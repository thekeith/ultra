/**
 * ANSI Escape Code Constants and Utilities
 * 
 * Provides low-level ANSI escape sequences for terminal control.
 */

// Control characters
export const ESC = '\x1b';
export const CSI = `${ESC}[`;  // Control Sequence Introducer

// Cursor control
export const CURSOR = {
  hide: `${CSI}?25l`,
  show: `${CSI}?25h`,
  save: `${CSI}s`,
  restore: `${CSI}u`,
  // Position: row and col are 1-indexed
  moveTo: (row: number, col: number) => `${CSI}${row};${col}H`,
  moveUp: (n: number = 1) => `${CSI}${n}A`,
  moveDown: (n: number = 1) => `${CSI}${n}B`,
  moveRight: (n: number = 1) => `${CSI}${n}C`,
  moveLeft: (n: number = 1) => `${CSI}${n}D`,
  // Cursor shapes
  shape: {
    block: `${CSI}2 q`,
    underline: `${CSI}4 q`,
    bar: `${CSI}6 q`,
    blinkingBlock: `${CSI}1 q`,
    blinkingUnderline: `${CSI}3 q`,
    blinkingBar: `${CSI}5 q`,
  }
};

// Screen control
export const SCREEN = {
  clear: `${CSI}2J`,
  clearLine: `${CSI}2K`,
  clearToEnd: `${CSI}0K`,
  clearToStart: `${CSI}1K`,
  clearBelow: `${CSI}0J`,
  clearAbove: `${CSI}1J`,
  // Alternate screen buffer (for fullscreen apps)
  enterAlt: `${CSI}?1049h`,
  exitAlt: `${CSI}?1049l`,
  // Scroll region
  setScrollRegion: (top: number, bottom: number) => `${CSI}${top};${bottom}r`,
  resetScrollRegion: `${CSI}r`,
};

// Text styles
export const STYLE = {
  reset: `${CSI}0m`,
  bold: `${CSI}1m`,
  dim: `${CSI}2m`,
  italic: `${CSI}3m`,
  underline: `${CSI}4m`,
  blink: `${CSI}5m`,
  inverse: `${CSI}7m`,
  hidden: `${CSI}8m`,
  strikethrough: `${CSI}9m`,
  // Reset individual styles
  noBold: `${CSI}22m`,
  noItalic: `${CSI}23m`,
  noUnderline: `${CSI}24m`,
  noBlink: `${CSI}25m`,
  noInverse: `${CSI}27m`,
  noHidden: `${CSI}28m`,
  noStrikethrough: `${CSI}29m`,
};

// Basic 16 colors (foreground)
export const FG = {
  black: `${CSI}30m`,
  red: `${CSI}31m`,
  green: `${CSI}32m`,
  yellow: `${CSI}33m`,
  blue: `${CSI}34m`,
  magenta: `${CSI}35m`,
  cyan: `${CSI}36m`,
  white: `${CSI}37m`,
  default: `${CSI}39m`,
  // Bright variants
  brightBlack: `${CSI}90m`,
  brightRed: `${CSI}91m`,
  brightGreen: `${CSI}92m`,
  brightYellow: `${CSI}93m`,
  brightBlue: `${CSI}94m`,
  brightMagenta: `${CSI}95m`,
  brightCyan: `${CSI}96m`,
  brightWhite: `${CSI}97m`,
  // 256 color
  color256: (n: number) => `${CSI}38;5;${n}m`,
  // True color (24-bit)
  rgb: (r: number, g: number, b: number) => `${CSI}38;2;${r};${g};${b}m`,
};

// Basic 16 colors (background)
export const BG = {
  black: `${CSI}40m`,
  red: `${CSI}41m`,
  green: `${CSI}42m`,
  yellow: `${CSI}43m`,
  blue: `${CSI}44m`,
  magenta: `${CSI}45m`,
  cyan: `${CSI}46m`,
  white: `${CSI}47m`,
  default: `${CSI}49m`,
  // Bright variants
  brightBlack: `${CSI}100m`,
  brightRed: `${CSI}101m`,
  brightGreen: `${CSI}102m`,
  brightYellow: `${CSI}103m`,
  brightBlue: `${CSI}104m`,
  brightMagenta: `${CSI}105m`,
  brightCyan: `${CSI}106m`,
  brightWhite: `${CSI}107m`,
  // 256 color
  color256: (n: number) => `${CSI}48;5;${n}m`,
  // True color (24-bit)
  rgb: (r: number, g: number, b: number) => `${CSI}48;2;${r};${g};${b}m`,
};

// Mouse tracking
export const MOUSE = {
  // Basic mouse tracking (X10 mode)
  enableBasic: `${CSI}?9h`,
  disableBasic: `${CSI}?9l`,
  // Button event tracking
  enableButton: `${CSI}?1000h`,
  disableButton: `${CSI}?1000l`,
  // Any event tracking (includes motion while button pressed)
  enableAny: `${CSI}?1003h`,
  disableAny: `${CSI}?1003l`,
  // SGR extended mode (for coordinates > 223)
  enableSGR: `${CSI}?1006h`,
  disableSGR: `${CSI}?1006l`,
  // UTF-8 mode
  enableUTF8: `${CSI}?1005h`,
  disableUTF8: `${CSI}?1005l`,
};

// Bracketed paste mode
export const PASTE = {
  enable: `${CSI}?2004h`,
  disable: `${CSI}?2004l`,
  start: `${ESC}[200~`,
  end: `${ESC}[201~`,
};

// Import shared color utilities
import { hexToRgbTuple } from '../core/colors.ts';

/**
 * Convert hex color to RGB tuple
 * @deprecated Use hexToRgbTuple from '../core/colors.ts' directly
 */
export function hexToRgb(hex: string): [number, number, number] {
  return hexToRgbTuple(hex);
}

/**
 * Create foreground color from hex
 */
export function fgHex(hex: string): string {
  const [r, g, b] = hexToRgbTuple(hex);
  return FG.rgb(r, g, b);
}

/**
 * Create background color from hex
 */
export function bgHex(hex: string): string {
  const [r, g, b] = hexToRgbTuple(hex);
  return BG.rgb(r, g, b);
}

/**
 * Combine multiple style codes
 */
export function style(...codes: string[]): string {
  return codes.join('');
}

/**
 * Style text and reset after
 */
export function styled(text: string, ...codes: string[]): string {
  return `${codes.join('')}${text}${STYLE.reset}`;
}

/**
 * Get display width of a single character in terminal cells.
 * Handles emoji, CJK, and other wide characters.
 */
export function getCharWidth(char: string): number {
  const code = char.codePointAt(0) ?? 0;

  // ASCII control chars
  if (code < 32) return 0;

  // Basic ASCII (most common case)
  if (code < 127) return 1;

  // Zero-width characters (must check before other ranges)
  if (
    (code >= 0x200B && code <= 0x200F) ||   // Zero-width space, joiners, direction marks
    (code >= 0x2028 && code <= 0x202F) ||   // Line/paragraph separators, embedding controls
    (code >= 0x2060 && code <= 0x206F) ||   // Word joiner, invisible operators
    (code >= 0xFE00 && code <= 0xFE0F) ||   // Variation Selectors (VS1-VS16)
    (code >= 0xFEFF && code <= 0xFEFF) ||   // BOM / Zero-width no-break space
    (code >= 0xE0100 && code <= 0xE01EF) || // Variation Selectors Supplement
    (code >= 0x0300 && code <= 0x036F) ||   // Combining Diacritical Marks
    (code >= 0x0483 && code <= 0x0489) ||   // Combining Cyrillic marks
    (code >= 0x0591 && code <= 0x05BD) ||   // Hebrew combining marks
    (code >= 0x1AB0 && code <= 0x1AFF) ||   // Combining Diacritical Marks Extended
    (code >= 0x1DC0 && code <= 0x1DFF) ||   // Combining Diacritical Marks Supplement
    (code >= 0x20D0 && code <= 0x20FF) ||   // Combining Diacritical Marks for Symbols
    (code >= 0xFE20 && code <= 0xFE2F)      // Combining Half Marks
  ) {
    return 0;
  }

  // Common emoji ranges (2 cells wide)
  if (
    (code >= 0x1F300 && code <= 0x1F9FF) || // Misc Symbols, Emoticons, Symbols & Pictographs
    (code >= 0x2600 && code <= 0x26FF) ||   // Misc Symbols (includes ☑️)
    (code >= 0x2700 && code <= 0x27BF) ||   // Dingbats (includes ✅ ✓)
    (code >= 0x1F600 && code <= 0x1F64F) || // Emoticons
    (code >= 0x1F680 && code <= 0x1F6FF) || // Transport/Map
    (code >= 0x1F1E0 && code <= 0x1F1FF) || // Flags
    (code >= 0x231A && code <= 0x231B) ||   // Watch, Hourglass
    (code >= 0x23E9 && code <= 0x23F3) ||   // Media control symbols
    (code >= 0x23F8 && code <= 0x23FA) ||   // Media control symbols
    (code >= 0x25AA && code <= 0x25AB) ||   // Small squares
    (code >= 0x25B6 && code <= 0x25C0) ||   // Play/reverse buttons
    (code >= 0x25FB && code <= 0x25FE) ||   // Medium squares
    (code >= 0x2934 && code <= 0x2935) ||   // Arrows
    (code >= 0x2B05 && code <= 0x2B07) ||   // Arrows
    (code >= 0x2B1B && code <= 0x2B1C) ||   // Large squares
    (code >= 0x2B50 && code <= 0x2B55) ||   // Star, circles
    (code >= 0x3030 && code <= 0x303D) ||   // CJK symbols
    (code >= 0x1F004 && code <= 0x1F0CF)    // Mahjong, Playing cards
  ) {
    return 2;
  }

  // CJK and other wide characters (2 cells wide)
  if (
    (code >= 0x1100 && code <= 0x115F) ||   // Hangul Jamo
    (code >= 0x2E80 && code <= 0xA4CF) ||   // CJK, Yi, etc.
    (code >= 0xAC00 && code <= 0xD7A3) ||   // Hangul Syllables
    (code >= 0xF900 && code <= 0xFAFF) ||   // CJK Compatibility
    (code >= 0xFE10 && code <= 0xFE1F) ||   // Vertical forms
    (code >= 0xFE30 && code <= 0xFE6F) ||   // CJK Compatibility Forms
    (code >= 0xFF00 && code <= 0xFF60) ||   // Fullwidth Forms
    (code >= 0xFFE0 && code <= 0xFFE6) ||   // Fullwidth Forms
    (code >= 0x20000 && code <= 0x2FFFF)    // CJK Extension B-F
  ) {
    return 2;
  }

  // Default to 1 for other printable characters
  return code >= 0x20 ? 1 : 0;
}

/**
 * Get display width of a string (accounting for wide chars)
 */
export function getDisplayWidth(str: string): number {
  let width = 0;
  for (const char of str) {
    width += getCharWidth(char);
  }
  return width;
}

/**
 * Truncate string to fit display width
 */
export function truncateToWidth(str: string, maxWidth: number, ellipsis: string = '…'): string {
  const ellipsisWidth = getDisplayWidth(ellipsis);
  if (getDisplayWidth(str) <= maxWidth) {
    return str;
  }
  
  let width = 0;
  let result = '';
  for (const char of str) {
    const charWidth = getDisplayWidth(char);
    if (width + charWidth + ellipsisWidth > maxWidth) {
      return result + ellipsis;
    }
    result += char;
    width += charWidth;
  }
  return result;
}

/**
 * Pad string to exact display width
 */
export function padToWidth(str: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string {
  const currentWidth = getDisplayWidth(str);
  if (currentWidth >= width) {
    return truncateToWidth(str, width);
  }
  
  const padding = width - currentWidth;
  switch (align) {
    case 'right':
      return ' '.repeat(padding) + str;
    case 'center':
      const left = Math.floor(padding / 2);
      const right = padding - left;
      return ' '.repeat(left) + str + ' '.repeat(right);
    default:
      return str + ' '.repeat(padding);
  }
}
