/**
 * ANSI Escape Sequences
 *
 * Raw ANSI escape codes for terminal control.
 * Reference: https://en.wikipedia.org/wiki/ANSI_escape_code
 */

// ============================================
// Constants
// ============================================

/** Control Sequence Introducer */
export const CSI = '\x1b[';

/** Operating System Command */
export const OSC = '\x1b]';

/** String Terminator */
export const ST = '\x1b\\';

/** Bell (alternative string terminator) */
export const BEL = '\x07';

// ============================================
// Cursor Movement
// ============================================

/**
 * Move cursor up n rows.
 */
export function cursorUp(n = 1): string {
  return `${CSI}${n}A`;
}

/**
 * Move cursor down n rows.
 */
export function cursorDown(n = 1): string {
  return `${CSI}${n}B`;
}

/**
 * Move cursor forward (right) n columns.
 */
export function cursorForward(n = 1): string {
  return `${CSI}${n}C`;
}

/**
 * Move cursor backward (left) n columns.
 */
export function cursorBack(n = 1): string {
  return `${CSI}${n}D`;
}

/**
 * Move cursor to beginning of line n lines down.
 */
export function cursorNextLine(n = 1): string {
  return `${CSI}${n}E`;
}

/**
 * Move cursor to beginning of line n lines up.
 */
export function cursorPrevLine(n = 1): string {
  return `${CSI}${n}F`;
}

/**
 * Move cursor to column n (1-indexed).
 */
export function cursorToColumn(n: number): string {
  return `${CSI}${n}G`;
}

/**
 * Move cursor to position (row, col) - both 1-indexed.
 */
export function cursorTo(row: number, col: number): string {
  return `${CSI}${row};${col}H`;
}

/**
 * Move cursor to position (row, col) - 0-indexed for convenience.
 */
export function cursorToZero(row: number, col: number): string {
  return `${CSI}${row + 1};${col + 1}H`;
}

/**
 * Move cursor to home position (1, 1).
 */
export function cursorHome(): string {
  return `${CSI}H`;
}

/**
 * Save cursor position.
 */
export function cursorSave(): string {
  return `${CSI}s`;
}

/**
 * Restore cursor position.
 */
export function cursorRestore(): string {
  return `${CSI}u`;
}

/**
 * Request cursor position (response: CSI row;col R).
 */
export function cursorPositionRequest(): string {
  return `${CSI}6n`;
}

// ============================================
// Cursor Visibility
// ============================================

/**
 * Hide cursor.
 */
export function cursorHide(): string {
  return `${CSI}?25l`;
}

/**
 * Show cursor.
 */
export function cursorShow(): string {
  return `${CSI}?25h`;
}

/**
 * Set cursor style.
 * 0: Default, 1: Blinking block, 2: Steady block,
 * 3: Blinking underline, 4: Steady underline,
 * 5: Blinking bar, 6: Steady bar
 */
export function cursorStyle(style: 0 | 1 | 2 | 3 | 4 | 5 | 6): string {
  return `${CSI}${style} q`;
}

// ============================================
// Screen Clearing
// ============================================

/**
 * Clear screen.
 * 0: From cursor to end, 1: From start to cursor, 2: Entire screen, 3: Entire screen + scrollback
 */
export function clearScreen(mode: 0 | 1 | 2 | 3 = 2): string {
  return `${CSI}${mode}J`;
}

/**
 * Clear line.
 * 0: From cursor to end, 1: From start to cursor, 2: Entire line
 */
export function clearLine(mode: 0 | 1 | 2 = 2): string {
  return `${CSI}${mode}K`;
}

/**
 * Clear screen and move cursor to home.
 */
export function clearScreenAndHome(): string {
  return clearScreen(2) + cursorHome();
}

// ============================================
// Scrolling
// ============================================

/**
 * Scroll up n lines.
 */
export function scrollUp(n = 1): string {
  return `${CSI}${n}S`;
}

/**
 * Scroll down n lines.
 */
export function scrollDown(n = 1): string {
  return `${CSI}${n}T`;
}

/**
 * Set scrolling region (top and bottom rows, 1-indexed).
 */
export function setScrollRegion(top: number, bottom: number): string {
  return `${CSI}${top};${bottom}r`;
}

/**
 * Reset scrolling region to full screen.
 */
export function resetScrollRegion(): string {
  return `${CSI}r`;
}

// ============================================
// Screen Modes
// ============================================

/**
 * Enable alternate screen buffer.
 */
export function alternateScreenOn(): string {
  return `${CSI}?1049h`;
}

/**
 * Disable alternate screen buffer.
 */
export function alternateScreenOff(): string {
  return `${CSI}?1049l`;
}

/**
 * Enable line wrapping.
 */
export function lineWrapOn(): string {
  return `${CSI}?7h`;
}

/**
 * Disable line wrapping.
 */
export function lineWrapOff(): string {
  return `${CSI}?7l`;
}

// ============================================
// Mouse Tracking
// ============================================

/**
 * Enable basic mouse tracking (press only).
 */
export function mouseTrackingOn(): string {
  return `${CSI}?1000h`;
}

/**
 * Disable basic mouse tracking.
 */
export function mouseTrackingOff(): string {
  return `${CSI}?1000l`;
}

/**
 * Enable mouse button tracking (press and release).
 */
export function mouseButtonTrackingOn(): string {
  return `${CSI}?1002h`;
}

/**
 * Disable mouse button tracking.
 */
export function mouseButtonTrackingOff(): string {
  return `${CSI}?1002l`;
}

/**
 * Enable any-event mouse tracking (includes movement).
 */
export function mouseAnyEventOn(): string {
  return `${CSI}?1003h`;
}

/**
 * Disable any-event mouse tracking.
 */
export function mouseAnyEventOff(): string {
  return `${CSI}?1003l`;
}

/**
 * Enable SGR extended mouse mode (for coordinates > 223).
 */
export function mouseSgrModeOn(): string {
  return `${CSI}?1006h`;
}

/**
 * Disable SGR extended mouse mode.
 */
export function mouseSgrModeOff(): string {
  return `${CSI}?1006l`;
}

/**
 * Enable full mouse support (button tracking + SGR mode).
 */
export function mouseFullOn(): string {
  return mouseButtonTrackingOn() + mouseSgrModeOn();
}

/**
 * Disable full mouse support.
 */
export function mouseFullOff(): string {
  return mouseButtonTrackingOff() + mouseSgrModeOff();
}

// ============================================
// Bracketed Paste
// ============================================

/**
 * Enable bracketed paste mode.
 */
export function bracketedPasteOn(): string {
  return `${CSI}?2004h`;
}

/**
 * Disable bracketed paste mode.
 */
export function bracketedPasteOff(): string {
  return `${CSI}?2004l`;
}

// ============================================
// Window/Terminal
// ============================================

/**
 * Set window title.
 */
export function setTitle(title: string): string {
  return `${OSC}0;${title}${BEL}`;
}

/**
 * Request terminal size (response varies by terminal).
 */
export function requestTerminalSize(): string {
  return `${CSI}18t`;
}

/**
 * Ring the bell.
 */
export function bell(): string {
  return BEL;
}

// ============================================
// Utility Sequences
// ============================================

/**
 * Soft terminal reset.
 */
export function softReset(): string {
  return `${CSI}!p`;
}

/**
 * Hard terminal reset.
 */
export function hardReset(): string {
  return '\x1bc';
}

/**
 * Enable focus tracking (terminal reports focus in/out).
 */
export function focusTrackingOn(): string {
  return `${CSI}?1004h`;
}

/**
 * Disable focus tracking.
 */
export function focusTrackingOff(): string {
  return `${CSI}?1004l`;
}
