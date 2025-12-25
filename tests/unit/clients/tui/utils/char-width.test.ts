/**
 * Character Width Utility Tests
 */

import { describe, test, expect } from 'bun:test';
import { charWidth, stringWidth, sliceToWidth, charIndexAtCell, cellPositionOfChar } from '../../../../../src/clients/tui/utils/char-width.ts';

describe('charWidth', () => {
  test('returns 1 for ASCII characters', () => {
    expect(charWidth('a')).toBe(1);
    expect(charWidth('Z')).toBe(1);
    expect(charWidth('0')).toBe(1);
    expect(charWidth(' ')).toBe(1);
    expect(charWidth('!')).toBe(1);
  });

  test('returns 0 for empty string', () => {
    expect(charWidth('')).toBe(0);
  });

  test('returns 0 for control characters', () => {
    expect(charWidth('\n')).toBe(0);
    expect(charWidth('\t')).toBe(0);
    expect(charWidth('\r')).toBe(0);
  });

  test('returns 2 for wide characters', () => {
    // CJK characters
    expect(charWidth('中')).toBe(2);
    expect(charWidth('日')).toBe(2);
    expect(charWidth('한')).toBe(2);

    // Common emojis (checkmark, etc)
    expect(charWidth('✅')).toBe(2);
    expect(charWidth('❌')).toBe(2);
  });

  test('returns 2 for full-width punctuation', () => {
    expect(charWidth('。')).toBe(2);
    expect(charWidth('、')).toBe(2);
    expect(charWidth('「')).toBe(2);
  });
});

describe('stringWidth', () => {
  test('returns correct width for ASCII string', () => {
    expect(stringWidth('hello')).toBe(5);
    expect(stringWidth('hello world')).toBe(11);
  });

  test('returns correct width for mixed string', () => {
    // "✅ Complete" - checkmark is 2 cells, rest are 1 each
    expect(stringWidth('✅ Complete')).toBe(11); // 2 + 1 + 8 = 11
  });

  test('returns 0 for empty string', () => {
    expect(stringWidth('')).toBe(0);
  });

  test('handles CJK characters', () => {
    expect(stringWidth('日本語')).toBe(6); // 3 characters × 2 cells each
  });
});

describe('sliceToWidth', () => {
  test('slices ASCII string correctly', () => {
    expect(sliceToWidth('hello', 3)).toBe('hel');
    expect(sliceToWidth('hello', 10)).toBe('hello');
  });

  test('slices wide character string correctly', () => {
    // "✅ Hi" - if we only have 3 cells, we can fit "✅ " (2+1=3) but not "H"
    expect(sliceToWidth('✅ Hi', 3)).toBe('✅ ');
    expect(sliceToWidth('✅ Hi', 2)).toBe('✅');
    expect(sliceToWidth('✅ Hi', 1)).toBe(''); // Not enough room for wide char
  });

  test('returns empty string for width 0', () => {
    expect(sliceToWidth('hello', 0)).toBe('');
  });
});

describe('charIndexAtCell', () => {
  test('finds char index in ASCII string', () => {
    expect(charIndexAtCell('hello', 0)).toBe(0);
    expect(charIndexAtCell('hello', 2)).toBe(2);
    expect(charIndexAtCell('hello', 4)).toBe(4);
  });

  test('finds char index with wide characters', () => {
    // "✅ Hi" - cells: [0,1]=✅, [2]=' ', [3]='H', [4]='i'
    expect(charIndexAtCell('✅ Hi', 0)).toBe(0); // First cell of ✅
    expect(charIndexAtCell('✅ Hi', 1)).toBe(0); // Second cell of ✅ (same char)
    expect(charIndexAtCell('✅ Hi', 2)).toBe(1); // Space
    expect(charIndexAtCell('✅ Hi', 3)).toBe(2); // 'H'
    expect(charIndexAtCell('✅ Hi', 4)).toBe(3); // 'i'
  });

  test('returns -1 for cell past end', () => {
    expect(charIndexAtCell('hello', 10)).toBe(-1);
  });
});

describe('cellPositionOfChar', () => {
  test('finds cell position in ASCII string', () => {
    expect(cellPositionOfChar('hello', 0)).toBe(0);
    expect(cellPositionOfChar('hello', 2)).toBe(2);
    expect(cellPositionOfChar('hello', 4)).toBe(4);
  });

  test('finds cell position with wide characters', () => {
    // "✅ Hi" - char indices: 0=✅, 1=' ', 2='H', 3='i'
    expect(cellPositionOfChar('✅ Hi', 0)).toBe(0); // ✅ starts at cell 0
    expect(cellPositionOfChar('✅ Hi', 1)).toBe(2); // ' ' starts at cell 2
    expect(cellPositionOfChar('✅ Hi', 2)).toBe(3); // 'H' starts at cell 3
    expect(cellPositionOfChar('✅ Hi', 3)).toBe(4); // 'i' starts at cell 4
  });
});
