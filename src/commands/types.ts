/**
 * Command Protocol - Core Type Definitions
 *
 * The Command Protocol is a unified API that exposes all editor functionality
 * through a single interface. Every action in Ultra - whether triggered by
 * keyboard shortcut, command palette, CLI, or external agent - flows through
 * this protocol.
 */

// ============================================
// Command Definition
// ============================================

/**
 * JSON Schema type for argument/return validation.
 * Using a simplified version to avoid external dependencies.
 */
export interface JSONSchema {
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  description?: string;
  enum?: unknown[];
  $ref?: string;
  additionalProperties?: boolean | JSONSchema;
}

/**
 * A command definition with typed arguments and result.
 */
export interface Command<TArgs = unknown, TResult = unknown> {
  /** Unique identifier (e.g., "ultra.openFile") */
  id: string;

  /** Human-readable title for command palette */
  title: string;

  /** Longer description */
  description?: string;

  /** Category for grouping in command palette */
  category?: string;

  /** JSON Schema for argument validation */
  args?: JSONSchema;

  /** JSON Schema for return type documentation */
  returns?: JSONSchema;

  /** Command implementation */
  handler: CommandHandler<TArgs, TResult>;

  /** Default keybinding (e.g., "ctrl+s") */
  keybinding?: string;

  /** Condition for when command is available (e.g., "editorFocus") */
  when?: string;

  /** Whether command is exposed to AI agents (default: true) */
  aiExposed?: boolean;
}

export type CommandHandler<TArgs, TResult> = (
  ctx: CommandContext,
  args: TArgs
) => Promise<CommandResult<TResult>>;

// ============================================
// Execution Context
// ============================================

/**
 * Context provided to command handlers during execution.
 */
export interface CommandContext {
  /** Who/what invoked this command */
  source: CommandSource;

  /** Current editor state */
  editor: EditorState | null;

  /** Workspace state */
  workspace: WorkspaceState;

  /** Available services */
  services: CommandServices;

  /** Validator registry (if validators loaded) */
  validators?: ValidatorRegistry;

  /** Arbitrary metadata (validators can attach info here) */
  metadata: Map<string, unknown>;
}

/**
 * Identifies the source of a command invocation.
 */
export interface CommandSource {
  /** Source type */
  type: 'human' | 'ai' | 'cli' | 'ipc' | 'internal' | 'extension';

  /** Identifier for AI agent (for tracking) */
  agentId?: string;

  /** Session identifier (for tracking) */
  sessionId?: string;

  /** Extension identifier (if from extension) */
  extensionId?: string;
}

/**
 * Current editor state snapshot.
 */
export interface EditorState {
  activeBuffer: {
    path: string | null;
    content: string;
    language: string;
    isDirty: boolean;
    version: number;
  } | null;

  cursor: Position | null;
  selection: Selection | null;
  selections: Selection[]; // Multi-cursor
  visibleRange: Range | null;
}

/**
 * Workspace state.
 */
export interface WorkspaceState {
  root: string;
  openFiles: Array<{ path: string | null; isDirty: boolean }>;
}

/**
 * Services available to command handlers.
 */
export interface CommandServices {
  git: GitService;
  lsp: LSPService;
  ui: UIService;
  fs: FileSystemService;
}

// ============================================
// Service Interfaces
// ============================================

export interface GitService {
  getStatus(): Promise<GitStatus>;
  stage(path?: string): Promise<void>;
  unstage(path?: string): Promise<void>;
  commit(message: string): Promise<void>;
  getBranch(): Promise<string | null>;
  getDiff(path?: string): Promise<string>;
}

export interface GitStatus {
  branch: string | null;
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

export interface LSPService {
  getDiagnostics(path?: string): Promise<Diagnostic[]>;
  getHover(path: string, position: Position): Promise<string | null>;
  getCompletions(path: string, position: Position): Promise<CompletionItem[]>;
  getDefinition(path: string, position: Position): Promise<Location | null>;
  getReferences(path: string, position: Position): Promise<Location[]>;
}

export interface Diagnostic {
  range: Range;
  message: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  source?: string;
  code?: string | number;
}

export interface CompletionItem {
  label: string;
  kind?: string;
  detail?: string;
  insertText?: string;
}

export interface UIService {
  showMessage(message: string, timeout?: number): void;
  showProgress(options: { message: string; step?: number; totalSteps?: number }): void;
  showConfirm(message: string): Promise<boolean>;
  showInput(options: { title: string; placeholder?: string; value?: string }): Promise<string | null>;
  scheduleRender(): void;
}

export interface FileSystemService {
  readFile(path: string): Promise<string | null>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  delete(path: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  glob(pattern: string): Promise<string[]>;
  stat(path: string): Promise<{ isFile: boolean; isDirectory: boolean; size: number } | null>;
}

// ============================================
// Command Results
// ============================================

/**
 * Result of command execution.
 */
export interface CommandResult<T = unknown> {
  /** Whether command succeeded */
  success: boolean;

  /** Result data (if successful) */
  data?: T;

  /** Error info (if failed) */
  error?: CommandError;

  /** Warnings (even on success) */
  warnings?: CommandWarning[];

  /** Structured feedback for AI agents */
  feedback?: AgentFeedback;
}

/**
 * Error information for failed commands.
 */
export interface CommandError {
  /** Error code (e.g., "FILE_NOT_FOUND", "VALIDATION_FAILED") */
  code: string;

  /** Human-readable message */
  message: string;

  /** Additional error details */
  details?: unknown;
}

/**
 * Warning information.
 */
export interface CommandWarning {
  code: string;
  message: string;
  location?: Location;
}

// ============================================
// AI Agent Feedback
// ============================================

/**
 * Structured feedback for AI agents to learn from errors.
 */
export interface AgentFeedback {
  /** What rules were violated */
  violations?: Array<{
    rule: string;
    message: string;
    location?: Location;
    matchedContent?: string;
  }>;

  /** How to fix violations */
  suggestions?: Array<{
    description: string;
    replacement?: string;
    import?: string;
    documentation?: string[];
  }>;

  /** Additional context for the agent */
  context?: {
    relevantDocs?: string[];
    examples?: string[];
  };

  /** Number of prior violations this session (for repeated issues) */
  priorViolationCount?: number;
}

// ============================================
// Common Types
// ============================================

/**
 * A position in a document (0-indexed).
 */
export interface Position {
  line: number;
  column: number;
}

/**
 * A range in a document.
 */
export interface Range {
  start: Position;
  end: Position;
}

/**
 * A selection in a document.
 */
export interface Selection {
  range: Range;
  isReversed: boolean;
}

/**
 * A location in a file.
 */
export interface Location {
  path: string;
  range: Range;
}

// ============================================
// Validator Types (forward declarations)
// ============================================

/**
 * Forward declaration for ValidatorRegistry.
 * Full implementation in validator-registry.ts
 */
export interface ValidatorRegistry {
  hasValidators(): boolean;
  validateCommand(
    command: string,
    args: unknown,
    context: ValidationContext
  ): Promise<AggregatedValidationResult>;
  validateContent(
    path: string,
    content: string,
    context: ValidationContext
  ): Promise<AggregatedValidationResult>;
  validateFileOperation(
    operation: 'create' | 'delete' | 'rename' | 'move',
    paths: { source?: string; target?: string },
    context: ValidationContext
  ): Promise<AggregatedValidationResult>;
  getContextForFiles(paths: string[]): Promise<ValidatorProvidedContext>;
  recordViolation(violation: RecordedViolation): Promise<void>;
}

export interface ValidationContext {
  source: CommandSource;
  workspaceRoot: string;
  activeFile?: string;
  selection?: Selection;
  getFileContent: (path: string) => Promise<string | null>;
  getAST?: (path: string) => Promise<unknown>;
}

export interface AggregatedValidationResult {
  proceed: boolean;
  violations: Violation[];
  suggestions: Suggestion[];
  warnings: Warning[];
  feedbackContext: string;
}

export interface Violation {
  rule: string;
  message: string;
  severity: 'error' | 'warning';
  location?: Location;
  matchedContent?: string;
}

export interface Suggestion {
  description: string;
  replacement?: string;
  import?: string;
  documentation?: string[];
}

export interface Warning {
  code: string;
  message: string;
}

export interface ValidatorProvidedContext {
  /** Guidelines/rules for AI to follow */
  guidelines?: string;

  /** File-specific context */
  fileContext?: Record<string, string>;

  /** Recent violations by this agent */
  recentViolations?: string;
}

export interface RecordedViolation {
  agentId?: string;
  sessionId?: string;
  timestamp: number;
  command: string;
  rule: string;
  message: string;
  file?: string;
  matchedContent?: string;
}
