/**
 * ECP (Editor Command Protocol)
 *
 * Public exports for the ECP module.
 */

// Types
export type {
  ECPRequest,
  ECPSuccessResponse,
  ECPError,
  ECPErrorResponse,
  ECPResponse,
  ECPNotification,
  HandlerResult,
  ServiceAdapter,
  NotificationHandler,
  NotificationListener,
  ECPServerOptions,
  ECPServerState,
  Unsubscribe,
} from './types.ts';

export {
  ECPErrorCodes,
  isErrorResponse,
  isSuccessResponse,
  createErrorResponse,
  createSuccessResponse,
  createNotification,
} from './types.ts';

// Server
export { ECPServer, createECPServer } from './server.ts';
