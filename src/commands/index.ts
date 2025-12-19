/**
 * Command Protocol - Main Entry Point
 *
 * The Command Protocol is a unified API that exposes all editor functionality
 * through a single interface. Every action in Ultra - whether triggered by
 * keyboard shortcut, command palette, CLI, or external agent - flows through
 * this protocol.
 *
 * Usage:
 *
 * 1. During app initialization:
 *    import { initializeCommandProtocol } from './commands/index.ts';
 *    const { executor, registry, ipcServer } = await initializeCommandProtocol({
 *      workspaceRoot: '/path/to/workspace',
 *      appStateProvider: appStateProviderInstance,
 *      services: { git, lsp, ui, fs },
 *      enableIPC: true,
 *    });
 *
 * 2. Executing commands:
 *    await executor.executeFromHuman('ultra.save');
 *    await executor.execute('ultra.openFile', { path: 'foo.ts' }, { type: 'ai', agentId: 'claude' });
 *
 * 3. Registering custom commands:
 *    registry.register({
 *      id: 'myExtension.doThing',
 *      title: 'Do Thing',
 *      handler: async (ctx, args) => { ... },
 *    });
 */

import { CommandRegistry, commandRegistry } from './registry.ts';
import { CommandExecutor } from './executor.ts';
import {
  ContextProvider,
  contextProvider,
  createGitService,
  createLSPService,
  createUIService,
  createFileSystemService,
  type AppStateProvider,
} from './context-provider.ts';
import { ValidatorRegistry } from './validator-registry.ts';
import { IPCServer } from './ipc/server.ts';
import { allCoreCommands, setFileCommandHandlers, setEditCommandHandlers } from './core/index.ts';
import type { CommandServices, FileSystemService } from './types.ts';

// ============================================
// Re-exports
// ============================================

// Types
export * from './types.ts';

// Registry
export { CommandRegistry, commandRegistry } from './registry.ts';

// Executor
export { CommandExecutor } from './executor.ts';

// Context Provider
export {
  ContextProvider,
  contextProvider,
  createGitService,
  createLSPService,
  createUIService,
  createFileSystemService,
} from './context-provider.ts';
export type { AppStateProvider } from './context-provider.ts';

// Validators
export * from './validator-interface.ts';
export { ValidatorRegistry } from './validator-registry.ts';

// Core Commands
export * from './core/index.ts';

// IPC
export { IPCServer } from './ipc/server.ts';
export { IPCClient, UltraClient } from './ipc/client.ts';

// ============================================
// Initialization
// ============================================

export interface CommandProtocolOptions {
  /** Workspace root directory */
  workspaceRoot: string;

  /** App state provider for building context */
  appStateProvider: AppStateProvider;

  /** Pre-built services, or components to build them from */
  services?: Partial<CommandServices>;

  /** Git integration instance (if services.git not provided) */
  gitIntegration?: Parameters<typeof createGitService>[0];

  /** LSP manager instance (if services.lsp not provided) */
  lspManager?: Parameters<typeof createLSPService>[0];

  /** UI service or components (if services.ui not provided) */
  uiService?: Parameters<typeof createUIService>[0];

  /** Enable IPC server for external access */
  enableIPC?: boolean;

  /** Custom IPC socket path */
  ipcSocketPath?: string;
}

export interface CommandProtocolInstance {
  /** Command registry */
  registry: CommandRegistry;

  /** Command executor */
  executor: CommandExecutor;

  /** Context provider */
  contextProvider: ContextProvider;

  /** Validator registry (if any validators registered) */
  validatorRegistry: ValidatorRegistry | null;

  /** IPC server (if enabled) */
  ipcServer: IPCServer | null;

  /** Shutdown function */
  shutdown: () => void;
}

/**
 * Initialize the command protocol.
 * Call this during app startup.
 */
export async function initializeCommandProtocol(
  options: CommandProtocolOptions
): Promise<CommandProtocolInstance> {
  const { workspaceRoot, appStateProvider, enableIPC = false, ipcSocketPath } = options;

  // Build file system service
  const fsService: FileSystemService = options.services?.fs || createFileSystemService(workspaceRoot);

  // Build services
  const services: CommandServices = {
    git: options.services?.git || (options.gitIntegration ? createGitService(options.gitIntegration) : createNoopGitService()),
    lsp: options.services?.lsp || (options.lspManager ? createLSPService(options.lspManager) : createNoopLSPService()),
    ui: options.services?.ui || (options.uiService ? createUIService(options.uiService) : createNoopUIService()),
    fs: fsService,
  };

  // Configure context provider
  contextProvider.setAppStateProvider(appStateProvider);
  contextProvider.setServices(services);

  // Create validator registry (no validators by default)
  const validatorRegistry = new ValidatorRegistry(workspaceRoot, fsService);

  // Create executor
  const executor = new CommandExecutor(commandRegistry, validatorRegistry, contextProvider);

  // Register core commands
  commandRegistry.registerAll(allCoreCommands);

  // Create IPC server if enabled
  let ipcServer: IPCServer | null = null;
  if (enableIPC) {
    ipcServer = new IPCServer(executor, commandRegistry, ipcSocketPath);
    ipcServer.start();
  }

  // Shutdown function
  const shutdown = () => {
    ipcServer?.stop();
    commandRegistry.clear();
  };

  return {
    registry: commandRegistry,
    executor,
    contextProvider,
    validatorRegistry,
    ipcServer,
    shutdown,
  };
}

// ============================================
// No-op Service Implementations
// ============================================

function createNoopGitService(): CommandServices['git'] {
  return {
    async getStatus() {
      return { branch: null, staged: [], unstaged: [], untracked: [] };
    },
    async stage() {},
    async unstage() {},
    async commit() {},
    async getBranch() {
      return null;
    },
    async getDiff() {
      return '';
    },
  };
}

function createNoopLSPService(): CommandServices['lsp'] {
  return {
    async getDiagnostics() {
      return [];
    },
    async getHover() {
      return null;
    },
    async getCompletions() {
      return [];
    },
    async getDefinition() {
      return null;
    },
    async getReferences() {
      return [];
    },
  };
}

function createNoopUIService(): CommandServices['ui'] {
  return {
    showMessage() {},
    showProgress() {},
    async showConfirm() {
      return false;
    },
    async showInput() {
      return null;
    },
    scheduleRender() {},
  };
}

// ============================================
// Convenience: Global executor for simple cases
// ============================================

let globalExecutor: CommandExecutor | null = null;

/**
 * Get the global executor instance.
 * Must call initializeCommandProtocol first.
 */
export function getExecutor(): CommandExecutor {
  if (!globalExecutor) {
    throw new Error('Command protocol not initialized. Call initializeCommandProtocol first.');
  }
  return globalExecutor;
}

/**
 * Set the global executor instance.
 * Called by initializeCommandProtocol.
 */
export function setGlobalExecutor(executor: CommandExecutor): void {
  globalExecutor = executor;
}
