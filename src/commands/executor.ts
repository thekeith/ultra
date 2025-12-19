/**
 * Command Executor
 *
 * Executes commands with validation hooks and source tracking.
 */

import { debugLog } from '../debug.ts';
import type { CommandRegistry } from './registry.ts';
import type { ContextProvider } from './context-provider.ts';
import type {
  Command,
  CommandContext,
  CommandResult,
  CommandSource,
  CommandWarning,
  AgentFeedback,
  ValidatorRegistry,
  AggregatedValidationResult,
  ValidationContext,
  Violation,
} from './types.ts';

export class CommandExecutor {
  constructor(
    private registry: CommandRegistry,
    private validators: ValidatorRegistry | null,
    private contextProvider: ContextProvider
  ) {}

  /**
   * Execute a command by ID with the given arguments.
   */
  async execute<TArgs, TResult>(
    commandId: string,
    args: TArgs,
    source: CommandSource
  ): Promise<CommandResult<TResult>> {
    debugLog(`[CommandExecutor] Executing: ${commandId} from ${source.type}`);

    // 1. Find command
    const command = this.registry.get(commandId);
    if (!command) {
      return {
        success: false,
        error: {
          code: 'UNKNOWN_COMMAND',
          message: `Command not found: ${commandId}`,
        },
      };
    }

    // 2. Build context
    let ctx: CommandContext;
    try {
      ctx = await this.contextProvider.buildContext(source, this.validators || undefined);
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CONTEXT_BUILD_ERROR',
          message: error instanceof Error ? error.message : 'Failed to build context',
        },
      };
    }

    // 3. Validate (for non-human sources, if validators present)
    if (source.type !== 'human' && this.validators?.hasValidators()) {
      const validationResult = await this.runValidation(command, args, ctx);
      if (validationResult) {
        return validationResult as CommandResult<TResult>;
      }
    }

    // 4. Execute
    try {
      const result = await command.handler(ctx, args);

      // Attach any validation warnings from metadata
      const warnings = ctx.metadata.get('validationWarnings') as CommandWarning[] | undefined;
      if (warnings?.length) {
        result.warnings = [...(result.warnings || []), ...warnings];
      }

      debugLog(`[CommandExecutor] ${commandId} completed: ${result.success ? 'success' : 'failure'}`);
      return result as CommandResult<TResult>;
    } catch (error) {
      debugLog(`[CommandExecutor] ${commandId} threw error: ${error}`);
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      };
    }
  }

  /**
   * Execute a command with human source (convenience method).
   */
  async executeFromHuman<TArgs, TResult>(
    commandId: string,
    args?: TArgs
  ): Promise<CommandResult<TResult>> {
    return this.execute(commandId, args as TArgs, { type: 'human' });
  }

  /**
   * Execute a command with internal source (convenience method).
   */
  async executeInternal<TArgs, TResult>(
    commandId: string,
    args?: TArgs
  ): Promise<CommandResult<TResult>> {
    return this.execute(commandId, args as TArgs, { type: 'internal' });
  }

  /**
   * Run validation for a command.
   * Returns a CommandResult if blocked, null if should proceed.
   */
  private async runValidation(
    command: Command,
    args: unknown,
    ctx: CommandContext
  ): Promise<CommandResult | null> {
    if (!this.validators) return null;

    const validationContext = this.buildValidationContext(ctx);

    // 1. Validate command itself
    const commandValidation = await this.validators.validateCommand(
      command.id,
      args,
      validationContext
    );

    if (!commandValidation.proceed) {
      await this.recordViolations(commandValidation.violations, ctx.source, command.id);

      return {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Command blocked by validator',
        },
        feedback: this.buildFeedback(commandValidation),
      };
    }

    // 2. For edit commands, validate content
    if (this.isEditCommand(command.id) && args && typeof args === 'object') {
      const editArgs = args as { path?: string; content?: string; text?: string };
      const content = editArgs.content || editArgs.text;
      const path = editArgs.path || ctx.editor?.activeBuffer?.path;

      if (content && path) {
        const contentValidation = await this.validators.validateContent(
          path,
          content,
          validationContext
        );

        if (!contentValidation.proceed) {
          await this.recordViolations(contentValidation.violations, ctx.source, command.id);

          return {
            success: false,
            error: {
              code: 'CONTENT_VALIDATION_FAILED',
              message: 'Content blocked by validator',
            },
            feedback: this.buildFeedback(contentValidation),
          };
        }

        // Store warnings for later
        if (contentValidation.warnings?.length) {
          ctx.metadata.set('validationWarnings', contentValidation.warnings);
        }
      }
    }

    // 3. For file operations, validate the operation
    if (this.isFileOperation(command.id) && args && typeof args === 'object') {
      const operation = this.getFileOperation(command.id);
      const paths = args as { path?: string; source?: string; target?: string; newPath?: string };

      const fileValidation = await this.validators.validateFileOperation(
        operation,
        {
          source: paths.path || paths.source,
          target: paths.newPath || paths.target,
        },
        validationContext
      );

      if (!fileValidation.proceed) {
        await this.recordViolations(fileValidation.violations, ctx.source, command.id);

        return {
          success: false,
          error: {
            code: 'FILE_OPERATION_VALIDATION_FAILED',
            message: 'File operation blocked by validator',
          },
          feedback: this.buildFeedback(fileValidation),
        };
      }
    }

    return null; // Proceed with execution
  }

  private buildValidationContext(ctx: CommandContext): ValidationContext {
    return {
      source: ctx.source,
      workspaceRoot: ctx.workspace.root,
      activeFile: ctx.editor?.activeBuffer?.path || undefined,
      selection: ctx.editor?.selection || undefined,
      getFileContent: (path) => ctx.services.fs.readFile(path),
    };
  }

  private buildFeedback(validation: AggregatedValidationResult): AgentFeedback {
    return {
      violations: validation.violations.map((v) => ({
        rule: v.rule,
        message: v.message,
        location: v.location,
        matchedContent: v.matchedContent,
      })),
      suggestions: validation.suggestions.map((s) => ({
        description: s.description,
        replacement: s.replacement,
        documentation: s.documentation,
      })),
      context: validation.feedbackContext
        ? { relevantDocs: [validation.feedbackContext] }
        : undefined,
    };
  }

  private async recordViolations(
    violations: Violation[] | undefined,
    source: CommandSource,
    command: string
  ): Promise<void> {
    if (!violations?.length || !this.validators) return;

    for (const v of violations) {
      await this.validators.recordViolation({
        agentId: source.agentId,
        sessionId: source.sessionId,
        timestamp: Date.now(),
        command,
        rule: v.rule,
        message: v.message,
        matchedContent: v.matchedContent,
      });
    }
  }

  private isEditCommand(commandId: string): boolean {
    const editCommands = [
      'ultra.edit',
      'ultra.insertText',
      'ultra.replaceText',
      'ultra.createFile',
    ];
    return editCommands.includes(commandId);
  }

  private isFileOperation(commandId: string): boolean {
    const fileOps = [
      'ultra.createFile',
      'ultra.deleteFile',
      'ultra.renameFile',
      'ultra.moveFile',
    ];
    return fileOps.includes(commandId);
  }

  private getFileOperation(commandId: string): 'create' | 'delete' | 'rename' | 'move' {
    const map: Record<string, 'create' | 'delete' | 'rename' | 'move'> = {
      'ultra.createFile': 'create',
      'ultra.deleteFile': 'delete',
      'ultra.renameFile': 'rename',
      'ultra.moveFile': 'move',
    };
    return map[commandId] || 'create';
  }
}

export default CommandExecutor;
