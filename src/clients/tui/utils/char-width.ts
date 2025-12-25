/**
 * Character Width Utilities
 *
 * Provides functions to calculate the display width of Unicode characters
 * in a terminal. Wide characters (like CJK and many emojis) take 2 cells.
 */

import { eastAsianWidth } from 'get-east-asian-width';

/**
 * Get the display width of a single character (1 or 2 cells).
 * Wide characters (CJK, emojis, etc.) return 2.
 * Control characters return 0.
 * Regular ASCII and other characters return 1.
 */
export function charWidth(char: string): number {
  if (!char || char.length === 0) {
    return 0;
  }

  // Get the first code point
  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) {
    return 0;
  }

  // Control characters have no width
  if (codePoint < 32 || (codePoint >= 0x7f && codePoint < 0xa0)) {
    return 0;
  }

  // Use get-east-asian-width which returns 1 or 2 directly
  // It handles Wide (W), Fullwidth (F), and other categories
  return eastAsianWidth(codePoint);
}

/**
 * Get the display width of a string in terminal cells.
 * Accounts for wide characters that take 2 cells.
 */
export function stringWidth(str: string): number {
  if (!str) {
    return 0;
  }

  let width = 0;
  // Use spread to properly iterate over code points (handles surrogate pairs)
  for (const char of str) {
    width += charWidth(char);
  }

  return width;
}

/**
 * Slice a string to fit within a maximum display width.
 * Returns the substring that fits within maxWidth cells.
 */
export function sliceToWidth(str: string, maxWidth: number): string {
  if (!str || maxWidth <= 0) {
    return '';
  }

  let width = 0;
  let endIndex = 0;

  for (const char of str) {
    const charW = charWidth(char);
    if (width + charW > maxWidth) {
      break;
    }
    width += charW;
    // Get the actual string index (handle multi-byte chars)
    endIndex += char.length;
  }

  return str.slice(0, endIndex);
}

/**
 * Iterator that yields characters with their display width and position.
 * Useful for rendering with proper cell alignment.
 */
export function* charWidthIterator(str: string): Generator<{
  char: string;
  width: number;
  charIndex: number;
  cellIndex: number;
}> {
  let cellIndex = 0;
  let charIndex = 0;

  for (const char of str) {
    const width = charWidth(char);
    yield { char, width, charIndex, cellIndex };
    cellIndex += width;
    charIndex++;
  }
}

/**
 * Get the character index at a specific cell position.
 * Returns -1 if the cell position is past the end of the string.
 * If the cell falls on the second cell of a wide character, returns
 * the index of that wide character.
 */
export function charIndexAtCell(str: string, cellPosition: number): number {
  if (cellPosition < 0) {
    return 0;
  }

  let cellIndex = 0;
  let charIndex = 0;

  for (const char of str) {
    const width = charWidth(char);

    // If target cell is within this character's cells
    if (cellPosition < cellIndex + width) {
      return charIndex;
    }

    cellIndex += width;
    charIndex++;
  }

  return -1; // Past end of string
}

/**
 * Get the cell position of a character at a given index.
 */
export function cellPositionOfChar(str: string, targetCharIndex: number): number {
  if (targetCharIndex <= 0) {
    return 0;
  }

  let cellIndex = 0;
  let charIndex = 0;

  for (const char of str) {
    if (charIndex >= targetCharIndex) {
      break;
    }
    cellIndex += charWidth(char);
    charIndex++;
  }

  return cellIndex;
}
