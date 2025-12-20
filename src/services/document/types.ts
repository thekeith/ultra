/**
 * Document Service Types
 *
 * Core type definitions for the Document Service, which manages
 * text buffers, cursors, selections, and undo/redo operations.
 */

/**
 * A position in a document (0-indexed line and column).
 */
export interface Position {
  line: number;
  column: number;
}

/**
 * A range in a document defined by start and end positions.
 * Start is inclusive, end is exclusive.
 */
export interface Range {
  start: Position;
  end: Position;
}

/**
 * A selection with anchor (where selection started) and active (current cursor) positions.
 * When anchor equals active, there is no selection.
 */
export interface Selection {
  anchor: Position;
  active: Position;
}

/**
 * A cursor with its position and optional selection.
 */
export interface Cursor {
  /** Current cursor position */
  position: Position;

  /** Selection range, if any */
  selection?: Selection;

  /** Desired column for vertical movement (preserved across short lines) */
  desiredColumn?: number;
}

/**
 * Types of edit operations for undo/redo.
 */
export type EditOperationType = 'insert' | 'delete';

/**
 * An edit operation that can be undone/redone.
 */
export interface EditOperation {
  type: EditOperationType;
  position: Position;
  text: string;
}

/**
 * A group of operations that form a single undo action.
 */
export interface UndoAction {
  /** The operations in this action (in order) */
  operations: EditOperation[];

  /** Cursor state before the action */
  cursorsBefore: Cursor[];

  /** Cursor state after the action */
  cursorsAfter: Cursor[];

  /** Timestamp when action was created */
  timestamp: number;
}

/**
 * Information about a document.
 */
export interface DocumentInfo {
  /** Unique document identifier */
  documentId: string;

  /** URI of the document (file://, memory://, etc.) */
  uri: string;

  /** Language identifier for syntax highlighting */
  languageId: string;

  /** Document version (increments on each change) */
  version: number;

  /** Whether document has unsaved changes */
  isDirty: boolean;

  /** Whether document is read-only */
  isReadOnly: boolean;

  /** Line count */
  lineCount: number;
}

/**
 * Options for opening a document.
 */
export interface DocumentOpenOptions {
  /** URI of the document */
  uri: string;

  /** Initial content (for memory:// documents or overriding file content) */
  content?: string;

  /** Language identifier (auto-detected if not provided) */
  languageId?: string;

  /** Open as read-only */
  readOnly?: boolean;
}

/**
 * Result of opening a document.
 */
export interface DocumentOpenResult {
  /** The document ID for subsequent operations */
  documentId: string;

  /** Document information */
  info: DocumentInfo;
}

/**
 * Options for inserting text.
 */
export interface InsertOptions {
  /** Document ID */
  documentId: string;

  /** Position to insert at */
  position: Position;

  /** Text to insert */
  text: string;

  /** Whether this is part of a larger operation (for undo grouping) */
  groupWithPrevious?: boolean;
}

/**
 * Options for deleting text.
 */
export interface DeleteOptions {
  /** Document ID */
  documentId: string;

  /** Range to delete */
  range: Range;

  /** Whether this is part of a larger operation (for undo grouping) */
  groupWithPrevious?: boolean;
}

/**
 * Options for replacing text.
 */
export interface ReplaceOptions {
  /** Document ID */
  documentId: string;

  /** Range to replace */
  range: Range;

  /** New text */
  text: string;

  /** Whether this is part of a larger operation (for undo grouping) */
  groupWithPrevious?: boolean;
}

/**
 * Result of an edit operation.
 */
export interface EditResult {
  /** Whether the operation succeeded */
  success: boolean;

  /** New document version after the edit */
  version: number;

  /** Error message if operation failed */
  error?: string;
}

/**
 * Options for setting cursor positions.
 */
export interface SetCursorsOptions {
  /** Document ID */
  documentId: string;

  /** New cursor positions */
  cursors: Cursor[];
}

/**
 * Direction for cursor movement.
 */
export type MoveDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Unit for cursor movement.
 */
export type MoveUnit = 'character' | 'word' | 'line' | 'page' | 'document';

/**
 * Options for moving cursors.
 */
export interface MoveCursorsOptions {
  /** Document ID */
  documentId: string;

  /** Direction to move */
  direction: MoveDirection;

  /** Unit of movement */
  unit?: MoveUnit;

  /** Whether to extend selection while moving */
  select?: boolean;
}

/**
 * Result of an undo/redo operation.
 */
export interface UndoRedoResult {
  /** Whether the operation succeeded */
  success: boolean;

  /** New document version */
  version: number;

  /** Whether there are more undo actions available */
  canUndo: boolean;

  /** Whether there are more redo actions available */
  canRedo: boolean;
}

/**
 * Document content with metadata.
 */
export interface DocumentContent {
  /** Full document content */
  content: string;

  /** Document version */
  version: number;

  /** Line count */
  lineCount: number;
}

/**
 * A line of text with its line number.
 */
export interface DocumentLine {
  /** Line number (0-indexed) */
  lineNumber: number;

  /** Line content (without line ending) */
  text: string;
}

/**
 * Event emitted when a document changes.
 */
export interface DocumentChangeEvent {
  /** Document ID */
  documentId: string;

  /** Document URI */
  uri: string;

  /** New version after change */
  version: number;

  /** Changes made (for incremental updates) */
  changes: TextChange[];
}

/**
 * A text change in a document.
 */
export interface TextChange {
  /** Range that was replaced */
  range: Range;

  /** New text that replaced the range */
  text: string;

  /** Length of text that was replaced */
  rangeLength: number;
}

/**
 * Event emitted when cursors change.
 */
export interface CursorChangeEvent {
  /** Document ID */
  documentId: string;

  /** New cursor positions */
  cursors: Cursor[];
}

/**
 * Event emitted when a document is opened.
 */
export interface DocumentOpenEvent {
  /** Document ID */
  documentId: string;

  /** Document URI */
  uri: string;

  /** Language ID */
  languageId: string;
}

/**
 * Event emitted when a document is closed.
 */
export interface DocumentCloseEvent {
  /** Document ID */
  documentId: string;

  /** Document URI */
  uri: string;
}

/**
 * Unsubscribe function returned by event subscriptions.
 */
export type Unsubscribe = () => void;
