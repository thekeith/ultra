/**
 * Git Service ECP Adapter
 *
 * Maps JSON-RPC methods to GitService operations.
 */

import type { GitService } from './interface.ts';
import { GitError, GitErrorCode } from './errors.ts';

/**
 * ECP request structure.
 */
interface ECPRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: unknown;
}

/**
 * ECP response structure.
 */
interface ECPResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * ECP notification structure.
 */
interface ECPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

/**
 * Notification handler callback.
 */
type NotificationHandler = (notification: ECPNotification) => void;

/**
 * ECP error codes for git operations.
 */
const ECPErrorCodes = {
  // Standard JSON-RPC errors
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,

  // Git-specific errors (-32200 to -32299)
  NotARepo: -32200,
  UncommittedChanges: -32201,
  MergeConflict: -32202,
  PushRejected: -32203,
  AuthFailed: -32204,
  NetworkError: -32205,
  BranchNotFound: -32206,
  BranchExists: -32207,
  RemoteNotFound: -32208,
  NoUpstream: -32209,
  RefNotFound: -32210,
  FileNotFound: -32211,
  CommandFailed: -32212,
} as const;

/**
 * Map GitErrorCode to ECP error code.
 */
function mapErrorCode(code: GitErrorCode): number {
  switch (code) {
    case GitErrorCode.NOT_A_REPO:
      return ECPErrorCodes.NotARepo;
    case GitErrorCode.UNCOMMITTED_CHANGES:
      return ECPErrorCodes.UncommittedChanges;
    case GitErrorCode.MERGE_CONFLICT:
      return ECPErrorCodes.MergeConflict;
    case GitErrorCode.PUSH_REJECTED:
      return ECPErrorCodes.PushRejected;
    case GitErrorCode.AUTHENTICATION_FAILED:
      return ECPErrorCodes.AuthFailed;
    case GitErrorCode.NETWORK_ERROR:
      return ECPErrorCodes.NetworkError;
    case GitErrorCode.BRANCH_NOT_FOUND:
      return ECPErrorCodes.BranchNotFound;
    case GitErrorCode.BRANCH_EXISTS:
      return ECPErrorCodes.BranchExists;
    case GitErrorCode.REMOTE_NOT_FOUND:
      return ECPErrorCodes.RemoteNotFound;
    case GitErrorCode.NO_UPSTREAM:
      return ECPErrorCodes.NoUpstream;
    case GitErrorCode.REF_NOT_FOUND:
      return ECPErrorCodes.RefNotFound;
    case GitErrorCode.FILE_NOT_FOUND:
      return ECPErrorCodes.FileNotFound;
    case GitErrorCode.COMMAND_FAILED:
      return ECPErrorCodes.CommandFailed;
    default:
      return ECPErrorCodes.InternalError;
  }
}

/**
 * Git Service ECP Adapter.
 *
 * Handles git/* ECP method calls.
 */
export class GitServiceAdapter {
  private notificationHandler?: NotificationHandler;
  private unsubscribe?: () => void;

  constructor(private service: GitService) {
    // Subscribe to git changes and forward as notifications
    this.unsubscribe = this.service.onChange((event) => {
      this.notify('git/didChange', {
        uri: event.uri,
        type: event.type,
      });
    });
  }

  /**
   * Set notification handler.
   */
  setNotificationHandler(handler: NotificationHandler): void {
    this.notificationHandler = handler;
  }

  /**
   * Send a notification.
   */
  private notify(method: string, params?: unknown): void {
    if (this.notificationHandler) {
      this.notificationHandler({
        jsonrpc: '2.0',
        method,
        params,
      });
    }
  }

  /**
   * Handle an ECP request.
   */
  async handleRequest(request: ECPRequest): Promise<ECPResponse> {
    try {
      const result = await this.dispatch(request.method, request.params);
      return {
        jsonrpc: '2.0',
        id: request.id,
        result,
      };
    } catch (error) {
      return this.createErrorResponse(request.id, error);
    }
  }

  /**
   * Dispatch method to handler.
   */
  private async dispatch(method: string, params: unknown): Promise<unknown> {
    const p = (params || {}) as Record<string, unknown>;

    switch (method) {
      // Repository
      case 'git/isRepo':
        return this.handleIsRepo(p);
      case 'git/status':
        return this.handleStatus(p);
      case 'git/branch':
        return this.handleBranch(p);

      // Staging
      case 'git/stage':
        return this.handleStage(p);
      case 'git/stageAll':
        return this.handleStageAll(p);
      case 'git/unstage':
        return this.handleUnstage(p);
      case 'git/discard':
        return this.handleDiscard(p);

      // Diff
      case 'git/diff':
        return this.handleDiff(p);
      case 'git/diffLines':
        return this.handleDiffLines(p);
      case 'git/diffBuffer':
        return this.handleDiffBuffer(p);

      // Commit
      case 'git/commit':
        return this.handleCommit(p);
      case 'git/amend':
        return this.handleAmend(p);
      case 'git/log':
        return this.handleLog(p);

      // Branches
      case 'git/branches':
        return this.handleBranches(p);
      case 'git/createBranch':
        return this.handleCreateBranch(p);
      case 'git/switchBranch':
        return this.handleSwitchBranch(p);
      case 'git/deleteBranch':
        return this.handleDeleteBranch(p);
      case 'git/renameBranch':
        return this.handleRenameBranch(p);

      // Remote
      case 'git/push':
        return this.handlePush(p);
      case 'git/pull':
        return this.handlePull(p);
      case 'git/fetch':
        return this.handleFetch(p);
      case 'git/remotes':
        return this.handleRemotes(p);

      // Merge
      case 'git/merge':
        return this.handleMerge(p);
      case 'git/mergeAbort':
        return this.handleMergeAbort(p);
      case 'git/conflicts':
        return this.handleConflicts(p);

      // Stash
      case 'git/stash':
        return this.handleStash(p);
      case 'git/stashPop':
        return this.handleStashPop(p);
      case 'git/stashList':
        return this.handleStashList(p);
      case 'git/stashDrop':
        return this.handleStashDrop(p);
      case 'git/stashApply':
        return this.handleStashApply(p);

      // Blame
      case 'git/blame':
        return this.handleBlame(p);

      // Content
      case 'git/show':
        return this.handleShow(p);

      default:
        throw { code: ECPErrorCodes.MethodNotFound, message: `Unknown method: ${method}` };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Repository Handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async handleIsRepo(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const isRepo = await this.service.isRepo(uri);
    const rootUri = isRepo ? await this.service.getRoot(uri) : undefined;
    return { isRepo, rootUri };
  }

  private async handleStatus(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const forceRefresh = params.forceRefresh as boolean | undefined;
    return await this.service.status(uri, forceRefresh);
  }

  private async handleBranch(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    return await this.service.branch(uri);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Staging Handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async handleStage(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const paths = this.requireStringArray(params, 'paths');
    await this.service.stage(uri, paths);
    return { success: true };
  }

  private async handleStageAll(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    await this.service.stageAll(uri);
    return { success: true };
  }

  private async handleUnstage(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const paths = this.requireStringArray(params, 'paths');
    await this.service.unstage(uri, paths);
    return { success: true };
  }

  private async handleDiscard(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const paths = this.requireStringArray(params, 'paths');
    await this.service.discard(uri, paths);
    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Diff Handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async handleDiff(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const path = this.requireString(params, 'path');
    const staged = params.staged as boolean | undefined;
    const hunks = await this.service.diff(uri, path, staged);
    return { hunks };
  }

  private async handleDiffLines(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const path = this.requireString(params, 'path');
    const changes = await this.service.diffLines(uri, path);
    return { changes };
  }

  private async handleDiffBuffer(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const path = this.requireString(params, 'path');
    const content = this.requireString(params, 'content');
    const changes = await this.service.diffBuffer(uri, path, content);
    return { changes };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Commit Handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async handleCommit(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const message = this.requireString(params, 'message');
    return await this.service.commit(uri, message);
  }

  private async handleAmend(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const message = params.message as string | undefined;
    return await this.service.amend(uri, message);
  }

  private async handleLog(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const count = params.count as number | undefined;
    const commits = await this.service.log(uri, count);
    return { commits };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Branch Handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async handleBranches(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    return await this.service.branches(uri);
  }

  private async handleCreateBranch(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const name = this.requireString(params, 'name');
    const checkout = params.checkout as boolean | undefined;
    await this.service.createBranch(uri, name, checkout);
    return { success: true };
  }

  private async handleSwitchBranch(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const name = this.requireString(params, 'name');
    await this.service.switchBranch(uri, name);
    return { success: true };
  }

  private async handleDeleteBranch(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const name = this.requireString(params, 'name');
    const force = params.force as boolean | undefined;
    await this.service.deleteBranch(uri, name, force);
    return { success: true };
  }

  private async handleRenameBranch(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const newName = this.requireString(params, 'newName');
    await this.service.renameBranch(uri, newName);
    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Remote Handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async handlePush(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const remote = params.remote as string | undefined;
    const options = {
      forceWithLease: params.force as boolean | undefined,
      setUpstream: params.setUpstream as boolean | undefined,
    };
    return await this.service.push(uri, remote, options);
  }

  private async handlePull(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const remote = params.remote as string | undefined;
    return await this.service.pull(uri, remote);
  }

  private async handleFetch(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const remote = params.remote as string | undefined;
    await this.service.fetch(uri, remote);
    return { success: true };
  }

  private async handleRemotes(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const remotes = await this.service.remotes(uri);
    return { remotes };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Merge Handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async handleMerge(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const branch = this.requireString(params, 'branch');
    return await this.service.merge(uri, branch);
  }

  private async handleMergeAbort(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    await this.service.abortMerge(uri);
    return { success: true };
  }

  private async handleConflicts(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const files = await this.service.getConflicts(uri);
    return { files };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stash Handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async handleStash(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const message = params.message as string | undefined;
    const stashId = await this.service.stash(uri, message);
    return { success: true, stashId };
  }

  private async handleStashPop(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const stashId = params.stashId as string | undefined;
    await this.service.stashPop(uri, stashId);
    return { success: true };
  }

  private async handleStashList(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const stashes = await this.service.stashList(uri);
    return { stashes };
  }

  private async handleStashDrop(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const stashId = this.requireString(params, 'stashId');
    await this.service.stashDrop(uri, stashId);
    return { success: true };
  }

  private async handleStashApply(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const stashId = params.stashId as string | undefined;
    await this.service.stashApply(uri, stashId);
    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Blame Handler
  // ─────────────────────────────────────────────────────────────────────────

  private async handleBlame(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const path = this.requireString(params, 'path');
    const lines = await this.service.blame(uri, path);
    return { lines };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Content Handler
  // ─────────────────────────────────────────────────────────────────────────

  private async handleShow(params: Record<string, unknown>): Promise<unknown> {
    const uri = this.requireString(params, 'uri');
    const path = this.requireString(params, 'path');
    const ref = this.requireString(params, 'ref');
    const content = await this.service.show(uri, path, ref);
    return { content };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private requireString(params: Record<string, unknown>, name: string): string {
    const value = params[name];
    if (typeof value !== 'string') {
      throw { code: ECPErrorCodes.InvalidParams, message: `Missing or invalid parameter: ${name}` };
    }
    return value;
  }

  private requireStringArray(params: Record<string, unknown>, name: string): string[] {
    const value = params[name];
    if (!Array.isArray(value) || !value.every(v => typeof v === 'string')) {
      throw { code: ECPErrorCodes.InvalidParams, message: `Missing or invalid parameter: ${name}` };
    }
    return value as string[];
  }

  private createErrorResponse(id: number | string, error: unknown): ECPResponse {
    if (error instanceof GitError) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: mapErrorCode(error.code),
          message: error.message,
          data: { gitErrorCode: error.code, uri: error.uri },
        },
      };
    }

    if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
      return {
        jsonrpc: '2.0',
        id,
        error: error as { code: number; message: string },
      };
    }

    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: ECPErrorCodes.InternalError,
        message: String(error),
      },
    };
  }

  /**
   * Dispose resources.
   */
  dispose(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
    this.notificationHandler = undefined;
  }
}
