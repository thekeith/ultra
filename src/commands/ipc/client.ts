/**
 * IPC Client
 *
 * Client for communicating with Ultra's IPC server.
 * Used by CLI tools and external AI agents.
 */

import type { CommandResult, Position, Range } from '../types.ts';

const DEFAULT_SOCKET_PATH = '/tmp/ultra.sock';

// ============================================
// IPC Message Types
// ============================================

interface IPCRequest {
  id: string;
  type: 'execute' | 'batch' | 'query' | 'subscribe';
  command?: string;
  args?: unknown;
  commands?: Array<{ command: string; args?: unknown }>;
  events?: string[];
  agentId?: string;
  sessionId?: string;
}

interface IPCResponse {
  id: string;
  success: boolean;
  result?: CommandResult | CommandResult[];
  error?: { code: string; message: string };
}

interface IPCEvent {
  type: 'event';
  event: string;
  data: unknown;
}

// ============================================
// IPC Client
// ============================================

export class IPCClient {
  private socket: ReturnType<typeof Bun.connect> | null = null;
  private socketPath: string;
  private requestId = 0;
  private pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: unknown) => void }>();
  private buffer = '';
  private eventHandlers = new Map<string, Set<(data: unknown) => void>>();

  constructor(socketPath?: string) {
    this.socketPath = socketPath || process.env.ULTRA_SOCKET || DEFAULT_SOCKET_PATH;
  }

  /**
   * Connect to the IPC server.
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = Bun.connect({
        unix: this.socketPath,
        socket: {
          open: () => {
            resolve();
          },

          data: (_socket, data) => {
            this.buffer += new TextDecoder().decode(data);
            this.processBuffer();
          },

          error: (_socket, error) => {
            reject(error);
          },

          close: () => {
            // Reject all pending requests
            for (const { reject } of this.pending.values()) {
              reject(new Error('Connection closed'));
            }
            this.pending.clear();
          },
        },
      });
    });
  }

  /**
   * Process incoming data buffer.
   */
  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line);

        // Check if it's an event
        if (message.type === 'event') {
          const event = message as IPCEvent;
          const handlers = this.eventHandlers.get(event.event);
          if (handlers) {
            for (const handler of handlers) {
              try {
                handler(event.data);
              } catch {
                // Ignore handler errors
              }
            }
          }
          continue;
        }

        // Otherwise it's a response
        const response = message as IPCResponse;
        const pending = this.pending.get(response.id);
        if (pending) {
          this.pending.delete(response.id);
          if (response.success) {
            pending.resolve(response.result);
          } else {
            pending.reject(response.error);
          }
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  /**
   * Send a request and wait for response.
   */
  private send(request: IPCRequest): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }

      this.pending.set(request.id, { resolve, reject });
      this.socket.write(JSON.stringify(request) + '\n');
    });
  }

  /**
   * Execute a single command.
   */
  async execute(
    command: string,
    args?: unknown,
    options?: { agentId?: string; sessionId?: string }
  ): Promise<CommandResult> {
    const id = String(++this.requestId);
    const result = await this.send({
      id,
      type: 'execute',
      command,
      args,
      agentId: options?.agentId,
      sessionId: options?.sessionId,
    });
    return result as CommandResult;
  }

  /**
   * Execute multiple commands in sequence.
   */
  async batch(
    commands: Array<{ command: string; args?: unknown }>,
    options?: { agentId?: string; sessionId?: string }
  ): Promise<CommandResult[]> {
    const id = String(++this.requestId);
    const result = await this.send({
      id,
      type: 'batch',
      commands,
      agentId: options?.agentId,
      sessionId: options?.sessionId,
    });
    return result as CommandResult[];
  }

  /**
   * Query available commands.
   */
  async queryCommands(): Promise<Array<{ id: string; title: string; description?: string; category?: string }>> {
    const id = String(++this.requestId);
    const result = (await this.send({ id, type: 'query' })) as CommandResult;
    return result.data as Array<{ id: string; title: string; description?: string; category?: string }>;
  }

  /**
   * Subscribe to events.
   */
  async subscribe(events: string[]): Promise<void> {
    const id = String(++this.requestId);
    await this.send({ id, type: 'subscribe', events });
  }

  /**
   * Add an event handler.
   */
  on(event: string, handler: (data: unknown) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * Close the connection.
   */
  async close(): Promise<void> {
    this.socket?.end();
    this.socket = null;
  }

  /**
   * Check if connected.
   */
  isConnected(): boolean {
    return this.socket !== null;
  }
}

// ============================================
// UltraClient - Convenience Wrapper
// ============================================

/**
 * High-level client for AI agents with typed methods.
 */
export class UltraClient extends IPCClient {
  private agentId?: string;
  private sessionId?: string;

  constructor(options?: { socketPath?: string; agentId?: string; sessionId?: string }) {
    super(options?.socketPath);
    this.agentId = options?.agentId;
    this.sessionId = options?.sessionId;
  }

  private opts() {
    return { agentId: this.agentId, sessionId: this.sessionId };
  }

  // ========== File Operations ==========

  async openFile(path: string, options?: { line?: number; column?: number }) {
    return this.execute('ultra.openFile', { path, ...options }, this.opts());
  }

  async save() {
    return this.execute('ultra.save', undefined, this.opts());
  }

  async saveAll() {
    return this.execute('ultra.saveAll', undefined, this.opts());
  }

  async createFile(path: string, content?: string) {
    return this.execute('ultra.createFile', { path, content }, this.opts());
  }

  async deleteFile(path: string, options?: { confirm?: boolean }) {
    return this.execute('ultra.deleteFile', { path, ...options }, this.opts());
  }

  async renameFile(path: string, newPath: string) {
    return this.execute('ultra.renameFile', { path, newPath }, this.opts());
  }

  async closeFile(options?: { path?: string; force?: boolean }) {
    return this.execute('ultra.closeFile', options, this.opts());
  }

  // ========== Editing ==========

  async edit(range: Range, text: string) {
    return this.execute('ultra.edit', { range, text }, this.opts());
  }

  async insertText(text: string, position?: Position) {
    return this.execute('ultra.insertText', { text, position }, this.opts());
  }

  async replaceText(search: string, replace: string, options?: { all?: boolean; regex?: boolean }) {
    return this.execute('ultra.replaceText', { search, replace, ...options }, this.opts());
  }

  async undo() {
    return this.execute('ultra.undo', undefined, this.opts());
  }

  async redo() {
    return this.execute('ultra.redo', undefined, this.opts());
  }

  // ========== Queries ==========

  async getFileContent(path: string) {
    return this.execute('ultra.getFileContent', { path }, this.opts());
  }

  async getSelection() {
    return this.execute('ultra.getSelection', undefined, this.opts());
  }

  async getDiagnostics(path?: string, severity?: 'error' | 'warning' | 'info' | 'hint') {
    return this.execute('ultra.getDiagnostics', { path, severity }, this.opts());
  }

  async getOpenFiles() {
    return this.execute('ultra.getOpenFiles', undefined, this.opts());
  }

  async getWorkspaceInfo() {
    return this.execute('ultra.getWorkspaceInfo', undefined, this.opts());
  }

  async getCursorPosition() {
    return this.execute('ultra.getCursorPosition', undefined, this.opts());
  }

  async getActiveBuffer() {
    return this.execute('ultra.getActiveBuffer', undefined, this.opts());
  }

  // ========== AI-specific ==========

  async getContext(paths: string[]) {
    return this.execute('ultra.ai.getContext', { paths }, this.opts());
  }

  async reportProgress(message: string, options?: { step?: number; totalSteps?: number }) {
    return this.execute('ultra.ai.reportProgress', { message, ...options }, this.opts());
  }

  // ========== Git ==========

  async gitStatus() {
    return this.execute('ultra.git.status', undefined, this.opts());
  }

  async gitStage(path?: string) {
    return this.execute('ultra.git.stage', { path }, this.opts());
  }

  async gitUnstage(path?: string) {
    return this.execute('ultra.git.unstage', { path }, this.opts());
  }

  async gitCommit(message: string) {
    return this.execute('ultra.git.commit', { message }, this.opts());
  }

  async gitDiff(path?: string) {
    return this.execute('ultra.git.diff', { path }, this.opts());
  }
}

export default IPCClient;
