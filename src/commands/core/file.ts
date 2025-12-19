/**
 * File Commands
 *
 * Commands for file operations: open, save, create, delete, rename, close.
 */

import type { Command, CommandResult } from '../types.ts';

// ============================================
// Argument Types
// ============================================

export interface OpenFileArgs {
  path: string;
  line?: number;
  column?: number;
  preview?: boolean;
}

export interface OpenFileResult {
  bufferId: string;
  path: string;
}

export interface CreateFileArgs {
  path: string;
  content?: string;
}

export interface DeleteFileArgs {
  path: string;
  confirm?: boolean;
}

export interface RenameFileArgs {
  path: string;
  newPath: string;
}

export interface CloseFileArgs {
  path?: string;
  force?: boolean;
}

export interface SaveResult {
  path: string;
  bytesWritten: number;
}

export interface SaveAllResult {
  saved: string[];
}

// ============================================
// Command Implementations
// ============================================

/**
 * The app can set this to provide actual implementations.
 * This allows the commands to work with the existing App class.
 */
export interface FileCommandHandlers {
  openFile: (args: OpenFileArgs) => Promise<CommandResult<OpenFileResult>>;
  save: () => Promise<CommandResult<SaveResult>>;
  saveAll: () => Promise<CommandResult<SaveAllResult>>;
  createFile: (args: CreateFileArgs) => Promise<CommandResult<void>>;
  deleteFile: (args: DeleteFileArgs) => Promise<CommandResult<void>>;
  renameFile: (args: RenameFileArgs) => Promise<CommandResult<void>>;
  closeFile: (args?: CloseFileArgs) => Promise<CommandResult<void>>;
}

let handlers: FileCommandHandlers | null = null;

/**
 * Set the file command handlers.
 * Called by the app during initialization.
 */
export function setFileCommandHandlers(h: FileCommandHandlers): void {
  handlers = h;
}

// ============================================
// File Commands
// ============================================

export const fileCommands: Command[] = [
  {
    id: 'ultra.openFile',
    title: 'Open File',
    category: 'File',
    args: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to open' },
        line: { type: 'number', description: 'Line to go to (1-indexed)' },
        column: { type: 'number', description: 'Column to go to (1-indexed)' },
        preview: { type: 'boolean', description: 'Open in preview mode' },
      },
      required: ['path'],
    },
    returns: {
      type: 'object',
      properties: {
        bufferId: { type: 'string' },
        path: { type: 'string' },
      },
    },
    handler: async (ctx, args: OpenFileArgs) => {
      if (!handlers) {
        return {
          success: false,
          error: { code: 'NOT_INITIALIZED', message: 'File handlers not initialized' },
        };
      }
      return handlers.openFile(args);
    },
  },

  {
    id: 'ultra.save',
    title: 'Save',
    category: 'File',
    keybinding: 'ctrl+s',
    handler: async (ctx) => {
      if (!handlers) {
        return {
          success: false,
          error: { code: 'NOT_INITIALIZED', message: 'File handlers not initialized' },
        };
      }
      return handlers.save();
    },
  },

  {
    id: 'ultra.saveAll',
    title: 'Save All',
    category: 'File',
    handler: async (ctx) => {
      if (!handlers) {
        return {
          success: false,
          error: { code: 'NOT_INITIALIZED', message: 'File handlers not initialized' },
        };
      }
      return handlers.saveAll();
    },
  },

  {
    id: 'ultra.createFile',
    title: 'Create File',
    category: 'File',
    args: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path for new file' },
        content: { type: 'string', description: 'Initial content' },
      },
      required: ['path'],
    },
    handler: async (ctx, args: CreateFileArgs) => {
      if (!handlers) {
        return {
          success: false,
          error: { code: 'NOT_INITIALIZED', message: 'File handlers not initialized' },
        };
      }
      return handlers.createFile(args);
    },
  },

  {
    id: 'ultra.deleteFile',
    title: 'Delete File',
    category: 'File',
    args: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to delete' },
        confirm: { type: 'boolean', description: 'Skip confirmation' },
      },
      required: ['path'],
    },
    handler: async (ctx, args: DeleteFileArgs) => {
      if (!handlers) {
        return {
          success: false,
          error: { code: 'NOT_INITIALIZED', message: 'File handlers not initialized' },
        };
      }
      return handlers.deleteFile(args);
    },
  },

  {
    id: 'ultra.renameFile',
    title: 'Rename File',
    category: 'File',
    args: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Current file path' },
        newPath: { type: 'string', description: 'New file path' },
      },
      required: ['path', 'newPath'],
    },
    handler: async (ctx, args: RenameFileArgs) => {
      if (!handlers) {
        return {
          success: false,
          error: { code: 'NOT_INITIALIZED', message: 'File handlers not initialized' },
        };
      }
      return handlers.renameFile(args);
    },
  },

  {
    id: 'ultra.closeFile',
    title: 'Close File',
    category: 'File',
    keybinding: 'ctrl+w',
    args: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Specific file to close (default: active)' },
        force: { type: 'boolean', description: 'Close without saving' },
      },
    },
    handler: async (ctx, args?: CloseFileArgs) => {
      if (!handlers) {
        return {
          success: false,
          error: { code: 'NOT_INITIALIZED', message: 'File handlers not initialized' },
        };
      }
      return handlers.closeFile(args);
    },
  },
];

export default fileCommands;
