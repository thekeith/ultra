/**
 * Validator Registry
 *
 * Manages validator plugins and aggregates their results.
 */

import { debugLog } from '../debug.ts';
import type {
  ValidatorPlugin,
  ValidatorContext,
  ValidationContext,
  ValidationResult,
  ContentValidationResult,
  Violation,
  Suggestion,
  Warning,
} from './validator-interface.ts';
import type {
  ValidatorProvidedContext,
  RecordedViolation,
  FileSystemService,
} from './types.ts';

/**
 * Aggregated result from all validators.
 */
export interface AggregatedValidationResult {
  proceed: boolean;
  violations: Violation[];
  suggestions: Suggestion[];
  warnings: Warning[];
  feedbackContext: string;
}

/**
 * Registry for managing validator plugins.
 */
export class ValidatorRegistry {
  private validators = new Map<string, ValidatorPlugin>();
  private context: ValidatorContext;

  constructor(workspaceRoot: string, fs: FileSystemService) {
    this.context = {
      workspaceRoot,
      getFileContent: (path) => fs.readFile(path),
      listFiles: (glob) => fs.glob(glob),
    };
  }

  /**
   * Register a validator plugin.
   */
  async register(plugin: ValidatorPlugin): Promise<void> {
    debugLog(`[ValidatorRegistry] Registering validator: ${plugin.id}`);
    if (plugin.initialize) {
      await plugin.initialize(this.context);
    }
    this.validators.set(plugin.id, plugin);
  }

  /**
   * Unregister a validator plugin.
   */
  async unregister(id: string): Promise<void> {
    const plugin = this.validators.get(id);
    if (plugin?.dispose) {
      await plugin.dispose();
    }
    this.validators.delete(id);
    debugLog(`[ValidatorRegistry] Unregistered validator: ${id}`);
  }

  /**
   * Check if any validators are registered.
   */
  hasValidators(): boolean {
    return this.validators.size > 0;
  }

  /**
   * Get all registered validators.
   */
  getValidators(): ValidatorPlugin[] {
    return Array.from(this.validators.values());
  }

  /**
   * Validate a command across all validators.
   */
  async validateCommand(
    command: string,
    args: unknown,
    context: ValidationContext
  ): Promise<AggregatedValidationResult> {
    const results: ValidationResult[] = [];

    for (const plugin of this.validators.values()) {
      if (plugin.validateCommand) {
        try {
          const result = await plugin.validateCommand(command, args, context);
          results.push(result);
        } catch (error) {
          debugLog(`[ValidatorRegistry] Validator ${plugin.id} error: ${error}`);
        }
      }
    }

    return this.aggregateResults(results);
  }

  /**
   * Validate content across all validators.
   */
  async validateContent(
    path: string,
    content: string,
    context: ValidationContext
  ): Promise<AggregatedValidationResult> {
    const results: ContentValidationResult[] = [];

    for (const plugin of this.validators.values()) {
      if (plugin.validateContent) {
        try {
          const result = await plugin.validateContent(path, content, context);
          results.push(result);
        } catch (error) {
          debugLog(`[ValidatorRegistry] Validator ${plugin.id} error: ${error}`);
        }
      }
    }

    return this.aggregateResults(results);
  }

  /**
   * Validate a file operation across all validators.
   */
  async validateFileOperation(
    operation: 'create' | 'delete' | 'rename' | 'move',
    paths: { source?: string; target?: string },
    context: ValidationContext
  ): Promise<AggregatedValidationResult> {
    const results: ValidationResult[] = [];

    for (const plugin of this.validators.values()) {
      if (plugin.validateFileOperation) {
        try {
          const result = await plugin.validateFileOperation(operation, paths, context);
          results.push(result);
        } catch (error) {
          debugLog(`[ValidatorRegistry] Validator ${plugin.id} error: ${error}`);
        }
      }
    }

    return this.aggregateResults(results);
  }

  /**
   * Get context from all validators for specific files.
   */
  async getContextForFiles(paths: string[]): Promise<ValidatorProvidedContext> {
    const contexts: ValidatorProvidedContext[] = [];

    for (const plugin of this.validators.values()) {
      if (plugin.getContextForFiles) {
        try {
          const ctx = await plugin.getContextForFiles(paths);
          contexts.push(ctx);
        } catch (error) {
          debugLog(`[ValidatorRegistry] Validator ${plugin.id} error: ${error}`);
        }
      }
    }

    // Merge all contexts
    return {
      guidelines: contexts
        .map((c) => c.guidelines)
        .filter(Boolean)
        .join('\n\n---\n\n'),
      fileContext: Object.assign({}, ...contexts.map((c) => c.fileContext || {})),
      recentViolations: contexts
        .map((c) => c.recentViolations)
        .filter(Boolean)
        .join('\n'),
    };
  }

  /**
   * Record a violation across all validators.
   */
  async recordViolation(violation: RecordedViolation): Promise<void> {
    for (const plugin of this.validators.values()) {
      if (plugin.recordViolation) {
        try {
          await plugin.recordViolation(violation);
        } catch (error) {
          debugLog(`[ValidatorRegistry] Validator ${plugin.id} error: ${error}`);
        }
      }
    }
  }

  /**
   * Aggregate results from multiple validators.
   */
  private aggregateResults(results: ValidationResult[]): AggregatedValidationResult {
    // Block if ANY validator says don't proceed
    const proceed = results.every((r) => r.proceed);

    return {
      proceed,
      violations: results.flatMap((r) => r.violations || []),
      suggestions: results.flatMap((r) => r.suggestions || []),
      warnings: results.flatMap((r) => r.warnings || []),
      feedbackContext: results
        .map((r) => r.feedbackContext)
        .filter(Boolean)
        .join('\n\n'),
    };
  }
}

export default ValidatorRegistry;
