/**
 * Git Service
 *
 * Version control operations for git repositories.
 */

// Types
export type {
  GitFileStatusCode,
  GitFileStatus,
  GitStatus,
  GitBranch,
  GitBranchInfo,
  GitCommit,
  GitRemote,
  GitStash,
  GitBlame,
  DiffLineType,
  DiffLine,
  GitDiffHunk,
  GitLineChangeType,
  GitLineChange,
  CommitResult,
  PushResult,
  PullResult,
  MergeResult,
  PushOptions,
  GitChangeType,
  GitChangeEvent,
  GitChangeCallback,
  Unsubscribe,
} from './types.ts';

// Errors
export { GitErrorCode, GitError } from './errors.ts';

// Interface
export type { GitService } from './interface.ts';

// Implementation
export { GitCliService, gitCliService } from './cli.ts';

// Adapter
export { GitServiceAdapter } from './adapter.ts';
