/**
 * Local File Provider
 *
 * Implements file operations for local file system (file:// URIs).
 * Uses Bun's native file APIs for optimal performance.
 */

import { watch, type FSWatcher } from 'node:fs';
import { readdir, mkdir, rm, rmdir, rename, copyFile, stat as fsStat, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { debugLog } from '../../debug.ts';
import type { FileProvider } from './interface.ts';
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
} from './types.ts';
import { FileError } from './errors.ts';

/**
 * Convert a file:// URI to a local file path.
 */
function uriToPath(uri: string): string {
  if (!uri.startsWith('file://')) {
    throw FileError.invalidUri(uri, 'Expected file:// URI');
  }
  return uri.slice(7);
}

/**
 * Convert a local file path to a file:// URI.
 */
function pathToUri(filePath: string): string {
  // Ensure absolute path
  const absolutePath = filePath.startsWith('/') ? filePath : join(process.cwd(), filePath);
  return `file://${absolutePath}`;
}

/**
 * Generate a unique watch ID.
 */
function generateWatchId(): string {
  return `watch_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Check if a path exists (works for both files and directories).
 */
async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Local file system provider.
 */
export class LocalFileProvider implements FileProvider {
  readonly scheme = 'file';

  // Active watchers
  private watchers = new Map<string, { watcher: FSWatcher; callbacks: Set<WatchCallback> }>();

  constructor() {
    debugLog('[LocalFileProvider] Initialized');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Content Operations
  // ─────────────────────────────────────────────────────────────────────────

  async read(uri: string): Promise<FileContent> {
    const filePath = uriToPath(uri);

    try {
      // Check if path exists and get stats
      if (!await pathExists(filePath)) {
        throw FileError.notFound(uri);
      }

      const stats = await fsStat(filePath);
      if (stats.isDirectory()) {
        throw FileError.isDirectory(uri);
      }

      const file = Bun.file(filePath);
      const content = await file.text();

      return {
        content,
        encoding: 'utf-8',
        modTime: stats.mtimeMs,
        size: stats.size,
      };
    } catch (error) {
      throw FileError.wrap(uri, error);
    }
  }

  async write(uri: string, content: string, options?: WriteOptions): Promise<WriteResult> {
    const filePath = uriToPath(uri);

    try {
      // Create parent directories if requested
      if (options?.createParents) {
        const dir = dirname(filePath);
        await mkdir(dir, { recursive: true });
      }

      // Check if file exists and overwrite is disabled
      if (options?.overwrite === false) {
        if (await pathExists(filePath)) {
          throw FileError.alreadyExists(uri);
        }
      }

      // Write content
      const bytesWritten = await Bun.write(filePath, content);

      // Get new modification time
      const stats = await fsStat(filePath);

      return {
        success: true,
        modTime: stats.mtimeMs,
        bytesWritten,
      };
    } catch (error) {
      throw FileError.wrap(uri, error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Metadata Operations
  // ─────────────────────────────────────────────────────────────────────────

  async stat(uri: string): Promise<FileStat> {
    const filePath = uriToPath(uri);

    try {
      const exists = await pathExists(filePath);

      if (!exists) {
        return {
          uri,
          exists: false,
          isDirectory: false,
          isFile: false,
          isSymlink: false,
          size: 0,
          modTime: 0,
          createTime: 0,
        };
      }

      const stats = await fsStat(filePath);

      return {
        uri,
        exists: true,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        isSymlink: stats.isSymbolicLink(),
        size: stats.size,
        modTime: stats.mtimeMs,
        createTime: stats.birthtimeMs,
      };
    } catch (error) {
      throw FileError.wrap(uri, error);
    }
  }

  async exists(uri: string): Promise<boolean> {
    const filePath = uriToPath(uri);
    return await pathExists(filePath);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // File Operations
  // ─────────────────────────────────────────────────────────────────────────

  async delete(uri: string): Promise<void> {
    const filePath = uriToPath(uri);

    try {
      // Check if path exists
      if (!await pathExists(filePath)) {
        throw FileError.notFound(uri);
      }

      // Check if it's a directory
      const stats = await fsStat(filePath);
      if (stats.isDirectory()) {
        throw FileError.isDirectory(uri, 'Use deleteDir for directories');
      }

      await rm(filePath);
    } catch (error) {
      throw FileError.wrap(uri, error);
    }
  }

  async rename(oldUri: string, newUri: string): Promise<void> {
    const oldPath = uriToPath(oldUri);
    const newPath = uriToPath(newUri);

    try {
      // Check if source exists
      if (!await pathExists(oldPath)) {
        throw FileError.notFound(oldUri);
      }

      await rename(oldPath, newPath);
    } catch (error) {
      throw FileError.wrap(oldUri, error);
    }
  }

  async copy(sourceUri: string, targetUri: string): Promise<void> {
    const sourcePath = uriToPath(sourceUri);
    const targetPath = uriToPath(targetUri);

    try {
      // Check if source exists
      if (!await pathExists(sourcePath)) {
        throw FileError.notFound(sourceUri);
      }

      await copyFile(sourcePath, targetPath);
    } catch (error) {
      throw FileError.wrap(sourceUri, error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Directory Operations
  // ─────────────────────────────────────────────────────────────────────────

  async readDir(uri: string): Promise<FileEntry[]> {
    const dirPath = uriToPath(uri);

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      const result: FileEntry[] = [];

      for (const entry of entries) {
        const entryPath = join(dirPath, entry.name);
        const entryUri = pathToUri(entryPath);

        let entryType: 'file' | 'directory' | 'symlink';
        if (entry.isDirectory()) {
          entryType = 'directory';
        } else if (entry.isSymbolicLink()) {
          entryType = 'symlink';
        } else {
          entryType = 'file';
        }

        // Get additional metadata for files
        let size: number | undefined;
        let modTime: number | undefined;

        if (entryType === 'file') {
          try {
            const stats = await fsStat(entryPath);
            size = stats.size;
            modTime = stats.mtimeMs;
          } catch {
            // Ignore stat errors for individual entries
          }
        }

        result.push({
          name: entry.name,
          uri: entryUri,
          type: entryType,
          size,
          modTime,
        });
      }

      // Sort: directories first, then files, alphabetically
      result.sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });

      return result;
    } catch (error) {
      throw FileError.wrap(uri, error);
    }
  }

  async createDir(uri: string, options?: CreateDirOptions): Promise<void> {
    const dirPath = uriToPath(uri);

    try {
      await mkdir(dirPath, { recursive: options?.recursive ?? false });
    } catch (error) {
      throw FileError.wrap(uri, error);
    }
  }

  async deleteDir(uri: string, options?: DeleteDirOptions): Promise<void> {
    const dirPath = uriToPath(uri);

    try {
      // Check if directory exists
      if (!await pathExists(dirPath)) {
        throw FileError.notFound(uri);
      }

      // Check if it's a directory
      const stats = await fsStat(dirPath);
      if (!stats.isDirectory()) {
        throw FileError.notDirectory(uri);
      }

      if (options?.recursive) {
        await rm(dirPath, { recursive: true });
      } else {
        // Use rmdir for non-recursive deletion (only works on empty directories)
        await rmdir(dirPath);
      }
    } catch (error) {
      throw FileError.wrap(uri, error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Search Operations
  // ─────────────────────────────────────────────────────────────────────────

  async search(pattern: string, options?: SearchOptions): Promise<SearchResult[]> {
    // Simple file name search using glob
    const results: SearchResult[] = [];
    const maxResults = options?.maxResults ?? 100;
    const baseUri = options?.includePatterns?.[0] ?? `file://${process.cwd()}`;
    const basePath = uriToPath(baseUri);

    try {
      // Use Bun's glob for efficient file matching
      const glob = new Bun.Glob(`**/*${pattern}*`);

      for await (const file of glob.scan({ cwd: basePath, onlyFiles: true })) {
        if (results.length >= maxResults) break;

        // Skip excluded patterns
        if (options?.excludePatterns?.some(p => file.includes(p))) {
          continue;
        }

        const name = basename(file);
        const matchIndex = name.toLowerCase().indexOf(pattern.toLowerCase());

        results.push({
          uri: pathToUri(join(basePath, file)),
          name,
          score: matchIndex === 0 ? 100 : matchIndex > 0 ? 50 : 25,
          matches: matchIndex >= 0 ? [{ start: matchIndex, end: matchIndex + pattern.length }] : undefined,
        });
      }

      // Sort by score (higher first)
      results.sort((a, b) => b.score - a.score);

      return results;
    } catch (error) {
      throw FileError.wrap(baseUri, error);
    }
  }

  async glob(pattern: string, options?: GlobOptions): Promise<string[]> {
    const baseUri = options?.baseUri ?? `file://${process.cwd()}`;
    const basePath = uriToPath(baseUri);
    const maxResults = options?.maxResults ?? 1000;

    try {
      const glob = new Bun.Glob(pattern);
      const results: string[] = [];

      for await (const file of glob.scan({
        cwd: basePath,
        onlyFiles: !options?.includeDirectories,
        followSymlinks: options?.followSymlinks ?? false,
      })) {
        if (results.length >= maxResults) break;

        // Skip excluded patterns
        if (options?.excludePatterns?.some(p => file.includes(p))) {
          continue;
        }

        results.push(pathToUri(join(basePath, file)));
      }

      return results;
    } catch (error) {
      throw FileError.wrap(baseUri, error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Watch Operations
  // ─────────────────────────────────────────────────────────────────────────

  watch(uri: string, callback: WatchCallback, options?: WatchOptions): WatchHandle {
    const filePath = uriToPath(uri);
    const watchId = generateWatchId();

    debugLog(`[LocalFileProvider] Setting up watch for: ${filePath} (recursive: ${options?.recursive ?? true})`);

    // Check if we already have a watcher for this path
    let entry = this.watchers.get(filePath);

    if (!entry) {
      // Create new watcher
      const watcher = watch(
        filePath,
        { recursive: options?.recursive ?? true },
        (eventType, filename) => {
          debugLog(`[LocalFileProvider] Watch event: ${eventType} ${filename}`);
          if (!filename) return;

          const changedUri = pathToUri(join(filePath, filename));
          const event: FileChangeEvent = {
            uri: changedUri,
            type: eventType === 'rename' ? 'deleted' : 'changed',
            timestamp: Date.now(),
          };

          // Notify all callbacks
          const callbacks = this.watchers.get(filePath)?.callbacks;
          debugLog(`[LocalFileProvider] Notifying ${callbacks?.size ?? 0} callbacks`);
          if (callbacks) {
            for (const cb of callbacks) {
              try {
                cb(event);
              } catch (error) {
                debugLog(`[LocalFileProvider] Watch callback error: ${error}`);
              }
            }
          }
        }
      );

      watcher.on('error', (error) => {
        debugLog(`[LocalFileProvider] Watcher error: ${error}`);
      });

      entry = { watcher, callbacks: new Set() };
      this.watchers.set(filePath, entry);
      debugLog(`[LocalFileProvider] Created new watcher for: ${filePath}`);
    } else {
      debugLog(`[LocalFileProvider] Reusing existing watcher for: ${filePath}`);
    }

    // Add callback
    entry.callbacks.add(callback);

    return {
      id: watchId,
      uri,
      dispose: () => {
        const e = this.watchers.get(filePath);
        if (e) {
          e.callbacks.delete(callback);
          if (e.callbacks.size === 0) {
            e.watcher.close();
            this.watchers.delete(filePath);
          }
        }
      },
    };
  }

  /**
   * Close all watchers.
   */
  closeAllWatchers(): void {
    for (const [, entry] of this.watchers) {
      entry.watcher.close();
    }
    this.watchers.clear();
  }
}

// Singleton instance
export const localFileProvider = new LocalFileProvider();
export default localFileProvider;
