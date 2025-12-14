/**
 * Bracket Matching
 * 
 * Finds matching bracket pairs for cursor position highlighting.
 */

import type { Position } from './buffer.ts';

// Bracket pairs
const BRACKET_PAIRS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
};

const CLOSING_TO_OPENING: Record<string, string> = {
  ')': '(',
  ']': '[',
  '}': '{',
};

const ALL_BRACKETS = new Set(['(', ')', '[', ']', '{', '}']);

export interface BracketMatch {
  open: Position;
  close: Position;
}

/**
 * Check if a character is a bracket
 */
export function isBracket(char: string): boolean {
  return ALL_BRACKETS.has(char);
}

/**
 * Find matching bracket for the bracket at or near cursor position
 * 
 * @param lines - Document lines
 * @param cursorLine - Cursor line number
 * @param cursorColumn - Cursor column number
 * @returns Match positions or null if no match found
 */
export function findMatchingBracket(
  lines: string[],
  cursorLine: number,
  cursorColumn: number
): BracketMatch | null {
  if (cursorLine < 0 || cursorLine >= lines.length) return null;
  
  const line = lines[cursorLine];
  if (!line) return null;
  
  // Check character at cursor position
  let bracketChar = line[cursorColumn];
  let bracketColumn = cursorColumn;
  
  // If not on a bracket, check character before cursor
  if (!bracketChar || !isBracket(bracketChar)) {
    if (cursorColumn > 0) {
      bracketChar = line[cursorColumn - 1];
      bracketColumn = cursorColumn - 1;
      if (!bracketChar || !isBracket(bracketChar)) {
        return null;
      }
    } else {
      return null;
    }
  }
  
  const bracketPos: Position = { line: cursorLine, column: bracketColumn };
  
  // Determine if opening or closing bracket
  if (BRACKET_PAIRS[bracketChar]) {
    // Opening bracket - search forward
    const closingChar = BRACKET_PAIRS[bracketChar];
    const matchPos = findClosingBracket(lines, bracketPos, bracketChar, closingChar);
    if (matchPos) {
      return { open: bracketPos, close: matchPos };
    }
  } else if (CLOSING_TO_OPENING[bracketChar]) {
    // Closing bracket - search backward
    const openingChar = CLOSING_TO_OPENING[bracketChar];
    const matchPos = findOpeningBracket(lines, bracketPos, openingChar, bracketChar);
    if (matchPos) {
      return { open: matchPos, close: bracketPos };
    }
  }
  
  return null;
}

/**
 * Search forward for matching closing bracket
 */
function findClosingBracket(
  lines: string[],
  startPos: Position,
  openChar: string,
  closeChar: string
): Position | null {
  let depth = 1;
  let line = startPos.line;
  let col = startPos.column + 1; // Start after the opening bracket
  
  while (line < lines.length) {
    const lineText = lines[line];
    if (!lineText) {
      line++;
      col = 0;
      continue;
    }
    
    while (col < lineText.length) {
      const char = lineText[col];
      if (char === openChar) {
        depth++;
      } else if (char === closeChar) {
        depth--;
        if (depth === 0) {
          return { line, column: col };
        }
      }
      col++;
    }
    
    line++;
    col = 0;
  }
  
  return null;
}

/**
 * Search backward for matching opening bracket
 */
function findOpeningBracket(
  lines: string[],
  startPos: Position,
  openChar: string,
  closeChar: string
): Position | null {
  let depth = 1;
  let line = startPos.line;
  let col = startPos.column - 1; // Start before the closing bracket
  
  while (line >= 0) {
    const lineText = lines[line];
    if (!lineText) {
      line--;
      if (line >= 0) {
        col = lines[line]!.length - 1;
      }
      continue;
    }
    
    while (col >= 0) {
      const char = lineText[col];
      if (char === closeChar) {
        depth++;
      } else if (char === openChar) {
        depth--;
        if (depth === 0) {
          return { line, column: col };
        }
      }
      col--;
    }
    
    line--;
    if (line >= 0) {
      col = lines[line]!.length - 1;
    }
  }
  
  return null;
}

/**
 * Get all lines from a document as an array
 */
export function getDocumentLines(getLine: (n: number) => string, lineCount: number): string[] {
  const lines: string[] = [];
  for (let i = 0; i < lineCount; i++) {
    lines.push(getLine(i));
  }
  return lines;
}
