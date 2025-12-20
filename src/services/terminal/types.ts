/**
 * Terminal Service Types
 *
 * Type definitions for the Terminal Service.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Terminal Cell Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single cell in the terminal buffer.
 */
export interface TerminalCell {
  /** Character in this cell */
  char: string;

  /** Foreground color (hex) or null for default */
  fg: string | null;

  /** Background color (hex) or null for default */
  bg: string | null;

  /** Bold text */
  bold: boolean;

  /** Italic text */
  italic: boolean;

  /** Underlined text */
  underline: boolean;

  /** Dim text */
  dim: boolean;

  /** Inverse video */
  inverse: boolean;
}

/**
 * Cursor position in the terminal.
 */
export interface CursorPosition {
  /** Column (0-indexed) */
  x: number;

  /** Row (0-indexed) */
  y: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Terminal Session Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for creating a terminal session.
 */
export interface TerminalOptions {
  /** Shell to use (defaults to $SHELL or /bin/sh) */
  shell?: string;

  /** Working directory */
  cwd?: string;

  /** Environment variables */
  env?: Record<string, string>;

  /** Number of columns */
  cols?: number;

  /** Number of rows */
  rows?: number;

  /** Scrollback buffer size */
  scrollback?: number;
}

/**
 * Information about a terminal session.
 */
export interface TerminalInfo {
  /** Unique terminal ID */
  terminalId: string;

  /** Shell path */
  shell: string;

  /** Working directory */
  cwd: string;

  /** Terminal width in columns */
  cols: number;

  /** Terminal height in rows */
  rows: number;

  /** Whether the terminal is running */
  running: boolean;

  /** Terminal title (if set by shell) */
  title?: string;
}

/**
 * Terminal buffer state for rendering.
 */
export interface TerminalBuffer {
  /** 2D grid of cells */
  cells: TerminalCell[][];

  /** Cursor position */
  cursor: CursorPosition;

  /** Current scroll offset (0 = at bottom) */
  scrollOffset: number;

  /** Total scrollback lines available */
  scrollbackSize: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Terminal output event data.
 */
export interface TerminalOutputEvent {
  /** Terminal ID */
  terminalId: string;

  /** Raw output data */
  data: string;
}

/**
 * Terminal exit event data.
 */
export interface TerminalExitEvent {
  /** Terminal ID */
  terminalId: string;

  /** Exit code */
  exitCode: number;
}

/**
 * Terminal title change event data.
 */
export interface TerminalTitleEvent {
  /** Terminal ID */
  terminalId: string;

  /** New title */
  title: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Callback Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Callback for terminal output.
 */
export type TerminalOutputCallback = (event: TerminalOutputEvent) => void;

/**
 * Callback for terminal exit.
 */
export type TerminalExitCallback = (event: TerminalExitEvent) => void;

/**
 * Callback for terminal title changes.
 */
export type TerminalTitleCallback = (event: TerminalTitleEvent) => void;

/**
 * Unsubscribe function returned by event subscriptions.
 */
export type Unsubscribe = () => void;
