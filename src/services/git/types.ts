/**
 * Git Service Types
 *
 * Type definitions for git operations.
 */

/**
 * File status in git (index or working tree).
 */
export type GitFileStatusCode = 'A' | 'M' | 'D' | 'R' | 'C' | 'U' | '?';

/**
 * A file with git status.
 */
export interface GitFileStatus {
  /** Path relative to repository root */
  path: string;
  /** Status code */
  status: GitFileStatusCode;
  /** Original path for renames */
  oldPath?: string;
}

/**
 * Repository status.
 */
export interface GitStatus {
  /** Current branch name */
  branch: string;
  /** Commits ahead of upstream */
  ahead: number;
  /** Commits behind upstream */
  behind: number;
  /** Files staged for commit */
  staged: GitFileStatus[];
  /** Files with unstaged changes */
  unstaged: GitFileStatus[];
  /** Untracked files */
  untracked: string[];
}

/**
 * Branch information.
 */
export interface GitBranchInfo {
  /** Branch name */
  name: string;
  /** Tracking branch (e.g., "origin/main") */
  tracking?: string;
  /** Commits ahead of tracking branch */
  ahead: number;
  /** Commits behind tracking branch */
  behind: number;
}

/**
 * Branch details.
 */
export interface GitBranch {
  /** Branch name */
  name: string;
  /** Whether this is the current branch */
  current: boolean;
  /** Remote tracking branch */
  tracking?: string;
  /** Last commit hash */
  commit?: string;
}

/**
 * Commit information.
 */
export interface GitCommit {
  /** Full commit hash */
  hash: string;
  /** Short commit hash */
  shortHash: string;
  /** Commit message (first line) */
  message: string;
  /** Author name */
  author: string;
  /** Author email */
  email?: string;
  /** Commit date (ISO format) */
  date: string;
}

/**
 * Remote repository.
 */
export interface GitRemote {
  /** Remote name (e.g., "origin") */
  name: string;
  /** Fetch URL */
  fetchUrl: string;
  /** Push URL */
  pushUrl: string;
}

/**
 * Stash entry.
 */
export interface GitStash {
  /** Stash ID (e.g., "stash@{0}") */
  id: string;
  /** Stash index number */
  index: number;
  /** Branch the stash was created on */
  branch: string;
  /** Stash message */
  message: string;
}

/**
 * Blame information for a single line.
 */
export interface GitBlame {
  /** Commit hash (short) */
  commit: string;
  /** Author name */
  author: string;
  /** Commit date (ISO format) */
  date: string;
  /** Line number (1-based) */
  line: number;
  /** Line content */
  content: string;
}

/**
 * A line in a diff hunk.
 */
export interface DiffLine {
  /** Line type */
  type: 'context' | 'added' | 'deleted';
  /** Line content (without +/- prefix) */
  content: string;
  /** Line number in old file */
  oldLineNum?: number;
  /** Line number in new file */
  newLineNum?: number;
}

/**
 * A diff hunk (section of changes).
 */
export interface GitDiffHunk {
  /** Start line in old file */
  oldStart: number;
  /** Number of lines in old file */
  oldCount: number;
  /** Start line in new file */
  newStart: number;
  /** Number of lines in new file */
  newCount: number;
  /** Lines in this hunk */
  lines: DiffLine[];
}

/**
 * Line change indicator for gutter display.
 */
export interface GitLineChange {
  /** Line number (1-based) */
  line: number;
  /** Change type */
  type: 'added' | 'modified' | 'deleted';
}

/**
 * Result of a commit operation.
 */
export interface CommitResult {
  /** Whether the commit succeeded */
  success: boolean;
  /** Commit hash (if successful) */
  hash?: string;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Options for push operation.
 */
export interface PushOptions {
  /** Force push with lease (safer than --force) */
  forceWithLease?: boolean;
  /** Set upstream tracking */
  setUpstream?: boolean;
}

/**
 * Result of a push operation.
 */
export interface PushResult {
  /** Whether the push succeeded */
  success: boolean;
  /** Number of commits pushed */
  pushed?: number;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Result of a pull operation.
 */
export interface PullResult {
  /** Whether the pull succeeded */
  success: boolean;
  /** Number of commits pulled */
  pulled?: number;
  /** Whether files were changed */
  changed?: boolean;
  /** Whether there are conflicts */
  conflicts?: boolean;
  /** Conflicting files */
  conflictFiles?: string[];
  /** Error message (if failed) */
  error?: string;
}

/**
 * Result of a merge operation.
 */
export interface MergeResult {
  /** Whether the merge succeeded */
  success: boolean;
  /** Conflicting files (if any) */
  conflicts: string[];
  /** Result message */
  message: string;
}

/**
 * Git change event types.
 */
export type GitChangeType = 'status' | 'branch' | 'commit' | 'stash';

/**
 * Git change event.
 */
export interface GitChangeEvent {
  /** Repository URI */
  uri: string;
  /** Type of change */
  type: GitChangeType;
}

/**
 * Callback for git change events.
 */
export type GitChangeCallback = (event: GitChangeEvent) => void;

/**
 * Unsubscribe function.
 */
export type Unsubscribe = () => void;
