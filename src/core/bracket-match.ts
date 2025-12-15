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
const OPENING_BRACKETS = new Set(['(', '[', '{']);
const CLOSING_BRACKETS = new Set([')', ']', '}']);

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
 * Find the enclosing bracket pair for the cursor position.
 * This highlights the brackets that surround the cursor, not just
 * brackets immediately adjacent to the cursor.
 * 
 * @param lines - Document lines
 * @param cursorLine - Cursor line number
 * @param cursorColumn - Cursor column number
 * @returns Match positions or null if no enclosing brackets found
 */
export function findMatchingBracket(
  lines: string[],
  cursorLine: number,
  cursorColumn: number
): BracketMatch | null {
  if (cursorLine < 0 || cursorLine >= lines.length) return null;
  
  const line = lines[cursorLine];
  if (!line) return null;
  
  // First, check if cursor is directly on or before a bracket
  // This gives priority to the bracket the cursor is touching
  let bracketChar = line[cursorColumn];
  
  // Check character at cursor position
  if (bracketChar && isBracket(bracketChar)) {
    const match = findMatchForBracket(lines, cursorLine, cursorColumn, bracketChar);
    if (match) return match;
  }
  
  // Check character before cursor
  if (cursorColumn > 0) {
    bracketChar = line[cursorColumn - 1];
    if (bracketChar && isBracket(bracketChar)) {
      const match = findMatchForBracket(lines, cursorLine, cursorColumn - 1, bracketChar);
      if (match) return match;
    }
  }
  
  // If not on a bracket, find the innermost enclosing bracket pair
  return findEnclosingBrackets(lines, cursorLine, cursorColumn);
}

/**
 * Find the match for a specific bracket at a position
 */
function findMatchForBracket(
  lines: string[],
  line: number,
  column: number,
  bracketChar: string
): BracketMatch | null {
  const bracketPos: Position = { line, column };
  
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
 * Find the innermost enclosing bracket pair for a position
 */
function findEnclosingBrackets(
  lines: string[],
  cursorLine: number,
  cursorColumn: number
): BracketMatch | null {
  // Search backward from cursor to find the nearest unmatched opening bracket
  const openBracket = findNearestUnmatchedOpening(lines, cursorLine, cursorColumn);
  
  if (!openBracket) return null;
  
  // Now find the matching closing bracket
  const openChar = lines[openBracket.line]![openBracket.column]!;
  const closeChar = BRACKET_PAIRS[openChar]!;
  
  const closeBracket = findClosingBracket(lines, openBracket, openChar, closeChar);
  
  if (!closeBracket) return null;
  
  // Make sure the cursor is actually inside these brackets
  const cursorOffset = positionToOffset(lines, cursorLine, cursorColumn);
  const closeOffset = positionToOffset(lines, closeBracket.line, closeBracket.column);
  
  if (cursorOffset <= closeOffset) {
    return { open: openBracket, close: closeBracket };
  }
  
  return null;
}

/**
 * Find the nearest unmatched opening bracket before the cursor
 */
function findNearestUnmatchedOpening(
  lines: string[],
  cursorLine: number,
  cursorColumn: number
): Position | null {
  // Track depth for each bracket type
  const depths: Record<string, number> = { '(': 0, '[': 0, '{': 0 };
  
  // Stack to track bracket positions with their types
  const stack: { pos: Position; char: string }[] = [];
  
  // Scan backward from cursor position
  let line = cursorLine;
  let col = cursorColumn - 1;
  
  while (line >= 0) {
    const lineText = lines[line];
    if (lineText === undefined) {
      line--;
      if (line >= 0) {
        col = lines[line]!.length - 1;
      }
      continue;
    }
    
    while (col >= 0) {
      const lineStr = lines[line];
      if (!lineStr) break;
      const char = lineStr[col];
      
      if (char && CLOSING_BRACKETS.has(char)) {
        // Found a closing bracket - push to track it
        const openChar = CLOSING_TO_OPENING[char];
        if (openChar && depths[openChar] !== undefined) {
          depths[openChar] = (depths[openChar] || 0) + 1;
        }
      } else if (char && OPENING_BRACKETS.has(char)) {
        const depth = depths[char];
        if (depth !== undefined && depth > 0) {
          // This opening bracket matches a closing bracket we passed
          depths[char] = (depths[char] || 0) - 1;
        } else {
          // This is an unmatched opening bracket - our enclosing bracket!
          return { line, column: col };
        }
      }
      
      col--;
    }
    
    line--;
    if (line >= 0) {
      const prevLine = lines[line];
      col = prevLine ? prevLine.length - 1 : -1;
    }
  }
  
  return null;
}

/**
 * Simple position to offset calculation for comparison
 */
function positionToOffset(lines: string[], line: number, column: number): number {
  let offset = 0;
  for (let i = 0; i < line && i < lines.length; i++) {
    offset += (lines[i]?.length ?? 0) + 1; // +1 for newline
  }
  return offset + column;
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
    if (lineText === undefined) {
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
    if (lineText === undefined) {
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
