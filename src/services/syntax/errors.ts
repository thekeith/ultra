/**
 * Syntax Service Errors
 *
 * Error types for the Syntax Service.
 */

/**
 * Syntax error codes.
 */
export const SyntaxErrorCode = {
  /** Syntax service not ready */
  NOT_READY: 'NOT_READY',

  /** Language not supported */
  LANGUAGE_NOT_SUPPORTED: 'LANGUAGE_NOT_SUPPORTED',

  /** Theme not found */
  THEME_NOT_FOUND: 'THEME_NOT_FOUND',

  /** Session not found */
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',

  /** Parse error */
  PARSE_ERROR: 'PARSE_ERROR',

  /** Invalid line number */
  INVALID_LINE: 'INVALID_LINE',
} as const;

export type SyntaxErrorCode = (typeof SyntaxErrorCode)[keyof typeof SyntaxErrorCode];

/**
 * Syntax Service Error.
 */
export class SyntaxError extends Error {
  public readonly code: SyntaxErrorCode;
  public readonly data?: unknown;
  public override readonly cause?: Error;

  constructor(
    message: string,
    code: SyntaxErrorCode,
    options?: { data?: unknown; cause?: Error }
  ) {
    super(message);
    this.name = 'SyntaxError';
    this.code = code;
    this.data = options?.data;
    this.cause = options?.cause;
  }

  /**
   * Create a NOT_READY error.
   */
  static notReady(): SyntaxError {
    return new SyntaxError(
      'Syntax service is not ready',
      SyntaxErrorCode.NOT_READY
    );
  }

  /**
   * Create a LANGUAGE_NOT_SUPPORTED error.
   */
  static languageNotSupported(languageId: string): SyntaxError {
    return new SyntaxError(
      `Language not supported: ${languageId}`,
      SyntaxErrorCode.LANGUAGE_NOT_SUPPORTED,
      { data: { languageId } }
    );
  }

  /**
   * Create a THEME_NOT_FOUND error.
   */
  static themeNotFound(theme: string): SyntaxError {
    return new SyntaxError(
      `Theme not found: ${theme}`,
      SyntaxErrorCode.THEME_NOT_FOUND,
      { data: { theme } }
    );
  }

  /**
   * Create a SESSION_NOT_FOUND error.
   */
  static sessionNotFound(sessionId: string): SyntaxError {
    return new SyntaxError(
      `Syntax session not found: ${sessionId}`,
      SyntaxErrorCode.SESSION_NOT_FOUND,
      { data: { sessionId } }
    );
  }

  /**
   * Create a PARSE_ERROR error.
   */
  static parseError(reason: string, cause?: Error): SyntaxError {
    return new SyntaxError(
      `Parse error: ${reason}`,
      SyntaxErrorCode.PARSE_ERROR,
      { data: { reason }, cause }
    );
  }

  /**
   * Create an INVALID_LINE error.
   */
  static invalidLine(lineNumber: number, totalLines: number): SyntaxError {
    return new SyntaxError(
      `Invalid line number: ${lineNumber} (document has ${totalLines} lines)`,
      SyntaxErrorCode.INVALID_LINE,
      { data: { lineNumber, totalLines } }
    );
  }
}
