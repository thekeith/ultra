/**
 * Document Service Interface
 *
 * The Document Service manages text documents including:
 * - Opening, closing, and tracking documents
 * - Text editing operations (insert, delete, replace)
 * - Cursor and selection management
 * - Undo/redo history
 *
 * This service is the core of the editor's text manipulation capabilities.
 * It does NOT handle file I/O (that's FileService's job).
 */

import type {
  Position,
  Range,
  Cursor,
  DocumentInfo,
  DocumentOpenOptions,
  DocumentOpenResult,
  DocumentContent,
  DocumentLine,
  InsertOptions,
  DeleteOptions,
  ReplaceOptions,
  EditResult,
  SetCursorsOptions,
  MoveCursorsOptions,
  MoveDirection,
  MoveUnit,
  UndoRedoResult,
  DocumentChangeEvent,
  CursorChangeEvent,
  DocumentOpenEvent,
  DocumentCloseEvent,
  Unsubscribe,
} from './types.ts';

/**
 * Document Service interface.
 *
 * Implementations:
 * - LocalDocumentService: In-memory document management
 * - (Future) RemoteDocumentService: Proxy to remote ECP server
 */
export interface DocumentService {
  // ─────────────────────────────────────────────────────────────────────────
  // Document Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Open a document for editing.
   *
   * For file:// URIs, content is loaded from the file system (via FileService).
   * For memory:// URIs, content must be provided in options.
   *
   * @param options - Document open options
   * @returns Document ID and info
   */
  open(options: DocumentOpenOptions): Promise<DocumentOpenResult>;

  /**
   * Close a document.
   *
   * @param documentId - Document to close
   * @returns Whether the document was closed
   */
  close(documentId: string): Promise<boolean>;

  /**
   * Get information about an open document.
   *
   * @param documentId - Document ID
   * @returns Document info or null if not found
   */
  getInfo(documentId: string): DocumentInfo | null;

  /**
   * List all open documents.
   *
   * @returns Array of document info
   */
  listOpen(): DocumentInfo[];

  /**
   * Check if a document is open.
   *
   * @param documentId - Document ID
   * @returns Whether the document is open
   */
  isOpen(documentId: string): boolean;

  /**
   * Find document by URI.
   *
   * @param uri - Document URI
   * @returns Document ID or null if not found
   */
  findByUri(uri: string): string | null;

  // ─────────────────────────────────────────────────────────────────────────
  // Content Access
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the full content of a document.
   *
   * @param documentId - Document ID
   * @returns Document content with metadata
   */
  getContent(documentId: string): DocumentContent | null;

  /**
   * Get a specific line from a document.
   *
   * @param documentId - Document ID
   * @param lineNumber - Line number (0-indexed)
   * @returns Line content or null if not found
   */
  getLine(documentId: string, lineNumber: number): DocumentLine | null;

  /**
   * Get a range of lines from a document.
   *
   * @param documentId - Document ID
   * @param startLine - Start line (0-indexed, inclusive)
   * @param endLine - End line (0-indexed, exclusive)
   * @returns Array of lines
   */
  getLines(documentId: string, startLine: number, endLine: number): DocumentLine[];

  /**
   * Get text within a range.
   *
   * @param documentId - Document ID
   * @param range - Range to get
   * @returns Text in range or null if document not found
   */
  getTextInRange(documentId: string, range: Range): string | null;

  /**
   * Get the current version of a document.
   * Version increments on each change, useful for change detection.
   *
   * @param documentId - Document ID
   * @returns Version number or null if not found
   */
  getVersion(documentId: string): number | null;

  // ─────────────────────────────────────────────────────────────────────────
  // Text Editing
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Insert text at a position.
   *
   * @param options - Insert options
   * @returns Edit result with new version
   */
  insert(options: InsertOptions): EditResult;

  /**
   * Delete text in a range.
   *
   * @param options - Delete options
   * @returns Edit result with new version
   */
  delete(options: DeleteOptions): EditResult;

  /**
   * Replace text in a range.
   *
   * @param options - Replace options
   * @returns Edit result with new version
   */
  replace(options: ReplaceOptions): EditResult;

  /**
   * Set the full content of a document.
   * This creates a single undo action for the entire change.
   *
   * @param documentId - Document ID
   * @param content - New content
   * @returns Edit result with new version
   */
  setContent(documentId: string, content: string): EditResult;

  // ─────────────────────────────────────────────────────────────────────────
  // Cursor Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get current cursor positions.
   *
   * @param documentId - Document ID
   * @returns Array of cursors or null if document not found
   */
  getCursors(documentId: string): Cursor[] | null;

  /**
   * Set cursor positions.
   *
   * @param options - Set cursors options
   * @returns Whether the operation succeeded
   */
  setCursors(options: SetCursorsOptions): boolean;

  /**
   * Set a single cursor (convenience method).
   *
   * @param documentId - Document ID
   * @param position - Cursor position
   * @param selection - Optional selection
   * @returns Whether the operation succeeded
   */
  setCursor(documentId: string, position: Position, selection?: { anchor: Position; active: Position }): boolean;

  /**
   * Add a cursor (for multi-cursor editing).
   *
   * @param documentId - Document ID
   * @param position - New cursor position
   * @returns Whether the operation succeeded
   */
  addCursor(documentId: string, position: Position): boolean;

  /**
   * Move cursors in a direction.
   *
   * @param options - Move options
   * @returns Whether the operation succeeded
   */
  moveCursors(options: MoveCursorsOptions): boolean;

  /**
   * Move cursors to a specific position.
   *
   * @param documentId - Document ID
   * @param position - Target position
   * @param select - Whether to extend selection
   * @returns Whether the operation succeeded
   */
  moveCursorsTo(documentId: string, position: Position, select?: boolean): boolean;

  /**
   * Select all text in the document.
   *
   * @param documentId - Document ID
   * @returns Whether the operation succeeded
   */
  selectAll(documentId: string): boolean;

  /**
   * Clear all selections (but keep cursor positions).
   *
   * @param documentId - Document ID
   * @returns Whether the operation succeeded
   */
  clearSelections(documentId: string): boolean;

  /**
   * Get the selected text for each cursor.
   *
   * @param documentId - Document ID
   * @returns Array of selected texts (empty string if no selection)
   */
  getSelections(documentId: string): string[] | null;

  // ─────────────────────────────────────────────────────────────────────────
  // Undo/Redo
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Undo the last action.
   *
   * @param documentId - Document ID
   * @returns Undo result with new version
   */
  undo(documentId: string): UndoRedoResult;

  /**
   * Redo the last undone action.
   *
   * @param documentId - Document ID
   * @returns Redo result with new version
   */
  redo(documentId: string): UndoRedoResult;

  /**
   * Check if undo is available.
   *
   * @param documentId - Document ID
   * @returns Whether undo is available
   */
  canUndo(documentId: string): boolean;

  /**
   * Check if redo is available.
   *
   * @param documentId - Document ID
   * @returns Whether redo is available
   */
  canRedo(documentId: string): boolean;

  /**
   * Clear undo history for a document.
   *
   * @param documentId - Document ID
   */
  clearUndoHistory(documentId: string): void;

  /**
   * Begin a compound edit (multiple operations as single undo action).
   *
   * @param documentId - Document ID
   */
  beginCompoundEdit(documentId: string): void;

  /**
   * End a compound edit.
   *
   * @param documentId - Document ID
   */
  endCompoundEdit(documentId: string): void;

  // ─────────────────────────────────────────────────────────────────────────
  // Dirty State
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check if document has unsaved changes.
   *
   * @param documentId - Document ID
   * @returns Whether document is dirty
   */
  isDirty(documentId: string): boolean;

  /**
   * Mark document as clean (after save).
   *
   * @param documentId - Document ID
   */
  markClean(documentId: string): void;

  /**
   * Mark document as dirty.
   *
   * @param documentId - Document ID
   */
  markDirty(documentId: string): void;

  // ─────────────────────────────────────────────────────────────────────────
  // Events
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Subscribe to document content changes.
   *
   * @param callback - Called when document content changes
   * @returns Unsubscribe function
   */
  onDidChangeContent(callback: (event: DocumentChangeEvent) => void): Unsubscribe;

  /**
   * Subscribe to cursor changes.
   *
   * @param callback - Called when cursors change
   * @returns Unsubscribe function
   */
  onDidChangeCursors(callback: (event: CursorChangeEvent) => void): Unsubscribe;

  /**
   * Subscribe to document open events.
   *
   * @param callback - Called when a document is opened
   * @returns Unsubscribe function
   */
  onDidOpenDocument(callback: (event: DocumentOpenEvent) => void): Unsubscribe;

  /**
   * Subscribe to document close events.
   *
   * @param callback - Called when a document is closed
   * @returns Unsubscribe function
   */
  onDidCloseDocument(callback: (event: DocumentCloseEvent) => void): Unsubscribe;

  // ─────────────────────────────────────────────────────────────────────────
  // Utility
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Convert a position to an absolute offset.
   *
   * @param documentId - Document ID
   * @param position - Position to convert
   * @returns Offset or null if document not found
   */
  positionToOffset(documentId: string, position: Position): number | null;

  /**
   * Convert an absolute offset to a position.
   *
   * @param documentId - Document ID
   * @param offset - Offset to convert
   * @returns Position or null if document not found
   */
  offsetToPosition(documentId: string, offset: number): Position | null;

  /**
   * Validate a position (clamp to valid range).
   *
   * @param documentId - Document ID
   * @param position - Position to validate
   * @returns Valid position or null if document not found
   */
  validatePosition(documentId: string, position: Position): Position | null;

  /**
   * Get word at position.
   *
   * @param documentId - Document ID
   * @param position - Position to check
   * @returns Word range and text, or null if not on a word
   */
  getWordAtPosition(documentId: string, position: Position): { range: Range; text: string } | null;
}
