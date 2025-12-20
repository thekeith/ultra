/**
 * File Service Types
 *
 * Core type definitions for the File Service, which abstracts
 * file system access for local, remote, and virtual file systems.
 */

/**
 * File content with metadata.
 */
export interface FileContent {
  /** File content as string */
  content: string;

  /** Character encoding (default: utf-8) */
  encoding: string;

  /** Last modification time (Unix timestamp in ms) */
  modTime: number;

  /** File size in bytes */
  size: number;
}

/**
 * File/directory metadata.
 */
export interface FileStat {
  /** File URI */
  uri: string;

  /** Whether the file exists */
  exists: boolean;

  /** Whether this is a directory */
  isDirectory: boolean;

  /** Whether this is a regular file */
  isFile: boolean;

  /** Whether this is a symbolic link */
  isSymlink: boolean;

  /** File size in bytes (0 for directories) */
  size: number;

  /** Last modification time (Unix timestamp in ms) */
  modTime: number;

  /** Creation time (Unix timestamp in ms) */
  createTime: number;
}

/**
 * Type of file entry.
 */
export type FileEntryType = 'file' | 'directory' | 'symlink';

/**
 * A file or directory entry in a directory listing.
 */
export interface FileEntry {
  /** File/directory name (not full path) */
  name: string;

  /** Full URI */
  uri: string;

  /** Entry type */
  type: FileEntryType;

  /** File size in bytes (optional, may not be available for directories) */
  size?: number;

  /** Last modification time (optional) */
  modTime?: number;
}

/**
 * Options for writing a file.
 */
export interface WriteOptions {
  /** Character encoding (default: utf-8) */
  encoding?: string;

  /** Create parent directories if they don't exist */
  createParents?: boolean;

  /** Overwrite existing file (default: true) */
  overwrite?: boolean;
}

/**
 * Result of a write operation.
 */
export interface WriteResult {
  /** Whether the write succeeded */
  success: boolean;

  /** Modification time after write */
  modTime: number;

  /** Number of bytes written */
  bytesWritten: number;
}

/**
 * Options for creating a directory.
 */
export interface CreateDirOptions {
  /** Create parent directories if they don't exist */
  recursive?: boolean;
}

/**
 * Options for deleting a directory.
 */
export interface DeleteDirOptions {
  /** Delete directory contents recursively */
  recursive?: boolean;
}

/**
 * Options for file search.
 */
export interface SearchOptions {
  /** Maximum number of results */
  maxResults?: number;

  /** Patterns to exclude (glob patterns) */
  excludePatterns?: string[];

  /** Only search in these directories (URIs) */
  includePatterns?: string[];

  /** Case-sensitive matching */
  caseSensitive?: boolean;

  /** Search in file contents (not just names) */
  searchContent?: boolean;
}

/**
 * A search result.
 */
export interface SearchResult {
  /** File URI */
  uri: string;

  /** File name */
  name: string;

  /** Match score (higher is better) */
  score: number;

  /** Matching ranges in the file name */
  matches?: Array<{ start: number; end: number }>;
}

/**
 * Options for glob pattern matching.
 */
export interface GlobOptions {
  /** Base directory to search from (default: workspace root) */
  baseUri?: string;

  /** Maximum number of results */
  maxResults?: number;

  /** Patterns to exclude */
  excludePatterns?: string[];

  /** Follow symbolic links */
  followSymlinks?: boolean;

  /** Include directories in results */
  includeDirectories?: boolean;
}

/**
 * Options for file watching.
 */
export interface WatchOptions {
  /** Watch directory recursively */
  recursive?: boolean;

  /** Debounce delay in milliseconds */
  debounceMs?: number;

  /** Patterns to exclude from watching */
  excludePatterns?: string[];
}

/**
 * Type of file change event.
 */
export type FileChangeType = 'created' | 'changed' | 'deleted';

/**
 * File change event.
 */
export interface FileChangeEvent {
  /** File URI */
  uri: string;

  /** Type of change */
  type: FileChangeType;

  /** Timestamp of change */
  timestamp: number;
}

/**
 * Handle for a file watch subscription.
 */
export interface WatchHandle {
  /** Unique watch ID */
  id: string;

  /** URI being watched */
  uri: string;

  /** Stop watching */
  dispose(): void;
}

/**
 * Callback for file change events.
 */
export type WatchCallback = (event: FileChangeEvent) => void;

/**
 * Callback for file service events.
 */
export type FileChangeCallback = (event: FileChangeEvent) => void;

/**
 * Unsubscribe function returned by event subscriptions.
 */
export type Unsubscribe = () => void;
