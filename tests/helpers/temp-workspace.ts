/**
 * Temp Workspace Utilities
 *
 * Provides utilities for creating and managing temporary
 * directories for testing file operations and git repos.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * A temporary workspace for testing.
 */
export interface TempWorkspace {
  /** Absolute path to workspace root */
  path: string;

  /** File URI for workspace root */
  rootUri: string;

  /** Write a file to the workspace */
  writeFile(relativePath: string, content: string): Promise<void>;

  /** Read a file from the workspace */
  readFile(relativePath: string): Promise<string>;

  /** Check if file exists */
  fileExists(relativePath: string): Promise<boolean>;

  /** Delete a file */
  deleteFile(relativePath: string): Promise<void>;

  /** Create a directory */
  mkdir(relativePath: string): Promise<void>;

  /** Get file URI for a file in the workspace */
  fileUri(relativePath: string): string;

  /** Initialize as git repo */
  gitInit(): Promise<void>;

  /** Git add files */
  gitAdd(paths: string[]): Promise<void>;

  /** Git commit with message */
  gitCommit(message: string): Promise<void>;

  /** Git status */
  gitStatus(): Promise<string>;

  /** Clean up the workspace */
  cleanup(): Promise<void>;
}

// Track all created workspaces for global cleanup
const activeWorkspaces: TempWorkspace[] = [];

/**
 * Create a temporary workspace.
 */
export async function createTempWorkspace(options: {
  git?: boolean;
  files?: Record<string, string>;
} = {}): Promise<TempWorkspace> {
  const path = await mkdtemp(join(tmpdir(), 'ultra-test-'));

  const workspace: TempWorkspace = {
    path,
    rootUri: `file://${path}`,

    async writeFile(relativePath: string, content: string): Promise<void> {
      const fullPath = join(path, relativePath);
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));

      // Ensure directory exists
      try {
        await Bun.write(fullPath, content);
      } catch {
        // Create directory and retry
        await Bun.$`mkdir -p ${dir}`.quiet();
        await Bun.write(fullPath, content);
      }
    },

    async readFile(relativePath: string): Promise<string> {
      const fullPath = join(path, relativePath);
      return await Bun.file(fullPath).text();
    },

    async fileExists(relativePath: string): Promise<boolean> {
      const fullPath = join(path, relativePath);
      return await Bun.file(fullPath).exists();
    },

    async deleteFile(relativePath: string): Promise<void> {
      const fullPath = join(path, relativePath);
      await rm(fullPath, { force: true });
    },

    async mkdir(relativePath: string): Promise<void> {
      const fullPath = join(path, relativePath);
      await Bun.$`mkdir -p ${fullPath}`.quiet();
    },

    fileUri(relativePath: string): string {
      return `file://${join(path, relativePath)}`;
    },

    async gitInit(): Promise<void> {
      await Bun.$`git -C ${path} init`.quiet();
      await Bun.$`git -C ${path} config user.email "test@example.com"`.quiet();
      await Bun.$`git -C ${path} config user.name "Test User"`.quiet();
    },

    async gitAdd(paths: string[]): Promise<void> {
      for (const p of paths) {
        await Bun.$`git -C ${path} add ${p}`.quiet();
      }
    },

    async gitCommit(message: string): Promise<void> {
      await Bun.$`git -C ${path} commit -m ${message}`.quiet();
    },

    async gitStatus(): Promise<string> {
      return await Bun.$`git -C ${path} status --porcelain`.text();
    },

    async cleanup(): Promise<void> {
      await rm(path, { recursive: true, force: true });
      const index = activeWorkspaces.indexOf(workspace);
      if (index >= 0) {
        activeWorkspaces.splice(index, 1);
      }
    },
  };

  activeWorkspaces.push(workspace);

  // Initialize git if requested
  if (options.git) {
    await workspace.gitInit();
  }

  // Write initial files
  if (options.files) {
    for (const [relativePath, content] of Object.entries(options.files)) {
      await workspace.writeFile(relativePath, content);
    }
  }

  return workspace;
}

/**
 * Clean up all temp workspaces.
 * Called automatically in global teardown.
 */
export async function cleanupAllTempWorkspaces(): Promise<void> {
  const promises = activeWorkspaces.map((ws) => ws.cleanup());
  await Promise.all(promises);
}
