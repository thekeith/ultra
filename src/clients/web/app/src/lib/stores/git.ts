/**
 * Git Store
 *
 * Manages git repository state and operations.
 */

import { writable, derived, get } from 'svelte/store';
import { ecpClient } from '../ecp/client';

export type FileStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'ignored' | 'conflict';

export interface GitFileChange {
  path: string;
  status: FileStatus;
  staged: boolean;
  originalPath?: string; // For renamed files
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: GitFileChange[];
  unstaged: GitFileChange[];
  untracked: GitFileChange[];
  conflicts: GitFileChange[];
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

// Server response types (from git service)
interface ServerFileStatus {
  path: string;
  status: 'A' | 'M' | 'D' | 'R' | 'C' | 'U' | '?';
  oldPath?: string;
}

interface ServerGitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: ServerFileStatus[];
  unstaged: ServerFileStatus[];
  untracked: string[];
}

/**
 * Convert server status code to client FileStatus.
 */
function statusCodeToFileStatus(code: string): FileStatus {
  switch (code) {
    case 'A': return 'added';
    case 'M': return 'modified';
    case 'D': return 'deleted';
    case 'R': return 'renamed';
    case 'C': return 'modified'; // Copied
    case 'U': return 'conflict';
    case '?': return 'untracked';
    default: return 'modified';
  }
}

/**
 * Transform server response to client format.
 */
function transformStatus(server: ServerGitStatus): GitStatus {
  return {
    branch: server.branch,
    ahead: server.ahead,
    behind: server.behind,
    staged: server.staged.map((f) => ({
      path: f.path,
      status: statusCodeToFileStatus(f.status),
      staged: true,
      originalPath: f.oldPath,
    })),
    unstaged: server.unstaged.map((f) => ({
      path: f.path,
      status: statusCodeToFileStatus(f.status),
      staged: false,
      originalPath: f.oldPath,
    })),
    untracked: server.untracked.map((path) => ({
      path,
      status: 'untracked' as FileStatus,
      staged: false,
    })),
    conflicts: [
      ...server.staged.filter((f) => f.status === 'U').map((f) => ({
        path: f.path,
        status: 'conflict' as FileStatus,
        staged: true,
      })),
      ...server.unstaged.filter((f) => f.status === 'U').map((f) => ({
        path: f.path,
        status: 'conflict' as FileStatus,
        staged: false,
      })),
    ],
  };
}

function createGitStore() {
  const isRepo = writable<boolean>(false);
  const status = writable<GitStatus | null>(null);
  const isLoading = writable<boolean>(false);
  const error = writable<string | null>(null);

  // Store the workspace root URI for git operations
  let workspaceUri: string = '';

  // Subscribe to git status updates from server
  ecpClient.subscribe('git/statusChanged', async () => {
    await refreshStatus();
  });

  async function refreshStatus(): Promise<void> {
    if (!get(isRepo) || !workspaceUri) return;

    try {
      isLoading.set(true);
      error.set(null);

      const result = await ecpClient.request<ServerGitStatus>('git/status', {
        uri: workspaceUri
      });
      status.set(transformStatus(result));
    } catch (err) {
      error.set(err instanceof Error ? err.message : String(err));
      status.set(null);
    } finally {
      isLoading.set(false);
    }
  }

  return {
    subscribe: status.subscribe,
    isRepo,
    isLoading,
    error,

    /**
     * Initialize git tracking for a repository.
     */
    async init(workspaceRoot: string): Promise<boolean> {
      try {
        // Convert path to URI format
        workspaceUri = workspaceRoot.startsWith('file://')
          ? workspaceRoot
          : `file://${workspaceRoot}`;

        const result = await ecpClient.request<{ isRepo: boolean; rootUri?: string }>('git/isRepo', {
          uri: workspaceUri,
        });

        isRepo.set(result.isRepo);

        if (result.isRepo) {
          // Use the actual git root if returned
          if (result.rootUri) {
            workspaceUri = result.rootUri;
          }
          await refreshStatus();
        }

        return result.isRepo;
      } catch (err) {
        error.set(err instanceof Error ? err.message : String(err));
        isRepo.set(false);
        return false;
      }
    },

    /**
     * Refresh the git status.
     */
    refresh: refreshStatus,

    /**
     * Stage a file.
     */
    async stage(path: string): Promise<void> {
      await ecpClient.request('git/stage', { uri: workspaceUri, paths: [path] });
      await refreshStatus();
    },

    /**
     * Stage all files.
     */
    async stageAll(): Promise<void> {
      await ecpClient.request('git/stageAll', { uri: workspaceUri });
      await refreshStatus();
    },

    /**
     * Unstage a file.
     */
    async unstage(path: string): Promise<void> {
      await ecpClient.request('git/unstage', { uri: workspaceUri, paths: [path] });
      await refreshStatus();
    },

    /**
     * Discard changes to a file.
     */
    async discard(path: string): Promise<void> {
      await ecpClient.request('git/discard', { uri: workspaceUri, paths: [path] });
      await refreshStatus();
    },

    /**
     * Commit staged changes.
     */
    async commit(message: string): Promise<void> {
      await ecpClient.request('git/commit', { uri: workspaceUri, message });
      await refreshStatus();
    },

    /**
     * Amend the last commit.
     */
    async amend(message?: string): Promise<void> {
      await ecpClient.request('git/amend', { uri: workspaceUri, message });
      await refreshStatus();
    },

    /**
     * Get diff for a file.
     */
    async diff(path: string, staged: boolean = false): Promise<string> {
      const result = await ecpClient.request<{ hunks: unknown[] }>('git/diff', {
        uri: workspaceUri,
        path,
        staged,
      });
      // Return formatted diff string from hunks
      return JSON.stringify(result.hunks, null, 2);
    },

    /**
     * Get commit log.
     */
    async log(limit: number = 50): Promise<GitCommit[]> {
      const result = await ecpClient.request<{ commits: GitCommit[] }>('git/log', {
        uri: workspaceUri,
        count: limit,
      });
      return result.commits;
    },

    /**
     * Get list of branches.
     */
    async branches(): Promise<{ current: string; branches: string[] }> {
      const result = await ecpClient.request<{
        local: Array<{ name: string; current: boolean }>;
        remote: Array<{ name: string }>;
      }>('git/branches', { uri: workspaceUri });

      const current = result.local.find((b) => b.current)?.name || '';
      const branches = result.local.map((b) => b.name);
      return { current, branches };
    },

    /**
     * Switch to a branch.
     */
    async switchBranch(branch: string): Promise<void> {
      await ecpClient.request('git/switchBranch', { uri: workspaceUri, name: branch });
      await refreshStatus();
    },

    /**
     * Create a new branch.
     */
    async createBranch(name: string, checkout: boolean = true): Promise<void> {
      await ecpClient.request('git/createBranch', { uri: workspaceUri, name, checkout });
      if (checkout) {
        await refreshStatus();
      }
    },

    /**
     * Pull from remote.
     */
    async pull(): Promise<void> {
      await ecpClient.request('git/pull', { uri: workspaceUri });
      await refreshStatus();
    },

    /**
     * Push to remote.
     */
    async push(): Promise<void> {
      await ecpClient.request('git/push', { uri: workspaceUri });
      await refreshStatus();
    },

    /**
     * Fetch from remote.
     */
    async fetch(): Promise<void> {
      await ecpClient.request('git/fetch', { uri: workspaceUri });
      await refreshStatus();
    },
  };
}

export const gitStore = createGitStore();

/**
 * Derived store for all changed files.
 */
export const changedFiles = derived(gitStore, ($status) => {
  if (!$status) return [];
  return [...$status.staged, ...$status.unstaged, ...$status.untracked, ...$status.conflicts];
});

/**
 * Derived store for whether there are uncommitted changes.
 */
export const hasChanges = derived(changedFiles, ($files) => $files.length > 0);

/**
 * Derived store for staged file count.
 */
export const stagedCount = derived(gitStore, ($status) => $status?.staged.length ?? 0);

export default gitStore;
