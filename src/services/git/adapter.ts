/**
 * Git Service ECP Adapter
 *
 * Maps ECP JSON-RPC calls to GitService methods.
 */

import type { GitService } from './interface.ts';
import { GitError } from './errors.ts';
import type { PushOptions } from './types.ts';

/**
 * ECP error codes (JSON-RPC 2.0 compatible).
 */
export const GitECPErrorCodes = {
  // Standard JSON-RPC errors
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,

  // Git service errors (-32200 to -32299)
  NotARepo: -32200,
  UncommittedChanges: -32201,
  MergeConflict: -32202,
  PushRejected: -32203,
  AuthFailed: -32204,
  NetworkError: -32205,
  BranchNotFound: -32206,
  BranchExists: -32207,
  CommandFailed: -32208,
} as const;

/**
 * JSON-RPC error response.
 */
interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * Handler result type.
 */
type HandlerResult<T> = { result: T } | { error: JsonRpcError };

/**
 * Git Service Adapter for ECP protocol.
 *
 * Handles JSON-RPC method routing and error conversion.
 */
export class GitServiceAdapter {
  constructor(private readonly service: GitService) {}

  /**
   * Handle an ECP request.
   *
   * @param method The method name (e.g., "git/status")
   * @param params The request parameters
   * @returns The method result
   */
  async handleRequest(method: string, params: unknown): Promise<HandlerResult<unknown>> {
    try {
      switch (method) {
        // Repository
        case 'git/isRepo':
          return this.isRepo(params);
        case 'git/status':
          return this.status(params);
        case 'git/branch':
          return this.branch(params);

        // Staging
        case 'git/stage':
          return this.stage(params);
        case 'git/stageAll':
          return this.stageAll(params);
        case 'git/unstage':
          return this.unstage(params);
        case 'git/discard':
          return this.discard(params);

        // Diff
        case 'git/diff':
          return this.diff(params);
        case 'git/diffLines':
          return this.diffLines(params);
        case 'git/diffBuffer':
          return this.diffBuffer(params);

        // Commit
        case 'git/commit':
          return this.commit(params);
        case 'git/amend':
          return this.amend(params);
        case 'git/log':
          return this.log(params);

        // Branches
        case 'git/branches':
          return this.branches(params);
        case 'git/createBranch':
          return this.createBranch(params);
        case 'git/switchBranch':
          return this.switchBranch(params);
        case 'git/deleteBranch':
          return this.deleteBranch(params);
        case 'git/renameBranch':
          return this.renameBranch(params);

        // Remote
        case 'git/push':
          return this.push(params);
        case 'git/pull':
          return this.pull(params);
        case 'git/fetch':
          return this.fetch(params);
        case 'git/remotes':
          return this.remotes(params);

        // Merge
        case 'git/merge':
          return this.merge(params);
        case 'git/mergeAbort':
          return this.abortMerge(params);
        case 'git/conflicts':
          return this.getConflicts(params);

        // Stash
        case 'git/stash':
          return this.stash(params);
        case 'git/stashPop':
          return this.stashPop(params);
        case 'git/stashList':
          return this.stashList(params);
        case 'git/stashDrop':
          return this.stashDrop(params);
        case 'git/stashApply':
          return this.stashApply(params);

        // Blame
        case 'git/blame':
          return this.blame(params);

        // Content
        case 'git/show':
          return this.show(params);

        default:
          return {
            error: {
              code: GitECPErrorCodes.MethodNotFound,
              message: `Method not found: ${method}`
            }
          };
      }
    } catch (error) {
      return { error: this.toJsonRpcError(error) };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Repository handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async isRepo(params: unknown): Promise<HandlerResult<{ isRepo: boolean; rootUri?: string }>> {
    const p = params as { uri: string };
    if (!p?.uri) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    const isRepo = await this.service.isRepo(p.uri);
    if (isRepo) {
      const rootUri = await this.service.getRoot(p.uri);
      return { result: { isRepo: true, rootUri: rootUri ?? undefined } };
    }
    return { result: { isRepo: false } };
  }

  private async status(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string; forceRefresh?: boolean };
    if (!p?.uri) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    const result = await this.service.status(p.uri, p.forceRefresh);
    return { result };
  }

  private async branch(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string };
    if (!p?.uri) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    const info = await this.service.branch(p.uri);
    return {
      result: {
        branch: info.name,
        tracking: info.tracking,
        ahead: info.ahead,
        behind: info.behind
      }
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Staging handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async stage(params: unknown): Promise<HandlerResult<{ success: boolean }>> {
    const p = params as { uri: string; paths: string[] };
    if (!p?.uri || !Array.isArray(p.paths)) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri and paths are required' } };
    }

    await this.service.stage(p.uri, p.paths);
    return { result: { success: true } };
  }

  private async stageAll(params: unknown): Promise<HandlerResult<{ success: boolean }>> {
    const p = params as { uri: string };
    if (!p?.uri) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    await this.service.stageAll(p.uri);
    return { result: { success: true } };
  }

  private async unstage(params: unknown): Promise<HandlerResult<{ success: boolean }>> {
    const p = params as { uri: string; paths: string[] };
    if (!p?.uri || !Array.isArray(p.paths)) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri and paths are required' } };
    }

    await this.service.unstage(p.uri, p.paths);
    return { result: { success: true } };
  }

  private async discard(params: unknown): Promise<HandlerResult<{ success: boolean }>> {
    const p = params as { uri: string; paths: string[] };
    if (!p?.uri || !Array.isArray(p.paths)) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri and paths are required' } };
    }

    await this.service.discard(p.uri, p.paths);
    return { result: { success: true } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Diff handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async diff(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string; path: string; staged?: boolean };
    if (!p?.uri || !p.path) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri and path are required' } };
    }

    const hunks = await this.service.diff(p.uri, p.path, p.staged);
    return { result: { hunks } };
  }

  private async diffLines(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string; path: string };
    if (!p?.uri || !p.path) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri and path are required' } };
    }

    const changes = await this.service.diffLines(p.uri, p.path);
    return { result: { changes } };
  }

  private async diffBuffer(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string; path: string; content: string };
    if (!p?.uri || !p.path || typeof p.content !== 'string') {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri, path, and content are required' } };
    }

    const changes = await this.service.diffBuffer(p.uri, p.path, p.content);
    return { result: { changes } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Commit handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async commit(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string; message: string };
    if (!p?.uri || !p.message) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri and message are required' } };
    }

    const result = await this.service.commit(p.uri, p.message);
    return { result };
  }

  private async amend(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string; message?: string };
    if (!p?.uri) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    const result = await this.service.amend(p.uri, p.message);
    return { result };
  }

  private async log(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string; count?: number };
    if (!p?.uri) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    const commits = await this.service.log(p.uri, p.count);
    return { result: { commits } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Branch handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async branches(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string };
    if (!p?.uri) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    const result = await this.service.branches(p.uri);
    return { result };
  }

  private async createBranch(params: unknown): Promise<HandlerResult<{ success: boolean }>> {
    const p = params as { uri: string; name: string; checkout?: boolean };
    if (!p?.uri || !p.name) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri and name are required' } };
    }

    await this.service.createBranch(p.uri, p.name, p.checkout);
    return { result: { success: true } };
  }

  private async switchBranch(params: unknown): Promise<HandlerResult<{ success: boolean }>> {
    const p = params as { uri: string; name: string };
    if (!p?.uri || !p.name) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri and name are required' } };
    }

    await this.service.switchBranch(p.uri, p.name);
    return { result: { success: true } };
  }

  private async deleteBranch(params: unknown): Promise<HandlerResult<{ success: boolean }>> {
    const p = params as { uri: string; name: string; force?: boolean };
    if (!p?.uri || !p.name) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri and name are required' } };
    }

    await this.service.deleteBranch(p.uri, p.name, p.force);
    return { result: { success: true } };
  }

  private async renameBranch(params: unknown): Promise<HandlerResult<{ success: boolean }>> {
    const p = params as { uri: string; newName: string };
    if (!p?.uri || !p.newName) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri and newName are required' } };
    }

    await this.service.renameBranch(p.uri, p.newName);
    return { result: { success: true } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Remote handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async push(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string; remote?: string; force?: boolean; setUpstream?: boolean };
    if (!p?.uri) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    const options: PushOptions = {};
    if (p.force) options.forceWithLease = true;
    if (p.setUpstream) options.setUpstream = true;

    const result = await this.service.push(p.uri, p.remote, options);
    return { result };
  }

  private async pull(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string; remote?: string };
    if (!p?.uri) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    const result = await this.service.pull(p.uri, p.remote);
    return { result };
  }

  private async fetch(params: unknown): Promise<HandlerResult<{ success: boolean }>> {
    const p = params as { uri: string; remote?: string };
    if (!p?.uri) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    await this.service.fetch(p.uri, p.remote);
    return { result: { success: true } };
  }

  private async remotes(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string };
    if (!p?.uri) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    const remotes = await this.service.remotes(p.uri);
    return { result: { remotes } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Merge handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async merge(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string; branch: string };
    if (!p?.uri || !p.branch) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri and branch are required' } };
    }

    const result = await this.service.merge(p.uri, p.branch);
    return { result };
  }

  private async abortMerge(params: unknown): Promise<HandlerResult<{ success: boolean }>> {
    const p = params as { uri: string };
    if (!p?.uri) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    await this.service.abortMerge(p.uri);
    return { result: { success: true } };
  }

  private async getConflicts(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string };
    if (!p?.uri) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    const files = await this.service.getConflicts(p.uri);
    return { result: { files } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stash handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async stash(params: unknown): Promise<HandlerResult<{ success: boolean; stashId: string }>> {
    const p = params as { uri: string; message?: string };
    if (!p?.uri) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    const stashId = await this.service.stash(p.uri, p.message);
    return { result: { success: true, stashId } };
  }

  private async stashPop(params: unknown): Promise<HandlerResult<{ success: boolean }>> {
    const p = params as { uri: string; stashId?: string };
    if (!p?.uri) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    await this.service.stashPop(p.uri, p.stashId);
    return { result: { success: true } };
  }

  private async stashList(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string };
    if (!p?.uri) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    const stashes = await this.service.stashList(p.uri);
    return { result: { stashes } };
  }

  private async stashDrop(params: unknown): Promise<HandlerResult<{ success: boolean }>> {
    const p = params as { uri: string; stashId: string };
    if (!p?.uri || !p.stashId) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri and stashId are required' } };
    }

    await this.service.stashDrop(p.uri, p.stashId);
    return { result: { success: true } };
  }

  private async stashApply(params: unknown): Promise<HandlerResult<{ success: boolean }>> {
    const p = params as { uri: string; stashId?: string };
    if (!p?.uri) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    await this.service.stashApply(p.uri, p.stashId);
    return { result: { success: true } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Blame/Content handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async blame(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string; path: string };
    if (!p?.uri || !p.path) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri and path are required' } };
    }

    const lines = await this.service.blame(p.uri, p.path);
    return { result: { lines } };
  }

  private async show(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string; path: string; ref: string };
    if (!p?.uri || !p.path || !p.ref) {
      return { error: { code: GitECPErrorCodes.InvalidParams, message: 'uri, path, and ref are required' } };
    }

    const content = await this.service.show(p.uri, p.path, p.ref);
    return { result: { content } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private toJsonRpcError(error: unknown): JsonRpcError {
    if (error instanceof GitError) {
      return {
        code: GitECPErrorCodes.CommandFailed,
        message: error.message,
        data: {
          gitErrorCode: error.code,
          uri: error.uri
        }
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
      code: GitECPErrorCodes.InternalError,
      message
    };
  }
}
