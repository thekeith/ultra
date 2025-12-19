/**
 * Edit Commands
 *
 * Commands for text editing: edit, insert, replace, undo, redo.
 */

import type { Command, CommandResult, Range, Position } from '../types.ts';

// ============================================
// Argument Types
// ============================================

export interface EditArgs {
  range: Range;
  text: string;
}

export interface InsertTextArgs {
  text: string;
  position?: Position;
}

export interface ReplaceTextArgs {
  search: string;
  replace: string;
  all?: boolean;
  regex?: boolean;
}

export interface ReplaceTextResult {
  count: number;
}

// ============================================
// Command Implementations
// ============================================

/**
 * The app can set this to provide actual implementations.
 */
export interface EditCommandHandlers {
  edit: (args: EditArgs) => Promise<CommandResult<void>>;
  insertText: (args: InsertTextArgs) => Promise<CommandResult<void>>;
  replaceText: (args: ReplaceTextArgs) => Promise<CommandResult<ReplaceTextResult>>;
  undo: () => Promise<CommandResult<void>>;
  redo: () => Promise<CommandResult<void>>;
  cut: () => Promise<CommandResult<{ text: string }>>;
  copy: () => Promise<CommandResult<{ text: string }>>;
  paste: () => Promise<CommandResult<void>>;
  selectAll: () => Promise<CommandResult<void>>;
}

let handlers: EditCommandHandlers | null = null;

/**
 * Set the edit command handlers.
 * Called by the app during initialization.
 */
export function setEditCommandHandlers(h: EditCommandHandlers): void {
  handlers = h;
}

// ============================================
// Edit Commands
// ============================================

export const editCommands: Command[] = [
  {
    id: 'ultra.edit',
    title: 'Edit',
    category: 'Edit',
    description: 'Replace text in a range',
    args: {
      type: 'object',
      properties: {
        range: {
          type: 'object',
          properties: {
            start: {
              type: 'object',
              properties: { line: { type: 'number' }, column: { type: 'number' } },
            },
            end: {
              type: 'object',
              properties: { line: { type: 'number' }, column: { type: 'number' } },
            },
          },
        },
        text: { type: 'string', description: 'Replacement text' },
      },
      required: ['range', 'text'],
    },
    handler: async (ctx, args: EditArgs) => {
      if (!handlers) {
        return {
          success: false,
          error: { code: 'NOT_INITIALIZED', message: 'Edit handlers not initialized' },
        };
      }
      return handlers.edit(args);
    },
  },

  {
    id: 'ultra.insertText',
    title: 'Insert Text',
    category: 'Edit',
    description: 'Insert text at cursor or specified position',
    args: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to insert' },
        position: {
          type: 'object',
          properties: { line: { type: 'number' }, column: { type: 'number' } },
          description: 'Position to insert at (default: cursor)',
        },
      },
      required: ['text'],
    },
    handler: async (ctx, args: InsertTextArgs) => {
      if (!handlers) {
        return {
          success: false,
          error: { code: 'NOT_INITIALIZED', message: 'Edit handlers not initialized' },
        };
      }
      return handlers.insertText(args);
    },
  },

  {
    id: 'ultra.replaceText',
    title: 'Replace Text',
    category: 'Edit',
    description: 'Find and replace text',
    args: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Text to find' },
        replace: { type: 'string', description: 'Replacement text' },
        all: { type: 'boolean', description: 'Replace all occurrences' },
        regex: { type: 'boolean', description: 'Treat search as regex' },
      },
      required: ['search', 'replace'],
    },
    handler: async (ctx, args: ReplaceTextArgs) => {
      if (!handlers) {
        return {
          success: false,
          error: { code: 'NOT_INITIALIZED', message: 'Edit handlers not initialized' },
        };
      }
      return handlers.replaceText(args);
    },
  },

  {
    id: 'ultra.undo',
    title: 'Undo',
    category: 'Edit',
    keybinding: 'ctrl+z',
    handler: async (ctx) => {
      if (!handlers) {
        return {
          success: false,
          error: { code: 'NOT_INITIALIZED', message: 'Edit handlers not initialized' },
        };
      }
      return handlers.undo();
    },
  },

  {
    id: 'ultra.redo',
    title: 'Redo',
    category: 'Edit',
    keybinding: 'ctrl+y',
    handler: async (ctx) => {
      if (!handlers) {
        return {
          success: false,
          error: { code: 'NOT_INITIALIZED', message: 'Edit handlers not initialized' },
        };
      }
      return handlers.redo();
    },
  },

  {
    id: 'ultra.cut',
    title: 'Cut',
    category: 'Edit',
    keybinding: 'ctrl+x',
    handler: async (ctx) => {
      if (!handlers) {
        return {
          success: false,
          error: { code: 'NOT_INITIALIZED', message: 'Edit handlers not initialized' },
        };
      }
      return handlers.cut();
    },
  },

  {
    id: 'ultra.copy',
    title: 'Copy',
    category: 'Edit',
    keybinding: 'ctrl+c',
    handler: async (ctx) => {
      if (!handlers) {
        return {
          success: false,
          error: { code: 'NOT_INITIALIZED', message: 'Edit handlers not initialized' },
        };
      }
      return handlers.copy();
    },
  },

  {
    id: 'ultra.paste',
    title: 'Paste',
    category: 'Edit',
    keybinding: 'ctrl+v',
    handler: async (ctx) => {
      if (!handlers) {
        return {
          success: false,
          error: { code: 'NOT_INITIALIZED', message: 'Edit handlers not initialized' },
        };
      }
      return handlers.paste();
    },
  },

  {
    id: 'ultra.selectAll',
    title: 'Select All',
    category: 'Edit',
    keybinding: 'ctrl+a',
    handler: async (ctx) => {
      if (!handlers) {
        return {
          success: false,
          error: { code: 'NOT_INITIALIZED', message: 'Edit handlers not initialized' },
        };
      }
      return handlers.selectAll();
    },
  },
];

export default editCommands;
