/**
 * Git Service Errors
 *
 * Error types for git operations.
 */

/**
 * Error codes for git operations.
 */
export enum GitErrorCode {
  /** Path is not a git repository */
  NOT_A_REPO = 'NOT_A_REPO',

  /** Operation requires a clean working tree */
  UNCOMMITTED_CHANGES = 'UNCOMMITTED_CHANGES',

  /** Merge conflict detected */
  MERGE_CONFLICT = 'MERGE_CONFLICT',

  /** Push was rejected by remote */
  PUSH_REJECTED = 'PUSH_REJECTED',

  /** Authentication failed */
  AUTHENTICATION_FAILED = 'AUTH_FAILED',

  /** Network error (couldn't reach remote) */
  NETWORK_ERROR = 'NETWORK_ERROR',

  /** Branch not found */
  BRANCH_NOT_FOUND = 'BRANCH_NOT_FOUND',

  /** Branch already exists */
  BRANCH_EXISTS = 'BRANCH_EXISTS',

  /** Remote not found */
  REMOTE_NOT_FOUND = 'REMOTE_NOT_FOUND',

  /** No upstream tracking branch */
  NO_UPSTREAM = 'NO_UPSTREAM',

  /** Ref (commit, tag, branch) not found */
  REF_NOT_FOUND = 'REF_NOT_FOUND',

  /** File not found in tree */
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',

  /** Invalid argument */
  INVALID_ARGUMENT = 'INVALID_ARGUMENT',

  /** Git command failed */
  COMMAND_FAILED = 'COMMAND_FAILED',

  /** Unknown error */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Error thrown by git operations.
 */
export class GitError extends Error {
  constructor(
    /** Error code */
    public readonly code: GitErrorCode,
    /** Repository URI */
    public readonly uri: string,
    /** Human-readable message */
    message: string,
    /** Underlying error, if any */
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'GitError';
  }

  /**
   * Create a NOT_A_REPO error.
   */
  static notARepo(uri: string): GitError {
    return new GitError(
      GitErrorCode.NOT_A_REPO,
      uri,
      `Not a git repository: ${uri}`
    );
  }

  /**
   * Create an UNCOMMITTED_CHANGES error.
   */
  static uncommittedChanges(uri: string, message?: string): GitError {
    return new GitError(
      GitErrorCode.UNCOMMITTED_CHANGES,
      uri,
      message ?? 'You have uncommitted changes'
    );
  }

  /**
   * Create a MERGE_CONFLICT error.
   */
  static mergeConflict(uri: string, files: string[]): GitError {
    return new GitError(
      GitErrorCode.MERGE_CONFLICT,
      uri,
      `Merge conflict in ${files.length} file(s): ${files.slice(0, 3).join(', ')}${files.length > 3 ? '...' : ''}`
    );
  }

  /**
   * Create a PUSH_REJECTED error.
   */
  static pushRejected(uri: string, message?: string): GitError {
    return new GitError(
      GitErrorCode.PUSH_REJECTED,
      uri,
      message ?? 'Push rejected - pull first or use force push'
    );
  }

  /**
   * Create an AUTHENTICATION_FAILED error.
   */
  static authFailed(uri: string): GitError {
    return new GitError(
      GitErrorCode.AUTHENTICATION_FAILED,
      uri,
      'Authentication failed'
    );
  }

  /**
   * Create a NETWORK_ERROR error.
   */
  static networkError(uri: string, message?: string): GitError {
    return new GitError(
      GitErrorCode.NETWORK_ERROR,
      uri,
      message ?? 'Network error - check your connection'
    );
  }

  /**
   * Create a BRANCH_NOT_FOUND error.
   */
  static branchNotFound(uri: string, branch: string): GitError {
    return new GitError(
      GitErrorCode.BRANCH_NOT_FOUND,
      uri,
      `Branch not found: ${branch}`
    );
  }

  /**
   * Create a BRANCH_EXISTS error.
   */
  static branchExists(uri: string, branch: string): GitError {
    return new GitError(
      GitErrorCode.BRANCH_EXISTS,
      uri,
      `Branch already exists: ${branch}`
    );
  }

  /**
   * Create a REMOTE_NOT_FOUND error.
   */
  static remoteNotFound(uri: string, remote: string): GitError {
    return new GitError(
      GitErrorCode.REMOTE_NOT_FOUND,
      uri,
      `Remote not found: ${remote}`
    );
  }

  /**
   * Create a NO_UPSTREAM error.
   */
  static noUpstream(uri: string): GitError {
    return new GitError(
      GitErrorCode.NO_UPSTREAM,
      uri,
      'No upstream branch configured'
    );
  }

  /**
   * Create a REF_NOT_FOUND error.
   */
  static refNotFound(uri: string, ref: string): GitError {
    return new GitError(
      GitErrorCode.REF_NOT_FOUND,
      uri,
      `Ref not found: ${ref}`
    );
  }

  /**
   * Create a FILE_NOT_FOUND error.
   */
  static fileNotFound(uri: string, path: string): GitError {
    return new GitError(
      GitErrorCode.FILE_NOT_FOUND,
      uri,
      `File not found: ${path}`
    );
  }

  /**
   * Create an INVALID_ARGUMENT error.
   */
  static invalidArgument(uri: string, message: string): GitError {
    return new GitError(
      GitErrorCode.INVALID_ARGUMENT,
      uri,
      message
    );
  }

  /**
   * Create a COMMAND_FAILED error.
   */
  static commandFailed(uri: string, command: string, stderr: string): GitError {
    return new GitError(
      GitErrorCode.COMMAND_FAILED,
      uri,
      `Git command failed: ${command}\n${stderr}`
    );
  }

  /**
   * Create an UNKNOWN error.
   */
  static unknown(uri: string, message: string, cause?: Error): GitError {
    return new GitError(
      GitErrorCode.UNKNOWN,
      uri,
      message,
      cause
    );
  }

  /**
   * Wrap an unknown error as a GitError.
   */
  static wrap(uri: string, error: unknown): GitError {
    if (error instanceof GitError) {
      return error;
    }

    const cause = error instanceof Error ? error : undefined;
    const message = error instanceof Error ? error.message : String(error);

    // Try to detect error type from message
    if (message.includes('not a git repository')) {
      return GitError.notARepo(uri);
    }
    if (message.includes('Authentication failed') || message.includes('could not read Username')) {
      return GitError.authFailed(uri);
    }
    if (message.includes('fatal: Could not read from remote') || message.includes('Connection refused')) {
      return GitError.networkError(uri, message);
    }
    if (message.includes('[rejected]') || message.includes('non-fast-forward')) {
      return GitError.pushRejected(uri, message);
    }

    return GitError.unknown(uri, message, cause);
  }
}
