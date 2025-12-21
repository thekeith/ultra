/**
 * Syntax Service ECP Adapter
 *
 * Maps ECP JSON-RPC calls to SyntaxService methods.
 */

import type { SyntaxService } from './interface.ts';
import { SyntaxError } from './errors.ts';
import type { HighlightToken } from './types.ts';

/**
 * ECP error codes (JSON-RPC 2.0 compatible).
 */
export const SyntaxECPErrorCodes = {
  // Standard JSON-RPC errors
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,

  // Syntax service errors (-32500 to -32599)
  NotReady: -32500,
  LanguageNotSupported: -32501,
  ThemeNotFound: -32502,
  SessionNotFound: -32503,
  ParseError: -32504,
  InvalidLine: -32505,
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
 * Syntax Service Adapter for ECP protocol.
 *
 * Handles JSON-RPC method routing and error conversion.
 */
export class SyntaxServiceAdapter {
  constructor(private readonly service: SyntaxService) {}

  /**
   * Handle an ECP request.
   *
   * @param method The method name (e.g., "syntax/highlight")
   * @param params The request parameters
   * @returns The method result
   */
  async handleRequest(method: string, params: unknown): Promise<HandlerResult<unknown>> {
    try {
      switch (method) {
        // Highlighting
        case 'syntax/highlight':
          return await this.highlight(params);
        case 'syntax/highlightLine':
          return await this.highlightLine(params);

        // Sessions
        case 'syntax/createSession':
          return await this.createSession(params);
        case 'syntax/updateSession':
          return await this.updateSession(params);
        case 'syntax/getSessionTokens':
          return this.getSessionTokens(params);
        case 'syntax/getSessionAllTokens':
          return this.getSessionAllTokens(params);
        case 'syntax/disposeSession':
          return this.disposeSession(params);
        case 'syntax/getSession':
          return this.getSession(params);

        // Language support
        case 'syntax/languages':
          return this.languages();
        case 'syntax/isSupported':
          return this.isSupported(params);
        case 'syntax/detectLanguage':
          return this.detectLanguage(params);

        // Themes
        case 'syntax/themes':
          return this.themes();
        case 'syntax/setTheme':
          return this.setTheme(params);
        case 'syntax/getTheme':
          return this.getTheme();

        // Metrics
        case 'syntax/metrics':
          return this.metrics();
        case 'syntax/resetMetrics':
          return this.resetMetrics();

        // Status
        case 'syntax/isReady':
          return this.isReady();
        case 'syntax/waitForReady':
          return await this.waitForReady();

        default:
          return {
            error: {
              code: SyntaxECPErrorCodes.MethodNotFound,
              message: `Method not found: ${method}`,
            },
          };
      }
    } catch (error) {
      return { error: this.toJsonRpcError(error) };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Highlighting handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async highlight(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { content: string; languageId: string; theme?: string };
    if (!p?.content === undefined || !p?.languageId) {
      return {
        error: {
          code: SyntaxECPErrorCodes.InvalidParams,
          message: 'content and languageId are required',
        },
      };
    }

    if (p.theme) {
      this.service.setTheme(p.theme);
    }

    const result = await this.service.highlight(p.content, p.languageId);
    return { result };
  }

  private async highlightLine(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { content: string; languageId: string; lineNumber: number; theme?: string };
    if (p?.content === undefined || !p?.languageId || p?.lineNumber === undefined) {
      return {
        error: {
          code: SyntaxECPErrorCodes.InvalidParams,
          message: 'content, languageId, and lineNumber are required',
        },
      };
    }

    if (p.theme) {
      this.service.setTheme(p.theme);
    }

    const tokens = await this.service.highlightLine(p.content, p.languageId, p.lineNumber);
    return { result: { tokens } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Session handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async createSession(params: unknown): Promise<HandlerResult<unknown>> {
    const p = params as { documentId: string; languageId: string; content: string };
    if (!p?.documentId || !p?.languageId || p?.content === undefined) {
      return {
        error: {
          code: SyntaxECPErrorCodes.InvalidParams,
          message: 'documentId, languageId, and content are required',
        },
      };
    }

    const session = await this.service.createSession(p.documentId, p.languageId, p.content);
    return { result: { session } };
  }

  private async updateSession(params: unknown): Promise<HandlerResult<{ success: boolean }>> {
    const p = params as { sessionId: string; content: string };
    if (!p?.sessionId || p?.content === undefined) {
      return {
        error: {
          code: SyntaxECPErrorCodes.InvalidParams,
          message: 'sessionId and content are required',
        },
      };
    }

    await this.service.updateSession(p.sessionId, p.content);
    return { result: { success: true } };
  }

  private getSessionTokens(params: unknown): HandlerResult<{ tokens: HighlightToken[] }> {
    const p = params as { sessionId: string; lineNumber: number };
    if (!p?.sessionId || p?.lineNumber === undefined) {
      return {
        error: {
          code: SyntaxECPErrorCodes.InvalidParams,
          message: 'sessionId and lineNumber are required',
        },
      };
    }

    const tokens = this.service.getSessionTokens(p.sessionId, p.lineNumber);
    return { result: { tokens } };
  }

  private getSessionAllTokens(params: unknown): HandlerResult<{ lines: HighlightToken[][] }> {
    const p = params as { sessionId: string };
    if (!p?.sessionId) {
      return {
        error: { code: SyntaxECPErrorCodes.InvalidParams, message: 'sessionId is required' },
      };
    }

    const lines = this.service.getSessionAllTokens(p.sessionId);
    return { result: { lines } };
  }

  private disposeSession(params: unknown): HandlerResult<{ success: boolean }> {
    const p = params as { sessionId: string };
    if (!p?.sessionId) {
      return {
        error: { code: SyntaxECPErrorCodes.InvalidParams, message: 'sessionId is required' },
      };
    }

    this.service.disposeSession(p.sessionId);
    return { result: { success: true } };
  }

  private getSession(params: unknown): HandlerResult<unknown> {
    const p = params as { sessionId: string };
    if (!p?.sessionId) {
      return {
        error: { code: SyntaxECPErrorCodes.InvalidParams, message: 'sessionId is required' },
      };
    }

    const session = this.service.getSession(p.sessionId);
    return { result: { session } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Language support handlers
  // ─────────────────────────────────────────────────────────────────────────

  private languages(): HandlerResult<{ languages: string[] }> {
    const languages = this.service.getSupportedLanguages();
    return { result: { languages } };
  }

  private isSupported(params: unknown): HandlerResult<{ supported: boolean }> {
    const p = params as { languageId: string };
    if (!p?.languageId) {
      return {
        error: { code: SyntaxECPErrorCodes.InvalidParams, message: 'languageId is required' },
      };
    }

    const supported = this.service.isLanguageSupported(p.languageId);
    return { result: { supported } };
  }

  private detectLanguage(params: unknown): HandlerResult<{ languageId: string | null }> {
    const p = params as { filePath: string };
    if (!p?.filePath) {
      return {
        error: { code: SyntaxECPErrorCodes.InvalidParams, message: 'filePath is required' },
      };
    }

    const languageId = this.service.detectLanguage(p.filePath);
    return { result: { languageId } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Theme handlers
  // ─────────────────────────────────────────────────────────────────────────

  private themes(): HandlerResult<{ themes: string[] }> {
    const themes = this.service.getAvailableThemes();
    return { result: { themes } };
  }

  private setTheme(params: unknown): HandlerResult<{ success: boolean }> {
    const p = params as { theme: string };
    if (!p?.theme) {
      return {
        error: { code: SyntaxECPErrorCodes.InvalidParams, message: 'theme is required' },
      };
    }

    this.service.setTheme(p.theme);
    return { result: { success: true } };
  }

  private getTheme(): HandlerResult<{ theme: string }> {
    const theme = this.service.getTheme();
    return { result: { theme } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Metrics handlers
  // ─────────────────────────────────────────────────────────────────────────

  private metrics(): HandlerResult<unknown> {
    const metrics = this.service.getMetrics();
    return { result: { metrics } };
  }

  private resetMetrics(): HandlerResult<{ success: boolean }> {
    this.service.resetMetrics();
    return { result: { success: true } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Status handlers
  // ─────────────────────────────────────────────────────────────────────────

  private isReady(): HandlerResult<{ ready: boolean }> {
    const ready = this.service.isReady();
    return { result: { ready } };
  }

  private async waitForReady(): Promise<HandlerResult<{ ready: boolean }>> {
    const ready = await this.service.waitForReady();
    return { result: { ready } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private toJsonRpcError(error: unknown): JsonRpcError {
    if (error instanceof SyntaxError) {
      // Map SyntaxError codes to ECP error codes
      let code: number = SyntaxECPErrorCodes.InternalError;
      switch (error.code) {
        case 'NOT_READY':
          code = SyntaxECPErrorCodes.NotReady;
          break;
        case 'LANGUAGE_NOT_SUPPORTED':
          code = SyntaxECPErrorCodes.LanguageNotSupported;
          break;
        case 'THEME_NOT_FOUND':
          code = SyntaxECPErrorCodes.ThemeNotFound;
          break;
        case 'SESSION_NOT_FOUND':
          code = SyntaxECPErrorCodes.SessionNotFound;
          break;
        case 'PARSE_ERROR':
          code = SyntaxECPErrorCodes.ParseError;
          break;
        case 'INVALID_LINE':
          code = SyntaxECPErrorCodes.InvalidLine;
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
      code: SyntaxECPErrorCodes.InternalError,
      message,
    };
  }
}
