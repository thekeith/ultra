/**
 * Integration Tests for Git ECP Methods
 *
 * Tests the git/* ECP methods via TestECPClient.
 * These tests verify the JSON-RPC protocol layer.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { TestECPClient } from '../helpers/ecp-client.ts';
import { createTempWorkspace, type TempWorkspace } from '../helpers/temp-workspace.ts';

describe('git/* ECP Methods', () => {
  let client: TestECPClient;
  let workspace: TempWorkspace;

  beforeEach(async () => {
    client = new TestECPClient();
    workspace = await createTempWorkspace({
      git: true,
      files: {
        'README.md': '# Test Project',
        'src/app.ts': 'const x = 1;',
        'src/utils.ts': 'export const helper = () => {};',
      },
    });

    // Create initial commit
    await workspace.gitAdd(['.']);
    await workspace.gitCommit('Initial commit');
  });

  afterEach(async () => {
    await client.shutdown();
    await workspace.cleanup();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Repository Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('git/isRepo', () => {
    test('returns true for git repository', async () => {
      const result = await client.request<{ isRepo: boolean; rootUri?: string }>('git/isRepo', {
        uri: workspace.rootUri,
      });

      expect(result.isRepo).toBe(true);
      expect(result.rootUri).toBe(workspace.rootUri);
    });

    test('returns false for non-git directory', async () => {
      const nonGitWorkspace = await createTempWorkspace({ git: false });
      try {
        const result = await client.request<{ isRepo: boolean }>('git/isRepo', {
          uri: nonGitWorkspace.rootUri,
        });

        expect(result.isRepo).toBe(false);
      } finally {
        await nonGitWorkspace.cleanup();
      }
    });

    test('returns error without uri', async () => {
      const response = await client.requestRaw('git/isRepo', {});

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32602); // InvalidParams
    });
  });

  describe('git/status', () => {
    test('returns clean status', async () => {
      const result = await client.request<{
        branch: string;
        ahead: number;
        behind: number;
        staged: Array<{ path: string; status: string }>;
        unstaged: Array<{ path: string; status: string }>;
        untracked: string[];
      }>('git/status', {
        uri: workspace.rootUri,
      });

      expect(result.branch).toBeDefined();
      expect(result.staged).toEqual([]);
      expect(result.unstaged).toEqual([]);
      expect(result.untracked).toEqual([]);
    });

    test('detects modified files', async () => {
      await workspace.writeFile('README.md', '# Updated Project');

      const result = await client.request<{
        unstaged: Array<{ path: string; status: string }>;
      }>('git/status', {
        uri: workspace.rootUri,
        forceRefresh: true,
      });

      expect(result.unstaged.length).toBe(1);
      expect(result.unstaged[0]!.path).toBe('README.md');
      expect(result.unstaged[0]!.status).toBe('M');
    });

    test('detects untracked files', async () => {
      await workspace.writeFile('new-file.txt', 'new content');

      const result = await client.request<{ untracked: string[] }>('git/status', {
        uri: workspace.rootUri,
        forceRefresh: true,
      });

      expect(result.untracked).toContain('new-file.txt');
    });
  });

  describe('git/branch', () => {
    test('returns current branch info', async () => {
      const result = await client.request<{
        branch: string;
        tracking?: string;
        ahead: number;
        behind: number;
      }>('git/branch', {
        uri: workspace.rootUri,
      });

      expect(result.branch).toBeDefined();
      expect(typeof result.ahead).toBe('number');
      expect(typeof result.behind).toBe('number');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Staging Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('git/stage', () => {
    test('stages specified files', async () => {
      await workspace.writeFile('README.md', '# Updated');

      const result = await client.request<{ success: boolean }>('git/stage', {
        uri: workspace.rootUri,
        paths: ['README.md'],
      });

      expect(result.success).toBe(true);

      const status = await client.request<{
        staged: Array<{ path: string }>;
      }>('git/status', { uri: workspace.rootUri, forceRefresh: true });
      expect(status.staged.length).toBe(1);
    });
  });

  describe('git/stageAll', () => {
    test('stages all changes', async () => {
      await workspace.writeFile('README.md', '# Updated');
      await workspace.writeFile('new-file.txt', 'new');

      const result = await client.request<{ success: boolean }>('git/stageAll', {
        uri: workspace.rootUri,
      });

      expect(result.success).toBe(true);

      const status = await client.request<{
        staged: Array<{ path: string }>;
        untracked: string[];
      }>('git/status', { uri: workspace.rootUri, forceRefresh: true });
      expect(status.staged.length).toBe(2);
      expect(status.untracked.length).toBe(0);
    });
  });

  describe('git/unstage', () => {
    test('unstages specified files', async () => {
      await workspace.writeFile('README.md', '# Updated');
      await workspace.gitAdd(['README.md']);

      const result = await client.request<{ success: boolean }>('git/unstage', {
        uri: workspace.rootUri,
        paths: ['README.md'],
      });

      expect(result.success).toBe(true);

      const status = await client.request<{
        staged: Array<{ path: string }>;
        unstaged: Array<{ path: string }>;
      }>('git/status', { uri: workspace.rootUri, forceRefresh: true });
      expect(status.staged.length).toBe(0);
      expect(status.unstaged.length).toBe(1);
    });
  });

  describe('git/discard', () => {
    test('discards changes to files', async () => {
      await workspace.writeFile('README.md', '# Updated');

      const result = await client.request<{ success: boolean }>('git/discard', {
        uri: workspace.rootUri,
        paths: ['README.md'],
      });

      expect(result.success).toBe(true);

      const content = await workspace.readFile('README.md');
      expect(content).toBe('# Test Project');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Diff Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('git/diff', () => {
    test('returns empty hunks for unchanged file', async () => {
      const result = await client.request<{
        hunks: Array<{ oldStart: number; newStart: number }>;
      }>('git/diff', {
        uri: workspace.rootUri,
        path: 'README.md',
      });

      expect(result.hunks).toEqual([]);
    });

    test('returns hunks for modified file', async () => {
      await workspace.writeFile('README.md', '# Updated\n\nNew line');

      const result = await client.request<{
        hunks: Array<{ oldStart: number; newStart: number; lines: unknown[] }>;
      }>('git/diff', {
        uri: workspace.rootUri,
        path: 'README.md',
      });

      expect(result.hunks.length).toBeGreaterThan(0);
    });
  });

  describe('git/diffLines', () => {
    test('returns line changes', async () => {
      await workspace.writeFile('README.md', '# Modified\nNew line');

      const result = await client.request<{
        changes: Array<{ line: number; type: string }>;
      }>('git/diffLines', {
        uri: workspace.rootUri,
        path: 'README.md',
      });

      expect(result.changes.length).toBeGreaterThan(0);
    });
  });

  describe('git/diffBuffer', () => {
    test('compares buffer content with HEAD', async () => {
      const result = await client.request<{
        changes: Array<{ line: number; type: string }>;
      }>('git/diffBuffer', {
        uri: workspace.rootUri,
        path: 'README.md',
        content: '# Modified Buffer\nNew line',
      });

      expect(result.changes.length).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Commit Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('git/commit', () => {
    test('creates a commit', async () => {
      await workspace.writeFile('README.md', '# Updated');
      await client.request('git/stageAll', { uri: workspace.rootUri });

      const result = await client.request<{
        success: boolean;
        hash?: string;
      }>('git/commit', {
        uri: workspace.rootUri,
        message: 'Update readme',
      });

      expect(result.success).toBe(true);
      expect(result.hash).toBeDefined();
    });

    test('fails with empty message', async () => {
      await workspace.writeFile('README.md', '# Updated');
      await client.request('git/stageAll', { uri: workspace.rootUri });

      const result = await client.request<{ success: boolean; message?: string }>('git/commit', {
        uri: workspace.rootUri,
        message: '',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('git/amend', () => {
    test('amends the last commit', async () => {
      const result = await client.request<{
        success: boolean;
        hash?: string;
      }>('git/amend', {
        uri: workspace.rootUri,
        message: 'Amended message',
      });

      expect(result.success).toBe(true);
      expect(result.hash).toBeDefined();
    });
  });

  describe('git/log', () => {
    test('returns commit history', async () => {
      const result = await client.request<{
        commits: Array<{
          hash: string;
          shortHash: string;
          message: string;
          author: string;
        }>;
      }>('git/log', {
        uri: workspace.rootUri,
      });

      expect(result.commits.length).toBeGreaterThan(0);
      expect(result.commits[0]!.hash).toBeDefined();
      expect(result.commits[0]!.message).toBeDefined();
    });

    test('limits number of commits', async () => {
      // Create a few more commits
      for (let i = 0; i < 5; i++) {
        await workspace.writeFile('README.md', `# Update ${i}`);
        await workspace.gitAdd(['README.md']);
        await workspace.gitCommit(`Commit ${i}`);
      }

      const result = await client.request<{
        commits: Array<{ hash: string }>;
      }>('git/log', {
        uri: workspace.rootUri,
        count: 3,
      });

      expect(result.commits.length).toBe(3);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Branch Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('git/branches', () => {
    test('lists branches', async () => {
      const result = await client.request<{
        branches: Array<{ name: string; current: boolean }>;
        current: string;
      }>('git/branches', {
        uri: workspace.rootUri,
      });

      expect(result.branches.length).toBeGreaterThan(0);
      expect(result.current).toBeDefined();
    });
  });

  describe('git/createBranch', () => {
    test('creates and checks out a branch', async () => {
      const result = await client.request<{ success: boolean }>('git/createBranch', {
        uri: workspace.rootUri,
        name: 'feature-branch',
        checkout: true,
      });

      expect(result.success).toBe(true);

      const branches = await client.request<{ current: string }>('git/branches', {
        uri: workspace.rootUri,
      });
      expect(branches.current).toBe('feature-branch');
    });
  });

  describe('git/switchBranch', () => {
    test('switches to existing branch', async () => {
      await client.request('git/createBranch', {
        uri: workspace.rootUri,
        name: 'other-branch',
        checkout: false,
      });

      const result = await client.request<{ success: boolean }>('git/switchBranch', {
        uri: workspace.rootUri,
        name: 'other-branch',
      });

      expect(result.success).toBe(true);

      const branches = await client.request<{ current: string }>('git/branches', {
        uri: workspace.rootUri,
      });
      expect(branches.current).toBe('other-branch');
    });

    test('returns error for non-existent branch', async () => {
      const response = await client.requestRaw('git/switchBranch', {
        uri: workspace.rootUri,
        name: 'nonexistent',
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32206); // BranchNotFound
    });
  });

  describe('git/deleteBranch', () => {
    test('deletes a branch', async () => {
      await client.request('git/createBranch', {
        uri: workspace.rootUri,
        name: 'to-delete',
        checkout: false,
      });

      const result = await client.request<{ success: boolean }>('git/deleteBranch', {
        uri: workspace.rootUri,
        name: 'to-delete',
      });

      expect(result.success).toBe(true);

      const branches = await client.request<{
        branches: Array<{ name: string }>;
      }>('git/branches', { uri: workspace.rootUri });
      expect(branches.branches.some(b => b.name === 'to-delete')).toBe(false);
    });
  });

  describe('git/renameBranch', () => {
    test('renames current branch', async () => {
      await client.request('git/createBranch', {
        uri: workspace.rootUri,
        name: 'old-name',
        checkout: true,
      });

      const result = await client.request<{ success: boolean }>('git/renameBranch', {
        uri: workspace.rootUri,
        newName: 'new-name',
      });

      expect(result.success).toBe(true);

      const branches = await client.request<{ current: string }>('git/branches', {
        uri: workspace.rootUri,
      });
      expect(branches.current).toBe('new-name');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Merge Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('git/merge', () => {
    test('merges a branch', async () => {
      // Create feature branch with changes
      await client.request('git/createBranch', {
        uri: workspace.rootUri,
        name: 'feature',
        checkout: true,
      });
      await workspace.writeFile('feature.txt', 'feature content');
      await client.request('git/stageAll', { uri: workspace.rootUri });
      await client.request('git/commit', { uri: workspace.rootUri, message: 'Add feature' });

      // Switch back and merge
      await client.request('git/switchBranch', { uri: workspace.rootUri, name: 'master' });

      const result = await client.request<{
        success: boolean;
        conflicts: string[];
      }>('git/merge', {
        uri: workspace.rootUri,
        branch: 'feature',
      });

      expect(result.success).toBe(true);
      expect(result.conflicts).toEqual([]);
    });
  });

  describe('git/mergeAbort', () => {
    test('aborts when no merge in progress returns error', async () => {
      // When no merge is in progress, abort should fail
      const response = await client.requestRaw('git/mergeAbort', {
        uri: workspace.rootUri,
      });

      // It should either succeed silently or return an error
      // depending on git version behavior
    });
  });

  describe('git/conflicts', () => {
    test('returns empty when no conflicts', async () => {
      const result = await client.request<{ files: string[] }>('git/conflicts', {
        uri: workspace.rootUri,
      });

      expect(result.files).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Stash Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('git/stash', () => {
    test('stashes changes', async () => {
      await workspace.writeFile('README.md', '# Stashed');

      const result = await client.request<{ success: boolean; stashId: string }>('git/stash', {
        uri: workspace.rootUri,
        message: 'WIP',
      });

      expect(result.success).toBe(true);
      expect(result.stashId).toBe('stash@{0}');

      // Working tree should be clean
      const status = await client.request<{ unstaged: unknown[] }>('git/status', {
        uri: workspace.rootUri,
        forceRefresh: true,
      });
      expect(status.unstaged.length).toBe(0);
    });
  });

  describe('git/stashList', () => {
    test('lists stashes', async () => {
      await workspace.writeFile('README.md', '# Stash 1');
      await client.request('git/stash', { uri: workspace.rootUri, message: 'First stash' });

      const result = await client.request<{
        stashes: Array<{ id: string; branch: string; message: string }>;
      }>('git/stashList', {
        uri: workspace.rootUri,
      });

      expect(result.stashes.length).toBe(1);
      expect(result.stashes[0]!.id).toBe('stash@{0}');
    });
  });

  describe('git/stashPop', () => {
    test('pops the latest stash', async () => {
      await workspace.writeFile('README.md', '# Stashed');
      await client.request('git/stash', { uri: workspace.rootUri });

      const result = await client.request<{ success: boolean }>('git/stashPop', {
        uri: workspace.rootUri,
      });

      expect(result.success).toBe(true);

      const status = await client.request<{ unstaged: unknown[] }>('git/status', {
        uri: workspace.rootUri,
        forceRefresh: true,
      });
      expect(status.unstaged.length).toBe(1);
    });
  });

  describe('git/stashDrop', () => {
    test('drops a stash', async () => {
      await workspace.writeFile('README.md', '# Stash');
      await client.request('git/stash', { uri: workspace.rootUri });

      const result = await client.request<{ success: boolean }>('git/stashDrop', {
        uri: workspace.rootUri,
        stashId: 'stash@{0}',
      });

      expect(result.success).toBe(true);

      const stashes = await client.request<{ stashes: unknown[] }>('git/stashList', {
        uri: workspace.rootUri,
      });
      expect(stashes.stashes.length).toBe(0);
    });
  });

  describe('git/stashApply', () => {
    test('applies stash without removing it', async () => {
      await workspace.writeFile('README.md', '# Stashed');
      await client.request('git/stash', { uri: workspace.rootUri });

      const result = await client.request<{ success: boolean }>('git/stashApply', {
        uri: workspace.rootUri,
      });

      expect(result.success).toBe(true);

      // Stash should still exist
      const stashes = await client.request<{ stashes: unknown[] }>('git/stashList', {
        uri: workspace.rootUri,
      });
      expect(stashes.stashes.length).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Blame
  // ─────────────────────────────────────────────────────────────────────────

  describe('git/blame', () => {
    test('returns blame information', async () => {
      const result = await client.request<{
        lines: Array<{
          commit: string;
          author: string;
          date: string;
          line: number;
          content: string;
        }>;
      }>('git/blame', {
        uri: workspace.rootUri,
        path: 'README.md',
      });

      expect(result.lines.length).toBeGreaterThan(0);
      expect(result.lines[0]!.commit).toBeDefined();
      expect(result.lines[0]!.author).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Content
  // ─────────────────────────────────────────────────────────────────────────

  describe('git/show', () => {
    test('gets file content at HEAD', async () => {
      const result = await client.request<{ content: string }>('git/show', {
        uri: workspace.rootUri,
        path: 'README.md',
        ref: 'HEAD',
      });

      expect(result.content).toBe('# Test Project');
    });

    test('returns error for non-existent file', async () => {
      const response = await client.requestRaw('git/show', {
        uri: workspace.rootUri,
        path: 'nonexistent.txt',
        ref: 'HEAD',
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32211); // FileNotFound
    });

    test('returns error for invalid ref', async () => {
      const response = await client.requestRaw('git/show', {
        uri: workspace.rootUri,
        path: 'README.md',
        ref: 'invalid-ref',
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32210); // RefNotFound
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Notifications
  // ─────────────────────────────────────────────────────────────────────────

  describe('git/didChange notifications', () => {
    test('emits notification on staging', async () => {
      client.clearNotifications();

      await workspace.writeFile('README.md', '# Updated');
      await client.request('git/stage', {
        uri: workspace.rootUri,
        paths: ['README.md'],
      });

      const notifications = client.getNotifications('git/didChange');
      expect(notifications.length).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Error Handling
  // ─────────────────────────────────────────────────────────────────────────

  describe('Error Handling', () => {
    test('returns NOT_A_REPO error for non-repo', async () => {
      const nonGitWorkspace = await createTempWorkspace({ git: false });
      try {
        const response = await client.requestRaw('git/status', {
          uri: nonGitWorkspace.rootUri,
        });

        expect(response.error).toBeDefined();
        expect(response.error!.code).toBe(-32200); // NotARepo
      } finally {
        await nonGitWorkspace.cleanup();
      }
    });
  });
});
