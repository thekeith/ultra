/**
 * Core Commands - Index
 *
 * Exports all core command modules.
 */

export { fileCommands, setFileCommandHandlers } from './file.ts';
export type { FileCommandHandlers, OpenFileArgs, CreateFileArgs, DeleteFileArgs, RenameFileArgs, CloseFileArgs } from './file.ts';

export { editCommands, setEditCommandHandlers } from './edit.ts';
export type { EditCommandHandlers, EditArgs, InsertTextArgs, ReplaceTextArgs } from './edit.ts';

export { queryCommands } from './query.ts';
export type { FileContentResult, SelectionResult, WorkspaceInfoResult, CommandInfo } from './query.ts';

import { fileCommands } from './file.ts';
import { editCommands } from './edit.ts';
import { queryCommands } from './query.ts';
import type { Command } from '../types.ts';

/**
 * All core commands combined.
 */
export const allCoreCommands: Command[] = [
  ...fileCommands,
  ...editCommands,
  ...queryCommands,
];

export default allCoreCommands;
