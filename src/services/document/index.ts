/**
 * Document Service
 *
 * Public API for document management.
 */

// Types
export type {
  Position,
  Range,
  Selection,
  Cursor,
  EditOperationType,
  EditOperation,
  UndoAction,
  DocumentInfo,
  DocumentOpenOptions,
  DocumentOpenResult,
  InsertOptions,
  DeleteOptions,
  ReplaceOptions,
  EditResult,
  SetCursorsOptions,
  MoveDirection,
  MoveUnit,
  MoveCursorsOptions,
  UndoRedoResult,
  DocumentContent,
  DocumentLine,
  DocumentChangeEvent,
  TextChange,
  CursorChangeEvent,
  DocumentOpenEvent,
  DocumentCloseEvent,
  Unsubscribe,
} from './types.ts';

// Interface
export type { DocumentService } from './interface.ts';

// Implementation
export { LocalDocumentService, localDocumentService } from './local.ts';

// Adapter
export { DocumentServiceAdapter, ECPErrorCodes } from './adapter.ts';
export type { ECPRequest, ECPResponse, ECPNotification, ECPError } from './adapter.ts';
