/**
 * Git Service Types
 *
 * Type definitions for git operations.
 */

/**
 * File status codes in git.
 */
export type GitFileStatusCode = 'A' | 'M' | 'D' | 'R' | 'C' | 'U' | '?';

/**
 * Status of a single file.
 */
export interface GitFileStatus {
  /** Relative path to file */
  path: string;
  /** Status code */
  status: GitFileStatusCode;
  /** Original path (for renames) */
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
  /** Staged file changes */
  staged: GitFileStatus[];
  /** Unstaged file changes */
  unstaged: GitFileStatus[];
  /** Untracked files */
  untracked: string[];
}

/**
 * Branch information.
 */
export interface GitBranch {
  /** Branch name */
  name: string;
  /** Whether this is the current branch */
  current: boolean;
  /** Tracking remote branch (e.g., "origin/main") */
  tracking?: string;
  /** Commits ahead of tracking */
  ahead?: number;
  /** Commits behind tracking */
  behind?: number;
}

/**
 * Detailed branch info for current branch.
 */
export interface GitBranchInfo {
  /** Branch name */
  branch: string;
  /** Tracking remote branch */
  tracking?: string;
  /** Commits ahead of tracking */
  ahead: number;
  /** Commits behind tracking */
  behind: number;
}

/**
 * Commit information.
 */
export interface GitCommit {
  /** Full commit hash */
  hash: string;
  /** Short hash (8 chars) */
  shortHash: string;
  /** Commit message */
  message: string;
  /** Author name */
  author: string;
  /** Author email */
  email?: string;
  /** Commit date (ISO format) */
  date: string;
}

/**
 * Remote repository information.
 */
export interface GitRemote {
  /** Remote name (e.g., "origin") */
  name: string;
  /** Fetch URL */
  fetchUrl?: string;
  /** Push URL */
  pushUrl?: string;
}

/**
 * Stash entry.
 */
export interface GitStash {
  /** Stash index (e.g., "stash@{0}") */
  id: string;
  /** Branch the stash was created on */
  branch: string;
  /** Stash message */
  message: string;
  /** When stash was created */
  date?: string;
}

/**
 * Blame information for a line.
 */
export interface GitBlame {
  /** Short commit hash */
  commit: string;
  /** Author name */
  author: string;
  /** Commit date */
  date: string;
  /** Line number (1-based) */
  line: number;
  /** Line content */
  content: string;
}

/**
 * Diff line types.
 */
export type DiffLineType = 'context' | 'added' | 'deleted';

/**
 * A single line in a diff.
 */
export interface DiffLine {
  /** Line type */
  type: DiffLineType;
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
  /** Lines in the hunk */
  lines: DiffLine[];
}

/**
 * Line change type for gutter indicators.
 */
export type GitLineChangeType = 'added' | 'modified' | 'deleted';

/**
 * Line change for gutter indicators.
 */
export interface GitLineChange {
  /** Line number (1-based) */
  line: number;
  /** Change type */
  type: GitLineChangeType;
}

/**
 * Result of a commit operation.
 */
export interface CommitResult {
  /** Whether commit succeeded */
  success: boolean;
  /** Commit hash if successful */
  hash?: string;
  /** Error message if failed */
  message?: string;
}

/**
 * Result of a push operation.
 */
export interface PushResult {
  /** Whether push succeeded */
  success: boolean;
  /** Error message if failed */
  message?: string;
  /** Whether push was rejected */
  rejected?: boolean;
}

/**
 * Result of a pull operation.
 */
export interface PullResult {
  /** Whether pull succeeded */
  success: boolean;
  /** Error message if failed */
  message?: string;
  /** Files updated */
  filesChanged?: number;
  /** Insertions */
  insertions?: number;
  /** Deletions */
  deletions?: number;
  /** Whether there are conflicts */
  conflicts?: string[];
}

/**
 * Result of a merge operation.
 */
export interface MergeResult {
  /** Whether merge succeeded */
  success: boolean;
  /** Conflicting files if any */
  conflicts: string[];
  /** Status message */
  message: string;
}

/**
 * Options for push operation.
 */
export interface PushOptions {
  /** Force push with lease (safer force push) */
  forceWithLease?: boolean;
  /** Set upstream tracking */
  setUpstream?: boolean;
}

/**
 * Git change event type.
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
