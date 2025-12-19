/**
 * Context Provider
 *
 * Builds CommandContext from current application state.
 * Provides services and editor state to command handlers.
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  CommandContext,
  CommandSource,
  CommandServices,
  EditorState,
  WorkspaceState,
  GitService,
  GitStatus,
  LSPService,
  UIService,
  FileSystemService,
  Diagnostic,
  CompletionItem,
  Location,
  Position,
  ValidatorRegistry,
} from './types.ts';

/**
 * Interface for the app to implement to provide state to the context provider.
 */
export interface AppStateProvider {
  getActiveDocument(): {
    filePath: string | null;
    content: string;
    language: string;
    isDirty: boolean;
    version?: number;
    getCursorPosition(): { line: number; column: number };
    getSelection(): { start: Position; end: Position } | null;
    getVisibleRange(): { start: Position; end: Position } | null;
  } | null;

  getOpenDocuments(): Array<{
    filePath: string | null;
    isDirty: boolean;
  }>;

  getWorkspaceRoot(): string;
}

/**
 * Builds CommandContext instances from application state.
 */
export class ContextProvider {
  private appState: AppStateProvider | null = null;
  private services: CommandServices | null = null;

  /**
   * Set the app state provider.
   * Called during app initialization.
   */
  setAppStateProvider(provider: AppStateProvider): void {
    this.appState = provider;
  }

  /**
   * Set the command services.
   * Called during app initialization.
   */
  setServices(services: CommandServices): void {
    this.services = services;
  }

  /**
   * Build a CommandContext for the given source.
   */
  async buildContext(
    source: CommandSource,
    validators?: ValidatorRegistry
  ): Promise<CommandContext> {
    if (!this.appState) {
      throw new Error('App state provider not set');
    }
    if (!this.services) {
      throw new Error('Services not set');
    }

    const editor = this.buildEditorState();
    const workspace = this.buildWorkspaceState();

    return {
      source,
      editor,
      workspace,
      services: this.services,
      validators,
      metadata: new Map(),
    };
  }

  private buildEditorState(): EditorState | null {
    if (!this.appState) return null;

    const doc = this.appState.getActiveDocument();
    if (!doc) {
      return {
        activeBuffer: null,
        cursor: null,
        selection: null,
        selections: [],
        visibleRange: null,
      };
    }

    const cursor = doc.getCursorPosition();
    const selection = doc.getSelection();
    const visibleRange = doc.getVisibleRange();

    return {
      activeBuffer: {
        path: doc.filePath,
        content: doc.content,
        language: doc.language,
        isDirty: doc.isDirty,
        version: doc.version || 1,
      },
      cursor: { line: cursor.line, column: cursor.column },
      selection: selection
        ? {
            range: {
              start: selection.start,
              end: selection.end,
            },
            isReversed: false, // TODO: Get actual direction
          }
        : null,
      selections: selection
        ? [
            {
              range: { start: selection.start, end: selection.end },
              isReversed: false,
            },
          ]
        : [],
      visibleRange: visibleRange
        ? { start: visibleRange.start, end: visibleRange.end }
        : null,
    };
  }

  private buildWorkspaceState(): WorkspaceState {
    if (!this.appState) {
      return {
        root: process.cwd(),
        openFiles: [],
      };
    }

    return {
      root: this.appState.getWorkspaceRoot(),
      openFiles: this.appState.getOpenDocuments().map((doc) => ({
        path: doc.filePath,
        isDirty: doc.isDirty,
      })),
    };
  }
}

// ============================================
// Default Service Implementations
// ============================================

/**
 * Creates a GitService that wraps the existing gitIntegration singleton.
 */
export function createGitService(gitIntegration: {
  getStatus: () => Promise<{ staged: string[]; unstaged: string[]; untracked: string[] }>;
  getCurrentBranch: () => Promise<string | null>;
  stageFile: (path: string) => Promise<void>;
  unstageFile: (path: string) => Promise<void>;
  commit: (message: string) => Promise<void>;
  getDiff: (path?: string) => Promise<string>;
}): GitService {
  return {
    async getStatus(): Promise<GitStatus> {
      const status = await gitIntegration.getStatus();
      const branch = await gitIntegration.getCurrentBranch();
      return {
        branch,
        staged: status.staged,
        unstaged: status.unstaged,
        untracked: status.untracked,
      };
    },

    async stage(filePath?: string): Promise<void> {
      if (filePath) {
        await gitIntegration.stageFile(filePath);
      }
    },

    async unstage(filePath?: string): Promise<void> {
      if (filePath) {
        await gitIntegration.unstageFile(filePath);
      }
    },

    async commit(message: string): Promise<void> {
      await gitIntegration.commit(message);
    },

    async getBranch(): Promise<string | null> {
      return gitIntegration.getCurrentBranch();
    },

    async getDiff(filePath?: string): Promise<string> {
      return gitIntegration.getDiff(filePath);
    },
  };
}

/**
 * Creates an LSPService that wraps the existing lspManager.
 */
export function createLSPService(lspManager: {
  getDiagnostics: (uri: string) => Diagnostic[];
  getHover: (uri: string, position: Position) => Promise<string | null>;
  getCompletions: (uri: string, position: Position) => Promise<CompletionItem[]>;
  getDefinition: (uri: string, position: Position) => Promise<Location | null>;
  getReferences: (uri: string, position: Position) => Promise<Location[]>;
}): LSPService {
  return {
    async getDiagnostics(filePath?: string): Promise<Diagnostic[]> {
      if (!filePath) return [];
      const uri = `file://${filePath}`;
      return lspManager.getDiagnostics(uri);
    },

    async getHover(filePath: string, position: Position): Promise<string | null> {
      const uri = `file://${filePath}`;
      return lspManager.getHover(uri, position);
    },

    async getCompletions(filePath: string, position: Position): Promise<CompletionItem[]> {
      const uri = `file://${filePath}`;
      return lspManager.getCompletions(uri, position);
    },

    async getDefinition(filePath: string, position: Position): Promise<Location | null> {
      const uri = `file://${filePath}`;
      return lspManager.getDefinition(uri, position);
    },

    async getReferences(filePath: string, position: Position): Promise<Location[]> {
      const uri = `file://${filePath}`;
      return lspManager.getReferences(uri, position);
    },
  };
}

/**
 * Creates a UIService that wraps UI components.
 */
export function createUIService(ui: {
  showMessage: (message: string, timeout?: number) => void;
  showProgress: (options: { message: string; step?: number; totalSteps?: number }) => void;
  showConfirm: (message: string) => Promise<boolean>;
  showInput: (options: { title: string; placeholder?: string; value?: string }) => Promise<string | null>;
  scheduleRender: () => void;
}): UIService {
  return {
    showMessage: ui.showMessage,
    showProgress: ui.showProgress,
    showConfirm: ui.showConfirm,
    showInput: ui.showInput,
    scheduleRender: ui.scheduleRender,
  };
}

/**
 * Creates a FileSystemService using Node.js fs.
 */
export function createFileSystemService(workspaceRoot: string): FileSystemService {
  return {
    async readFile(filePath: string): Promise<string | null> {
      try {
        const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
        return await fs.promises.readFile(fullPath, 'utf-8');
      } catch {
        return null;
      }
    },

    async writeFile(filePath: string, content: string): Promise<void> {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
      const dir = path.dirname(fullPath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(fullPath, content, 'utf-8');
    },

    async exists(filePath: string): Promise<boolean> {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
      try {
        await fs.promises.access(fullPath);
        return true;
      } catch {
        return false;
      }
    },

    async delete(filePath: string): Promise<void> {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
      await fs.promises.unlink(fullPath);
    },

    async rename(oldPath: string, newPath: string): Promise<void> {
      const fullOldPath = path.isAbsolute(oldPath) ? oldPath : path.join(workspaceRoot, oldPath);
      const fullNewPath = path.isAbsolute(newPath) ? newPath : path.join(workspaceRoot, newPath);
      await fs.promises.rename(fullOldPath, fullNewPath);
    },

    async glob(pattern: string): Promise<string[]> {
      const globber = new Bun.Glob(pattern);
      const results: string[] = [];
      for await (const file of globber.scan({ cwd: workspaceRoot })) {
        results.push(file);
      }
      return results;
    },

    async stat(filePath: string): Promise<{ isFile: boolean; isDirectory: boolean; size: number } | null> {
      try {
        const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
        const stats = await fs.promises.stat(fullPath);
        return {
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
          size: stats.size,
        };
      } catch {
        return null;
      }
    },
  };
}

// Singleton instance
export const contextProvider = new ContextProvider();
export default contextProvider;
