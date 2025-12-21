/**
 * Git Service
 *
 * Provides version control operations using Git CLI.
 */

// Types
export type {
  GitStatus,
  GitFileStatus,
  GitFileStatusCode,
  GitBranchInfo,
  GitBranch,
  GitCommit,
  GitRemote,
  GitStash,
  GitBlame,
  DiffLine,
  GitDiffHunk,
  GitLineChange,
  CommitResult,
  PushOptions,
  PushResult,
  PullResult,
  MergeResult,
  GitChangeType,
  GitChangeEvent,
  GitChangeCallback,
  Unsubscribe,
} from './types.ts';

// Errors
export { GitError, GitErrorCode } from './errors.ts';

// Interface
export type { GitService } from './interface.ts';

// Implementation
export { GitCliService, gitCliService } from './cli.ts';

// Adapter
export { GitServiceAdapter } from './adapter.ts';
