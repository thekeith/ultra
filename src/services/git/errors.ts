/**
 * Git Service Errors
 *
 * Error types for git operations.
 */

/**
 * Git error codes.
 */
export enum GitErrorCode {
  /** Path is not inside a git repository */
  NOT_A_REPO = 'NOT_A_REPO',
  /** Operation failed due to uncommitted changes */
  UNCOMMITTED_CHANGES = 'UNCOMMITTED_CHANGES',
  /** Merge has conflicts */
  MERGE_CONFLICT = 'MERGE_CONFLICT',
  /** Push was rejected by remote */
  PUSH_REJECTED = 'PUSH_REJECTED',
  /** Authentication failed */
  AUTHENTICATION_FAILED = 'AUTH_FAILED',
  /** Network error during remote operation */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** Branch not found */
  BRANCH_NOT_FOUND = 'BRANCH_NOT_FOUND',
  /** Branch already exists */
  BRANCH_EXISTS = 'BRANCH_EXISTS',
  /** File not found */
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  /** Stash not found */
  STASH_NOT_FOUND = 'STASH_NOT_FOUND',
  /** No stash entries */
  NO_STASH = 'NO_STASH',
  /** Nothing to commit */
  NOTHING_TO_COMMIT = 'NOTHING_TO_COMMIT',
  /** Invalid ref (commit, tag, branch) */
  INVALID_REF = 'INVALID_REF',
  /** Generic command failure */
  COMMAND_FAILED = 'COMMAND_FAILED',
}

/**
 * Git operation error.
 *
 * Thrown when a git operation fails. Contains structured error information
 * for proper error handling.
 */
export class GitError extends Error {
  override readonly name = 'GitError';

  constructor(
    /** Error code for programmatic handling */
    public readonly code: GitErrorCode,
    /** Repository URI where the error occurred */
    public readonly uri: string,
    /** Human-readable error message */
    message: string,
    /** Underlying error if any */
    public override readonly cause?: Error
  ) {
    super(message);
    // Maintain proper prototype chain
    Object.setPrototypeOf(this, GitError.prototype);
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
   * Create a MERGE_CONFLICT error.
   */
  static mergeConflict(uri: string, files: string[]): GitError {
    return new GitError(
      GitErrorCode.MERGE_CONFLICT,
      uri,
      `Merge conflicts in ${files.length} file(s): ${files.slice(0, 3).join(', ')}${files.length > 3 ? '...' : ''}`
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
   * Create a PUSH_REJECTED error.
   */
  static pushRejected(uri: string, reason?: string): GitError {
    return new GitError(
      GitErrorCode.PUSH_REJECTED,
      uri,
      reason ? `Push rejected: ${reason}` : 'Push rejected by remote'
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
  static networkError(uri: string, detail?: string): GitError {
    return new GitError(
      GitErrorCode.NETWORK_ERROR,
      uri,
      detail ? `Network error: ${detail}` : 'Network error during git operation'
    );
  }

  /**
   * Create a NOTHING_TO_COMMIT error.
   */
  static nothingToCommit(uri: string): GitError {
    return new GitError(
      GitErrorCode.NOTHING_TO_COMMIT,
      uri,
      'Nothing to commit, working tree clean'
    );
  }

  /**
   * Create a STASH_NOT_FOUND error.
   */
  static stashNotFound(uri: string, stashId: string): GitError {
    return new GitError(
      GitErrorCode.STASH_NOT_FOUND,
      uri,
      `Stash not found: ${stashId}`
    );
  }

  /**
   * Create a NO_STASH error.
   */
  static noStash(uri: string): GitError {
    return new GitError(
      GitErrorCode.NO_STASH,
      uri,
      'No stash entries'
    );
  }

  /**
   * Create an INVALID_REF error.
   */
  static invalidRef(uri: string, ref: string): GitError {
    return new GitError(
      GitErrorCode.INVALID_REF,
      uri,
      `Invalid ref: ${ref}`
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
   * Wrap an unknown error as a GitError.
   */
  static wrap(uri: string, error: unknown): GitError {
    if (error instanceof GitError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error ? error : undefined;

    // Try to detect specific error types from message
    if (message.includes('not a git repository')) {
      return GitError.notARepo(uri);
    }
    if (message.includes('CONFLICT') || message.includes('Merge conflict')) {
      return new GitError(GitErrorCode.MERGE_CONFLICT, uri, message, cause);
    }
    if (message.includes('rejected') && message.includes('push')) {
      return new GitError(GitErrorCode.PUSH_REJECTED, uri, message, cause);
    }
    if (message.includes('Authentication') || message.includes('Permission denied')) {
      return new GitError(GitErrorCode.AUTHENTICATION_FAILED, uri, message, cause);
    }
    if (message.includes('Could not resolve host') || message.includes('Connection refused')) {
      return new GitError(GitErrorCode.NETWORK_ERROR, uri, message, cause);
    }

    return new GitError(GitErrorCode.COMMAND_FAILED, uri, message, cause);
  }
}
