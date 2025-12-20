/**
 * File Service Implementation
 *
 * Routes file operations to appropriate providers based on URI scheme.
 * Manages provider registry and provides utility functions for URI handling.
 */

import { join, dirname, basename } from 'node:path';
import { debugLog } from '../../debug.ts';
import type { FileService, FileProvider } from './interface.ts';
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
import { FileError } from './errors.ts';
import { localFileProvider } from './local.ts';

/**
 * Extract scheme from URI.
 */
function getScheme(uri: string): string {
  const colonIndex = uri.indexOf(':');
  if (colonIndex === -1) {
    throw FileError.invalidUri(uri, 'URI must contain a scheme');
  }
  return uri.slice(0, colonIndex);
}

/**
 * File Service implementation.
 *
 * Routes file operations to registered providers based on URI scheme.
 */
export class FileServiceImpl implements FileService {
  private providers = new Map<string, FileProvider>();
  private changeListeners = new Set<(event: FileChangeEvent) => void>();
  private watchHandles = new Map<string, WatchHandle>();

  constructor() {
    // Register the local file provider by default
    this.registerProvider(localFileProvider);
    debugLog('[FileService] Initialized with local provider');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Provider Management
  // ─────────────────────────────────────────────────────────────────────────

  registerProvider(provider: FileProvider): void {
    if (this.providers.has(provider.scheme)) {
      debugLog(`[FileService] Replacing provider for scheme: ${provider.scheme}`);
    }
    this.providers.set(provider.scheme, provider);
    debugLog(`[FileService] Registered provider for scheme: ${provider.scheme}`);
  }

  getProvider(scheme: string): FileProvider | undefined {
    return this.providers.get(scheme);
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get provider for URI, throwing if not found.
   */
  private requireProvider(uri: string): FileProvider {
    const scheme = getScheme(uri);
    const provider = this.providers.get(scheme);
    if (!provider) {
      throw FileError.noProvider(uri, scheme);
    }
    return provider;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Content Operations
  // ─────────────────────────────────────────────────────────────────────────

  async read(uri: string): Promise<FileContent> {
    const provider = this.requireProvider(uri);
    return provider.read(uri);
  }

  async write(uri: string, content: string, options?: WriteOptions): Promise<WriteResult> {
    const provider = this.requireProvider(uri);
    return provider.write(uri, content, options);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Metadata Operations
  // ─────────────────────────────────────────────────────────────────────────

  async stat(uri: string): Promise<FileStat> {
    const provider = this.requireProvider(uri);
    return provider.stat(uri);
  }

  async exists(uri: string): Promise<boolean> {
    const provider = this.requireProvider(uri);
    return provider.exists(uri);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // File Operations
  // ─────────────────────────────────────────────────────────────────────────

  async delete(uri: string): Promise<void> {
    const provider = this.requireProvider(uri);
    return provider.delete(uri);
  }

  async rename(oldUri: string, newUri: string): Promise<void> {
    const oldScheme = getScheme(oldUri);
    const newScheme = getScheme(newUri);

    if (oldScheme !== newScheme) {
      throw FileError.invalidUri(
        newUri,
        `Cannot rename across schemes: ${oldScheme} -> ${newScheme}`
      );
    }

    const provider = this.requireProvider(oldUri);
    return provider.rename(oldUri, newUri);
  }

  async copy(sourceUri: string, targetUri: string): Promise<void> {
    const sourceScheme = getScheme(sourceUri);
    const targetScheme = getScheme(targetUri);

    if (sourceScheme !== targetScheme) {
      // Cross-scheme copy: read from source, write to target
      const sourceProvider = this.requireProvider(sourceUri);
      const targetProvider = this.requireProvider(targetUri);

      const content = await sourceProvider.read(sourceUri);
      await targetProvider.write(targetUri, content.content);
      return;
    }

    const provider = this.requireProvider(sourceUri);
    return provider.copy(sourceUri, targetUri);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Directory Operations
  // ─────────────────────────────────────────────────────────────────────────

  async readDir(uri: string): Promise<FileEntry[]> {
    const provider = this.requireProvider(uri);
    return provider.readDir(uri);
  }

  async createDir(uri: string, options?: CreateDirOptions): Promise<void> {
    const provider = this.requireProvider(uri);
    return provider.createDir(uri, options);
  }

  async deleteDir(uri: string, options?: DeleteDirOptions): Promise<void> {
    const provider = this.requireProvider(uri);
    return provider.deleteDir(uri, options);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Search Operations
  // ─────────────────────────────────────────────────────────────────────────

  async search(pattern: string, options?: SearchOptions): Promise<SearchResult[]> {
    // Default to local file provider for search
    const baseUri = options?.includePatterns?.[0] ?? `file://${process.cwd()}`;
    const provider = this.requireProvider(baseUri);

    if (!provider.search) {
      throw FileError.notSupported(baseUri, 'search');
    }

    return provider.search(pattern, options);
  }

  async glob(pattern: string, options?: GlobOptions): Promise<string[]> {
    const baseUri = options?.baseUri ?? `file://${process.cwd()}`;
    const provider = this.requireProvider(baseUri);

    if (!provider.glob) {
      throw FileError.notSupported(baseUri, 'glob');
    }

    return provider.glob(pattern, options);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Watch Operations
  // ─────────────────────────────────────────────────────────────────────────

  watch(uri: string, callback: WatchCallback, options?: WatchOptions): WatchHandle {
    const provider = this.requireProvider(uri);

    if (!provider.watch) {
      throw FileError.notSupported(uri, 'watch');
    }

    // Create wrapper callback that notifies global listeners
    const wrappedCallback: WatchCallback = (event) => {
      // Call the specific callback
      callback(event);

      // Notify global listeners
      for (const listener of this.changeListeners) {
        try {
          listener(event);
        } catch (error) {
          debugLog(`[FileService] Change listener error: ${error}`);
        }
      }
    };

    const handle = provider.watch(uri, wrappedCallback, options);

    // Track the handle for cleanup
    this.watchHandles.set(handle.id, handle);

    // Return handle with cleanup
    return {
      ...handle,
      dispose: () => {
        handle.dispose();
        this.watchHandles.delete(handle.id);
      },
    };
  }

  onFileChange(callback: (event: FileChangeEvent) => void): Unsubscribe {
    this.changeListeners.add(callback);
    return () => {
      this.changeListeners.delete(callback);
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Utility Methods
  // ─────────────────────────────────────────────────────────────────────────

  pathToUri(filePath: string): string {
    // Ensure absolute path
    const absolutePath = filePath.startsWith('/') ? filePath : join(process.cwd(), filePath);
    return `file://${absolutePath}`;
  }

  uriToPath(uri: string): string | null {
    if (!uri.startsWith('file://')) {
      return null;
    }
    return uri.slice(7);
  }

  getParentUri(uri: string): string {
    const scheme = getScheme(uri);
    const path = uri.slice(scheme.length + 3); // Remove scheme://
    const parentPath = dirname(path);
    return `${scheme}://${parentPath}`;
  }

  getBasename(uri: string): string {
    const scheme = getScheme(uri);
    const path = uri.slice(scheme.length + 3); // Remove scheme://
    return basename(path);
  }

  joinUri(baseUri: string, ...paths: string[]): string {
    const scheme = getScheme(baseUri);
    const basePath = baseUri.slice(scheme.length + 3); // Remove scheme://
    const joinedPath = join(basePath, ...paths);
    return `${scheme}://${joinedPath}`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Dispose all watches and cleanup resources.
   */
  dispose(): void {
    // Dispose all watch handles
    for (const handle of this.watchHandles.values()) {
      handle.dispose();
    }
    this.watchHandles.clear();
    this.changeListeners.clear();

    debugLog('[FileService] Disposed');
  }
}

// Singleton instance
export const fileService = new FileServiceImpl();
export default fileService;
