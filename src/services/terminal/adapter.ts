/**
 * Terminal Service ECP Adapter
 *
 * Maps ECP JSON-RPC calls to TerminalService methods.
 */

import type { TerminalService } from './interface.ts';
import { TerminalError } from './errors.ts';
import type { TerminalInfo, TerminalBuffer, TerminalOptions } from './types.ts';

/**
 * ECP error codes (JSON-RPC 2.0 compatible).
 */
export const TerminalECPErrorCodes = {
  // Standard JSON-RPC errors
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,

  // Terminal service errors (-32700 to -32799)
  TerminalNotFound: -32700,
  TerminalExists: -32701,
  StartFailed: -32702,
  NotRunning: -32703,
  InvalidDimensions: -32704,
  ShellNotFound: -32705,
  WriteFailed: -32706,
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
type NotificationHandler = (notification: {
  method: string;
  params: unknown;
}) => void;

/**
 * Terminal Service Adapter for ECP protocol.
 *
 * Handles JSON-RPC method routing and error conversion.
 */
export class TerminalServiceAdapter {
  private notificationHandler?: NotificationHandler;

  constructor(private readonly service: TerminalService) {
    // Subscribe to events and forward as notifications
    this.service.onOutput((event) => {
      this.sendNotification('terminal/output', event);
    });

    this.service.onExit((event) => {
      this.sendNotification('terminal/exit', event);
    });

    this.service.onTitle((event) => {
      this.sendNotification('terminal/title', event);
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
  private sendNotification(method: string, params: unknown): void {
    if (this.notificationHandler) {
      this.notificationHandler({ method, params });
    }
  }

  /**
   * Handle an ECP request.
   *
   * @param method The method name (e.g., "terminal/create")
   * @param params The request parameters
   * @returns The method result
   */
  async handleRequest(method: string, params: unknown): Promise<HandlerResult<unknown>> {
    try {
      switch (method) {
        // Lifecycle
        case 'terminal/create':
          return await this.create(params);
        case 'terminal/close':
          return this.close(params);
        case 'terminal/closeAll':
          return this.closeAll();

        // Operations
        case 'terminal/write':
          return this.write(params);
        case 'terminal/resize':
          return this.resize(params);

        // Buffer
        case 'terminal/getBuffer':
          return this.getBuffer(params);
        case 'terminal/scroll':
          return this.scroll(params);
        case 'terminal/scrollToBottom':
          return this.scrollToBottom(params);

        // Info
        case 'terminal/getInfo':
          return this.getInfo(params);
        case 'terminal/list':
          return this.list();
        case 'terminal/exists':
          return this.exists(params);
        case 'terminal/isRunning':
          return this.isRunning(params);

        default:
          return {
            error: {
              code: TerminalECPErrorCodes.MethodNotFound,
              message: `Method not found: ${method}`,
            },
          };
      }
    } catch (error) {
      return { error: this.toJsonRpcError(error) };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async create(params: unknown): Promise<HandlerResult<{ terminalId: string }>> {
    const p = params as TerminalOptions | undefined;

    const terminalId = await this.service.create(p);
    return { result: { terminalId } };
  }

  private close(params: unknown): HandlerResult<{ success: boolean }> {
    const p = params as { terminalId: string };
    if (!p?.terminalId) {
      return {
        error: {
          code: TerminalECPErrorCodes.InvalidParams,
          message: 'terminalId is required',
        },
      };
    }

    this.service.close(p.terminalId);
    return { result: { success: true } };
  }

  private closeAll(): HandlerResult<{ success: boolean }> {
    this.service.closeAll();
    return { result: { success: true } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Operation handlers
  // ─────────────────────────────────────────────────────────────────────────

  private write(params: unknown): HandlerResult<{ success: boolean }> {
    const p = params as { terminalId: string; data: string };
    if (!p?.terminalId || p?.data === undefined) {
      return {
        error: {
          code: TerminalECPErrorCodes.InvalidParams,
          message: 'terminalId and data are required',
        },
      };
    }

    this.service.write(p.terminalId, p.data);
    return { result: { success: true } };
  }

  private resize(params: unknown): HandlerResult<{ success: boolean }> {
    const p = params as { terminalId: string; cols: number; rows: number };
    if (!p?.terminalId || p?.cols === undefined || p?.rows === undefined) {
      return {
        error: {
          code: TerminalECPErrorCodes.InvalidParams,
          message: 'terminalId, cols, and rows are required',
        },
      };
    }

    this.service.resize(p.terminalId, p.cols, p.rows);
    return { result: { success: true } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Buffer handlers
  // ─────────────────────────────────────────────────────────────────────────

  private getBuffer(params: unknown): HandlerResult<{ buffer: TerminalBuffer | null }> {
    const p = params as { terminalId: string };
    if (!p?.terminalId) {
      return {
        error: {
          code: TerminalECPErrorCodes.InvalidParams,
          message: 'terminalId is required',
        },
      };
    }

    const buffer = this.service.getBuffer(p.terminalId);
    return { result: { buffer } };
  }

  private scroll(params: unknown): HandlerResult<{ success: boolean }> {
    const p = params as { terminalId: string; lines: number };
    if (!p?.terminalId || p?.lines === undefined) {
      return {
        error: {
          code: TerminalECPErrorCodes.InvalidParams,
          message: 'terminalId and lines are required',
        },
      };
    }

    this.service.scroll(p.terminalId, p.lines);
    return { result: { success: true } };
  }

  private scrollToBottom(params: unknown): HandlerResult<{ success: boolean }> {
    const p = params as { terminalId: string };
    if (!p?.terminalId) {
      return {
        error: {
          code: TerminalECPErrorCodes.InvalidParams,
          message: 'terminalId is required',
        },
      };
    }

    this.service.scrollToBottom(p.terminalId);
    return { result: { success: true } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Info handlers
  // ─────────────────────────────────────────────────────────────────────────

  private getInfo(params: unknown): HandlerResult<{ info: TerminalInfo | null }> {
    const p = params as { terminalId: string };
    if (!p?.terminalId) {
      return {
        error: {
          code: TerminalECPErrorCodes.InvalidParams,
          message: 'terminalId is required',
        },
      };
    }

    const info = this.service.getInfo(p.terminalId);
    return { result: { info } };
  }

  private list(): HandlerResult<{ terminals: TerminalInfo[] }> {
    const terminals = this.service.list();
    return { result: { terminals } };
  }

  private exists(params: unknown): HandlerResult<{ exists: boolean }> {
    const p = params as { terminalId: string };
    if (!p?.terminalId) {
      return {
        error: {
          code: TerminalECPErrorCodes.InvalidParams,
          message: 'terminalId is required',
        },
      };
    }

    const exists = this.service.exists(p.terminalId);
    return { result: { exists } };
  }

  private isRunning(params: unknown): HandlerResult<{ running: boolean }> {
    const p = params as { terminalId: string };
    if (!p?.terminalId) {
      return {
        error: {
          code: TerminalECPErrorCodes.InvalidParams,
          message: 'terminalId is required',
        },
      };
    }

    const running = this.service.isRunning(p.terminalId);
    return { result: { running } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private toJsonRpcError(error: unknown): JsonRpcError {
    if (error instanceof TerminalError) {
      // Map TerminalError codes to ECP error codes
      let code: number = TerminalECPErrorCodes.InternalError;
      switch (error.code) {
        case 'TERMINAL_NOT_FOUND':
          code = TerminalECPErrorCodes.TerminalNotFound;
          break;
        case 'TERMINAL_EXISTS':
          code = TerminalECPErrorCodes.TerminalExists;
          break;
        case 'START_FAILED':
          code = TerminalECPErrorCodes.StartFailed;
          break;
        case 'NOT_RUNNING':
          code = TerminalECPErrorCodes.NotRunning;
          break;
        case 'INVALID_DIMENSIONS':
          code = TerminalECPErrorCodes.InvalidDimensions;
          break;
        case 'SHELL_NOT_FOUND':
          code = TerminalECPErrorCodes.ShellNotFound;
          break;
        case 'WRITE_FAILED':
          code = TerminalECPErrorCodes.WriteFailed;
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
      code: TerminalECPErrorCodes.InternalError,
      message,
    };
  }
}
