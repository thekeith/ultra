/**
 * Terminal Service
 *
 * Public exports for the Terminal Service module.
 */

// Types
export type {
  TerminalCell,
  CursorPosition,
  TerminalOptions,
  TerminalInfo,
  TerminalBuffer,
  TerminalOutputEvent,
  TerminalExitEvent,
  TerminalTitleEvent,
  TerminalOutputCallback,
  TerminalExitCallback,
  TerminalTitleCallback,
  Unsubscribe,
} from './types.ts';

// Errors
export { TerminalError, TerminalErrorCode } from './errors.ts';

// Interface
export type { TerminalService } from './interface.ts';

// Implementation
export { LocalTerminalService, localTerminalService } from './service.ts';

// ECP Adapter
export { TerminalServiceAdapter, TerminalECPErrorCodes } from './adapter.ts';
