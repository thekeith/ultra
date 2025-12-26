/**
 * GitCliService Unit Tests
 *
 * Tests for the Git CLI service implementation.
 * Uses a temporary git repository for testing.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { $ } from 'bun';
import { mkdtemp, rm, writeFile, mkdir, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GitCliService } from '../../../../src/services/git/cli.ts';
import { GitError, GitErrorCode } from '../../../../src/services/git/errors.ts';

describe('GitCliService', () => {
  let service: GitCliService;
  let testDir: string;

  beforeAll(async () => {
    // Create a temp directory for tests (use realpath to resolve macOS symlinks)
    testDir = await realpath(await mkdtemp(join(tmpdir(), 'git-test-')));
    service = new GitCliService();

    // Initialize git repo
    await $`git init ${testDir}`.quiet();
    await $`git -C ${testDir} config user.email "test@test.com"`.quiet();
    await $`git -C ${testDir} config user.name "Test User"`.quiet();

    // Create an initial commit
    await writeFile(join(testDir, 'README.md'), '# Test\n');
    await $`git -C ${testDir} add .`.quiet();
    await $`git -C ${testDir} commit -m "Initial commit"`.quiet();
  });

  afterAll(async () => {
    // Clean up temp directory
    await rm(testDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Clear service caches before each test
    service.invalidateCache(testDir);
  });

  describe('isRepo', () => {
    test('returns true for git repository', async () => {
      const result = await service.isRepo(testDir);
      expect(result).toBe(true);
    });

    test('returns false for non-repository', async () => {
      const result = await service.isRepo(tmpdir());
      expect(result).toBe(false);
    });

    test('returns false for non-existent path', async () => {
      const result = await service.isRepo('/nonexistent/path');
      expect(result).toBe(false);
    });
  });

  describe('getRoot', () => {
    test('returns repository root for repo directory', async () => {
      const root = await service.getRoot(testDir);
      expect(root).toBe(testDir);
    });

    test('returns repository root for subdirectory', async () => {
      const subDir = join(testDir, 'subdir');
      await mkdir(subDir, { recursive: true });

      const root = await service.getRoot(subDir);
      expect(root).toBe(testDir);
    });

    test('returns null for non-repository', async () => {
      const root = await service.getRoot(tmpdir());
      expect(root).toBeNull();
    });
  });

  describe('status', () => {
    test('returns status for clean repository', async () => {
      const status = await service.status(testDir);

      expect(status.branch).toBeDefined();
      expect(status.staged).toEqual([]);
      expect(status.unstaged).toEqual([]);
      expect(status.untracked).toEqual([]);
    });

    test('detects untracked files', async () => {
      await writeFile(join(testDir, 'untracked.txt'), 'content');

      const status = await service.status(testDir, true);

      expect(status.untracked).toContain('untracked.txt');

      // Clean up
      await rm(join(testDir, 'untracked.txt'));
    });

    test('detects modified files', async () => {
      await writeFile(join(testDir, 'README.md'), '# Modified\n');

      const status = await service.status(testDir, true);

      expect(status.unstaged.length).toBe(1);
      expect(status.unstaged[0]?.path).toBe('README.md');
      expect(status.unstaged[0]?.status).toBe('M');

      // Restore file
      await $`git -C ${testDir} checkout -- README.md`.quiet();
    });

    test('detects staged files', async () => {
      await writeFile(join(testDir, 'staged.txt'), 'content');
      await $`git -C ${testDir} add staged.txt`.quiet();

      const status = await service.status(testDir, true);

      expect(status.staged.length).toBe(1);
      expect(status.staged[0]?.path).toBe('staged.txt');
      expect(status.staged[0]?.status).toBe('A');

      // Clean up
      await $`git -C ${testDir} reset HEAD staged.txt`.quiet();
      await rm(join(testDir, 'staged.txt'));
    });

    test('throws for non-repository', async () => {
      await expect(service.status(tmpdir())).rejects.toThrow(GitError);
    });
  });

  describe('branch', () => {
    test('returns current branch info', async () => {
      const info = await service.branch(testDir);

      expect(info.name).toBeDefined();
      expect(typeof info.ahead).toBe('number');
      expect(typeof info.behind).toBe('number');
    });
  });

  describe('staging operations', () => {
    test('stage adds file to index', async () => {
      await writeFile(join(testDir, 'tostage.txt'), 'content');
      await service.stage(testDir, ['tostage.txt']);

      const status = await service.status(testDir, true);
      expect(status.staged.some(f => f.path === 'tostage.txt')).toBe(true);

      // Clean up
      await $`git -C ${testDir} reset HEAD tostage.txt`.quiet();
      await rm(join(testDir, 'tostage.txt'));
    });

    test('stageAll stages all changes', async () => {
      await writeFile(join(testDir, 'file1.txt'), 'content');
      await writeFile(join(testDir, 'file2.txt'), 'content');
      await service.stageAll(testDir);

      const status = await service.status(testDir, true);
      expect(status.staged.length).toBeGreaterThanOrEqual(2);

      // Clean up
      await $`git -C ${testDir} reset HEAD`.quiet();
      await rm(join(testDir, 'file1.txt'));
      await rm(join(testDir, 'file2.txt'));
    });

    test('unstage removes file from index', async () => {
      await writeFile(join(testDir, 'tounstage.txt'), 'content');
      await $`git -C ${testDir} add tounstage.txt`.quiet();

      await service.unstage(testDir, ['tounstage.txt']);

      const status = await service.status(testDir, true);
      expect(status.staged.some(f => f.path === 'tounstage.txt')).toBe(false);
      expect(status.untracked).toContain('tounstage.txt');

      // Clean up
      await rm(join(testDir, 'tounstage.txt'));
    });

    test('discard reverts changes', async () => {
      // Modify a tracked file
      await writeFile(join(testDir, 'README.md'), '# Changed\n');

      let status = await service.status(testDir, true);
      expect(status.unstaged.some(f => f.path === 'README.md')).toBe(true);

      await service.discard(testDir, ['README.md']);

      status = await service.status(testDir, true);
      expect(status.unstaged.some(f => f.path === 'README.md')).toBe(false);
    });
  });

  describe('commit operations', () => {
    test('commit creates a new commit', async () => {
      await writeFile(join(testDir, 'newfile.txt'), 'content');
      await $`git -C ${testDir} add newfile.txt`.quiet();

      const result = await service.commit(testDir, 'Add new file');

      expect(result.success).toBe(true);
      expect(result.hash).toBeDefined();
    });

    test('commit fails with empty message', async () => {
      await writeFile(join(testDir, 'another.txt'), 'content');
      await $`git -C ${testDir} add another.txt`.quiet();

      const result = await service.commit(testDir, '');

      expect(result.success).toBe(false);

      // Clean up
      await $`git -C ${testDir} reset HEAD another.txt`.quiet();
      await rm(join(testDir, 'another.txt'));
    });

    test('log returns commit history', async () => {
      const commits = await service.log(testDir, 10);

      expect(commits.length).toBeGreaterThan(0);
      expect(commits[0]?.hash).toBeDefined();
      expect(commits[0]?.message).toBeDefined();
      expect(commits[0]?.author).toBe('Test User');
    });
  });

  describe('branch operations', () => {
    test('branches lists all branches', async () => {
      const result = await service.branches(testDir);

      expect(result.branches.length).toBeGreaterThan(0);
      expect(result.current).toBeDefined();
    });

    test('createBranch creates new branch', async () => {
      await service.createBranch(testDir, 'test-branch', false);

      const result = await service.branches(testDir);
      expect(result.branches.some(b => b.name === 'test-branch')).toBe(true);
    });

    test('switchBranch switches to branch', async () => {
      await service.switchBranch(testDir, 'test-branch');

      const result = await service.branches(testDir);
      expect(result.current).toBe('test-branch');
    });

    test('deleteBranch deletes branch', async () => {
      // Switch back to main first
      await $`git -C ${testDir} checkout -`.quiet();

      await service.deleteBranch(testDir, 'test-branch');

      const result = await service.branches(testDir);
      expect(result.branches.some(b => b.name === 'test-branch')).toBe(false);
    });
  });

  describe('diff operations', () => {
    test('diff returns hunks for modified file', async () => {
      await writeFile(join(testDir, 'README.md'), '# Modified\nNew line\n');

      const hunks = await service.diff(testDir, 'README.md');

      expect(hunks.length).toBeGreaterThan(0);
      expect(hunks[0]?.lines.length).toBeGreaterThan(0);

      // Restore
      await $`git -C ${testDir} checkout -- README.md`.quiet();
    });

    test('diffLines returns line changes', async () => {
      await writeFile(join(testDir, 'README.md'), '# Modified\n');

      const changes = await service.diffLines(testDir, 'README.md');

      expect(changes.length).toBeGreaterThan(0);

      // Restore
      await $`git -C ${testDir} checkout -- README.md`.quiet();
    });
  });

  describe('show', () => {
    test('returns file content at HEAD', async () => {
      const content = await service.show(testDir, 'README.md', 'HEAD');

      expect(content).toBe('# Test\n');
    });

    test('throws for non-existent file', async () => {
      await expect(service.show(testDir, 'nonexistent.txt', 'HEAD')).rejects.toThrow(GitError);
    });
  });

  describe('events', () => {
    test('onChange subscribes and unsubscribes', () => {
      const callback = () => {};
      const unsubscribe = service.onChange(callback);

      expect(typeof unsubscribe).toBe('function');

      // Should not throw
      unsubscribe();
    });
  });

  describe('diffCommit', () => {
    test('returns hunks for a commit', async () => {
      // Get the most recent commit hash
      const commits = await service.log(testDir, 1);
      expect(commits.length).toBeGreaterThan(0);

      const commitHash = commits[0]!.hash;
      const hunks = await service.diffCommit(testDir, commitHash);

      // The commit should have some changes
      expect(hunks).toBeDefined();
      expect(Array.isArray(hunks)).toBe(true);
    });

    test('returns hunks for specific file in commit', async () => {
      // Create a new commit with a specific file
      await writeFile(join(testDir, 'difftest.txt'), 'line 1\nline 2\n');
      await $`git -C ${testDir} add difftest.txt`.quiet();
      await $`git -C ${testDir} commit -m "Add difftest.txt"`.quiet();

      const commits = await service.log(testDir, 1);
      const commitHash = commits[0]!.hash;

      const hunks = await service.diffCommit(testDir, commitHash, 'difftest.txt');

      expect(hunks.length).toBeGreaterThan(0);
      expect(hunks[0]?.lines.length).toBeGreaterThan(0);
    });

    test('returns empty array for invalid commit', async () => {
      const hunks = await service.diffCommit(testDir, 'invalid-commit-hash');

      expect(hunks).toEqual([]);
    });
  });

  describe('getCommitFiles', () => {
    test('returns files changed in a commit', async () => {
      // Create a commit with multiple files
      await writeFile(join(testDir, 'file1.txt'), 'content1');
      await writeFile(join(testDir, 'file2.txt'), 'content2');
      await $`git -C ${testDir} add file1.txt file2.txt`.quiet();
      await $`git -C ${testDir} commit -m "Add two files"`.quiet();

      const commits = await service.log(testDir, 1);
      const commitHash = commits[0]!.hash;

      const files = await service.getCommitFiles(testDir, commitHash);

      expect(files).toContain('file1.txt');
      expect(files).toContain('file2.txt');
    });

    test('returns single file for single-file commit', async () => {
      await writeFile(join(testDir, 'single.txt'), 'single file');
      await $`git -C ${testDir} add single.txt`.quiet();
      await $`git -C ${testDir} commit -m "Add single file"`.quiet();

      const commits = await service.log(testDir, 1);
      const commitHash = commits[0]!.hash;

      const files = await service.getCommitFiles(testDir, commitHash);

      expect(files).toHaveLength(1);
      expect(files[0]).toBe('single.txt');
    });

    test('returns empty array for invalid commit', async () => {
      const files = await service.getCommitFiles(testDir, 'invalid-hash');

      expect(files).toEqual([]);
    });
  });
});
