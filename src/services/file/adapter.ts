/**
 * File Service ECP Adapter
 *
 * Maps JSON-RPC 2.0 methods to FileService operations.
 * This adapter handles the protocol layer, allowing the service
 * to be accessed via ECP.
 */

import { debugLog } from '../../debug.ts';
import type { FileService } from './interface.ts';
import type {
  WriteOptions,
  CreateDirOptions,
  DeleteDirOptions,
  SearchOptions,
  GlobOptions,
  WatchOptions,
  FileChangeEvent,
  WatchHandle,
} from './types.ts';
import { FileError, FileErrorCode } from './errors.ts';

/**
 * ECP error codes (JSON-RPC 2.0 compatible).
 */
export const ECPErrorCodes = {
  // Standard JSON-RPC errors
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,

  // File service errors (-32100 to -32199)
  FileNotFound: -32100,
  AccessDenied: -32101,
  IsDirectory: -32102,
  NotDirectory: -32103,
  AlreadyExists: -32104,
  NotEmpty: -32105,
  InvalidUri: -32106,
  NoProvider: -32107,
  NotSupported: -32108,
  IOError: -32109,
} as const;

/**
 * ECP error response.
 */
export interface ECPError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * ECP request.
 */
export interface ECPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

/**
 * ECP response.
 */
export interface ECPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: ECPError;
}

/**
 * ECP notification (no id, no response expected).
 */
export interface ECPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

/**
 * Handler result - either success with result or error.
 */
type HandlerResult<T> = { result: T } | { error: ECPError };

/**
 * Map FileError codes to ECP error codes.
 */
function fileErrorToECPError(error: FileError): ECPError {
  const codeMap: Record<FileErrorCode, number> = {
    [FileErrorCode.NOT_FOUND]: ECPErrorCodes.FileNotFound,
    [FileErrorCode.ACCESS_DENIED]: ECPErrorCodes.AccessDenied,
    [FileErrorCode.IS_DIRECTORY]: ECPErrorCodes.IsDirectory,
    [FileErrorCode.NOT_DIRECTORY]: ECPErrorCodes.NotDirectory,
    [FileErrorCode.ALREADY_EXISTS]: ECPErrorCodes.AlreadyExists,
    [FileErrorCode.NOT_EMPTY]: ECPErrorCodes.NotEmpty,
    [FileErrorCode.INVALID_URI]: ECPErrorCodes.InvalidUri,
    [FileErrorCode.NO_PROVIDER]: ECPErrorCodes.NoProvider,
    [FileErrorCode.NOT_SUPPORTED]: ECPErrorCodes.NotSupported,
    [FileErrorCode.IO_ERROR]: ECPErrorCodes.IOError,
    [FileErrorCode.UNKNOWN]: ECPErrorCodes.InternalError,
  };

  return {
    code: codeMap[error.code] ?? ECPErrorCodes.InternalError,
    message: error.message,
    data: { uri: error.uri, code: error.code },
  };
}

/**
 * File Service ECP Adapter.
 *
 * Maps JSON-RPC methods to FileService operations:
 *
 * Content operations:
 * - file/read -> read()
 * - file/write -> write()
 *
 * Metadata operations:
 * - file/stat -> stat()
 * - file/exists -> exists()
 *
 * File operations:
 * - file/delete -> delete()
 * - file/rename -> rename()
 * - file/copy -> copy()
 *
 * Directory operations:
 * - file/readDir -> readDir()
 * - file/createDir -> createDir()
 * - file/deleteDir -> deleteDir()
 *
 * Search operations:
 * - file/search -> search()
 * - file/glob -> glob()
 *
 * Watch operations:
 * - file/watch -> watch()
 * - file/unwatch -> dispose watch
 *
 * Utility:
 * - file/pathToUri -> pathToUri()
 * - file/uriToPath -> uriToPath()
 * - file/getParent -> getParentUri()
 * - file/getBasename -> getBasename()
 * - file/join -> joinUri()
 */
export class FileServiceAdapter {
  private service: FileService;
  private notificationHandler?: (notification: ECPNotification) => void;
  private activeWatches = new Map<string, WatchHandle>();

  constructor(service: FileService) {
    this.service = service;

    // Subscribe to file change events
    this.setupEventHandlers();
  }

  /**
   * Set handler for outgoing notifications.
   */
  setNotificationHandler(handler: (notification: ECPNotification) => void): void {
    this.notificationHandler = handler;
  }

  /**
   * Handle an incoming ECP request.
   */
  async handleRequest(request: ECPRequest): Promise<ECPResponse> {
    const { id, method, params } = request;

    debugLog(`[FileServiceAdapter] Handling request: ${method}`);

    try {
      const result = await this.dispatch(method, params);

      if ('error' in result) {
        return {
          jsonrpc: '2.0',
          id,
          error: result.error,
        };
      }

      return {
        jsonrpc: '2.0',
        id,
        result: result.result,
      };
    } catch (error) {
      debugLog(`[FileServiceAdapter] Error handling ${method}: ${error}`);

      // Convert FileError to ECP error
      if (error instanceof FileError) {
        return {
          jsonrpc: '2.0',
          id,
          error: fileErrorToECPError(error),
        };
      }

      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: ECPErrorCodes.InternalError,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Dispatch a method to the appropriate handler.
   */
  private async dispatch(method: string, params: unknown): Promise<HandlerResult<unknown>> {
    switch (method) {
      // Content operations
      case 'file/read':
        return this.handleRead(params);
      case 'file/write':
        return this.handleWrite(params);

      // Metadata operations
      case 'file/stat':
        return this.handleStat(params);
      case 'file/exists':
        return this.handleExists(params);

      // File operations
      case 'file/delete':
        return this.handleDelete(params);
      case 'file/rename':
        return this.handleRename(params);
      case 'file/copy':
        return this.handleCopy(params);

      // Directory operations
      case 'file/readDir':
        return this.handleReadDir(params);
      case 'file/createDir':
        return this.handleCreateDir(params);
      case 'file/deleteDir':
        return this.handleDeleteDir(params);

      // Search operations
      case 'file/search':
        return this.handleSearch(params);
      case 'file/glob':
        return this.handleGlob(params);

      // Watch operations
      case 'file/watch':
        return this.handleWatch(params);
      case 'file/unwatch':
        return this.handleUnwatch(params);

      // Utility operations
      case 'file/pathToUri':
        return this.handlePathToUri(params);
      case 'file/uriToPath':
        return this.handleUriToPath(params);
      case 'file/getParent':
        return this.handleGetParent(params);
      case 'file/getBasename':
        return this.handleGetBasename(params);
      case 'file/join':
        return this.handleJoin(params);

      default:
        return {
          error: {
            code: ECPErrorCodes.MethodNotFound,
            message: `Unknown method: ${method}`,
          },
        };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Content Operation Handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async handleRead(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string };
    if (!p?.uri) {
      return { error: { code: ECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    const result = await this.service.read(p.uri);
    return { result };
  }

  private async handleWrite(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as {
      uri: string;
      content: string;
      encoding?: string;
      createParents?: boolean;
      overwrite?: boolean;
    };
    if (!p?.uri || typeof p.content !== 'string') {
      return { error: { code: ECPErrorCodes.InvalidParams, message: 'uri and content are required' } };
    }

    const options: WriteOptions = {
      encoding: p.encoding,
      createParents: p.createParents,
      overwrite: p.overwrite,
    };

    const result = await this.service.write(p.uri, p.content, options);
    return { result };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Metadata Operation Handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async handleStat(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string };
    if (!p?.uri) {
      return { error: { code: ECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    const result = await this.service.stat(p.uri);
    return { result };
  }

  private async handleExists(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string };
    if (!p?.uri) {
      return { error: { code: ECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    const exists = await this.service.exists(p.uri);
    return { result: { exists } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // File Operation Handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async handleDelete(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string };
    if (!p?.uri) {
      return { error: { code: ECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    await this.service.delete(p.uri);
    return { result: { success: true } };
  }

  private async handleRename(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { oldUri: string; newUri: string };
    if (!p?.oldUri || !p?.newUri) {
      return { error: { code: ECPErrorCodes.InvalidParams, message: 'oldUri and newUri are required' } };
    }

    await this.service.rename(p.oldUri, p.newUri);
    return { result: { success: true } };
  }

  private async handleCopy(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { sourceUri: string; targetUri: string };
    if (!p?.sourceUri || !p?.targetUri) {
      return { error: { code: ECPErrorCodes.InvalidParams, message: 'sourceUri and targetUri are required' } };
    }

    await this.service.copy(p.sourceUri, p.targetUri);
    return { result: { success: true } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Directory Operation Handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async handleReadDir(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string };
    if (!p?.uri) {
      return { error: { code: ECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    const entries = await this.service.readDir(p.uri);
    return { result: { entries } };
  }

  private async handleCreateDir(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string; recursive?: boolean };
    if (!p?.uri) {
      return { error: { code: ECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    const options: CreateDirOptions = {
      recursive: p.recursive,
    };

    await this.service.createDir(p.uri, options);
    return { result: { success: true } };
  }

  private async handleDeleteDir(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string; recursive?: boolean };
    if (!p?.uri) {
      return { error: { code: ECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    const options: DeleteDirOptions = {
      recursive: p.recursive,
    };

    await this.service.deleteDir(p.uri, options);
    return { result: { success: true } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Search Operation Handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async handleSearch(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as {
      pattern: string;
      maxResults?: number;
      includePatterns?: string[];
      excludePatterns?: string[];
    };
    if (!p?.pattern) {
      return { error: { code: ECPErrorCodes.InvalidParams, message: 'pattern is required' } };
    }

    const options: SearchOptions = {
      maxResults: p.maxResults,
      includePatterns: p.includePatterns,
      excludePatterns: p.excludePatterns,
    };

    const results = await this.service.search(p.pattern, options);
    return { result: { results } };
  }

  private async handleGlob(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as {
      pattern: string;
      baseUri?: string;
      maxResults?: number;
      includeDirectories?: boolean;
      followSymlinks?: boolean;
      excludePatterns?: string[];
    };
    if (!p?.pattern) {
      return { error: { code: ECPErrorCodes.InvalidParams, message: 'pattern is required' } };
    }

    const options: GlobOptions = {
      baseUri: p.baseUri,
      maxResults: p.maxResults,
      includeDirectories: p.includeDirectories,
      followSymlinks: p.followSymlinks,
      excludePatterns: p.excludePatterns,
    };

    const uris = await this.service.glob(p.pattern, options);
    return { result: { uris } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Watch Operation Handlers
  // ─────────────────────────────────────────────────────────────────────────

  private handleWatch(params: unknown): HandlerResult<unknown> {
    const p = params as { uri: string; recursive?: boolean };
    if (!p?.uri) {
      return { error: { code: ECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    const options: WatchOptions = {
      recursive: p.recursive,
    };

    // Create watch with callback that sends notifications
    const handle = this.service.watch(
      p.uri,
      (event: FileChangeEvent) => {
        this.sendNotification('file/didChange', event);
      },
      options
    );

    // Store handle for later disposal
    this.activeWatches.set(handle.id, handle);

    return { result: { watchId: handle.id } };
  }

  private handleUnwatch(params: unknown): HandlerResult<unknown> {
    const p = params as { watchId: string };
    if (!p?.watchId) {
      return { error: { code: ECPErrorCodes.InvalidParams, message: 'watchId is required' } };
    }

    const handle = this.activeWatches.get(p.watchId);
    if (!handle) {
      return { error: { code: ECPErrorCodes.InvalidParams, message: 'Unknown watchId' } };
    }

    handle.dispose();
    this.activeWatches.delete(p.watchId);

    return { result: { success: true } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Utility Operation Handlers
  // ─────────────────────────────────────────────────────────────────────────

  private handlePathToUri(params: unknown): HandlerResult<unknown> {
    const p = params as { path: string };
    if (!p?.path) {
      return { error: { code: ECPErrorCodes.InvalidParams, message: 'path is required' } };
    }

    const uri = this.service.pathToUri(p.path);
    return { result: { uri } };
  }

  private handleUriToPath(params: unknown): HandlerResult<unknown> {
    const p = params as { uri: string };
    if (!p?.uri) {
      return { error: { code: ECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    const path = this.service.uriToPath(p.uri);
    return { result: { path } };
  }

  private handleGetParent(params: unknown): HandlerResult<unknown> {
    const p = params as { uri: string };
    if (!p?.uri) {
      return { error: { code: ECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    const parent = this.service.getParentUri(p.uri);
    return { result: { parent } };
  }

  private handleGetBasename(params: unknown): HandlerResult<unknown> {
    const p = params as { uri: string };
    if (!p?.uri) {
      return { error: { code: ECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    const basename = this.service.getBasename(p.uri);
    return { result: { basename } };
  }

  private handleJoin(params: unknown): HandlerResult<unknown> {
    const p = params as { baseUri: string; paths: string[] };
    if (!p?.baseUri || !Array.isArray(p.paths)) {
      return { error: { code: ECPErrorCodes.InvalidParams, message: 'baseUri and paths array are required' } };
    }

    const uri = this.service.joinUri(p.baseUri, ...p.paths);
    return { result: { uri } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event Handlers
  // ─────────────────────────────────────────────────────────────────────────

  private setupEventHandlers(): void {
    // Subscribe to file change events
    this.service.onFileChange((event: FileChangeEvent) => {
      // Determine notification type based on change type
      switch (event.type) {
        case 'created':
          this.sendNotification('file/didCreate', { uri: event.uri });
          break;
        case 'deleted':
          this.sendNotification('file/didDelete', { uri: event.uri });
          break;
        case 'changed':
          this.sendNotification('file/didChange', event);
          break;
      }
    });
  }

  private sendNotification(method: string, params: unknown): void {
    if (this.notificationHandler) {
      this.notificationHandler({
        jsonrpc: '2.0',
        method,
        params,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Dispose all active watches.
   */
  dispose(): void {
    for (const handle of this.activeWatches.values()) {
      handle.dispose();
    }
    this.activeWatches.clear();
  }
}
