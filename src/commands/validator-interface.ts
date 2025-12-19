/**
 * Validator Plugin Interface
 *
 * External validators (like COR) implement this interface.
 * Ultra calls these hooks but does not implement validation logic itself.
 */

import type {
  CommandSource,
  Selection,
  Location,
  ValidatorProvidedContext,
  RecordedViolation,
} from './types.ts';

// ============================================
// Validator Plugin Interface
// ============================================

/**
 * Interface for external validator plugins.
 * Ultra calls these hooks; validators decide what to enforce.
 */
export interface ValidatorPlugin {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Called when plugin is loaded */
  initialize?(ctx: ValidatorContext): Promise<void>;

  /** Called when plugin is unloaded */
  dispose?(): Promise<void>;

  /**
   * Validate a command before execution.
   * Return { proceed: false } to block.
   */
  validateCommand?(
    command: string,
    args: unknown,
    context: ValidationContext
  ): Promise<ValidationResult>;

  /**
   * Validate content before it's written.
   * Called for edit/create operations.
   */
  validateContent?(
    path: string,
    content: string,
    context: ValidationContext
  ): Promise<ContentValidationResult>;

  /**
   * Validate file operations (create, delete, rename, move).
   */
  validateFileOperation?(
    operation: 'create' | 'delete' | 'rename' | 'move',
    paths: { source?: string; target?: string },
    context: ValidationContext
  ): Promise<ValidationResult>;

  /**
   * Get context to provide to AI before it works on files.
   * Validators can inject guidelines, rules, recent violations, etc.
   */
  getContextForFiles?(paths: string[]): Promise<ValidatorProvidedContext>;

  /**
   * Record a violation for tracking/learning.
   */
  recordViolation?(violation: RecordedViolation): Promise<void>;
}

// ============================================
// Validation Types
// ============================================

/**
 * Context provided when a validator plugin is initialized.
 */
export interface ValidatorContext {
  workspaceRoot: string;
  getFileContent: (path: string) => Promise<string | null>;
  listFiles: (glob: string) => Promise<string[]>;
}

/**
 * Context provided during validation.
 */
export interface ValidationContext {
  source: CommandSource;
  workspaceRoot: string;
  activeFile?: string;
  selection?: Selection;
  getFileContent: (path: string) => Promise<string | null>;
  getAST?: (path: string) => Promise<unknown>;
}

/**
 * Result of validation.
 */
export interface ValidationResult {
  /** Whether to proceed with execution */
  proceed: boolean;

  /** Rule violations (if blocked) */
  violations?: Violation[];

  /** How to fix violations */
  suggestions?: Suggestion[];

  /** Warnings (even if proceeding) */
  warnings?: Warning[];

  /** Additional context for AI feedback */
  feedbackContext?: string;
}

/**
 * Result of content validation with line-specific info.
 */
export interface ContentValidationResult extends ValidationResult {
  /** Line-specific violations */
  lineViolations?: Array<{
    line: number;
    column?: number;
    length?: number;
    rule: string;
    message: string;
  }>;
}

/**
 * A rule violation.
 */
export interface Violation {
  rule: string;
  message: string;
  severity: 'error' | 'warning';
  location?: Location;
  matchedContent?: string;
}

/**
 * A suggestion for fixing a violation.
 */
export interface Suggestion {
  description: string;
  replacement?: string;
  import?: string;
  documentation?: string[];
}

/**
 * A warning.
 */
export interface Warning {
  code: string;
  message: string;
}
