/**
 * Git Service Integration Tests
 *
 * Tests for the Git ECP adapter using TestECPClient.
 * Uses a temporary git repository for testing.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { $ } from 'bun';
import { mkdtemp, rm, writeFile, mkdir, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TestECPClient } from '../helpers/ecp-client.ts';
import type {
  GitStatus,
  GitBranchInfo,
  GitCommit,
  CommitResult,
  MergeResult,
} from '../../src/services/git/types.ts';

describe('Git ECP Integration', () => {
  let client: TestECPClient;
  let testDir: string;

  beforeAll(async () => {
    // Create a temp directory for tests (use realpath to resolve macOS symlinks)
    testDir = await realpath(await mkdtemp(join(tmpdir(), 'git-ecp-test-')));

    // Initialize git repo
    await $`git init ${testDir}`.quiet();
    await $`git -C ${testDir} config user.email "test@test.com"`.quiet();
    await $`git -C ${testDir} config user.name "Test User"`.quiet();

    // Create an initial commit
    await writeFile(join(testDir, 'README.md'), '# Test\n');
    await $`git -C ${testDir} add .`.quiet();
    await $`git -C ${testDir} commit -m "Initial commit"`.quiet();

    // Create client
    client = new TestECPClient({ workspaceRoot: testDir });
  });

  afterAll(async () => {
    await client.shutdown();
    await rm(testDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    client.clearNotifications();
  });

  describe('git/isRepo', () => {
    test('returns true for git repository', async () => {
      const result = await client.request<{ isRepo: boolean; rootUri?: string }>('git/isRepo', { uri: testDir });

      expect(result.isRepo).toBe(true);
      expect(result.rootUri).toBe(testDir);
    });

    test('returns false for non-repository', async () => {
      const result = await client.request<{ isRepo: boolean }>('git/isRepo', { uri: tmpdir() });

      expect(result.isRepo).toBe(false);
    });

    test('returns error for missing uri', async () => {
      const response = await client.requestRaw('git/isRepo', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe('git/status', () => {
    test('returns status for clean repository', async () => {
      const result = await client.request<GitStatus>('git/status', { uri: testDir, forceRefresh: true });

      expect(result.branch).toBeDefined();
      expect(result.staged).toEqual([]);
      expect(result.unstaged).toEqual([]);
      expect(result.untracked).toEqual([]);
    });

    test('detects untracked files', async () => {
      await writeFile(join(testDir, 'untracked.txt'), 'content');

      const result = await client.request<GitStatus>('git/status', { uri: testDir, forceRefresh: true });

      expect(result.untracked).toContain('untracked.txt');

      // Clean up
      await rm(join(testDir, 'untracked.txt'));
    });
  });

  describe('git/branch', () => {
    test('returns current branch info', async () => {
      const result = await client.request<{ branch: string; ahead: number; behind: number }>('git/branch', { uri: testDir });

      expect(result.branch).toBeDefined();
      expect(typeof result.ahead).toBe('number');
      expect(typeof result.behind).toBe('number');
    });
  });

  describe('staging operations', () => {
    test('git/stage adds files to index', async () => {
      await writeFile(join(testDir, 'tostage.txt'), 'content');

      await client.request('git/stage', { uri: testDir, paths: ['tostage.txt'] });

      const status = await client.request<GitStatus>('git/status', { uri: testDir, forceRefresh: true });
      expect(status.staged.some(f => f.path === 'tostage.txt')).toBe(true);

      // Clean up
      await $`git -C ${testDir} reset HEAD tostage.txt`.quiet();
      await rm(join(testDir, 'tostage.txt'));
    });

    test('git/stageAll stages all changes', async () => {
      await writeFile(join(testDir, 'file1.txt'), 'content');
      await writeFile(join(testDir, 'file2.txt'), 'content');

      await client.request('git/stageAll', { uri: testDir });

      const status = await client.request<GitStatus>('git/status', { uri: testDir, forceRefresh: true });
      expect(status.staged.length).toBeGreaterThanOrEqual(2);

      // Clean up
      await $`git -C ${testDir} reset HEAD`.quiet();
      await rm(join(testDir, 'file1.txt'));
      await rm(join(testDir, 'file2.txt'));
    });

    test('git/unstage removes files from index', async () => {
      await writeFile(join(testDir, 'tounstage.txt'), 'content');
      await $`git -C ${testDir} add tounstage.txt`.quiet();

      await client.request('git/unstage', { uri: testDir, paths: ['tounstage.txt'] });

      const status = await client.request<GitStatus>('git/status', { uri: testDir, forceRefresh: true });
      expect(status.staged.some(f => f.path === 'tounstage.txt')).toBe(false);
      expect(status.untracked).toContain('tounstage.txt');

      // Clean up
      await rm(join(testDir, 'tounstage.txt'));
    });

    test('git/discard reverts changes', async () => {
      await writeFile(join(testDir, 'README.md'), '# Changed\n');

      let status = await client.request<GitStatus>('git/status', { uri: testDir, forceRefresh: true });
      expect(status.unstaged.some(f => f.path === 'README.md')).toBe(true);

      await client.request('git/discard', { uri: testDir, paths: ['README.md'] });

      status = await client.request<GitStatus>('git/status', { uri: testDir, forceRefresh: true });
      expect(status.unstaged.some(f => f.path === 'README.md')).toBe(false);
    });
  });

  describe('commit operations', () => {
    test('git/commit creates a new commit', async () => {
      await writeFile(join(testDir, 'newfile.txt'), 'content');
      await $`git -C ${testDir} add newfile.txt`.quiet();

      const result = await client.request<CommitResult>('git/commit', { uri: testDir, message: 'Add new file' });

      expect(result.success).toBe(true);
      expect(result.hash).toBeDefined();
    });

    test('git/log returns commit history', async () => {
      const result = await client.request<{ commits: GitCommit[] }>('git/log', { uri: testDir, count: 10 });

      expect(result.commits.length).toBeGreaterThan(0);
      expect(result.commits[0]?.hash).toBeDefined();
      expect(result.commits[0]?.author).toBe('Test User');
    });
  });

  describe('branch operations', () => {
    test('git/branches lists all branches', async () => {
      const result = await client.request<{ branches: { name: string }[]; current: string }>('git/branches', { uri: testDir });

      expect(result.branches.length).toBeGreaterThan(0);
      expect(result.current).toBeDefined();
    });

    test('git/createBranch creates new branch', async () => {
      await client.request('git/createBranch', { uri: testDir, name: 'test-branch', checkout: false });

      const result = await client.request<{ branches: { name: string }[] }>('git/branches', { uri: testDir });
      expect(result.branches.some(b => b.name === 'test-branch')).toBe(true);
    });

    test('git/switchBranch switches to branch', async () => {
      await client.request('git/switchBranch', { uri: testDir, name: 'test-branch' });

      const result = await client.request<{ branches: { name: string }[]; current: string }>('git/branches', { uri: testDir });
      expect(result.current).toBe('test-branch');
    });

    test('git/deleteBranch deletes branch', async () => {
      // Switch back first
      await $`git -C ${testDir} checkout -`.quiet();

      await client.request('git/deleteBranch', { uri: testDir, name: 'test-branch' });

      const result = await client.request<{ branches: { name: string }[] }>('git/branches', { uri: testDir });
      expect(result.branches.some(b => b.name === 'test-branch')).toBe(false);
    });
  });

  describe('diff operations', () => {
    test('git/diff returns hunks for modified file', async () => {
      await writeFile(join(testDir, 'README.md'), '# Modified\nNew line\n');

      const result = await client.request<{ hunks: unknown[] }>('git/diff', { uri: testDir, path: 'README.md' });

      expect(result.hunks.length).toBeGreaterThan(0);

      // Restore
      await $`git -C ${testDir} checkout -- README.md`.quiet();
    });

    test('git/diffLines returns line changes', async () => {
      await writeFile(join(testDir, 'README.md'), '# Modified\n');

      const result = await client.request<{ changes: unknown[] }>('git/diffLines', { uri: testDir, path: 'README.md' });

      expect(result.changes.length).toBeGreaterThan(0);

      // Restore
      await $`git -C ${testDir} checkout -- README.md`.quiet();
    });
  });

  describe('git/show', () => {
    test('returns file content at HEAD', async () => {
      const result = await client.request<{ content: string }>('git/show', { uri: testDir, path: 'README.md', ref: 'HEAD' });

      expect(result.content).toBe('# Test\n');
    });
  });

  describe('error handling', () => {
    test('returns error for invalid params', async () => {
      const response = await client.requestRaw('git/stage', { uri: testDir });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });

    test('returns error for unknown method', async () => {
      const response = await client.requestRaw('git/unknown', { uri: testDir });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601);
    });
  });
});
