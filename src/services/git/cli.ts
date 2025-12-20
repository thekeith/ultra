/**
 * Git CLI Service
 *
 * GitService implementation using git CLI via Bun.$.
 */

import { $ } from 'bun';
import { debugLog } from '../../debug.ts';
import type { GitService } from './interface.ts';
import type {
  GitStatus,
  GitBranchInfo,
  GitBranch,
  GitCommit,
  GitRemote,
  GitStash,
  GitBlame,
  GitDiffHunk,
  DiffLine,
  GitLineChange,
  GitFileStatus,
  CommitResult,
  PushResult,
  PullResult,
  MergeResult,
  PushOptions,
  GitChangeCallback,
  GitChangeEvent,
  Unsubscribe,
} from './types.ts';
import { GitError, GitErrorCode } from './errors.ts';

/**
 * Cache entry with TTL.
 */
interface CacheEntry<T> {
  value: T;
  time: number;
}

/**
 * Git CLI service implementation.
 */
export class GitCliService implements GitService {
  private readonly CACHE_TTL = 5000; // 5 seconds
  private statusCache: Map<string, CacheEntry<GitStatus>> = new Map();
  private lineChangesCache: Map<string, CacheEntry<GitLineChange[]>> = new Map();
  private changeListeners: Set<GitChangeCallback> = new Set();

  constructor() {
    // Prevent git from opening editors for interactive commands
    process.env.GIT_EDITOR = 'true';
    process.env.GIT_TERMINAL_PROMPT = '0';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Convert file URI to path.
   */
  private uriToPath(uri: string): string {
    if (uri.startsWith('file://')) {
      return uri.slice(7);
    }
    return uri;
  }

  /**
   * Get repository root for a path.
   */
  private async getRepoRoot(uri: string): Promise<string> {
    const path = this.uriToPath(uri);
    try {
      const result = await $`git -C ${path} rev-parse --show-toplevel`.quiet().nothrow();
      if (result.exitCode === 0) {
        return result.text().trim();
      }
      throw GitError.notARepo(uri);
    } catch (error) {
      if (error instanceof GitError) throw error;
      throw GitError.wrap(uri, error);
    }
  }

  /**
   * Emit change event to listeners.
   */
  private emitChange(uri: string, type: GitChangeEvent['type']): void {
    const event: GitChangeEvent = { uri, type };
    for (const listener of this.changeListeners) {
      try {
        listener(event);
      } catch (e) {
        debugLog(`[GitCliService] Error in change listener: ${e}`);
      }
    }
  }

  /**
   * Make path relative to repository root.
   */
  private makeRelative(repoRoot: string, filePath: string): string {
    const path = this.uriToPath(filePath);
    if (path.startsWith(repoRoot)) {
      return path.substring(repoRoot.length + 1);
    }
    return path;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Repository
  // ─────────────────────────────────────────────────────────────────────────

  async isRepo(uri: string): Promise<boolean> {
    const path = this.uriToPath(uri);
    try {
      const result = await $`git -C ${path} rev-parse --is-inside-work-tree`.quiet();
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  async getRoot(uri: string): Promise<string | null> {
    try {
      const root = await this.getRepoRoot(uri);
      return `file://${root}`;
    } catch {
      return null;
    }
  }

  async status(uri: string, forceRefresh = false): Promise<GitStatus> {
    const repoRoot = await this.getRepoRoot(uri);
    const cacheKey = repoRoot;

    // Check cache
    if (!forceRefresh) {
      const cached = this.statusCache.get(cacheKey);
      if (cached && Date.now() - cached.time < this.CACHE_TTL) {
        return cached.value;
      }
    }

    try {
      // Get branch info
      const branchResult = await $`git -C ${repoRoot} branch --show-current`.quiet();
      const branch = branchResult.exitCode === 0 ? branchResult.text().trim() || 'HEAD' : 'unknown';

      // Get ahead/behind
      let ahead = 0;
      let behind = 0;
      try {
        const trackingResult = await $`git -C ${repoRoot} rev-list --left-right --count HEAD...@{upstream}`.quiet();
        if (trackingResult.exitCode === 0) {
          const [a, b] = trackingResult.text().trim().split('\t').map(n => parseInt(n, 10));
          ahead = a || 0;
          behind = b || 0;
        }
      } catch {
        // No upstream tracking
      }

      // Get status (porcelain format)
      const statusResult = await $`git -C ${repoRoot} status --porcelain -uall`.quiet();
      if (statusResult.exitCode !== 0) {
        throw GitError.commandFailed(uri, 'status', statusResult.stderr.toString());
      }

      const staged: GitFileStatus[] = [];
      const unstaged: GitFileStatus[] = [];
      const untracked: string[] = [];

      const lines = statusResult.text().split('\n').filter(l => l.length > 0);
      for (const line of lines) {
        const indexStatus = line[0];
        const workTreeStatus = line[1];
        let path = line.substring(3);
        let oldPath: string | undefined;

        // Handle renames (R100 old -> new)
        if (path.includes(' -> ')) {
          const parts = path.split(' -> ');
          oldPath = parts[0];
          path = parts[1] || path;
        }

        // Untracked files
        if (indexStatus === '?' && workTreeStatus === '?') {
          untracked.push(path);
          continue;
        }

        // Staged changes
        if (indexStatus !== ' ' && indexStatus !== '?') {
          staged.push({
            path,
            status: indexStatus as GitFileStatus['status'],
            oldPath,
          });
        }

        // Unstaged changes
        if (workTreeStatus !== ' ' && workTreeStatus !== '?') {
          unstaged.push({
            path,
            status: workTreeStatus as GitFileStatus['status'],
          });
        }
      }

      const result: GitStatus = { branch, ahead, behind, staged, unstaged, untracked };
      this.statusCache.set(cacheKey, { value: result, time: Date.now() });
      return result;
    } catch (error) {
      if (error instanceof GitError) throw error;
      throw GitError.wrap(uri, error);
    }
  }

  async branch(uri: string): Promise<GitBranchInfo> {
    const repoRoot = await this.getRepoRoot(uri);

    try {
      // Get current branch
      const branchResult = await $`git -C ${repoRoot} branch --show-current`.quiet();
      const branch = branchResult.exitCode === 0 ? branchResult.text().trim() || 'HEAD' : 'HEAD';

      // Get tracking info
      let tracking: string | undefined;
      let ahead = 0;
      let behind = 0;

      try {
        const trackingResult = await $`git -C ${repoRoot} rev-parse --abbrev-ref ${branch}@{upstream}`.quiet();
        if (trackingResult.exitCode === 0) {
          tracking = trackingResult.text().trim();
        }

        const countResult = await $`git -C ${repoRoot} rev-list --left-right --count HEAD...@{upstream}`.quiet();
        if (countResult.exitCode === 0) {
          const [a, b] = countResult.text().trim().split('\t').map(n => parseInt(n, 10));
          ahead = a || 0;
          behind = b || 0;
        }
      } catch {
        // No upstream
      }

      return { branch, tracking, ahead, behind };
    } catch (error) {
      if (error instanceof GitError) throw error;
      throw GitError.wrap(uri, error);
    }
  }

  invalidateCache(uri: string): void {
    const path = this.uriToPath(uri);
    // Clear status cache for this repo
    for (const key of this.statusCache.keys()) {
      if (path.startsWith(key) || key.startsWith(path)) {
        this.statusCache.delete(key);
      }
    }
    // Clear line changes cache
    for (const key of this.lineChangesCache.keys()) {
      if (key.startsWith(path)) {
        this.lineChangesCache.delete(key);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Staging
  // ─────────────────────────────────────────────────────────────────────────

  async stage(uri: string, paths: string[]): Promise<void> {
    const repoRoot = await this.getRepoRoot(uri);
    const relativePaths = paths.map(p => this.makeRelative(repoRoot, p));

    try {
      const result = await $`git -C ${repoRoot} add -- ${relativePaths}`.quiet();
      if (result.exitCode !== 0) {
        throw GitError.commandFailed(uri, 'add', result.stderr.toString());
      }
      this.invalidateCache(uri);
      this.emitChange(uri, 'status');
    } catch (error) {
      if (error instanceof GitError) throw error;
      throw GitError.wrap(uri, error);
    }
  }

  async stageAll(uri: string): Promise<void> {
    const repoRoot = await this.getRepoRoot(uri);

    try {
      const result = await $`git -C ${repoRoot} add -A`.quiet();
      if (result.exitCode !== 0) {
        throw GitError.commandFailed(uri, 'add -A', result.stderr.toString());
      }
      this.invalidateCache(uri);
      this.emitChange(uri, 'status');
    } catch (error) {
      if (error instanceof GitError) throw error;
      throw GitError.wrap(uri, error);
    }
  }

  async unstage(uri: string, paths: string[]): Promise<void> {
    const repoRoot = await this.getRepoRoot(uri);
    const relativePaths = paths.map(p => this.makeRelative(repoRoot, p));

    try {
      const result = await $`git -C ${repoRoot} reset HEAD -- ${relativePaths}`.quiet();
      if (result.exitCode !== 0) {
        throw GitError.commandFailed(uri, 'reset', result.stderr.toString());
      }
      this.invalidateCache(uri);
      this.emitChange(uri, 'status');
    } catch (error) {
      if (error instanceof GitError) throw error;
      throw GitError.wrap(uri, error);
    }
  }

  async discard(uri: string, paths: string[]): Promise<void> {
    const repoRoot = await this.getRepoRoot(uri);
    const relativePaths = paths.map(p => this.makeRelative(repoRoot, p));

    try {
      // Unstage first, then checkout
      await $`git -C ${repoRoot} reset HEAD -- ${relativePaths}`.quiet();
      const result = await $`git -C ${repoRoot} checkout -- ${relativePaths}`.quiet();
      if (result.exitCode !== 0) {
        throw GitError.commandFailed(uri, 'checkout', result.stderr.toString());
      }
      this.invalidateCache(uri);
      this.emitChange(uri, 'status');
    } catch (error) {
      if (error instanceof GitError) throw error;
      throw GitError.wrap(uri, error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Diff
  // ─────────────────────────────────────────────────────────────────────────

  async diff(uri: string, path: string, staged = false): Promise<GitDiffHunk[]> {
    const repoRoot = await this.getRepoRoot(uri);
    const relativePath = this.makeRelative(repoRoot, path);

    try {
      const args = staged ? ['--cached'] : [];
      const result = await $`git -C ${repoRoot} diff ${args} -- ${relativePath}`.quiet();
      if (result.exitCode !== 0) {
        return [];
      }
      return this.parseDiff(result.text());
    } catch {
      return [];
    }
  }

  async diffLines(uri: string, path: string): Promise<GitLineChange[]> {
    const repoRoot = await this.getRepoRoot(uri);
    const relativePath = this.makeRelative(repoRoot, path);
    const cacheKey = `${repoRoot}:${relativePath}`;

    // Check cache
    const cached = this.lineChangesCache.get(cacheKey);
    if (cached && Date.now() - cached.time < this.CACHE_TTL) {
      return cached.changes;
    }

    try {
      const result = await $`git -C ${repoRoot} diff --unified=0 -- ${relativePath}`.quiet();
      if (result.exitCode !== 0) {
        return [];
      }

      const changes: GitLineChange[] = [];
      const lines = result.text().split('\n');

      for (const line of lines) {
        const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (!match) continue;

        const oldCount = parseInt(match[2] || '1', 10);
        const newStart = parseInt(match[3]!, 10);
        const newCount = parseInt(match[4] || '1', 10);

        if (oldCount === 0) {
          // Pure addition
          for (let i = 0; i < newCount; i++) {
            changes.push({ line: newStart + i, type: 'added' });
          }
        } else if (newCount === 0) {
          // Pure deletion
          changes.push({ line: Math.max(1, newStart), type: 'deleted' });
        } else {
          // Modification
          for (let i = 0; i < newCount; i++) {
            changes.push({ line: newStart + i, type: 'modified' });
          }
        }
      }

      this.lineChangesCache.set(cacheKey, { changes, time: Date.now() });
      return changes;
    } catch {
      return [];
    }
  }

  async diffBuffer(uri: string, path: string, content: string): Promise<GitLineChange[]> {
    const repoRoot = await this.getRepoRoot(uri);
    const relativePath = this.makeRelative(repoRoot, path);

    try {
      // Get HEAD content
      const headContent = await this.show(uri, relativePath, 'HEAD');

      if (headContent === '') {
        // File not tracked - all lines are added
        const lineCount = content.split('\n').length;
        const changes: GitLineChange[] = [];
        for (let i = 1; i <= lineCount; i++) {
          changes.push({ line: i, type: 'added' });
        }
        return changes;
      }

      // Compare line by line
      const oldLines = headContent.split('\n');
      const newLines = content.split('\n');
      return this.computeLineDiff(oldLines, newLines);
    } catch {
      return [];
    }
  }

  /**
   * Parse diff output into structured hunks.
   */
  private parseDiff(diffText: string): GitDiffHunk[] {
    const hunks: GitDiffHunk[] = [];
    const lines = diffText.split('\n');

    let currentHunk: GitDiffHunk | null = null;
    let oldLineNum = 0;
    let newLineNum = 0;

    for (const line of lines) {
      const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (hunkMatch) {
        if (currentHunk) {
          hunks.push(currentHunk);
        }
        currentHunk = {
          oldStart: parseInt(hunkMatch[1]!, 10),
          oldCount: parseInt(hunkMatch[2] || '1', 10),
          newStart: parseInt(hunkMatch[3]!, 10),
          newCount: parseInt(hunkMatch[4] || '1', 10),
          lines: [],
        };
        oldLineNum = currentHunk.oldStart;
        newLineNum = currentHunk.newStart;
        continue;
      }

      if (!currentHunk) continue;

      if (line.startsWith('+') && !line.startsWith('+++')) {
        currentHunk.lines.push({
          type: 'added',
          content: line.substring(1),
          newLineNum: newLineNum++,
        });
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        currentHunk.lines.push({
          type: 'deleted',
          content: line.substring(1),
          oldLineNum: oldLineNum++,
        });
      } else if (line.startsWith(' ')) {
        currentHunk.lines.push({
          type: 'context',
          content: line.substring(1),
          oldLineNum: oldLineNum++,
          newLineNum: newLineNum++,
        });
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    return hunks;
  }

  /**
   * Compute line-by-line diff using LCS algorithm.
   */
  private computeLineDiff(oldLines: string[], newLines: string[]): GitLineChange[] {
    const changes: GitLineChange[] = [];
    const m = oldLines.length;
    const n = newLines.length;

    // Build LCS table
    const lcs: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (oldLines[i - 1] === newLines[j - 1]) {
          lcs[i]![j] = lcs[i - 1]![j - 1]! + 1;
        } else {
          lcs[i]![j] = Math.max(lcs[i - 1]![j]!, lcs[i]![j - 1]!);
        }
      }
    }

    // Backtrack to find matches
    const matchedOld = new Set<number>();
    const matchedNew = new Set<number>();
    const oldToNewMapping = new Map<number, number>();

    let i = m,
      j = n;
    while (i > 0 && j > 0) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        matchedOld.add(i - 1);
        matchedNew.add(j - 1);
        oldToNewMapping.set(i - 1, j - 1);
        i--;
        j--;
      } else if (lcs[i - 1]![j]! > lcs[i]![j - 1]!) {
        i--;
      } else {
        j--;
      }
    }

    // Find deleted lines
    const deletedOldIndices: number[] = [];
    for (let k = 0; k < m; k++) {
      if (!matchedOld.has(k)) {
        deletedOldIndices.push(k);
      }
    }

    // Find added lines
    const addedNewIndices: number[] = [];
    for (let k = 0; k < n; k++) {
      if (!matchedNew.has(k)) {
        addedNewIndices.push(k);
      }
    }

    // Map new lines to old regions
    const newLineToOldRegion = new Map<number, { prevOld: number; nextOld: number }>();

    for (const newIdx of addedNewIndices) {
      let prevMatchedNewIdx = -1;
      let nextMatchedNewIdx = n;

      for (let k = newIdx - 1; k >= 0; k--) {
        if (matchedNew.has(k)) {
          prevMatchedNewIdx = k;
          break;
        }
      }
      for (let k = newIdx + 1; k < n; k++) {
        if (matchedNew.has(k)) {
          nextMatchedNewIdx = k;
          break;
        }
      }

      let prevOldIdx = -1;
      let nextOldIdx = m;

      for (const [oldK, newK] of oldToNewMapping) {
        if (newK === prevMatchedNewIdx) prevOldIdx = oldK;
        if (newK === nextMatchedNewIdx) nextOldIdx = oldK;
      }

      newLineToOldRegion.set(newIdx, { prevOld: prevOldIdx, nextOld: nextOldIdx });
    }

    // Mark changes
    for (const newIdx of addedNewIndices) {
      const region = newLineToOldRegion.get(newIdx)!;
      const hasDeletedInRegion = deletedOldIndices.some(
        oldIdx => oldIdx > region.prevOld && oldIdx < region.nextOld
      );

      changes.push({
        line: newIdx + 1,
        type: hasDeletedInRegion ? 'modified' : 'added',
      });
    }

    // Add delete markers
    for (const oldIdx of deletedOldIndices) {
      let insertionPoint = 0;
      for (let k = oldIdx - 1; k >= 0; k--) {
        if (oldToNewMapping.has(k)) {
          insertionPoint = oldToNewMapping.get(k)! + 1;
          break;
        }
      }

      const deletionLine = insertionPoint + 1;
      if (!changes.some(c => c.line === deletionLine)) {
        changes.push({ line: Math.max(1, deletionLine), type: 'deleted' });
      }
    }

    changes.sort((a, b) => a.line - b.line);
    return changes;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Commit
  // ─────────────────────────────────────────────────────────────────────────

  async commit(uri: string, message: string): Promise<CommitResult> {
    if (!message.trim()) {
      return { success: false, message: 'Commit message is required' };
    }

    const repoRoot = await this.getRepoRoot(uri);

    try {
      const result = await $`git -C ${repoRoot} commit -m ${message}`.quiet();
      if (result.exitCode === 0) {
        this.invalidateCache(uri);
        this.emitChange(uri, 'commit');

        // Get the commit hash
        const hashResult = await $`git -C ${repoRoot} rev-parse HEAD`.quiet();
        const hash = hashResult.exitCode === 0 ? hashResult.text().trim() : undefined;

        return { success: true, hash };
      }

      return { success: false, message: result.stderr.toString() };
    } catch (error) {
      return { success: false, message: String(error) };
    }
  }

  async amend(uri: string, message?: string): Promise<CommitResult> {
    const repoRoot = await this.getRepoRoot(uri);

    try {
      let result;
      if (message) {
        result = await $`git -C ${repoRoot} commit --amend -m ${message}`.quiet();
      } else {
        result = await $`git -C ${repoRoot} commit --amend --no-edit`.quiet();
      }

      if (result.exitCode === 0) {
        this.invalidateCache(uri);
        this.emitChange(uri, 'commit');

        const hashResult = await $`git -C ${repoRoot} rev-parse HEAD`.quiet();
        const hash = hashResult.exitCode === 0 ? hashResult.text().trim() : undefined;

        return { success: true, hash };
      }

      return { success: false, message: result.stderr.toString() };
    } catch (error) {
      return { success: false, message: String(error) };
    }
  }

  async log(uri: string, count = 50): Promise<GitCommit[]> {
    const repoRoot = await this.getRepoRoot(uri);

    try {
      const result = await $`git -C ${repoRoot} log --oneline -n ${count} --format=%H%x00%h%x00%s%x00%an%x00%ae%x00%aI`.quiet();
      if (result.exitCode !== 0) {
        return [];
      }

      return result
        .text()
        .trim()
        .split('\n')
        .filter(l => l)
        .map(line => {
          const [hash, shortHash, message, author, email, date] = line.split('\x00');
          return {
            hash: hash || '',
            shortHash: shortHash || '',
            message: message || '',
            author: author || '',
            email,
            date: date || '',
          };
        });
    } catch {
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Branches
  // ─────────────────────────────────────────────────────────────────────────

  async branches(uri: string): Promise<{ branches: GitBranch[]; current: string }> {
    const repoRoot = await this.getRepoRoot(uri);

    try {
      // Get all branches with basic info (simpler format that works with Bun.$)
      const result = await $`git -C ${repoRoot} branch -vv`.quiet();
      if (result.exitCode !== 0) {
        throw GitError.commandFailed(uri, 'branch', result.stderr.toString());
      }

      let current = '';
      const branches: GitBranch[] = result
        .text()
        .trim()
        .split('\n')
        .filter(l => l)
        .map(line => {
          const isCurrent = line.startsWith('*');
          const trimmed = line.replace(/^\*?\s+/, '');

          // Parse: branch-name hash [origin/branch: ahead N, behind M] message
          // or: branch-name hash message (no tracking)
          const parts = trimmed.split(/\s+/);
          const name = parts[0] || '';
          if (isCurrent) current = name;

          // Look for tracking info in brackets
          let tracking: string | undefined;
          let ahead: number | undefined;
          let behind: number | undefined;

          const bracketMatch = trimmed.match(/\[([^\]]+)\]/);
          if (bracketMatch) {
            const bracketContent = bracketMatch[1]!;
            // Extract tracking branch (first part before ':')
            const trackMatch = bracketContent.match(/^([^:]+)/);
            if (trackMatch) {
              tracking = trackMatch[1]!.trim();
            }
            // Extract ahead/behind
            const aheadMatch = bracketContent.match(/ahead (\d+)/);
            const behindMatch = bracketContent.match(/behind (\d+)/);
            if (aheadMatch) ahead = parseInt(aheadMatch[1]!, 10);
            if (behindMatch) behind = parseInt(behindMatch[1]!, 10);
          }

          return {
            name,
            current: isCurrent,
            tracking,
            ahead,
            behind,
          };
        });

      return { branches, current };
    } catch (error) {
      if (error instanceof GitError) throw error;
      throw GitError.wrap(uri, error);
    }
  }

  async createBranch(uri: string, name: string, checkout = true): Promise<void> {
    const repoRoot = await this.getRepoRoot(uri);

    try {
      let result;
      if (checkout) {
        result = await $`git -C ${repoRoot} checkout -b ${name}`.quiet();
      } else {
        result = await $`git -C ${repoRoot} branch ${name}`.quiet();
      }

      if (result.exitCode !== 0) {
        const stderr = result.stderr.toString();
        if (stderr.includes('already exists')) {
          throw GitError.branchExists(uri, name);
        }
        throw GitError.commandFailed(uri, 'branch', stderr);
      }

      this.invalidateCache(uri);
      this.emitChange(uri, 'branch');
    } catch (error) {
      if (error instanceof GitError) throw error;
      throw GitError.wrap(uri, error);
    }
  }

  async switchBranch(uri: string, name: string): Promise<void> {
    const repoRoot = await this.getRepoRoot(uri);

    try {
      const result = await $`git -C ${repoRoot} checkout ${name}`.quiet().nothrow();
      if (result.exitCode !== 0) {
        const stderr = result.stderr.toString();
        if (stderr.includes('did not match any') || stderr.includes('pathspec')) {
          throw GitError.branchNotFound(uri, name);
        }
        if (stderr.includes('would be overwritten') || stderr.includes('uncommitted changes')) {
          throw GitError.uncommittedChanges(uri, stderr);
        }
        throw GitError.commandFailed(uri, 'checkout', stderr);
      }

      this.invalidateCache(uri);
      this.emitChange(uri, 'branch');
    } catch (error) {
      if (error instanceof GitError) throw error;
      throw GitError.wrap(uri, error);
    }
  }

  async deleteBranch(uri: string, name: string, force = false): Promise<void> {
    const repoRoot = await this.getRepoRoot(uri);

    try {
      const flag = force ? '-D' : '-d';
      const result = await $`git -C ${repoRoot} branch ${flag} ${name}`.quiet();
      if (result.exitCode !== 0) {
        const stderr = result.stderr.toString();
        if (stderr.includes('not found')) {
          throw GitError.branchNotFound(uri, name);
        }
        throw GitError.commandFailed(uri, 'branch -d', stderr);
      }

      this.invalidateCache(uri);
      this.emitChange(uri, 'branch');
    } catch (error) {
      if (error instanceof GitError) throw error;
      throw GitError.wrap(uri, error);
    }
  }

  async renameBranch(uri: string, newName: string): Promise<void> {
    const repoRoot = await this.getRepoRoot(uri);

    try {
      const result = await $`git -C ${repoRoot} branch -m ${newName}`.quiet();
      if (result.exitCode !== 0) {
        throw GitError.commandFailed(uri, 'branch -m', result.stderr.toString());
      }

      this.invalidateCache(uri);
      this.emitChange(uri, 'branch');
    } catch (error) {
      if (error instanceof GitError) throw error;
      throw GitError.wrap(uri, error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Remote
  // ─────────────────────────────────────────────────────────────────────────

  async push(uri: string, remote = 'origin', options?: PushOptions): Promise<PushResult> {
    const repoRoot = await this.getRepoRoot(uri);

    try {
      const branchInfo = await this.branch(uri);
      const args: string[] = [];

      if (options?.forceWithLease) {
        args.push('--force-with-lease');
      }
      if (options?.setUpstream) {
        args.push('-u');
      }

      const result = await $`git -C ${repoRoot} push ${args} ${remote} ${branchInfo.branch}`.quiet();

      if (result.exitCode === 0) {
        this.invalidateCache(uri);
        return { success: true };
      }

      const stderr = result.stderr.toString();
      if (stderr.includes('[rejected]') || stderr.includes('non-fast-forward')) {
        return { success: false, rejected: true, message: stderr };
      }

      return { success: false, message: stderr };
    } catch (error) {
      return { success: false, message: String(error) };
    }
  }

  async pull(uri: string, remote = 'origin'): Promise<PullResult> {
    const repoRoot = await this.getRepoRoot(uri);

    try {
      const branchInfo = await this.branch(uri);
      const result = await $`git -C ${repoRoot} pull ${remote} ${branchInfo.branch}`.quiet();

      if (result.exitCode === 0) {
        this.invalidateCache(uri);

        // Parse stats from output
        const output = result.text();
        const statsMatch = output.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);

        return {
          success: true,
          filesChanged: statsMatch ? parseInt(statsMatch[1]!, 10) : undefined,
          insertions: statsMatch?.[2] ? parseInt(statsMatch[2], 10) : undefined,
          deletions: statsMatch?.[3] ? parseInt(statsMatch[3], 10) : undefined,
        };
      }

      // Check for conflicts
      const conflicts = await this.getConflicts(uri);
      if (conflicts.length > 0) {
        return { success: false, conflicts, message: 'Merge conflicts' };
      }

      return { success: false, message: result.stderr.toString() };
    } catch (error) {
      return { success: false, message: String(error) };
    }
  }

  async fetch(uri: string, remote = 'origin'): Promise<void> {
    const repoRoot = await this.getRepoRoot(uri);

    try {
      const result = await $`git -C ${repoRoot} fetch ${remote}`.quiet();
      if (result.exitCode !== 0) {
        throw GitError.commandFailed(uri, 'fetch', result.stderr.toString());
      }
      this.invalidateCache(uri);
    } catch (error) {
      if (error instanceof GitError) throw error;
      throw GitError.wrap(uri, error);
    }
  }

  async remotes(uri: string): Promise<GitRemote[]> {
    const repoRoot = await this.getRepoRoot(uri);

    try {
      const result = await $`git -C ${repoRoot} remote -v`.quiet();
      if (result.exitCode !== 0) {
        return [];
      }

      const remoteMap = new Map<string, GitRemote>();

      for (const line of result.text().trim().split('\n')) {
        if (!line) continue;
        const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
        if (!match) continue;

        const [, name, url, type] = match;
        if (!remoteMap.has(name!)) {
          remoteMap.set(name!, { name: name! });
        }

        const remote = remoteMap.get(name!)!;
        if (type === 'fetch') {
          remote.fetchUrl = url;
        } else {
          remote.pushUrl = url;
        }
      }

      return Array.from(remoteMap.values());
    } catch {
      return [];
    }
  }

  async setUpstream(uri: string, remote: string, branch: string): Promise<void> {
    const repoRoot = await this.getRepoRoot(uri);

    try {
      const result = await $`git -C ${repoRoot} branch --set-upstream-to=${remote}/${branch}`.quiet();
      if (result.exitCode !== 0) {
        throw GitError.commandFailed(uri, 'branch --set-upstream-to', result.stderr.toString());
      }
      this.invalidateCache(uri);
    } catch (error) {
      if (error instanceof GitError) throw error;
      throw GitError.wrap(uri, error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Merge
  // ─────────────────────────────────────────────────────────────────────────

  async merge(uri: string, branch: string): Promise<MergeResult> {
    const repoRoot = await this.getRepoRoot(uri);

    try {
      const result = await $`git -C ${repoRoot} merge ${branch}`.quiet();

      if (result.exitCode === 0) {
        this.invalidateCache(uri);
        this.emitChange(uri, 'commit');
        return { success: true, conflicts: [], message: 'Merge completed' };
      }

      const conflicts = await this.getConflicts(uri);
      if (conflicts.length > 0) {
        return {
          success: false,
          conflicts,
          message: `Merge conflicts in ${conflicts.length} file(s)`,
        };
      }

      return { success: false, conflicts: [], message: result.stderr.toString() };
    } catch (error) {
      const conflicts = await this.getConflicts(uri);
      if (conflicts.length > 0) {
        return {
          success: false,
          conflicts,
          message: `Merge conflicts in ${conflicts.length} file(s)`,
        };
      }
      return { success: false, conflicts: [], message: String(error) };
    }
  }

  async abortMerge(uri: string): Promise<void> {
    const repoRoot = await this.getRepoRoot(uri);

    try {
      const result = await $`git -C ${repoRoot} merge --abort`.quiet();
      if (result.exitCode !== 0) {
        throw GitError.commandFailed(uri, 'merge --abort', result.stderr.toString());
      }
      this.invalidateCache(uri);
    } catch (error) {
      if (error instanceof GitError) throw error;
      throw GitError.wrap(uri, error);
    }
  }

  async getConflicts(uri: string): Promise<string[]> {
    const repoRoot = await this.getRepoRoot(uri);

    try {
      const result = await $`git -C ${repoRoot} diff --name-only --diff-filter=U`.quiet();
      if (result.exitCode !== 0) {
        return [];
      }
      return result
        .text()
        .trim()
        .split('\n')
        .filter(f => f);
    } catch {
      return [];
    }
  }

  async isMerging(uri: string): Promise<boolean> {
    const repoRoot = await this.getRepoRoot(uri);

    try {
      const result = await $`git -C ${repoRoot} rev-parse -q --verify MERGE_HEAD`.quiet();
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stash
  // ─────────────────────────────────────────────────────────────────────────

  async stash(uri: string, message?: string): Promise<string> {
    const repoRoot = await this.getRepoRoot(uri);

    try {
      let result;
      if (message) {
        result = await $`git -C ${repoRoot} stash push -m ${message}`.quiet();
      } else {
        result = await $`git -C ${repoRoot} stash push`.quiet();
      }

      if (result.exitCode !== 0) {
        throw GitError.commandFailed(uri, 'stash', result.stderr.toString());
      }

      this.invalidateCache(uri);
      this.emitChange(uri, 'stash');
      return 'stash@{0}';
    } catch (error) {
      if (error instanceof GitError) throw error;
      throw GitError.wrap(uri, error);
    }
  }

  async stashPop(uri: string, stashId?: string): Promise<void> {
    const repoRoot = await this.getRepoRoot(uri);

    try {
      const args = stashId ? [stashId] : [];
      const result = await $`git -C ${repoRoot} stash pop ${args}`.quiet();
      if (result.exitCode !== 0) {
        throw GitError.commandFailed(uri, 'stash pop', result.stderr.toString());
      }

      this.invalidateCache(uri);
      this.emitChange(uri, 'stash');
    } catch (error) {
      if (error instanceof GitError) throw error;
      throw GitError.wrap(uri, error);
    }
  }

  async stashList(uri: string): Promise<GitStash[]> {
    const repoRoot = await this.getRepoRoot(uri);

    try {
      const result = await $`git -C ${repoRoot} stash list --format=%gd%x00%gs%x00%ci`.quiet();
      if (result.exitCode !== 0) {
        return [];
      }

      return result
        .text()
        .trim()
        .split('\n')
        .filter(l => l)
        .map(line => {
          const [id, messageWithBranch, date] = line.split('\x00');
          // Parse "WIP on branch: message" or "On branch: message"
          const match = messageWithBranch?.match(/^(?:WIP )?[Oo]n (\S+): (.*)$/);
          return {
            id: id || '',
            branch: match?.[1] || '',
            message: match?.[2] || messageWithBranch || '',
            date,
          };
        });
    } catch {
      return [];
    }
  }

  async stashDrop(uri: string, stashId: string): Promise<void> {
    const repoRoot = await this.getRepoRoot(uri);

    try {
      const result = await $`git -C ${repoRoot} stash drop ${stashId}`.quiet();
      if (result.exitCode !== 0) {
        throw GitError.commandFailed(uri, 'stash drop', result.stderr.toString());
      }

      this.emitChange(uri, 'stash');
    } catch (error) {
      if (error instanceof GitError) throw error;
      throw GitError.wrap(uri, error);
    }
  }

  async stashApply(uri: string, stashId?: string): Promise<void> {
    const repoRoot = await this.getRepoRoot(uri);

    try {
      const args = stashId ? [stashId] : [];
      const result = await $`git -C ${repoRoot} stash apply ${args}`.quiet();
      if (result.exitCode !== 0) {
        throw GitError.commandFailed(uri, 'stash apply', result.stderr.toString());
      }

      this.invalidateCache(uri);
    } catch (error) {
      if (error instanceof GitError) throw error;
      throw GitError.wrap(uri, error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Blame
  // ─────────────────────────────────────────────────────────────────────────

  async blame(uri: string, path: string): Promise<GitBlame[]> {
    const repoRoot = await this.getRepoRoot(uri);
    const relativePath = this.makeRelative(repoRoot, path);

    try {
      const result = await $`git -C ${repoRoot} blame --line-porcelain -- ${relativePath}`.quiet();
      if (result.exitCode !== 0) {
        return [];
      }

      const blames: GitBlame[] = [];
      const lines = result.text().split('\n');

      let currentCommit = '';
      let currentAuthor = '';
      let currentDate = '';
      let currentLine = 0;
      let expectContent = false;

      for (const line of lines) {
        if (expectContent) {
          const content = line.startsWith('\t') ? line.substring(1) : line;
          blames.push({
            commit: currentCommit.substring(0, 8),
            author: currentAuthor,
            date: currentDate,
            line: currentLine,
            content,
          });
          expectContent = false;
          continue;
        }

        const commitMatch = line.match(/^([a-f0-9]{40}) \d+ (\d+)/);
        if (commitMatch) {
          currentCommit = commitMatch[1]!;
          currentLine = parseInt(commitMatch[2]!, 10);
          continue;
        }

        if (line.startsWith('author ')) {
          currentAuthor = line.substring(7);
        } else if (line.startsWith('author-time ')) {
          const timestamp = parseInt(line.substring(12), 10);
          currentDate = new Date(timestamp * 1000).toISOString();
        } else if (line.startsWith('filename ')) {
          expectContent = true;
        }
      }

      return blames;
    } catch {
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Content
  // ─────────────────────────────────────────────────────────────────────────

  async show(uri: string, path: string, ref: string): Promise<string> {
    const repoRoot = await this.getRepoRoot(uri);
    const relativePath = this.makeRelative(repoRoot, path);

    try {
      const result = await $`git -C ${repoRoot} show ${ref}:${relativePath}`.quiet().nothrow();
      if (result.exitCode === 0) {
        return result.text();
      }

      const stderr = result.stderr.toString();
      if (stderr.includes('does not exist') || stderr.includes('fatal: path')) {
        throw GitError.fileNotFound(uri, path);
      }
      if (stderr.includes('unknown revision') || stderr.includes('bad revision') || stderr.includes('invalid object name')) {
        throw GitError.refNotFound(uri, ref);
      }

      throw GitError.commandFailed(uri, 'show', stderr);
    } catch (error) {
      if (error instanceof GitError) throw error;
      throw GitError.wrap(uri, error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Events
  // ─────────────────────────────────────────────────────────────────────────

  onChange(callback: GitChangeCallback): Unsubscribe {
    this.changeListeners.add(callback);
    return () => {
      this.changeListeners.delete(callback);
    };
  }
}

// Singleton export
export const gitCliService = new GitCliService();
export default gitCliService;
