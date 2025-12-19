/**
 * IPC Server
 *
 * Unix socket server for external command execution.
 * Allows CLI tools and AI agents to communicate with Ultra.
 */

import { unlinkSync } from 'fs';
import { debugLog } from '../../debug.ts';
import type { CommandExecutor } from '../executor.ts';
import type { CommandRegistry } from '../registry.ts';
import type { CommandSource, CommandResult } from '../types.ts';

const DEFAULT_SOCKET_PATH = '/tmp/ultra.sock';

// ============================================
// IPC Message Types
// ============================================

interface IPCRequest {
  id: string;
  type: 'execute' | 'batch' | 'query' | 'subscribe';

  // For execute
  command?: string;
  args?: unknown;

  // For batch
  commands?: Array<{ command: string; args?: unknown }>;

  // For subscribe
  events?: string[];

  // Agent identification
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
// Socket Type (Bun-compatible)
// ============================================

interface Socket {
  write(data: string | Uint8Array): number;
  end(): void;
  data: { buffer: string };
}

// ============================================
// IPC Server
// ============================================

export class IPCServer {
  private server: ReturnType<typeof Bun.listen> | null = null;
  private socketPath: string;
  private subscribers = new Map<string, Set<Socket>>();
  private connections = new Set<Socket>();

  constructor(
    private executor: CommandExecutor,
    private registry: CommandRegistry,
    socketPath?: string
  ) {
    this.socketPath = socketPath || process.env.ULTRA_SOCKET || DEFAULT_SOCKET_PATH;
  }

  /**
   * Start the IPC server.
   */
  start(): void {
    // Clean up stale socket
    try {
      unlinkSync(this.socketPath);
    } catch {
      // Socket doesn't exist, that's fine
    }

    this.server = Bun.listen({
      unix: this.socketPath,
      socket: {
        open: (socket: Socket) => {
          debugLog(`[IPCServer] New connection`);
          socket.data = { buffer: '' };
          this.connections.add(socket);
        },

        data: async (socket: Socket, data: Uint8Array) => {
          // Accumulate data in buffer
          socket.data.buffer += new TextDecoder().decode(data);

          // Process complete messages (newline-delimited)
          const lines = socket.data.buffer.split('\n');
          socket.data.buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const request: IPCRequest = JSON.parse(line);
              const response = await this.handleRequest(request, socket);
              socket.write(JSON.stringify(response) + '\n');
            } catch (error) {
              debugLog(`[IPCServer] Parse error: ${error}`);
              socket.write(
                JSON.stringify({
                  id: 'unknown',
                  success: false,
                  error: { code: 'PARSE_ERROR', message: 'Invalid request JSON' },
                }) + '\n'
              );
            }
          }
        },

        close: (socket: Socket) => {
          debugLog(`[IPCServer] Connection closed`);
          this.connections.delete(socket);
          // Remove from all subscriptions
          for (const subs of this.subscribers.values()) {
            subs.delete(socket);
          }
        },

        error: (socket: Socket, error: Error) => {
          debugLog(`[IPCServer] Socket error: ${error.message}`);
        },
      },
    });

    debugLog(`[IPCServer] Listening on ${this.socketPath}`);
  }

  /**
   * Handle an incoming IPC request.
   */
  private async handleRequest(request: IPCRequest, socket: Socket): Promise<IPCResponse> {
    const source: CommandSource = {
      type: 'ipc',
      agentId: request.agentId,
      sessionId: request.sessionId,
    };

    debugLog(`[IPCServer] Request: ${request.type} ${request.command || ''}`);

    switch (request.type) {
      case 'execute':
        return this.handleExecute(request, source);

      case 'batch':
        return this.handleBatch(request, source);

      case 'query':
        return this.handleQuery(request);

      case 'subscribe':
        return this.handleSubscribe(request, socket);

      default:
        return {
          id: request.id,
          success: false,
          error: { code: 'UNKNOWN_REQUEST', message: `Unknown request type: ${request.type}` },
        };
    }
  }

  private async handleExecute(request: IPCRequest, source: CommandSource): Promise<IPCResponse> {
    if (!request.command) {
      return {
        id: request.id,
        success: false,
        error: { code: 'MISSING_COMMAND', message: 'Command is required' },
      };
    }

    const result = await this.executor.execute(request.command, request.args, source);
    return {
      id: request.id,
      success: result.success,
      result,
    };
  }

  private async handleBatch(request: IPCRequest, source: CommandSource): Promise<IPCResponse> {
    if (!request.commands?.length) {
      return {
        id: request.id,
        success: false,
        error: { code: 'MISSING_COMMANDS', message: 'Commands array is required' },
      };
    }

    const results: CommandResult[] = [];
    for (const cmd of request.commands) {
      const result = await this.executor.execute(cmd.command, cmd.args, source);
      results.push(result);
    }

    return {
      id: request.id,
      success: results.every((r) => r.success),
      result: results,
    };
  }

  private handleQuery(request: IPCRequest): IPCResponse {
    const commands = this.registry.getAIExposed().map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      category: c.category,
      args: c.args,
      returns: c.returns,
    }));

    return {
      id: request.id,
      success: true,
      result: {
        success: true,
        data: commands,
      },
    };
  }

  private handleSubscribe(request: IPCRequest, socket: Socket): IPCResponse {
    if (!request.events?.length) {
      return {
        id: request.id,
        success: false,
        error: { code: 'MISSING_EVENTS', message: 'Events array is required' },
      };
    }

    for (const event of request.events) {
      if (!this.subscribers.has(event)) {
        this.subscribers.set(event, new Set());
      }
      this.subscribers.get(event)!.add(socket);
    }

    debugLog(`[IPCServer] Subscribed to: ${request.events.join(', ')}`);

    return {
      id: request.id,
      success: true,
    };
  }

  /**
   * Emit an event to all subscribers.
   */
  emit(event: string, data: unknown): void {
    const subscribers = this.subscribers.get(event);
    if (!subscribers?.size) return;

    const message: IPCEvent = { type: 'event', event, data };
    const json = JSON.stringify(message) + '\n';

    for (const socket of subscribers) {
      try {
        socket.write(json);
      } catch {
        // Remove dead socket
        subscribers.delete(socket);
        this.connections.delete(socket);
      }
    }
  }

  /**
   * Stop the IPC server.
   */
  stop(): void {
    debugLog(`[IPCServer] Stopping...`);

    // Close all connections
    for (const socket of this.connections) {
      try {
        socket.end();
      } catch {
        // Ignore errors
      }
    }
    this.connections.clear();
    this.subscribers.clear();

    // Stop server
    this.server?.stop();
    this.server = null;

    // Clean up socket file
    try {
      unlinkSync(this.socketPath);
    } catch {
      // Socket doesn't exist, that's fine
    }
  }

  /**
   * Get the socket path.
   */
  getSocketPath(): string {
    return this.socketPath;
  }

  /**
   * Check if server is running.
   */
  isRunning(): boolean {
    return this.server !== null;
  }
}

export default IPCServer;
