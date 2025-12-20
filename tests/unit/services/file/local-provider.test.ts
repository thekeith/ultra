/**
 * LocalFileProvider Unit Tests
 *
 * Tests for the local file system provider.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { LocalFileProvider } from '../../../../src/services/file/local.ts';
import { FileError, FileErrorCode } from '../../../../src/services/file/errors.ts';
import { createTempWorkspace, type TempWorkspace } from '../../../helpers/temp-workspace.ts';

describe('LocalFileProvider', () => {
  let provider: LocalFileProvider;
  let workspace: TempWorkspace;

  beforeEach(async () => {
    provider = new LocalFileProvider();
    workspace = await createTempWorkspace({
      files: {
        'test.txt': 'Hello, World!',
        'src/app.ts': 'const x = 1;',
        'src/utils/helpers.ts': 'export const helper = () => {};',
        'empty.txt': '',
      },
    });
  });

  afterEach(async () => {
    provider.closeAllWatchers();
    await workspace.cleanup();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Content Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('read', () => {
    it('should read file content', async () => {
      const result = await provider.read(workspace.fileUri('test.txt'));

      expect(result.content).toBe('Hello, World!');
      expect(result.encoding).toBe('utf-8');
      expect(result.size).toBeGreaterThan(0);
      expect(result.modTime).toBeGreaterThan(0);
    });

    it('should read nested file', async () => {
      const result = await provider.read(workspace.fileUri('src/app.ts'));

      expect(result.content).toBe('const x = 1;');
    });

    it('should read empty file', async () => {
      const result = await provider.read(workspace.fileUri('empty.txt'));

      expect(result.content).toBe('');
      expect(result.size).toBe(0);
    });

    it('should throw FileError.NOT_FOUND for non-existent file', async () => {
      try {
        await provider.read(workspace.fileUri('nonexistent.txt'));
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FileError);
        expect((error as FileError).code).toBe(FileErrorCode.NOT_FOUND);
      }
    });

    it('should throw FileError.IS_DIRECTORY for directory', async () => {
      try {
        await provider.read(workspace.fileUri('src'));
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FileError);
        expect((error as FileError).code).toBe(FileErrorCode.IS_DIRECTORY);
      }
    });

    it('should throw FileError.INVALID_URI for non-file URI', async () => {
      try {
        await provider.read('http://example.com/file.txt');
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FileError);
        expect((error as FileError).code).toBe(FileErrorCode.INVALID_URI);
      }
    });
  });

  describe('write', () => {
    it('should write file content', async () => {
      const uri = workspace.fileUri('new-file.txt');
      const result = await provider.write(uri, 'New content');

      expect(result.success).toBe(true);
      expect(result.bytesWritten).toBeGreaterThan(0);
      expect(result.modTime).toBeGreaterThan(0);

      // Verify content
      const content = await workspace.readFile('new-file.txt');
      expect(content).toBe('New content');
    });

    it('should overwrite existing file', async () => {
      const uri = workspace.fileUri('test.txt');
      await provider.write(uri, 'Updated content');

      const content = await workspace.readFile('test.txt');
      expect(content).toBe('Updated content');
    });

    it('should create parent directories with createParents option', async () => {
      const uri = workspace.fileUri('deep/nested/path/file.txt');
      await provider.write(uri, 'Nested content', { createParents: true });

      const content = await workspace.readFile('deep/nested/path/file.txt');
      expect(content).toBe('Nested content');
    });

    it('should throw when overwrite is false and file exists', async () => {
      const uri = workspace.fileUri('test.txt');

      try {
        await provider.write(uri, 'New content', { overwrite: false });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FileError);
        expect((error as FileError).code).toBe(FileErrorCode.ALREADY_EXISTS);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Metadata Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('stat', () => {
    it('should return file stats', async () => {
      const result = await provider.stat(workspace.fileUri('test.txt'));

      expect(result.uri).toBe(workspace.fileUri('test.txt'));
      expect(result.exists).toBe(true);
      expect(result.isFile).toBe(true);
      expect(result.isDirectory).toBe(false);
      expect(result.isSymlink).toBe(false);
      expect(result.size).toBeGreaterThan(0);
      expect(result.modTime).toBeGreaterThan(0);
      // createTime may be 0 on Linux (doesn't track birth time)
      expect(typeof result.createTime).toBe('number');
    });

    it('should return directory stats', async () => {
      const result = await provider.stat(workspace.fileUri('src'));

      expect(result.exists).toBe(true);
      expect(result.isFile).toBe(false);
      expect(result.isDirectory).toBe(true);
    });

    it('should return exists: false for non-existent file', async () => {
      const result = await provider.stat(workspace.fileUri('nonexistent.txt'));

      expect(result.exists).toBe(false);
      expect(result.isFile).toBe(false);
      expect(result.isDirectory).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      const result = await provider.exists(workspace.fileUri('test.txt'));
      expect(result).toBe(true);
    });

    it('should return true for existing directory', async () => {
      const result = await provider.exists(workspace.fileUri('src'));
      expect(result).toBe(true);
    });

    it('should return false for non-existent path', async () => {
      const result = await provider.exists(workspace.fileUri('nonexistent.txt'));
      expect(result).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // File Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should delete a file', async () => {
      const uri = workspace.fileUri('test.txt');
      await provider.delete(uri);

      const exists = await workspace.fileExists('test.txt');
      expect(exists).toBe(false);
    });

    it('should throw for non-existent file', async () => {
      try {
        await provider.delete(workspace.fileUri('nonexistent.txt'));
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FileError);
        expect((error as FileError).code).toBe(FileErrorCode.NOT_FOUND);
      }
    });

    it('should throw for directory', async () => {
      try {
        await provider.delete(workspace.fileUri('src'));
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FileError);
        expect((error as FileError).code).toBe(FileErrorCode.IS_DIRECTORY);
      }
    });
  });

  describe('rename', () => {
    it('should rename a file', async () => {
      const oldUri = workspace.fileUri('test.txt');
      const newUri = workspace.fileUri('renamed.txt');

      await provider.rename(oldUri, newUri);

      expect(await workspace.fileExists('test.txt')).toBe(false);
      expect(await workspace.fileExists('renamed.txt')).toBe(true);

      const content = await workspace.readFile('renamed.txt');
      expect(content).toBe('Hello, World!');
    });

    it('should move a file to different directory', async () => {
      const oldUri = workspace.fileUri('test.txt');
      const newUri = workspace.fileUri('src/moved.txt');

      await provider.rename(oldUri, newUri);

      expect(await workspace.fileExists('test.txt')).toBe(false);
      expect(await workspace.fileExists('src/moved.txt')).toBe(true);
    });

    it('should throw for non-existent source', async () => {
      try {
        await provider.rename(
          workspace.fileUri('nonexistent.txt'),
          workspace.fileUri('new.txt')
        );
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FileError);
        expect((error as FileError).code).toBe(FileErrorCode.NOT_FOUND);
      }
    });
  });

  describe('copy', () => {
    it('should copy a file', async () => {
      const sourceUri = workspace.fileUri('test.txt');
      const targetUri = workspace.fileUri('copy.txt');

      await provider.copy(sourceUri, targetUri);

      // Both files should exist
      expect(await workspace.fileExists('test.txt')).toBe(true);
      expect(await workspace.fileExists('copy.txt')).toBe(true);

      // Content should match
      const content = await workspace.readFile('copy.txt');
      expect(content).toBe('Hello, World!');
    });

    it('should throw for non-existent source', async () => {
      try {
        await provider.copy(
          workspace.fileUri('nonexistent.txt'),
          workspace.fileUri('copy.txt')
        );
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FileError);
        expect((error as FileError).code).toBe(FileErrorCode.NOT_FOUND);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Directory Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('readDir', () => {
    it('should list directory contents', async () => {
      const entries = await provider.readDir(workspace.rootUri);

      // Should contain our test files and directories
      const names = entries.map((e) => e.name);
      expect(names).toContain('test.txt');
      expect(names).toContain('empty.txt');
      expect(names).toContain('src');
    });

    it('should return correct types', async () => {
      const entries = await provider.readDir(workspace.rootUri);

      const src = entries.find((e) => e.name === 'src');
      expect(src?.type).toBe('directory');

      const test = entries.find((e) => e.name === 'test.txt');
      expect(test?.type).toBe('file');
    });

    it('should sort directories before files', async () => {
      const entries = await provider.readDir(workspace.rootUri);

      // Find first file and last directory
      const firstFileIndex = entries.findIndex((e) => e.type === 'file');
      const lastDirIndex = entries
        .map((e, i) => (e.type === 'directory' ? i : -1))
        .filter((i) => i >= 0)
        .pop() ?? -1;

      if (lastDirIndex >= 0 && firstFileIndex >= 0) {
        expect(lastDirIndex).toBeLessThan(firstFileIndex);
      }
    });

    it('should include metadata for files', async () => {
      const entries = await provider.readDir(workspace.rootUri);

      const test = entries.find((e) => e.name === 'test.txt');
      expect(test?.size).toBeGreaterThan(0);
      expect(test?.modTime).toBeGreaterThan(0);
    });
  });

  describe('createDir', () => {
    it('should create a directory', async () => {
      const uri = workspace.fileUri('new-dir');
      await provider.createDir(uri);

      const stat = await provider.stat(uri);
      expect(stat.isDirectory).toBe(true);
    });

    it('should create nested directories with recursive option', async () => {
      const uri = workspace.fileUri('deep/nested/dir');
      await provider.createDir(uri, { recursive: true });

      const stat = await provider.stat(uri);
      expect(stat.isDirectory).toBe(true);
    });
  });

  describe('deleteDir', () => {
    it('should delete empty directory', async () => {
      // Create empty directory using the provider
      const uri = workspace.fileUri('empty-dir');
      await provider.createDir(uri);

      // Verify it was created
      const statBefore = await provider.stat(uri);
      expect(statBefore.exists).toBe(true);
      expect(statBefore.isDirectory).toBe(true);

      await provider.deleteDir(uri);

      const statAfter = await provider.stat(uri);
      expect(statAfter.exists).toBe(false);
    });

    it('should delete non-empty directory with recursive option', async () => {
      const uri = workspace.fileUri('src');
      await provider.deleteDir(uri, { recursive: true });

      const stat = await provider.stat(uri);
      expect(stat.exists).toBe(false);
    });

    it('should throw for non-existent directory', async () => {
      try {
        await provider.deleteDir(workspace.fileUri('nonexistent-dir'));
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FileError);
        expect((error as FileError).code).toBe(FileErrorCode.NOT_FOUND);
      }
    });

    it('should throw for file', async () => {
      try {
        await provider.deleteDir(workspace.fileUri('test.txt'));
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FileError);
        expect((error as FileError).code).toBe(FileErrorCode.NOT_DIRECTORY);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Search Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('search', () => {
    it('should find files by name pattern', async () => {
      const results = await provider.search('test', {
        includePatterns: [workspace.rootUri],
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toContain('test');
    });

    it('should respect maxResults', async () => {
      const results = await provider.search('', {
        includePatterns: [workspace.rootUri],
        maxResults: 1,
      });

      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe('glob', () => {
    it('should find files matching glob pattern', async () => {
      const uris = await provider.glob('**/*.ts', {
        baseUri: workspace.rootUri,
      });

      expect(uris.length).toBe(2); // app.ts and helpers.ts
      expect(uris.every((uri) => uri.endsWith('.ts'))).toBe(true);
    });

    it('should find files in subdirectories', async () => {
      const uris = await provider.glob('**/*.ts', {
        baseUri: workspace.rootUri,
      });

      const helpers = uris.find((uri) => uri.includes('helpers.ts'));
      expect(helpers).toBeDefined();
    });

    it('should respect maxResults', async () => {
      const uris = await provider.glob('**/*', {
        baseUri: workspace.rootUri,
        maxResults: 2,
      });

      expect(uris.length).toBeLessThanOrEqual(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Watch Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('watch', () => {
    it('should return a watch handle with id', () => {
      const handle = provider.watch(
        workspace.rootUri,
        () => {},
        { recursive: true }
      );

      expect(handle.id).toBeDefined();
      expect(handle.id).toMatch(/^watch_/);
      expect(handle.uri).toBe(workspace.rootUri);
      expect(typeof handle.dispose).toBe('function');

      handle.dispose();
    });

    it('should dispose watch cleanly', () => {
      const handle = provider.watch(
        workspace.rootUri,
        () => {},
        { recursive: true }
      );

      // Should not throw
      handle.dispose();
      handle.dispose(); // Double dispose should be safe
    });
  });
});
