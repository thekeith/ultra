/**
 * Undo/Redo System
 * 
 * Operation-based undo system that tracks individual edit operations
 * rather than full document snapshots.
 */

import type { Position } from './buffer.ts';
import type { Cursor } from './cursor.ts';

export interface EditOperation {
  type: 'insert' | 'delete';
  position: Position;
  text: string;
}

export interface UndoAction {
  operations: EditOperation[];
  cursorsBefore: Cursor[];
  cursorsAfter: Cursor[];
  timestamp?: number;
}

export class UndoManager {
  private undoStack: UndoAction[] = [];
  private redoStack: UndoAction[] = [];
  private maxStackSize: number = 1000;
  private groupTimeout: number = 300; // ms to group operations
  private lastActionTime: number = 0;

  /**
   * Push a new action onto the undo stack
   */
  push(action: UndoAction): void {
    const now = Date.now();
    action.timestamp = now;

    // Try to merge with previous action if recent and same type
    if (this.undoStack.length > 0 && now - this.lastActionTime < this.groupTimeout) {
      const lastAction = this.undoStack[this.undoStack.length - 1]!;
      
      if (this.canMerge(lastAction, action)) {
        this.mergeActions(lastAction, action);
        this.lastActionTime = now;
        return;
      }
    }

    this.undoStack.push(action);
    this.lastActionTime = now;

    // Clear redo stack on new action
    this.redoStack = [];

    // Trim stack if too large
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }
  }

  /**
   * Undo the last action
   */
  undo(): UndoAction | null {
    const action = this.undoStack.pop();
    if (!action) return null;

    this.redoStack.push(action);
    return action;
  }

  /**
   * Redo the last undone action
   */
  redo(): UndoAction | null {
    const action = this.redoStack.pop();
    if (!action) return null;

    this.undoStack.push(action);
    return action;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * Start a new undo group (prevents merging with previous)
   */
  breakUndoGroup(): void {
    this.lastActionTime = 0;
  }

  /**
   * Check if two actions can be merged
   */
  private canMerge(existing: UndoAction, incoming: UndoAction): boolean {
    // Only merge single-operation actions
    if (existing.operations.length !== 1 || incoming.operations.length !== 1) {
      return false;
    }

    const existingOp = existing.operations[0]!;
    const incomingOp = incoming.operations[0]!;

    // Only merge same type operations
    if (existingOp.type !== incomingOp.type) {
      return false;
    }

    // Don't merge operations with newlines
    if (existingOp.text.includes('\n') || incomingOp.text.includes('\n')) {
      return false;
    }

    if (existingOp.type === 'insert') {
      // Merge consecutive inserts
      const existingEnd = existingOp.position.column + existingOp.text.length;
      return (
        existingOp.position.line === incomingOp.position.line &&
        existingEnd === incomingOp.position.column
      );
    } else {
      // Merge consecutive deletes (backspace)
      return (
        existingOp.position.line === incomingOp.position.line &&
        (existingOp.position.column === incomingOp.position.column + incomingOp.text.length ||
         existingOp.position.column === incomingOp.position.column)
      );
    }
  }

  /**
   * Merge incoming action into existing action
   */
  private mergeActions(existing: UndoAction, incoming: UndoAction): void {
    const existingOp = existing.operations[0]!;
    const incomingOp = incoming.operations[0]!;

    if (existingOp.type === 'insert') {
      // Append text for inserts
      existingOp.text += incomingOp.text;
    } else {
      // For deletes, prepend text and update position
      if (incomingOp.position.column < existingOp.position.column) {
        existingOp.text = incomingOp.text + existingOp.text;
        existingOp.position = { ...incomingOp.position };
      } else {
        existingOp.text += incomingOp.text;
      }
    }

    // Update cursor state
    existing.cursorsAfter = incoming.cursorsAfter;
    existing.timestamp = incoming.timestamp;
  }

  /**
   * Get undo stack size
   */
  get undoCount(): number {
    return this.undoStack.length;
  }

  /**
   * Get redo stack size
   */
  get redoCount(): number {
    return this.redoStack.length;
  }
}

export default UndoManager;
