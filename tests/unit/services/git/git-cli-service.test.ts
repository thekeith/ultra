/**
 * GitCliService Unit Tests
 *
 * Tests for the git CLI service implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { GitCliService } from '../../../../src/services/git/cli.ts';
import { GitError, GitErrorCode } from '../../../../src/services/git/errors.ts';
import { createTempWorkspace, type TempWorkspace } from '../../../helpers/temp-workspace.ts';

describe('GitCliService', () => {
  let service: GitCliService;
  let workspace: TempWorkspace;

  beforeEach(async () => {
    service = new GitCliService();
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
    await workspace.cleanup();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Repository Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('isRepo', () => {
    it('should return true for git repository', async () => {
      const result = await service.isRepo(workspace.rootUri);
      expect(result).toBe(true);
    });

    it('should return false for non-git directory', async () => {
      const nonGitWorkspace = await createTempWorkspace({ git: false });
      try {
        const result = await service.isRepo(nonGitWorkspace.rootUri);
        expect(result).toBe(false);
      } finally {
        await nonGitWorkspace.cleanup();
      }
    });
  });

  describe('getRoot', () => {
    it('should return repository root URI', async () => {
      const root = await service.getRoot(workspace.rootUri);
      expect(root).toBe(workspace.rootUri);
    });

    it('should return root from subdirectory', async () => {
      const root = await service.getRoot(workspace.fileUri('src'));
      expect(root).toBe(workspace.rootUri);
    });

    it('should return null for non-git directory', async () => {
      const nonGitWorkspace = await createTempWorkspace({ git: false });
      try {
        const root = await service.getRoot(nonGitWorkspace.rootUri);
        expect(root).toBeNull();
      } finally {
        await nonGitWorkspace.cleanup();
      }
    });
  });

  describe('status', () => {
    it('should return clean status', async () => {
      const status = await service.status(workspace.rootUri);

      expect(status.branch).toBeDefined();
      expect(status.staged).toEqual([]);
      expect(status.unstaged).toEqual([]);
      expect(status.untracked).toEqual([]);
    });

    it('should detect modified file', async () => {
      await workspace.writeFile('README.md', '# Updated Project');

      const status = await service.status(workspace.rootUri, true);

      expect(status.unstaged.length).toBe(1);
      expect(status.unstaged[0]!.path).toBe('README.md');
      expect(status.unstaged[0]!.status).toBe('M');
    });

    it('should detect untracked file', async () => {
      await workspace.writeFile('new-file.txt', 'new content');

      const status = await service.status(workspace.rootUri, true);

      expect(status.untracked).toContain('new-file.txt');
    });

    it('should detect staged file', async () => {
      await workspace.writeFile('README.md', '# Updated Project');
      await workspace.gitAdd(['README.md']);

      const status = await service.status(workspace.rootUri, true);

      expect(status.staged.length).toBe(1);
      expect(status.staged[0]!.path).toBe('README.md');
      expect(status.staged[0]!.status).toBe('M');
    });

    it('should use cache when forceRefresh is false', async () => {
      // Get initial status
      await service.status(workspace.rootUri);

      // Modify file
      await workspace.writeFile('README.md', '# Updated Project');

      // Should return cached result
      const cachedStatus = await service.status(workspace.rootUri, false);
      expect(cachedStatus.unstaged.length).toBe(0);

      // Force refresh should see the change
      const freshStatus = await service.status(workspace.rootUri, true);
      expect(freshStatus.unstaged.length).toBe(1);
    });
  });

  describe('branch', () => {
    it('should return branch info', async () => {
      const info = await service.branch(workspace.rootUri);

      expect(info.branch).toBeDefined();
      expect(typeof info.ahead).toBe('number');
      expect(typeof info.behind).toBe('number');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Staging Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('stage', () => {
    it('should stage a file', async () => {
      await workspace.writeFile('README.md', '# Updated');

      await service.stage(workspace.rootUri, ['README.md']);

      const status = await service.status(workspace.rootUri, true);
      expect(status.staged.length).toBe(1);
      expect(status.unstaged.length).toBe(0);
    });

    it('should stage multiple files', async () => {
      await workspace.writeFile('README.md', '# Updated');
      await workspace.writeFile('src/app.ts', 'const x = 2;');

      await service.stage(workspace.rootUri, ['README.md', 'src/app.ts']);

      const status = await service.status(workspace.rootUri, true);
      expect(status.staged.length).toBe(2);
    });
  });

  describe('stageAll', () => {
    it('should stage all changes', async () => {
      await workspace.writeFile('README.md', '# Updated');
      await workspace.writeFile('new-file.txt', 'new');

      await service.stageAll(workspace.rootUri);

      const status = await service.status(workspace.rootUri, true);
      expect(status.staged.length).toBe(2);
      expect(status.unstaged.length).toBe(0);
      expect(status.untracked.length).toBe(0);
    });
  });

  describe('unstage', () => {
    it('should unstage a file', async () => {
      await workspace.writeFile('README.md', '# Updated');
      await workspace.gitAdd(['README.md']);

      await service.unstage(workspace.rootUri, ['README.md']);

      const status = await service.status(workspace.rootUri, true);
      expect(status.staged.length).toBe(0);
      expect(status.unstaged.length).toBe(1);
    });
  });

  describe('discard', () => {
    it('should discard changes to a file', async () => {
      await workspace.writeFile('README.md', '# Updated');

      await service.discard(workspace.rootUri, ['README.md']);

      const content = await workspace.readFile('README.md');
      expect(content).toBe('# Test Project');

      const status = await service.status(workspace.rootUri, true);
      expect(status.unstaged.length).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Diff Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('diff', () => {
    it('should return empty hunks for unchanged file', async () => {
      const hunks = await service.diff(workspace.rootUri, 'README.md');
      expect(hunks).toEqual([]);
    });

    it('should return hunks for modified file', async () => {
      await workspace.writeFile('README.md', '# Updated Project\n\nNew line');

      const hunks = await service.diff(workspace.rootUri, 'README.md');

      expect(hunks.length).toBeGreaterThan(0);
      expect(hunks[0]!.lines.length).toBeGreaterThan(0);
    });

    it('should diff staged changes when staged=true', async () => {
      await workspace.writeFile('README.md', '# Staged Update');
      await workspace.gitAdd(['README.md']);

      const hunks = await service.diff(workspace.rootUri, 'README.md', true);

      expect(hunks.length).toBeGreaterThan(0);
    });
  });

  describe('diffLines', () => {
    it('should return line changes for modified file', async () => {
      await workspace.writeFile('README.md', '# Modified\nNew line');

      const changes = await service.diffLines(workspace.rootUri, 'README.md');

      expect(changes.length).toBeGreaterThan(0);
    });
  });

  describe('diffBuffer', () => {
    it('should compare buffer content with HEAD', async () => {
      const changes = await service.diffBuffer(
        workspace.rootUri,
        'README.md',
        '# Modified Buffer\nNew line'
      );

      expect(changes.length).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Commit Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('commit', () => {
    it('should create a commit', async () => {
      await workspace.writeFile('README.md', '# Updated');
      await service.stageAll(workspace.rootUri);

      const result = await service.commit(workspace.rootUri, 'Update readme');

      expect(result.success).toBe(true);
      expect(result.hash).toBeDefined();
    });

    it('should fail with empty message', async () => {
      await workspace.writeFile('README.md', '# Updated');
      await service.stageAll(workspace.rootUri);

      const result = await service.commit(workspace.rootUri, '');

      expect(result.success).toBe(false);
    });

    it('should fail with nothing staged', async () => {
      const result = await service.commit(workspace.rootUri, 'Empty commit');

      expect(result.success).toBe(false);
    });
  });

  describe('amend', () => {
    it('should amend the last commit with new message', async () => {
      const result = await service.amend(workspace.rootUri, 'Amended message');

      expect(result.success).toBe(true);
      expect(result.hash).toBeDefined();
    });

    it('should amend without changing message', async () => {
      await workspace.writeFile('README.md', '# Updated');
      await service.stageAll(workspace.rootUri);

      const result = await service.amend(workspace.rootUri);

      expect(result.success).toBe(true);
    });
  });

  describe('log', () => {
    it('should return commit history', async () => {
      const commits = await service.log(workspace.rootUri);

      expect(commits.length).toBeGreaterThan(0);
      expect(commits[0]!.hash).toBeDefined();
      expect(commits[0]!.shortHash).toBeDefined();
      expect(commits[0]!.message).toBeDefined();
      expect(commits[0]!.author).toBeDefined();
    });

    it('should limit number of commits', async () => {
      // Create a few more commits
      for (let i = 0; i < 5; i++) {
        await workspace.writeFile('README.md', `# Update ${i}`);
        await workspace.gitAdd(['README.md']);
        await workspace.gitCommit(`Commit ${i}`);
      }

      const commits = await service.log(workspace.rootUri, 3);

      expect(commits.length).toBe(3);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Branch Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('branches', () => {
    it('should list branches', async () => {
      const result = await service.branches(workspace.rootUri);

      expect(result.branches.length).toBeGreaterThan(0);
      expect(result.current).toBeDefined();
    });
  });

  describe('createBranch', () => {
    it('should create a new branch and checkout', async () => {
      await service.createBranch(workspace.rootUri, 'feature-branch', true);

      const result = await service.branches(workspace.rootUri);
      expect(result.current).toBe('feature-branch');
    });

    it('should create a branch without checkout', async () => {
      const initialBranch = (await service.branches(workspace.rootUri)).current;

      await service.createBranch(workspace.rootUri, 'new-branch', false);

      const result = await service.branches(workspace.rootUri);
      expect(result.current).toBe(initialBranch);
      expect(result.branches.some(b => b.name === 'new-branch')).toBe(true);
    });

    it('should throw if branch already exists', async () => {
      await service.createBranch(workspace.rootUri, 'existing-branch', false);

      await expect(service.createBranch(workspace.rootUri, 'existing-branch', false)).rejects.toThrow();
    });
  });

  describe('switchBranch', () => {
    it('should switch to existing branch', async () => {
      await service.createBranch(workspace.rootUri, 'other-branch', false);

      await service.switchBranch(workspace.rootUri, 'other-branch');

      const result = await service.branches(workspace.rootUri);
      expect(result.current).toBe('other-branch');
    });

    it('should throw for non-existent branch', async () => {
      await expect(service.switchBranch(workspace.rootUri, 'nonexistent')).rejects.toThrow();
    });
  });

  describe('deleteBranch', () => {
    it('should delete a branch', async () => {
      await service.createBranch(workspace.rootUri, 'to-delete', false);

      await service.deleteBranch(workspace.rootUri, 'to-delete');

      const result = await service.branches(workspace.rootUri);
      expect(result.branches.some(b => b.name === 'to-delete')).toBe(false);
    });
  });

  describe('renameBranch', () => {
    it('should rename the current branch', async () => {
      await service.createBranch(workspace.rootUri, 'old-name', true);

      await service.renameBranch(workspace.rootUri, 'new-name');

      const result = await service.branches(workspace.rootUri);
      expect(result.current).toBe('new-name');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Merge Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('merge', () => {
    it('should merge a branch', async () => {
      // Create feature branch with changes
      await service.createBranch(workspace.rootUri, 'feature', true);
      await workspace.writeFile('feature.txt', 'feature content');
      await service.stageAll(workspace.rootUri);
      await service.commit(workspace.rootUri, 'Add feature');

      // Switch back to main and merge
      await service.switchBranch(workspace.rootUri, 'master');
      const result = await service.merge(workspace.rootUri, 'feature');

      expect(result.success).toBe(true);
      expect(result.conflicts).toEqual([]);
    });
  });

  describe('isMerging', () => {
    it('should return false when not in merge', async () => {
      const result = await service.isMerging(workspace.rootUri);
      expect(result).toBe(false);
    });
  });

  describe('getConflicts', () => {
    it('should return empty array when no conflicts', async () => {
      const conflicts = await service.getConflicts(workspace.rootUri);
      expect(conflicts).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Stash Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('stash', () => {
    it('should stash changes', async () => {
      await workspace.writeFile('README.md', '# Stashed changes');

      const stashId = await service.stash(workspace.rootUri, 'WIP');

      expect(stashId).toBe('stash@{0}');

      // Working tree should be clean
      const status = await service.status(workspace.rootUri, true);
      expect(status.unstaged.length).toBe(0);
    });
  });

  describe('stashList', () => {
    it('should list stashes', async () => {
      await workspace.writeFile('README.md', '# Stash 1');
      await service.stash(workspace.rootUri, 'First stash');

      const stashes = await service.stashList(workspace.rootUri);

      expect(stashes.length).toBe(1);
      expect(stashes[0]!.id).toBe('stash@{0}');
    });
  });

  describe('stashPop', () => {
    it('should pop the latest stash', async () => {
      await workspace.writeFile('README.md', '# Stashed');
      await service.stash(workspace.rootUri);

      await service.stashPop(workspace.rootUri);

      const status = await service.status(workspace.rootUri, true);
      expect(status.unstaged.length).toBe(1);

      const stashes = await service.stashList(workspace.rootUri);
      expect(stashes.length).toBe(0);
    });
  });

  describe('stashDrop', () => {
    it('should drop a specific stash', async () => {
      await workspace.writeFile('README.md', '# Stash');
      await service.stash(workspace.rootUri);

      await service.stashDrop(workspace.rootUri, 'stash@{0}');

      const stashes = await service.stashList(workspace.rootUri);
      expect(stashes.length).toBe(0);
    });
  });

  describe('stashApply', () => {
    it('should apply stash without removing it', async () => {
      await workspace.writeFile('README.md', '# Stashed');
      await service.stash(workspace.rootUri);

      await service.stashApply(workspace.rootUri);

      const status = await service.status(workspace.rootUri, true);
      expect(status.unstaged.length).toBe(1);

      // Stash should still exist
      const stashes = await service.stashList(workspace.rootUri);
      expect(stashes.length).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Blame
  // ─────────────────────────────────────────────────────────────────────────

  describe('blame', () => {
    it('should return blame information', async () => {
      const blames = await service.blame(workspace.rootUri, 'README.md');

      expect(blames.length).toBeGreaterThan(0);
      expect(blames[0]!.commit).toBeDefined();
      expect(blames[0]!.author).toBeDefined();
      expect(blames[0]!.line).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Content
  // ─────────────────────────────────────────────────────────────────────────

  describe('show', () => {
    it('should get file content at HEAD', async () => {
      const content = await service.show(workspace.rootUri, 'README.md', 'HEAD');
      expect(content).toBe('# Test Project');
    });

    it('should throw for non-existent file', async () => {
      await expect(
        service.show(workspace.rootUri, 'nonexistent.txt', 'HEAD')
      ).rejects.toThrow();
    });

    it('should throw for invalid ref', async () => {
      await expect(
        service.show(workspace.rootUri, 'README.md', 'invalid-ref')
      ).rejects.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Events
  // ─────────────────────────────────────────────────────────────────────────

  describe('onChange', () => {
    it('should notify on staging', async () => {
      const events: { uri: string; type: string }[] = [];
      const unsubscribe = service.onChange((event) => {
        events.push(event);
      });

      await workspace.writeFile('README.md', '# Updated');
      await service.stage(workspace.rootUri, ['README.md']);

      expect(events.length).toBeGreaterThan(0);
      expect(events[0]!.type).toBe('status');

      unsubscribe();
    });

    it('should unsubscribe correctly', async () => {
      const events: { uri: string; type: string }[] = [];
      const unsubscribe = service.onChange((event) => {
        events.push(event);
      });

      unsubscribe();

      await workspace.writeFile('README.md', '# Updated');
      await service.stage(workspace.rootUri, ['README.md']);

      expect(events.length).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Error Handling
  // ─────────────────────────────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('should throw NOT_A_REPO for non-repo operations', async () => {
      const nonGitWorkspace = await createTempWorkspace({ git: false });
      try {
        await expect(service.status(nonGitWorkspace.rootUri)).rejects.toThrow();
      } finally {
        await nonGitWorkspace.cleanup();
      }
    });
  });
});
