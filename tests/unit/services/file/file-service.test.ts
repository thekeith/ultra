/**
 * FileServiceImpl Unit Tests
 *
 * Tests for the file service implementation with provider routing.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { FileServiceImpl } from '../../../../src/services/file/service.ts';
import { FileError, FileErrorCode } from '../../../../src/services/file/errors.ts';
import type { FileProvider } from '../../../../src/services/file/interface.ts';
import { createTempWorkspace, type TempWorkspace } from '../../../helpers/temp-workspace.ts';

describe('FileServiceImpl', () => {
  let service: FileServiceImpl;
  let workspace: TempWorkspace;

  beforeEach(async () => {
    service = new FileServiceImpl();
    workspace = await createTempWorkspace({
      files: {
        'test.txt': 'Hello, World!',
        'src/app.ts': 'const x = 1;',
      },
    });
  });

  afterEach(async () => {
    service.dispose();
    await workspace.cleanup();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Provider Management
  // ─────────────────────────────────────────────────────────────────────────

  describe('provider management', () => {
    it('should have local provider registered by default', () => {
      const provider = service.getProvider('file');

      expect(provider).toBeDefined();
      expect(provider?.scheme).toBe('file');
    });

    it('should list registered providers', () => {
      const schemes = service.listProviders();

      expect(schemes).toContain('file');
    });

    it('should register custom provider', () => {
      const mockProvider: FileProvider = {
        scheme: 'custom',
        read: async () => ({ content: '', encoding: 'utf-8', modTime: 0, size: 0 }),
        write: async () => ({ success: true, modTime: 0, bytesWritten: 0 }),
        stat: async (uri) => ({ uri, exists: true, isDirectory: false, isFile: true, isSymlink: false, size: 0, modTime: 0, createTime: 0 }),
        exists: async () => true,
        delete: async () => {},
        rename: async () => {},
        copy: async () => {},
        readDir: async () => [],
        createDir: async () => {},
        deleteDir: async () => {},
      };

      service.registerProvider(mockProvider);

      const provider = service.getProvider('custom');
      expect(provider).toBe(mockProvider);
      expect(service.listProviders()).toContain('custom');
    });

    it('should throw for unknown scheme', async () => {
      try {
        await service.read('unknown://path/to/file');
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FileError);
        expect((error as FileError).code).toBe(FileErrorCode.NO_PROVIDER);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Content Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('read', () => {
    it('should route to correct provider', async () => {
      const result = await service.read(workspace.fileUri('test.txt'));

      expect(result.content).toBe('Hello, World!');
    });
  });

  describe('write', () => {
    it('should route to correct provider', async () => {
      const uri = workspace.fileUri('new.txt');
      const result = await service.write(uri, 'New content');

      expect(result.success).toBe(true);

      const content = await workspace.readFile('new.txt');
      expect(content).toBe('New content');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Cross-Scheme Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('rename', () => {
    it('should throw when renaming across schemes', async () => {
      // Register mock provider
      const mockProvider: FileProvider = {
        scheme: 'custom',
        read: async () => ({ content: '', encoding: 'utf-8', modTime: 0, size: 0 }),
        write: async () => ({ success: true, modTime: 0, bytesWritten: 0 }),
        stat: async (uri) => ({ uri, exists: true, isDirectory: false, isFile: true, isSymlink: false, size: 0, modTime: 0, createTime: 0 }),
        exists: async () => true,
        delete: async () => {},
        rename: async () => {},
        copy: async () => {},
        readDir: async () => [],
        createDir: async () => {},
        deleteDir: async () => {},
      };
      service.registerProvider(mockProvider);

      try {
        await service.rename(
          workspace.fileUri('test.txt'),
          'custom://other/file.txt'
        );
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FileError);
        expect((error as FileError).code).toBe(FileErrorCode.INVALID_URI);
      }
    });
  });

  describe('copy', () => {
    it('should copy within same scheme', async () => {
      await service.copy(
        workspace.fileUri('test.txt'),
        workspace.fileUri('copy.txt')
      );

      const content = await workspace.readFile('copy.txt');
      expect(content).toBe('Hello, World!');
    });

    it('should copy across schemes by read+write', async () => {
      // Register mock provider that tracks writes
      let writtenContent = '';
      const mockProvider: FileProvider = {
        scheme: 'mock',
        read: async () => ({ content: '', encoding: 'utf-8', modTime: 0, size: 0 }),
        write: async (_uri, content) => {
          writtenContent = content;
          return { success: true, modTime: 0, bytesWritten: content.length };
        },
        stat: async (uri) => ({ uri, exists: true, isDirectory: false, isFile: true, isSymlink: false, size: 0, modTime: 0, createTime: 0 }),
        exists: async () => true,
        delete: async () => {},
        rename: async () => {},
        copy: async () => {},
        readDir: async () => [],
        createDir: async () => {},
        deleteDir: async () => {},
      };
      service.registerProvider(mockProvider);

      await service.copy(
        workspace.fileUri('test.txt'),
        'mock://path/to/copy.txt'
      );

      expect(writtenContent).toBe('Hello, World!');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Utility Methods
  // ─────────────────────────────────────────────────────────────────────────

  describe('utility methods', () => {
    it('pathToUri should convert path to file:// URI', () => {
      const uri = service.pathToUri('/home/user/test.txt');

      expect(uri).toBe('file:///home/user/test.txt');
    });

    it('pathToUri should handle relative paths', () => {
      const uri = service.pathToUri('test.txt');

      expect(uri).toMatch(/^file:\/\//);
      expect(uri).toMatch(/test\.txt$/);
    });

    it('uriToPath should extract path from file:// URI', () => {
      const path = service.uriToPath('file:///home/user/test.txt');

      expect(path).toBe('/home/user/test.txt');
    });

    it('uriToPath should return null for non-file URI', () => {
      const path = service.uriToPath('http://example.com/file.txt');

      expect(path).toBeNull();
    });

    it('getParentUri should return parent directory URI', () => {
      const parent = service.getParentUri('file:///home/user/project/src/app.ts');

      expect(parent).toBe('file:///home/user/project/src');
    });

    it('getBasename should return file name', () => {
      const name = service.getBasename('file:///home/user/project/app.ts');

      expect(name).toBe('app.ts');
    });

    it('joinUri should join path components', () => {
      const uri = service.joinUri('file:///home/user', 'project', 'src', 'app.ts');

      expect(uri).toBe('file:///home/user/project/src/app.ts');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Watch Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('watch', () => {
    it('should create watch handle', () => {
      const handle = service.watch(
        workspace.rootUri,
        () => {},
        { recursive: true }
      );

      expect(handle.id).toBeDefined();
      expect(typeof handle.dispose).toBe('function');

      handle.dispose();
    });

    it('should allow subscribing to all file changes', () => {
      let callCount = 0;
      const unsubscribe = service.onFileChange(() => {
        callCount++;
      });

      // Verify subscription returns unsubscribe function
      expect(typeof unsubscribe).toBe('function');

      // Cleanup
      unsubscribe();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Dispose
  // ─────────────────────────────────────────────────────────────────────────

  describe('dispose', () => {
    it('should clean up all watches', () => {
      // Create some watches
      const handle1 = service.watch(workspace.rootUri, () => {});
      const handle2 = service.watch(workspace.rootUri, () => {});

      // Should not throw
      service.dispose();

      // Further disposes should be safe
      service.dispose();
    });
  });
});
