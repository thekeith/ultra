/**
 * Terminal Service Errors
 *
 * Error types for the Terminal Service.
 */

/**
 * Terminal error codes.
 */
export const TerminalErrorCode = {
  /** Terminal not found */
  TERMINAL_NOT_FOUND: 'TERMINAL_NOT_FOUND',

  /** Terminal already exists */
  TERMINAL_EXISTS: 'TERMINAL_EXISTS',

  /** Failed to start terminal */
  START_FAILED: 'START_FAILED',

  /** Terminal not running */
  NOT_RUNNING: 'NOT_RUNNING',

  /** Invalid dimensions */
  INVALID_DIMENSIONS: 'INVALID_DIMENSIONS',

  /** Shell not found */
  SHELL_NOT_FOUND: 'SHELL_NOT_FOUND',

  /** Write failed */
  WRITE_FAILED: 'WRITE_FAILED',
} as const;

export type TerminalErrorCode = (typeof TerminalErrorCode)[keyof typeof TerminalErrorCode];

/**
 * Terminal Service Error.
 */
export class TerminalError extends Error {
  public readonly code: TerminalErrorCode;
  public readonly data?: unknown;
  public override readonly cause?: Error;

  constructor(
    message: string,
    code: TerminalErrorCode,
    options?: { data?: unknown; cause?: Error }
  ) {
    super(message);
    this.name = 'TerminalError';
    this.code = code;
    this.data = options?.data;
    this.cause = options?.cause;
  }

  /**
   * Create a TERMINAL_NOT_FOUND error.
   */
  static terminalNotFound(terminalId: string): TerminalError {
    return new TerminalError(
      `Terminal not found: ${terminalId}`,
      TerminalErrorCode.TERMINAL_NOT_FOUND,
      { data: { terminalId } }
    );
  }

  /**
   * Create a TERMINAL_EXISTS error.
   */
  static terminalExists(terminalId: string): TerminalError {
    return new TerminalError(
      `Terminal already exists: ${terminalId}`,
      TerminalErrorCode.TERMINAL_EXISTS,
      { data: { terminalId } }
    );
  }

  /**
   * Create a START_FAILED error.
   */
  static startFailed(reason: string, cause?: Error): TerminalError {
    return new TerminalError(
      `Failed to start terminal: ${reason}`,
      TerminalErrorCode.START_FAILED,
      { data: { reason }, cause }
    );
  }

  /**
   * Create a NOT_RUNNING error.
   */
  static notRunning(terminalId: string): TerminalError {
    return new TerminalError(
      `Terminal is not running: ${terminalId}`,
      TerminalErrorCode.NOT_RUNNING,
      { data: { terminalId } }
    );
  }

  /**
   * Create an INVALID_DIMENSIONS error.
   */
  static invalidDimensions(cols: number, rows: number): TerminalError {
    return new TerminalError(
      `Invalid terminal dimensions: ${cols}x${rows}`,
      TerminalErrorCode.INVALID_DIMENSIONS,
      { data: { cols, rows } }
    );
  }

  /**
   * Create a SHELL_NOT_FOUND error.
   */
  static shellNotFound(shell: string): TerminalError {
    return new TerminalError(
      `Shell not found: ${shell}`,
      TerminalErrorCode.SHELL_NOT_FOUND,
      { data: { shell } }
    );
  }

  /**
   * Create a WRITE_FAILED error.
   */
  static writeFailed(terminalId: string, reason: string): TerminalError {
    return new TerminalError(
      `Failed to write to terminal ${terminalId}: ${reason}`,
      TerminalErrorCode.WRITE_FAILED,
      { data: { terminalId, reason } }
    );
  }
}
