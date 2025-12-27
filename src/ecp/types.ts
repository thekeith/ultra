/**
 * ECP (Editor Command Protocol) Types
 *
 * JSON-RPC 2.0 compatible types for the Editor Command Protocol.
 */

// ─────────────────────────────────────────────────────────────────────────────
// JSON-RPC 2.0 Base Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * JSON-RPC 2.0 request.
 */
export interface ECPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

/**
 * JSON-RPC 2.0 success response.
 */
export interface ECPSuccessResponse {
  jsonrpc: '2.0';
  id: string | number;
  result: unknown;
}

/**
 * JSON-RPC 2.0 error object.
 */
export interface ECPError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * JSON-RPC 2.0 error response.
 */
export interface ECPErrorResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  error: ECPError;
}

/**
 * JSON-RPC 2.0 response (success or error).
 */
export type ECPResponse = ECPSuccessResponse | ECPErrorResponse;

/**
 * JSON-RPC 2.0 notification (no id, no response expected).
 */
export interface ECPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Standard JSON-RPC 2.0 Error Codes
// ─────────────────────────────────────────────────────────────────────────────

export const ECPErrorCodes = {
  // JSON-RPC 2.0 standard errors
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,

  // Server errors (-32000 to -32099)
  ServerError: -32000,
  ServerNotInitialized: -32001,
  ServerShuttingDown: -32002,
} as const;

export type ECPErrorCode = (typeof ECPErrorCodes)[keyof typeof ECPErrorCodes];

// ─────────────────────────────────────────────────────────────────────────────
// Handler Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result from a service adapter handler.
 */
export type HandlerResult<T = unknown> =
  | { result: T }
  | { error: ECPError };

/**
 * Service adapter interface.
 */
export interface ServiceAdapter {
  handleRequest(method: string, params: unknown): Promise<HandlerResult>;
  setNotificationHandler?(handler: NotificationHandler): void;
}

/**
 * Notification handler callback.
 */
export type NotificationHandler = (notification: ECPNotification) => void;

/**
 * Notification listener callback (for clients).
 */
export type NotificationListener = (method: string, params: unknown) => void;

// ─────────────────────────────────────────────────────────────────────────────
// Server Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ECP Server options.
 */
export interface ECPServerOptions {
  /** Workspace root for file operations */
  workspaceRoot?: string;
  /** Sessions directory (defaults to ~/.ultra/sessions) */
  sessionsDir?: string;
}

/**
 * ECP Server state.
 */
export type ECPServerState = 'uninitialized' | 'running' | 'shutdown';

// ─────────────────────────────────────────────────────────────────────────────
// Utility Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unsubscribe function.
 */
export type Unsubscribe = () => void;

/**
 * Helper to check if response is an error.
 */
export function isErrorResponse(response: ECPResponse): response is ECPErrorResponse {
  return 'error' in response;
}

/**
 * Helper to check if response is successful.
 */
export function isSuccessResponse(response: ECPResponse): response is ECPSuccessResponse {
  return 'result' in response;
}

/**
 * Create an error response.
 */
export function createErrorResponse(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): ECPErrorResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message, data },
  };
}

/**
 * Create a success response.
 */
export function createSuccessResponse(
  id: string | number,
  result: unknown
): ECPSuccessResponse {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

/**
 * Create a notification.
 */
export function createNotification(
  method: string,
  params?: unknown
): ECPNotification {
  return {
    jsonrpc: '2.0',
    method,
    params,
  };
}
