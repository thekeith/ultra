/**
 * Terminal Service Interface
 *
 * Defines the contract for embedded terminal services.
 */

import type {
  TerminalOptions,
  TerminalInfo,
  TerminalBuffer,
  TerminalOutputCallback,
  TerminalExitCallback,
  TerminalTitleCallback,
  Unsubscribe,
} from './types.ts';

/**
 * Terminal Service interface.
 *
 * Manages embedded terminal sessions (PTY).
 */
export interface TerminalService {
  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a new terminal session.
   *
   * @param options Terminal options
   * @returns Terminal ID
   */
  create(options?: TerminalOptions): Promise<string>;

  /**
   * Close a terminal session.
   *
   * @param terminalId Terminal ID
   */
  close(terminalId: string): void;

  /**
   * Close all terminal sessions.
   */
  closeAll(): void;

  // ─────────────────────────────────────────────────────────────────────────
  // Terminal Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Write data to a terminal.
   *
   * @param terminalId Terminal ID
   * @param data Data to write
   */
  write(terminalId: string, data: string): void;

  /**
   * Resize a terminal.
   *
   * @param terminalId Terminal ID
   * @param cols Number of columns
   * @param rows Number of rows
   */
  resize(terminalId: string, cols: number, rows: number): void;

  // ─────────────────────────────────────────────────────────────────────────
  // Buffer Access
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the terminal buffer for rendering.
   *
   * @param terminalId Terminal ID
   * @returns Terminal buffer state
   */
  getBuffer(terminalId: string): TerminalBuffer | null;

  /**
   * Scroll the terminal view.
   *
   * @param terminalId Terminal ID
   * @param lines Number of lines (positive = up, negative = down)
   */
  scroll(terminalId: string, lines: number): void;

  /**
   * Reset scroll to bottom.
   *
   * @param terminalId Terminal ID
   */
  scrollToBottom(terminalId: string): void;

  // ─────────────────────────────────────────────────────────────────────────
  // Terminal Info
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get terminal info.
   *
   * @param terminalId Terminal ID
   * @returns Terminal info or null
   */
  getInfo(terminalId: string): TerminalInfo | null;

  /**
   * List all terminals.
   *
   * @returns Array of terminal info
   */
  list(): TerminalInfo[];

  /**
   * Check if a terminal exists.
   *
   * @param terminalId Terminal ID
   * @returns Whether the terminal exists
   */
  exists(terminalId: string): boolean;

  /**
   * Check if a terminal is running.
   *
   * @param terminalId Terminal ID
   * @returns Whether the terminal is running
   */
  isRunning(terminalId: string): boolean;

  // ─────────────────────────────────────────────────────────────────────────
  // Events
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Subscribe to terminal output.
   *
   * @param callback Output callback
   * @returns Unsubscribe function
   */
  onOutput(callback: TerminalOutputCallback): Unsubscribe;

  /**
   * Subscribe to terminal exit.
   *
   * @param callback Exit callback
   * @returns Unsubscribe function
   */
  onExit(callback: TerminalExitCallback): Unsubscribe;

  /**
   * Subscribe to terminal title changes.
   *
   * @param callback Title callback
   * @returns Unsubscribe function
   */
  onTitle(callback: TerminalTitleCallback): Unsubscribe;
}
