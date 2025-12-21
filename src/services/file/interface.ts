/**
 * File Service Interface
 *
 * The File Service abstracts file system access, enabling Ultra to work
 * with local files, SSH, FTP, cloud storage, and other backends through
 * a unified interface.
 *
 * All file references use URIs:
 * - Local: file:///home/user/project/src/app.ts
 * - SSH: ssh://user@host/path/to/file.ts (future)
 * - S3: s3://bucket/path/to/file.ts (future)
 */

import type {
  FileContent,
  FileStat,
  FileEntry,
  WriteOptions,
  WriteResult,
  CreateDirOptions,
  DeleteDirOptions,
  SearchOptions,
  SearchResult,
  GlobOptions,
  WatchOptions,
  WatchHandle,
  WatchCallback,
  FileChangeEvent,
  Unsubscribe,
} from './types.ts';

/**
 * File Provider interface.
 *
 * Providers implement file operations for a specific URI scheme.
 * Examples: LocalFileProvider (file://), SSHFileProvider (ssh://)
 */
export interface FileProvider {
  /** URI scheme this provider handles (e.g., 'file', 'ssh', 's3') */
  readonly scheme: string;

  // ─────────────────────────────────────────────────────────────────────────
  // Content Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Read file content.
   *
   * @param uri - File URI
   * @returns File content with metadata
   * @throws FileError if file doesn't exist or can't be read
   */
  read(uri: string): Promise<FileContent>;

  /**
   * Write content to a file.
   *
   * @param uri - File URI
   * @param content - Content to write
   * @param options - Write options
   * @returns Write result with metadata
   * @throws FileError if file can't be written
   */
  write(uri: string, content: string, options?: WriteOptions): Promise<WriteResult>;

  // ─────────────────────────────────────────────────────────────────────────
  // Metadata Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get file/directory metadata.
   *
   * @param uri - File or directory URI
   * @returns File statistics
   */
  stat(uri: string): Promise<FileStat>;

  /**
   * Check if a file or directory exists.
   *
   * @param uri - File or directory URI
   * @returns Whether the path exists
   */
  exists(uri: string): Promise<boolean>;

  // ─────────────────────────────────────────────────────────────────────────
  // File Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Delete a file.
   *
   * @param uri - File URI
   * @throws FileError if file doesn't exist or can't be deleted
   */
  delete(uri: string): Promise<void>;

  /**
   * Rename or move a file.
   *
   * @param oldUri - Current file URI
   * @param newUri - New file URI
   * @throws FileError if operation fails
   */
  rename(oldUri: string, newUri: string): Promise<void>;

  /**
   * Copy a file.
   *
   * @param sourceUri - Source file URI
   * @param targetUri - Target file URI
   * @throws FileError if operation fails
   */
  copy(sourceUri: string, targetUri: string): Promise<void>;

  // ─────────────────────────────────────────────────────────────────────────
  // Directory Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Read directory contents.
   *
   * @param uri - Directory URI
   * @returns Array of file entries
   * @throws FileError if directory doesn't exist
   */
  readDir(uri: string): Promise<FileEntry[]>;

  /**
   * Create a directory.
   *
   * @param uri - Directory URI
   * @param options - Creation options
   * @throws FileError if directory can't be created
   */
  createDir(uri: string, options?: CreateDirOptions): Promise<void>;

  /**
   * Delete a directory.
   *
   * @param uri - Directory URI
   * @param options - Deletion options
   * @throws FileError if directory can't be deleted
   */
  deleteDir(uri: string, options?: DeleteDirOptions): Promise<void>;

  // ─────────────────────────────────────────────────────────────────────────
  // Search Operations (optional - may not be supported by all providers)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Search for files by name or content.
   *
   * @param pattern - Search pattern
   * @param options - Search options
   * @returns Search results
   */
  search?(pattern: string, options?: SearchOptions): Promise<SearchResult[]>;

  /**
   * Find files matching a glob pattern.
   *
   * @param pattern - Glob pattern
   * @param options - Glob options
   * @returns Array of matching URIs
   */
  glob?(pattern: string, options?: GlobOptions): Promise<string[]>;

  // ─────────────────────────────────────────────────────────────────────────
  // Watch Operations (optional - may not be supported by all providers)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Watch a file or directory for changes.
   *
   * @param uri - URI to watch
   * @param callback - Called when changes occur
   * @param options - Watch options
   * @returns Handle to stop watching
   */
  watch?(uri: string, callback: WatchCallback, options?: WatchOptions): WatchHandle;
}

/**
 * File Service interface.
 *
 * The main interface for file operations. Routes requests to appropriate
 * providers based on URI scheme.
 */
export interface FileService {
  // ─────────────────────────────────────────────────────────────────────────
  // Provider Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Register a file provider.
   *
   * @param provider - Provider to register
   */
  registerProvider(provider: FileProvider): void;

  /**
   * Get registered provider for a scheme.
   *
   * @param scheme - URI scheme
   * @returns Provider or undefined if not registered
   */
  getProvider(scheme: string): FileProvider | undefined;

  /**
   * List registered providers.
   *
   * @returns Array of registered schemes
   */
  listProviders(): string[];

  // ─────────────────────────────────────────────────────────────────────────
  // Content Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Read file content.
   *
   * @param uri - File URI
   * @returns File content with metadata
   */
  read(uri: string): Promise<FileContent>;

  /**
   * Write content to a file.
   *
   * @param uri - File URI
   * @param content - Content to write
   * @param options - Write options
   * @returns Write result
   */
  write(uri: string, content: string, options?: WriteOptions): Promise<WriteResult>;

  // ─────────────────────────────────────────────────────────────────────────
  // Metadata Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get file/directory metadata.
   *
   * @param uri - File or directory URI
   * @returns File statistics
   */
  stat(uri: string): Promise<FileStat>;

  /**
   * Check if a file or directory exists.
   *
   * @param uri - File or directory URI
   * @returns Whether the path exists
   */
  exists(uri: string): Promise<boolean>;

  // ─────────────────────────────────────────────────────────────────────────
  // File Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Delete a file.
   *
   * @param uri - File URI
   */
  delete(uri: string): Promise<void>;

  /**
   * Rename or move a file.
   *
   * @param oldUri - Current file URI
   * @param newUri - New file URI
   */
  rename(oldUri: string, newUri: string): Promise<void>;

  /**
   * Copy a file.
   *
   * @param sourceUri - Source file URI
   * @param targetUri - Target file URI
   */
  copy(sourceUri: string, targetUri: string): Promise<void>;

  // ─────────────────────────────────────────────────────────────────────────
  // Directory Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Read directory contents.
   *
   * @param uri - Directory URI
   * @returns Array of file entries
   */
  readDir(uri: string): Promise<FileEntry[]>;

  /**
   * Create a directory.
   *
   * @param uri - Directory URI
   * @param options - Creation options
   */
  createDir(uri: string, options?: CreateDirOptions): Promise<void>;

  /**
   * Delete a directory.
   *
   * @param uri - Directory URI
   * @param options - Deletion options
   */
  deleteDir(uri: string, options?: DeleteDirOptions): Promise<void>;

  // ─────────────────────────────────────────────────────────────────────────
  // Search Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Search for files by name or content.
   *
   * @param pattern - Search pattern
   * @param options - Search options
   * @returns Search results
   */
  search(pattern: string, options?: SearchOptions): Promise<SearchResult[]>;

  /**
   * Find files matching a glob pattern.
   *
   * @param pattern - Glob pattern
   * @param options - Glob options
   * @returns Array of matching URIs
   */
  glob(pattern: string, options?: GlobOptions): Promise<string[]>;

  // ─────────────────────────────────────────────────────────────────────────
  // Watch Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Watch a file or directory for changes.
   *
   * @param uri - URI to watch
   * @param callback - Called when changes occur
   * @param options - Watch options
   * @returns Handle to stop watching
   */
  watch(uri: string, callback: WatchCallback, options?: WatchOptions): WatchHandle;

  /**
   * Subscribe to all file change events.
   *
   * @param callback - Called when any watched file changes
   * @returns Unsubscribe function
   */
  onFileChange(callback: (event: FileChangeEvent) => void): Unsubscribe;

  // ─────────────────────────────────────────────────────────────────────────
  // Utility
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Convert a file path to a file:// URI.
   *
   * @param filePath - Local file path
   * @returns file:// URI
   */
  pathToUri(filePath: string): string;

  /**
   * Extract the file path from a file:// URI.
   *
   * @param uri - file:// URI
   * @returns Local file path or null if not a file:// URI
   */
  uriToPath(uri: string): string | null;

  /**
   * Get the parent directory URI.
   *
   * @param uri - File or directory URI
   * @returns Parent directory URI
   */
  getParentUri(uri: string): string;

  /**
   * Get the file/directory name from a URI.
   *
   * @param uri - File or directory URI
   * @returns Name component
   */
  getBasename(uri: string): string;

  /**
   * Join URI path components.
   *
   * @param baseUri - Base URI
   * @param paths - Path components to join
   * @returns Joined URI
   */
  joinUri(baseUri: string, ...paths: string[]): string;
}
