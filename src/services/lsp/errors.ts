/**
 * LSP Service Errors
 *
 * Error types for the LSP Service.
 */

/**
 * LSP error codes.
 */
export const LSPErrorCode = {
  /** Server not found for language */
  SERVER_NOT_FOUND: 'SERVER_NOT_FOUND',

  /** Server failed to start */
  SERVER_START_FAILED: 'SERVER_START_FAILED',

  /** Server is not initialized */
  SERVER_NOT_INITIALIZED: 'SERVER_NOT_INITIALIZED',

  /** Server request timed out */
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',

  /** Server request failed */
  REQUEST_FAILED: 'REQUEST_FAILED',

  /** Document not open */
  DOCUMENT_NOT_OPEN: 'DOCUMENT_NOT_OPEN',

  /** Invalid URI */
  INVALID_URI: 'INVALID_URI',

  /** Invalid position */
  INVALID_POSITION: 'INVALID_POSITION',

  /** Feature not supported by server */
  NOT_SUPPORTED: 'NOT_SUPPORTED',

  /** LSP is disabled */
  DISABLED: 'DISABLED',
} as const;

export type LSPErrorCode = (typeof LSPErrorCode)[keyof typeof LSPErrorCode];

/**
 * LSP Service Error.
 */
export class LSPError extends Error {
  public readonly code: LSPErrorCode;
  public readonly data?: unknown;
  public override readonly cause?: Error;

  constructor(
    message: string,
    code: LSPErrorCode,
    options?: { data?: unknown; cause?: Error }
  ) {
    super(message);
    this.name = 'LSPError';
    this.code = code;
    this.data = options?.data;
    this.cause = options?.cause;
  }

  /**
   * Create a SERVER_NOT_FOUND error.
   */
  static serverNotFound(languageId: string): LSPError {
    return new LSPError(
      `No language server found for: ${languageId}`,
      LSPErrorCode.SERVER_NOT_FOUND,
      { data: { languageId } }
    );
  }

  /**
   * Create a SERVER_START_FAILED error.
   */
  static serverStartFailed(languageId: string, reason?: string): LSPError {
    return new LSPError(
      `Failed to start language server for ${languageId}${reason ? `: ${reason}` : ''}`,
      LSPErrorCode.SERVER_START_FAILED,
      { data: { languageId, reason } }
    );
  }

  /**
   * Create a SERVER_NOT_INITIALIZED error.
   */
  static serverNotInitialized(languageId: string): LSPError {
    return new LSPError(
      `Language server not initialized for: ${languageId}`,
      LSPErrorCode.SERVER_NOT_INITIALIZED,
      { data: { languageId } }
    );
  }

  /**
   * Create a REQUEST_TIMEOUT error.
   */
  static requestTimeout(method: string, timeoutMs: number): LSPError {
    return new LSPError(
      `LSP request '${method}' timed out after ${timeoutMs}ms`,
      LSPErrorCode.REQUEST_TIMEOUT,
      { data: { method, timeoutMs } }
    );
  }

  /**
   * Create a REQUEST_FAILED error.
   */
  static requestFailed(method: string, reason: string, cause?: Error): LSPError {
    return new LSPError(
      `LSP request '${method}' failed: ${reason}`,
      LSPErrorCode.REQUEST_FAILED,
      { data: { method, reason }, cause }
    );
  }

  /**
   * Create a DOCUMENT_NOT_OPEN error.
   */
  static documentNotOpen(uri: string): LSPError {
    return new LSPError(
      `Document not open: ${uri}`,
      LSPErrorCode.DOCUMENT_NOT_OPEN,
      { data: { uri } }
    );
  }

  /**
   * Create an INVALID_URI error.
   */
  static invalidUri(uri: string): LSPError {
    return new LSPError(
      `Invalid URI: ${uri}`,
      LSPErrorCode.INVALID_URI,
      { data: { uri } }
    );
  }

  /**
   * Create an INVALID_POSITION error.
   */
  static invalidPosition(line: number, character: number): LSPError {
    return new LSPError(
      `Invalid position: line ${line}, character ${character}`,
      LSPErrorCode.INVALID_POSITION,
      { data: { line, character } }
    );
  }

  /**
   * Create a NOT_SUPPORTED error.
   */
  static notSupported(feature: string, languageId: string): LSPError {
    return new LSPError(
      `Feature '${feature}' not supported by ${languageId} server`,
      LSPErrorCode.NOT_SUPPORTED,
      { data: { feature, languageId } }
    );
  }

  /**
   * Create a DISABLED error.
   */
  static disabled(): LSPError {
    return new LSPError(
      'LSP is disabled',
      LSPErrorCode.DISABLED
    );
  }
}
