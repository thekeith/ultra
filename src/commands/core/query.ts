/**
 * Query Commands
 *
 * Read-only commands primarily for AI agents.
 * These expose editor state without modifying anything.
 */

import type { Command, Range, Diagnostic } from '../types.ts';

// ============================================
// Result Types
// ============================================

export interface FileContentResult {
  content: string;
  language: string;
  lineCount: number;
}

export interface SelectionResult {
  text: string;
  range: Range | null;
  isEmpty: boolean;
}

export interface WorkspaceInfoResult {
  root: string;
  openFileCount: number;
  activeFile: string | null;
}

export interface CommandInfo {
  id: string;
  title: string;
  description?: string;
  category?: string;
  args?: unknown;
}

// ============================================
// Helper: Detect language from file path
// ============================================

function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescriptreact',
    js: 'javascript',
    jsx: 'javascriptreact',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    go: 'go',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    r: 'r',
    lua: 'lua',
    sh: 'shellscript',
    bash: 'shellscript',
    zsh: 'shellscript',
    fish: 'shellscript',
    ps1: 'powershell',
    sql: 'sql',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    md: 'markdown',
    markdown: 'markdown',
    txt: 'plaintext',
    toml: 'toml',
    ini: 'ini',
    cfg: 'ini',
    conf: 'ini',
    vue: 'vue',
    svelte: 'svelte',
  };
  return languageMap[ext] || 'plaintext';
}

// ============================================
// Query Commands
// ============================================

export const queryCommands: Command[] = [
  {
    id: 'ultra.getFileContent',
    title: 'Get File Content',
    category: 'Query',
    aiExposed: true,
    description: 'Read the content of a file',
    args: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to read' },
      },
      required: ['path'],
    },
    returns: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        language: { type: 'string' },
        lineCount: { type: 'number' },
      },
    },
    handler: async (ctx, args: { path: string }) => {
      const content = await ctx.services.fs.readFile(args.path);
      if (content === null) {
        return {
          success: false,
          error: { code: 'FILE_NOT_FOUND', message: `File not found: ${args.path}` },
        };
      }
      return {
        success: true,
        data: {
          content,
          language: detectLanguage(args.path),
          lineCount: content.split('\n').length,
        },
      };
    },
  },

  {
    id: 'ultra.getSelection',
    title: 'Get Selection',
    category: 'Query',
    aiExposed: true,
    description: 'Get the current text selection',
    returns: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        range: { $ref: '#/definitions/Range' },
        isEmpty: { type: 'boolean' },
      },
    },
    handler: async (ctx) => {
      const selection = ctx.editor?.selection;
      const activeBuffer = ctx.editor?.activeBuffer;

      let text = '';
      if (selection && activeBuffer) {
        // Extract selected text from content
        const lines = activeBuffer.content.split('\n');
        const startLine = selection.range.start.line;
        const endLine = selection.range.end.line;
        const startCol = selection.range.start.column;
        const endCol = selection.range.end.column;

        if (startLine === endLine) {
          text = lines[startLine]?.substring(startCol, endCol) || '';
        } else {
          const selectedLines: string[] = [];
          for (let i = startLine; i <= endLine; i++) {
            const line = lines[i] || '';
            if (i === startLine) {
              selectedLines.push(line.substring(startCol));
            } else if (i === endLine) {
              selectedLines.push(line.substring(0, endCol));
            } else {
              selectedLines.push(line);
            }
          }
          text = selectedLines.join('\n');
        }
      }

      return {
        success: true,
        data: {
          text,
          range: selection?.range || null,
          isEmpty: !text,
        },
      };
    },
  },

  {
    id: 'ultra.getDiagnostics',
    title: 'Get Diagnostics',
    category: 'Query',
    aiExposed: true,
    description: 'Get LSP diagnostics for a file',
    args: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path (default: active file)' },
        severity: {
          type: 'string',
          enum: ['error', 'warning', 'info', 'hint'],
          description: 'Filter by severity',
        },
      },
    },
    handler: async (ctx, args?: { path?: string; severity?: string }) => {
      const path = args?.path || ctx.editor?.activeBuffer?.path;
      if (!path) {
        return {
          success: false,
          error: { code: 'NO_FILE', message: 'No file specified and no active file' },
        };
      }

      let diagnostics = await ctx.services.lsp.getDiagnostics(path);

      if (args?.severity) {
        diagnostics = diagnostics.filter((d) => d.severity === args.severity);
      }

      return { success: true, data: diagnostics };
    },
  },

  {
    id: 'ultra.getOpenFiles',
    title: 'Get Open Files',
    category: 'Query',
    aiExposed: true,
    description: 'List all open files',
    handler: async (ctx) => {
      return { success: true, data: ctx.workspace.openFiles };
    },
  },

  {
    id: 'ultra.getWorkspaceInfo',
    title: 'Get Workspace Info',
    category: 'Query',
    aiExposed: true,
    description: 'Get information about the workspace',
    handler: async (ctx) => {
      return {
        success: true,
        data: {
          root: ctx.workspace.root,
          openFileCount: ctx.workspace.openFiles.length,
          activeFile: ctx.editor?.activeBuffer?.path || null,
        },
      };
    },
  },

  {
    id: 'ultra.getCursorPosition',
    title: 'Get Cursor Position',
    category: 'Query',
    aiExposed: true,
    description: 'Get the current cursor position',
    handler: async (ctx) => {
      return {
        success: true,
        data: {
          position: ctx.editor?.cursor || null,
          file: ctx.editor?.activeBuffer?.path || null,
        },
      };
    },
  },

  {
    id: 'ultra.getActiveBuffer',
    title: 'Get Active Buffer',
    category: 'Query',
    aiExposed: true,
    description: 'Get information about the active buffer',
    handler: async (ctx) => {
      const buffer = ctx.editor?.activeBuffer;
      if (!buffer) {
        return {
          success: true,
          data: null,
        };
      }
      return {
        success: true,
        data: {
          path: buffer.path,
          language: buffer.language,
          isDirty: buffer.isDirty,
          lineCount: buffer.content.split('\n').length,
        },
      };
    },
  },

  {
    id: 'ultra.listCommands',
    title: 'List Commands',
    category: 'Query',
    aiExposed: true,
    description: 'List available commands',
    args: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category' },
        aiOnly: { type: 'boolean', description: 'Only show AI-exposed commands' },
      },
    },
    handler: async (ctx, args?: { category?: string; aiOnly?: boolean }) => {
      // This needs access to the registry, which we'll inject later
      // For now, return an indication that it needs to be wired up
      return {
        success: false,
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'listCommands needs to be wired up to the registry',
        },
      };
    },
  },
];

export default queryCommands;
