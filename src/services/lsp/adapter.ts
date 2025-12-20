/**
 * LSP Service ECP Adapter
 *
 * Maps ECP JSON-RPC calls to LSPService methods.
 */

import type { LSPService } from './interface.ts';
import { LSPError } from './errors.ts';
import type { LSPPosition, LSPDiagnostic } from './types.ts';

/**
 * ECP error codes (JSON-RPC 2.0 compatible).
 */
export const LSPECPErrorCodes = {
  // Standard JSON-RPC errors
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,

  // LSP service errors (-32400 to -32499)
  ServerNotFound: -32400,
  ServerStartFailed: -32401,
  ServerNotInitialized: -32402,
  RequestTimeout: -32403,
  RequestFailed: -32404,
  DocumentNotOpen: -32405,
  InvalidUri: -32406,
  InvalidPosition: -32407,
  NotSupported: -32408,
  Disabled: -32409,
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
 * Notification handler type.
 */
type NotificationHandler = (notification: { method: string; params: unknown }) => void;

/**
 * LSP Service Adapter for ECP protocol.
 *
 * Handles JSON-RPC method routing and error conversion.
 */
export class LSPServiceAdapter {
  private notificationHandler: NotificationHandler | null = null;

  constructor(private readonly service: LSPService) {
    // Subscribe to diagnostics and forward as notifications
    this.service.onDiagnostics((uri, diagnostics) => {
      this.emitNotification('lsp/didPublishDiagnostics', { uri, diagnostics });
    });

    // Subscribe to server status changes
    this.service.onServerStatusChange((status) => {
      this.emitNotification('lsp/serverStatusChanged', status);
    });
  }

  /**
   * Set notification handler for forwarding LSP notifications.
   */
  setNotificationHandler(handler: NotificationHandler): void {
    this.notificationHandler = handler;
  }

  /**
   * Handle an ECP request.
   *
   * @param method The method name (e.g., "lsp/completion")
   * @param params The request parameters
   * @returns The method result
   */
  async handleRequest(method: string, params: unknown): Promise<HandlerResult<unknown>> {
    try {
      switch (method) {
        // Server lifecycle
        case 'lsp/start':
          return await this.lspStart(params);
        case 'lsp/stop':
          return await this.lspStop(params);
        case 'lsp/status':
          return this.lspStatus(params);

        // Document sync
        case 'lsp/documentOpen':
          return await this.documentOpen(params);
        case 'lsp/documentChange':
          return await this.documentChange(params);
        case 'lsp/documentSave':
          return await this.documentSave(params);
        case 'lsp/documentClose':
          return await this.documentClose(params);

        // Code intelligence
        case 'lsp/completion':
          return await this.completion(params);
        case 'lsp/hover':
          return await this.hover(params);
        case 'lsp/signatureHelp':
          return await this.signatureHelp(params);
        case 'lsp/definition':
          return await this.definition(params);
        case 'lsp/references':
          return await this.references(params);
        case 'lsp/documentSymbol':
          return await this.documentSymbol(params);
        case 'lsp/rename':
          return await this.rename(params);

        // Diagnostics
        case 'lsp/diagnostics':
          return this.diagnostics(params);
        case 'lsp/allDiagnostics':
          return this.allDiagnostics();
        case 'lsp/diagnosticsSummary':
          return this.diagnosticsSummary();

        // Configuration
        case 'lsp/setServerConfig':
          return this.setServerConfig(params);
        case 'lsp/getServerConfig':
          return this.getServerConfig(params);
        case 'lsp/getLanguageId':
          return this.getLanguageId(params);
        case 'lsp/hasServerFor':
          return this.hasServerFor(params);

        default:
          return {
            error: {
              code: LSPECPErrorCodes.MethodNotFound,
              message: `Method not found: ${method}`,
            },
          };
      }
    } catch (error) {
      return { error: this.toJsonRpcError(error) };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Server lifecycle handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async lspStart(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { languageId: string; workspaceUri: string };
    if (!p?.languageId || !p?.workspaceUri) {
      return {
        error: {
          code: LSPECPErrorCodes.InvalidParams,
          message: 'languageId and workspaceUri are required',
        },
      };
    }

    const info = await this.service.startServer(p.languageId, p.workspaceUri);
    return { result: { success: true, ...info } };
  }

  private async lspStop(params: unknown): Promise<HandlerResult<{ success: boolean }>> {
    const p = params as { languageId: string };
    if (!p?.languageId) {
      return {
        error: { code: LSPECPErrorCodes.InvalidParams, message: 'languageId is required' },
      };
    }

    await this.service.stopServer(p.languageId);
    return { result: { success: true } };
  }

  private lspStatus(params: unknown): HandlerResult<unknown> {
    const p = params as { languageId?: string } | undefined;
    const servers = this.service.getServerStatus(p?.languageId);
    return { result: { servers } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Document sync handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async documentOpen(params: unknown): Promise<HandlerResult<{ success: boolean }>> {
    const p = params as { uri: string; languageId: string; content: string };
    if (!p?.uri || !p?.languageId || p?.content === undefined) {
      return {
        error: {
          code: LSPECPErrorCodes.InvalidParams,
          message: 'uri, languageId, and content are required',
        },
      };
    }

    await this.service.documentOpened(p.uri, p.languageId, p.content);
    return { result: { success: true } };
  }

  private async documentChange(params: unknown): Promise<HandlerResult<{ success: boolean }>> {
    const p = params as { uri: string; content: string; version?: number };
    if (!p?.uri || p?.content === undefined) {
      return {
        error: { code: LSPECPErrorCodes.InvalidParams, message: 'uri and content are required' },
      };
    }

    await this.service.documentChanged(p.uri, p.content, p.version ?? 1);
    return { result: { success: true } };
  }

  private async documentSave(params: unknown): Promise<HandlerResult<{ success: boolean }>> {
    const p = params as { uri: string; content?: string };
    if (!p?.uri) {
      return { error: { code: LSPECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    await this.service.documentSaved(p.uri, p.content);
    return { result: { success: true } };
  }

  private async documentClose(params: unknown): Promise<HandlerResult<{ success: boolean }>> {
    const p = params as { uri: string };
    if (!p?.uri) {
      return { error: { code: LSPECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    await this.service.documentClosed(p.uri);
    return { result: { success: true } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Code intelligence handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async completion(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string; position: LSPPosition };
    if (!p?.uri || !p?.position) {
      return {
        error: { code: LSPECPErrorCodes.InvalidParams, message: 'uri and position are required' },
      };
    }

    const items = await this.service.getCompletions(p.uri, p.position);
    return { result: { items } };
  }

  private async hover(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string; position: LSPPosition };
    if (!p?.uri || !p?.position) {
      return {
        error: { code: LSPECPErrorCodes.InvalidParams, message: 'uri and position are required' },
      };
    }

    const hover = await this.service.getHover(p.uri, p.position);
    return { result: hover };
  }

  private async signatureHelp(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string; position: LSPPosition };
    if (!p?.uri || !p?.position) {
      return {
        error: { code: LSPECPErrorCodes.InvalidParams, message: 'uri and position are required' },
      };
    }

    const help = await this.service.getSignatureHelp(p.uri, p.position);
    return { result: help };
  }

  private async definition(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string; position: LSPPosition };
    if (!p?.uri || !p?.position) {
      return {
        error: { code: LSPECPErrorCodes.InvalidParams, message: 'uri and position are required' },
      };
    }

    const locations = await this.service.getDefinition(p.uri, p.position);
    return { result: { locations } };
  }

  private async references(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string; position: LSPPosition; includeDeclaration?: boolean };
    if (!p?.uri || !p?.position) {
      return {
        error: { code: LSPECPErrorCodes.InvalidParams, message: 'uri and position are required' },
      };
    }

    const locations = await this.service.getReferences(
      p.uri,
      p.position,
      p.includeDeclaration ?? true
    );
    return { result: { locations } };
  }

  private async documentSymbol(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string };
    if (!p?.uri) {
      return { error: { code: LSPECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    const symbols = await this.service.getDocumentSymbols(p.uri);
    return { result: { symbols } };
  }

  private async rename(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { uri: string; position: LSPPosition; newName: string };
    if (!p?.uri || !p?.position || !p?.newName) {
      return {
        error: {
          code: LSPECPErrorCodes.InvalidParams,
          message: 'uri, position, and newName are required',
        },
      };
    }

    const edit = await this.service.rename(p.uri, p.position, p.newName);
    return { result: { edit } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Diagnostics handlers
  // ─────────────────────────────────────────────────────────────────────────

  private diagnostics(params: unknown): HandlerResult<{ diagnostics: LSPDiagnostic[] }> {
    const p = params as { uri: string };
    if (!p?.uri) {
      return { error: { code: LSPECPErrorCodes.InvalidParams, message: 'uri is required' } };
    }

    const diagnostics = this.service.getDiagnostics(p.uri);
    return { result: { diagnostics } };
  }

  private allDiagnostics(): HandlerResult<{ diagnostics: Record<string, LSPDiagnostic[]> }> {
    const map = this.service.getAllDiagnostics();
    const diagnostics: Record<string, LSPDiagnostic[]> = {};
    for (const [uri, diags] of map) {
      diagnostics[uri] = diags;
    }
    return { result: { diagnostics } };
  }

  private diagnosticsSummary(): HandlerResult<{ errors: number; warnings: number }> {
    const summary = this.service.getDiagnosticsSummary();
    return { result: summary };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Configuration handlers
  // ─────────────────────────────────────────────────────────────────────────

  private setServerConfig(params: unknown): HandlerResult<{ success: boolean }> {
    const p = params as { languageId: string; config: { command: string; args: string[] } };
    if (!p?.languageId || !p?.config?.command) {
      return {
        error: {
          code: LSPECPErrorCodes.InvalidParams,
          message: 'languageId and config.command are required',
        },
      };
    }

    this.service.setServerConfig(p.languageId, p.config);
    return { result: { success: true } };
  }

  private getServerConfig(params: unknown): HandlerResult<unknown> {
    const p = params as { languageId: string };
    if (!p?.languageId) {
      return {
        error: { code: LSPECPErrorCodes.InvalidParams, message: 'languageId is required' },
      };
    }

    const config = this.service.getServerConfig(p.languageId);
    return { result: { config } };
  }

  private getLanguageId(params: unknown): HandlerResult<{ languageId: string | null }> {
    const p = params as { filePath: string };
    if (!p?.filePath) {
      return { error: { code: LSPECPErrorCodes.InvalidParams, message: 'filePath is required' } };
    }

    const languageId = this.service.getLanguageId(p.filePath);
    return { result: { languageId } };
  }

  private hasServerFor(params: unknown): HandlerResult<{ available: boolean }> {
    const p = params as { languageId: string };
    if (!p?.languageId) {
      return {
        error: { code: LSPECPErrorCodes.InvalidParams, message: 'languageId is required' },
      };
    }

    const available = this.service.hasServerFor(p.languageId);
    return { result: { available } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private emitNotification(method: string, params: unknown): void {
    if (this.notificationHandler) {
      this.notificationHandler({ method, params });
    }
  }

  private toJsonRpcError(error: unknown): JsonRpcError {
    if (error instanceof LSPError) {
      // Map LSPError codes to ECP error codes
      let code: number = LSPECPErrorCodes.InternalError;
      switch (error.code) {
        case 'SERVER_NOT_FOUND':
          code = LSPECPErrorCodes.ServerNotFound;
          break;
        case 'SERVER_START_FAILED':
          code = LSPECPErrorCodes.ServerStartFailed;
          break;
        case 'SERVER_NOT_INITIALIZED':
          code = LSPECPErrorCodes.ServerNotInitialized;
          break;
        case 'REQUEST_TIMEOUT':
          code = LSPECPErrorCodes.RequestTimeout;
          break;
        case 'REQUEST_FAILED':
          code = LSPECPErrorCodes.RequestFailed;
          break;
        case 'DOCUMENT_NOT_OPEN':
          code = LSPECPErrorCodes.DocumentNotOpen;
          break;
        case 'INVALID_URI':
          code = LSPECPErrorCodes.InvalidUri;
          break;
        case 'INVALID_POSITION':
          code = LSPECPErrorCodes.InvalidPosition;
          break;
        case 'NOT_SUPPORTED':
          code = LSPECPErrorCodes.NotSupported;
          break;
        case 'DISABLED':
          code = LSPECPErrorCodes.Disabled;
          break;
      }

      return {
        code,
        message: error.message,
        data: error.data,
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
      code: LSPECPErrorCodes.InternalError,
      message,
    };
  }
}
