/**
 * Local Terminal Service Implementation
 *
 * Implements TerminalService using the PTY class.
 */

import { debugLog as globalDebugLog } from '../../debug.ts';
import { PTY, type PTYOptions, type TerminalCell as PTYCell } from '../../terminal/pty.ts';
import type { TerminalService } from './interface.ts';
import { TerminalError } from './errors.ts';
import type {
  TerminalOptions,
  TerminalInfo,
  TerminalBuffer,
  TerminalCell,
  TerminalOutputCallback,
  TerminalExitCallback,
  TerminalTitleCallback,
  Unsubscribe,
} from './types.ts';

/**
 * Internal terminal session state.
 */
interface TerminalSession {
  /** Terminal ID */
  terminalId: string;

  /** PTY instance */
  pty: PTY;

  /** Shell path */
  shell: string;

  /** Working directory */
  cwd: string;

  /** Current title */
  title: string;
}

/**
 * Local Terminal Service.
 *
 * Manages embedded terminal sessions using PTY.
 */
export class LocalTerminalService implements TerminalService {
  private _debugName = 'LocalTerminalService';
  private sessions = new Map<string, TerminalSession>();
  private sessionCounter = 0;

  // Event callbacks
  private outputCallbacks: Set<TerminalOutputCallback> = new Set();
  private exitCallbacks: Set<TerminalExitCallback> = new Set();
  private titleCallbacks: Set<TerminalTitleCallback> = new Set();

  constructor() {
    this.debugLog('Initialized');
  }

  protected debugLog(msg: string): void {
    globalDebugLog(`[${this._debugName}] ${msg}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  async create(options: TerminalOptions = {}): Promise<string> {
    const terminalId = `terminal-${++this.sessionCounter}-${Date.now()}`;

    // Determine shell with fallbacks
    const shell = options.shell || process.env.SHELL || '/bin/sh';
    const cwd = options.cwd || process.cwd();

    // Create PTY options
    const ptyOptions: PTYOptions = {
      shell,
      cwd,
      env: options.env,
      cols: options.cols || 80,
      rows: options.rows || 24,
      scrollback: options.scrollback || 1000,
    };

    // Create PTY
    const pty = new PTY(ptyOptions);

    // Create session
    const session: TerminalSession = {
      terminalId,
      pty,
      shell,
      cwd,
      title: shell,
    };

    // Set up callbacks
    pty.onData((data: string) => {
      this.emitOutput(terminalId, data);
    });

    pty.onExit((exitCode: number) => {
      this.emitExit(terminalId, exitCode);
    });

    pty.onTitle((title: string) => {
      session.title = title;
      this.emitTitle(terminalId, title);
    });

    // Start PTY
    try {
      await pty.start();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw TerminalError.startFailed(message, error instanceof Error ? error : undefined);
    }

    this.sessions.set(terminalId, session);
    this.debugLog(`Created terminal ${terminalId}`);

    return terminalId;
  }

  close(terminalId: string): void {
    const session = this.sessions.get(terminalId);
    if (!session) {
      return;
    }

    session.pty.kill();
    this.sessions.delete(terminalId);
    this.debugLog(`Closed terminal ${terminalId}`);
  }

  closeAll(): void {
    for (const [terminalId] of this.sessions) {
      this.close(terminalId);
    }
    this.debugLog('Closed all terminals');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Terminal Operations
  // ─────────────────────────────────────────────────────────────────────────

  write(terminalId: string, data: string): void {
    const session = this.sessions.get(terminalId);
    if (!session) {
      throw TerminalError.terminalNotFound(terminalId);
    }

    if (!session.pty.isRunning()) {
      throw TerminalError.notRunning(terminalId);
    }

    session.pty.write(data);
  }

  resize(terminalId: string, cols: number, rows: number): void {
    const session = this.sessions.get(terminalId);
    if (!session) {
      throw TerminalError.terminalNotFound(terminalId);
    }

    if (cols < 1 || rows < 1) {
      throw TerminalError.invalidDimensions(cols, rows);
    }

    session.pty.resize(cols, rows);
    this.debugLog(`Resized terminal ${terminalId} to ${cols}x${rows}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Buffer Access
  // ─────────────────────────────────────────────────────────────────────────

  getBuffer(terminalId: string): TerminalBuffer | null {
    const session = this.sessions.get(terminalId);
    if (!session) {
      return null;
    }

    const buffer = session.pty.getBuffer();
    const cursor = session.pty.getCursor();
    const scrollOffset = session.pty.getViewOffset();

    // Convert PTY cells to service cells
    const cells: TerminalCell[][] = buffer.map((row: PTYCell[]) =>
      row.map((cell: PTYCell) => ({
        char: cell.char,
        fg: cell.fg,
        bg: cell.bg,
        bold: cell.bold,
        italic: cell.italic,
        underline: cell.underline,
        dim: cell.dim,
        inverse: cell.inverse,
      }))
    );

    return {
      cells,
      cursor: { x: cursor.x, y: cursor.y },
      scrollOffset,
      scrollbackSize: 0, // PTY doesn't expose scrollback size directly
    };
  }

  scroll(terminalId: string, lines: number): void {
    const session = this.sessions.get(terminalId);
    if (!session) {
      throw TerminalError.terminalNotFound(terminalId);
    }

    if (lines > 0) {
      session.pty.scrollViewUp(lines);
    } else if (lines < 0) {
      session.pty.scrollViewDown(-lines);
    }
  }

  scrollToBottom(terminalId: string): void {
    const session = this.sessions.get(terminalId);
    if (!session) {
      throw TerminalError.terminalNotFound(terminalId);
    }

    session.pty.resetViewOffset();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Terminal Info
  // ─────────────────────────────────────────────────────────────────────────

  getInfo(terminalId: string): TerminalInfo | null {
    const session = this.sessions.get(terminalId);
    if (!session) {
      return null;
    }

    return {
      terminalId: session.terminalId,
      shell: session.shell,
      cwd: session.cwd,
      cols: session.pty.cols,
      rows: session.pty.rows,
      running: session.pty.isRunning(),
      title: session.title,
    };
  }

  list(): TerminalInfo[] {
    const result: TerminalInfo[] = [];
    for (const session of this.sessions.values()) {
      const info = this.getInfo(session.terminalId);
      if (info) {
        result.push(info);
      }
    }
    return result;
  }

  exists(terminalId: string): boolean {
    return this.sessions.has(terminalId);
  }

  isRunning(terminalId: string): boolean {
    const session = this.sessions.get(terminalId);
    if (!session) {
      return false;
    }
    return session.pty.isRunning();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Events
  // ─────────────────────────────────────────────────────────────────────────

  onOutput(callback: TerminalOutputCallback): Unsubscribe {
    this.outputCallbacks.add(callback);
    return () => {
      this.outputCallbacks.delete(callback);
    };
  }

  onExit(callback: TerminalExitCallback): Unsubscribe {
    this.exitCallbacks.add(callback);
    return () => {
      this.exitCallbacks.delete(callback);
    };
  }

  onTitle(callback: TerminalTitleCallback): Unsubscribe {
    this.titleCallbacks.add(callback);
    return () => {
      this.titleCallbacks.delete(callback);
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event Emission
  // ─────────────────────────────────────────────────────────────────────────

  private emitOutput(terminalId: string, data: string): void {
    for (const callback of this.outputCallbacks) {
      try {
        callback({ terminalId, data });
      } catch (error) {
        this.debugLog(`Output callback error: ${error}`);
      }
    }
  }

  private emitExit(terminalId: string, exitCode: number): void {
    for (const callback of this.exitCallbacks) {
      try {
        callback({ terminalId, exitCode });
      } catch (error) {
        this.debugLog(`Exit callback error: ${error}`);
      }
    }
  }

  private emitTitle(terminalId: string, title: string): void {
    for (const callback of this.titleCallbacks) {
      try {
        callback({ terminalId, title });
      } catch (error) {
        this.debugLog(`Title callback error: ${error}`);
      }
    }
  }
}

export const localTerminalService = new LocalTerminalService();
export default localTerminalService;
