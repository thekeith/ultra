/**
 * Integration Tests for File ECP Methods
 *
 * Tests the file/* ECP methods via TestECPClient.
 * These tests verify the JSON-RPC protocol layer.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { TestECPClient } from '../helpers/ecp-client.ts';
import { createTempWorkspace, type TempWorkspace } from '../helpers/temp-workspace.ts';

describe('file/* ECP Methods', () => {
  let client: TestECPClient;
  let workspace: TempWorkspace;

  beforeEach(async () => {
    client = new TestECPClient();
    workspace = await createTempWorkspace({
      files: {
        'test.txt': 'Hello, World!',
        'src/app.ts': 'const x = 1;',
        'src/utils.ts': 'export const helper = () => {};',
      },
    });
  });

  afterEach(async () => {
    await client.shutdown();
    await workspace.cleanup();
  });

  // ───────────────────────────────────────────────────────────────────────
  // Content Operations
  // ───────────────────────────────────────────────────────────────────────

  describe('file/read', () => {
    test('reads file content', async () => {
      const result = await client.request<{
        content: string;
        encoding: string;
        size: number;
        modTime: number;
      }>('file/read', {
        uri: workspace.fileUri('test.txt'),
      });

      expect(result.content).toBe('Hello, World!');
      expect(result.encoding).toBe('utf-8');
      expect(result.size).toBeGreaterThan(0);
      expect(result.modTime).toBeGreaterThan(0);
    });

    test('returns error for non-existent file', async () => {
      const response = await client.requestRaw('file/read', {
        uri: workspace.fileUri('nonexistent.txt'),
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32100); // FileNotFound
    });

    test('returns error without uri', async () => {
      const response = await client.requestRaw('file/read', {});

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32602); // InvalidParams
    });
  });

  describe('file/write', () => {
    test('writes new file', async () => {
      const uri = workspace.fileUri('new-file.txt');
      const result = await client.request<{
        success: boolean;
        modTime: number;
        bytesWritten: number;
      }>('file/write', {
        uri,
        content: 'New content',
      });

      expect(result.success).toBe(true);
      expect(result.bytesWritten).toBeGreaterThan(0);

      // Verify content
      const content = await workspace.readFile('new-file.txt');
      expect(content).toBe('New content');
    });

    test('overwrites existing file', async () => {
      const uri = workspace.fileUri('test.txt');
      await client.request('file/write', {
        uri,
        content: 'Updated content',
      });

      const content = await workspace.readFile('test.txt');
      expect(content).toBe('Updated content');
    });

    test('creates parent directories with createParents option', async () => {
      const uri = workspace.fileUri('deep/nested/file.txt');
      await client.request('file/write', {
        uri,
        content: 'Nested content',
        createParents: true,
      });

      const content = await workspace.readFile('deep/nested/file.txt');
      expect(content).toBe('Nested content');
    });

    test('returns error without uri', async () => {
      const response = await client.requestRaw('file/write', {
        content: 'Hello',
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32602); // InvalidParams
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Metadata Operations
  // ───────────────────────────────────────────────────────────────────────

  describe('file/stat', () => {
    test('returns file stats', async () => {
      const result = await client.request<{
        uri: string;
        exists: boolean;
        isFile: boolean;
        isDirectory: boolean;
        size: number;
      }>('file/stat', {
        uri: workspace.fileUri('test.txt'),
      });

      expect(result.exists).toBe(true);
      expect(result.isFile).toBe(true);
      expect(result.isDirectory).toBe(false);
      expect(result.size).toBeGreaterThan(0);
    });

    test('returns directory stats', async () => {
      const result = await client.request<{
        exists: boolean;
        isFile: boolean;
        isDirectory: boolean;
      }>('file/stat', {
        uri: workspace.fileUri('src'),
      });

      expect(result.exists).toBe(true);
      expect(result.isFile).toBe(false);
      expect(result.isDirectory).toBe(true);
    });

    test('returns exists: false for non-existent path', async () => {
      const result = await client.request<{
        exists: boolean;
      }>('file/stat', {
        uri: workspace.fileUri('nonexistent.txt'),
      });

      expect(result.exists).toBe(false);
    });
  });

  describe('file/exists', () => {
    test('returns true for existing file', async () => {
      const result = await client.request<{ exists: boolean }>('file/exists', {
        uri: workspace.fileUri('test.txt'),
      });

      expect(result.exists).toBe(true);
    });

    test('returns false for non-existent file', async () => {
      const result = await client.request<{ exists: boolean }>('file/exists', {
        uri: workspace.fileUri('nonexistent.txt'),
      });

      expect(result.exists).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // File Operations
  // ───────────────────────────────────────────────────────────────────────

  describe('file/delete', () => {
    test('deletes a file', async () => {
      const uri = workspace.fileUri('test.txt');
      const result = await client.request<{ success: boolean }>('file/delete', {
        uri,
      });

      expect(result.success).toBe(true);
      expect(await workspace.fileExists('test.txt')).toBe(false);
    });

    test('returns error for non-existent file', async () => {
      const response = await client.requestRaw('file/delete', {
        uri: workspace.fileUri('nonexistent.txt'),
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32100); // FileNotFound
    });
  });

  describe('file/rename', () => {
    test('renames a file', async () => {
      const result = await client.request<{ success: boolean }>('file/rename', {
        oldUri: workspace.fileUri('test.txt'),
        newUri: workspace.fileUri('renamed.txt'),
      });

      expect(result.success).toBe(true);
      expect(await workspace.fileExists('test.txt')).toBe(false);
      expect(await workspace.fileExists('renamed.txt')).toBe(true);
    });

    test('returns error for non-existent source', async () => {
      const response = await client.requestRaw('file/rename', {
        oldUri: workspace.fileUri('nonexistent.txt'),
        newUri: workspace.fileUri('new.txt'),
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32100); // FileNotFound
    });
  });

  describe('file/copy', () => {
    test('copies a file', async () => {
      const result = await client.request<{ success: boolean }>('file/copy', {
        sourceUri: workspace.fileUri('test.txt'),
        targetUri: workspace.fileUri('copy.txt'),
      });

      expect(result.success).toBe(true);

      // Both files should exist
      expect(await workspace.fileExists('test.txt')).toBe(true);
      expect(await workspace.fileExists('copy.txt')).toBe(true);

      // Content should match
      const content = await workspace.readFile('copy.txt');
      expect(content).toBe('Hello, World!');
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Directory Operations
  // ───────────────────────────────────────────────────────────────────────

  describe('file/readDir', () => {
    test('lists directory contents', async () => {
      const result = await client.request<{
        entries: Array<{
          name: string;
          uri: string;
          type: 'file' | 'directory' | 'symlink';
        }>;
      }>('file/readDir', {
        uri: workspace.rootUri,
      });

      const names = result.entries.map((e) => e.name);
      expect(names).toContain('test.txt');
      expect(names).toContain('src');
    });

    test('returns correct entry types', async () => {
      const result = await client.request<{
        entries: Array<{
          name: string;
          type: 'file' | 'directory' | 'symlink';
        }>;
      }>('file/readDir', {
        uri: workspace.rootUri,
      });

      const src = result.entries.find((e) => e.name === 'src');
      expect(src?.type).toBe('directory');

      const test = result.entries.find((e) => e.name === 'test.txt');
      expect(test?.type).toBe('file');
    });
  });

  describe('file/createDir', () => {
    test('creates a directory', async () => {
      const uri = workspace.fileUri('new-dir');
      const result = await client.request<{ success: boolean }>('file/createDir', {
        uri,
      });

      expect(result.success).toBe(true);

      // Verify directory was created
      const stat = await client.request<{ isDirectory: boolean }>('file/stat', { uri });
      expect(stat.isDirectory).toBe(true);
    });

    test('creates nested directories with recursive option', async () => {
      const uri = workspace.fileUri('deep/nested/dir');
      await client.request('file/createDir', {
        uri,
        recursive: true,
      });

      const stat = await client.request<{ isDirectory: boolean }>('file/stat', { uri });
      expect(stat.isDirectory).toBe(true);
    });
  });

  describe('file/deleteDir', () => {
    test('deletes empty directory', async () => {
      // Create empty directory first
      const uri = workspace.fileUri('empty-dir');
      await client.request('file/createDir', { uri });

      const result = await client.request<{ success: boolean }>('file/deleteDir', {
        uri,
      });

      expect(result.success).toBe(true);

      const stat = await client.request<{ exists: boolean }>('file/stat', { uri });
      expect(stat.exists).toBe(false);
    });

    test('deletes non-empty directory with recursive option', async () => {
      const uri = workspace.fileUri('src');
      await client.request('file/deleteDir', {
        uri,
        recursive: true,
      });

      const stat = await client.request<{ exists: boolean }>('file/stat', { uri });
      expect(stat.exists).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Search Operations
  // ───────────────────────────────────────────────────────────────────────

  describe('file/search', () => {
    test('finds files by name pattern', async () => {
      const result = await client.request<{
        results: Array<{ uri: string; name: string }>;
      }>('file/search', {
        pattern: 'test',
        includePatterns: [workspace.rootUri],
      });

      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].name).toContain('test');
    });
  });

  describe('file/glob', () => {
    test('finds files matching glob pattern', async () => {
      const result = await client.request<{ uris: string[] }>('file/glob', {
        pattern: '**/*.ts',
        baseUri: workspace.rootUri,
      });

      expect(result.uris.length).toBe(2); // app.ts and utils.ts
      expect(result.uris.every((uri) => uri.endsWith('.ts'))).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Watch Operations
  // ───────────────────────────────────────────────────────────────────────

  describe('file/watch', () => {
    test('creates watch handle', async () => {
      const result = await client.request<{ watchId: string }>('file/watch', {
        uri: workspace.rootUri,
        recursive: true,
      });

      expect(result.watchId).toBeDefined();
      expect(result.watchId).toMatch(/^watch_/);

      // Clean up
      await client.request('file/unwatch', { watchId: result.watchId });
    });
  });

  describe('file/unwatch', () => {
    test('disposes watch handle', async () => {
      const { watchId } = await client.request<{ watchId: string }>('file/watch', {
        uri: workspace.rootUri,
      });

      const result = await client.request<{ success: boolean }>('file/unwatch', {
        watchId,
      });

      expect(result.success).toBe(true);
    });

    test('returns error for unknown watchId', async () => {
      const response = await client.requestRaw('file/unwatch', {
        watchId: 'unknown',
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32602); // InvalidParams
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Utility Operations
  // ───────────────────────────────────────────────────────────────────────

  describe('file/pathToUri', () => {
    test('converts path to file:// URI', async () => {
      const result = await client.request<{ uri: string }>('file/pathToUri', {
        path: '/home/user/test.txt',
      });

      expect(result.uri).toBe('file:///home/user/test.txt');
    });
  });

  describe('file/uriToPath', () => {
    test('extracts path from file:// URI', async () => {
      const result = await client.request<{ path: string | null }>('file/uriToPath', {
        uri: 'file:///home/user/test.txt',
      });

      expect(result.path).toBe('/home/user/test.txt');
    });

    test('returns null for non-file URI', async () => {
      const result = await client.request<{ path: string | null }>('file/uriToPath', {
        uri: 'http://example.com/file.txt',
      });

      expect(result.path).toBeNull();
    });
  });

  describe('file/getParent', () => {
    test('returns parent directory URI', async () => {
      const result = await client.request<{ parent: string }>('file/getParent', {
        uri: 'file:///home/user/project/src/app.ts',
      });

      expect(result.parent).toBe('file:///home/user/project/src');
    });
  });

  describe('file/getBasename', () => {
    test('returns file name', async () => {
      const result = await client.request<{ basename: string }>('file/getBasename', {
        uri: 'file:///home/user/project/app.ts',
      });

      expect(result.basename).toBe('app.ts');
    });
  });

  describe('file/join', () => {
    test('joins path components', async () => {
      const result = await client.request<{ uri: string }>('file/join', {
        baseUri: 'file:///home/user',
        paths: ['project', 'src', 'app.ts'],
      });

      expect(result.uri).toBe('file:///home/user/project/src/app.ts');
    });
  });
});
