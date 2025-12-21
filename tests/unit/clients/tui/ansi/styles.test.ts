/**
 * ANSI Styles Tests
 */

import { describe, test, expect } from 'bun:test';
import {
  bold,
  boldOff,
  dim,
  dimOff,
  italic,
  italicOff,
  underline,
  underlineOff,
  blink,
  blinkOff,
  inverse,
  inverseOff,
  hidden,
  hiddenOff,
  strikethrough,
  strikethroughOff,
  buildStyle,
  cellStyle,
  styled,
  diffCells,
  transitionStyle,
  stylesMatch,
  type StyleOptions,
} from '../../../../../src/clients/tui/ansi/styles.ts';
import type { Cell } from '../../../../../src/clients/tui/types.ts';

describe('ANSI Styles', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Individual Style Codes
  // ─────────────────────────────────────────────────────────────────────────

  describe('individual styles', () => {
    test('bold on/off', () => {
      expect(bold()).toBe('\x1b[1m');
      expect(boldOff()).toBe('\x1b[22m');
    });

    test('dim on/off', () => {
      expect(dim()).toBe('\x1b[2m');
      expect(dimOff()).toBe('\x1b[22m');
    });

    test('italic on/off', () => {
      expect(italic()).toBe('\x1b[3m');
      expect(italicOff()).toBe('\x1b[23m');
    });

    test('underline on/off', () => {
      expect(underline()).toBe('\x1b[4m');
      expect(underlineOff()).toBe('\x1b[24m');
    });

    test('blink on/off', () => {
      expect(blink()).toBe('\x1b[5m');
      expect(blinkOff()).toBe('\x1b[25m');
    });

    test('inverse on/off', () => {
      expect(inverse()).toBe('\x1b[7m');
      expect(inverseOff()).toBe('\x1b[27m');
    });

    test('hidden on/off', () => {
      expect(hidden()).toBe('\x1b[8m');
      expect(hiddenOff()).toBe('\x1b[28m');
    });

    test('strikethrough on/off', () => {
      expect(strikethrough()).toBe('\x1b[9m');
      expect(strikethroughOff()).toBe('\x1b[29m');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Combined Styles
  // ─────────────────────────────────────────────────────────────────────────

  describe('buildStyle', () => {
    test('returns empty string for empty options', () => {
      expect(buildStyle({})).toBe('');
    });

    test('applies foreground color', () => {
      const style = buildStyle({ fg: '#ff0000' });
      expect(style).toBe('\x1b[38;2;255;0;0m');
    });

    test('applies background color', () => {
      const style = buildStyle({ bg: '#000000' });
      expect(style).toBe('\x1b[48;2;0;0;0m');
    });

    test('applies both colors', () => {
      const style = buildStyle({ fg: '#ffffff', bg: '#000000' });
      expect(style).toContain('\x1b[38;2;255;255;255m');
      expect(style).toContain('\x1b[48;2;0;0;0m');
    });

    test('applies text styles', () => {
      const style = buildStyle({ bold: true, italic: true });
      expect(style).toContain('\x1b[1m');
      expect(style).toContain('\x1b[3m');
    });

    test('applies all options', () => {
      const options: StyleOptions = {
        fg: '#fff',
        bg: '#000',
        bold: true,
        dim: true,
        italic: true,
        underline: true,
        strikethrough: true,
      };
      const style = buildStyle(options);
      expect(style).toContain('\x1b[38;2;255;255;255m'); // fg
      expect(style).toContain('\x1b[48;2;0;0;0m'); // bg
      expect(style).toContain('\x1b[1m'); // bold
      expect(style).toContain('\x1b[2m'); // dim
      expect(style).toContain('\x1b[3m'); // italic
      expect(style).toContain('\x1b[4m'); // underline
      expect(style).toContain('\x1b[9m'); // strikethrough
    });

    test('does not apply false styles', () => {
      const style = buildStyle({
        bold: false,
        italic: false,
        underline: false,
      });
      expect(style).toBe('');
    });
  });

  describe('cellStyle', () => {
    test('converts cell to style sequence', () => {
      const cell: Cell = {
        char: 'A',
        fg: '#ff0000',
        bg: '#000000',
        bold: true,
      };
      const style = cellStyle(cell);
      expect(style).toContain('\x1b[38;2;255;0;0m');
      expect(style).toContain('\x1b[48;2;0;0;0m');
      expect(style).toContain('\x1b[1m');
    });

    test('handles minimal cell', () => {
      const cell: Cell = {
        char: ' ',
        fg: 'default',
        bg: 'default',
      };
      const style = cellStyle(cell);
      expect(style).toContain('\x1b[39m'); // default fg
      expect(style).toContain('\x1b[49m'); // default bg
    });
  });

  describe('styled', () => {
    test('wraps text with style and reset', () => {
      const result = styled('Hello', { bold: true });
      expect(result).toBe('\x1b[1mHello\x1b[0m');
    });

    test('applies multiple styles', () => {
      const result = styled('World', { fg: '#ff0000', italic: true });
      expect(result).toContain('\x1b[38;2;255;0;0m');
      expect(result).toContain('\x1b[3m');
      expect(result).toContain('World');
      expect(result).toContain('\x1b[0m');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Diff-based Updates
  // ─────────────────────────────────────────────────────────────────────────

  describe('diffCells', () => {
    test('all changed when prev is null', () => {
      const next: Cell = {
        char: 'X',
        fg: '#fff',
        bg: '#000',
        bold: true,
      };
      const diff = diffCells(null, next);
      expect(diff.fgChanged).toBe(true);
      expect(diff.bgChanged).toBe(true);
      expect(diff.boldChanged).toBe(true);
    });

    test('detects no changes for identical cells', () => {
      const cell: Cell = {
        char: 'A',
        fg: '#ff0000',
        bg: '#000000',
        bold: true,
        italic: false,
      };
      const diff = diffCells(cell, { ...cell });
      expect(diff.fgChanged).toBe(false);
      expect(diff.bgChanged).toBe(false);
      expect(diff.boldChanged).toBe(false);
    });

    test('detects fg change', () => {
      const prev: Cell = { char: 'A', fg: '#ff0000', bg: '#000' };
      const next: Cell = { char: 'A', fg: '#00ff00', bg: '#000' };
      const diff = diffCells(prev, next);
      expect(diff.fgChanged).toBe(true);
      expect(diff.bgChanged).toBe(false);
    });

    test('detects style changes', () => {
      const prev: Cell = { char: 'A', fg: '#fff', bg: '#000', bold: false };
      const next: Cell = { char: 'A', fg: '#fff', bg: '#000', bold: true };
      const diff = diffCells(prev, next);
      expect(diff.boldChanged).toBe(true);
      expect(diff.fgChanged).toBe(false);
    });
  });

  describe('transitionStyle', () => {
    test('returns full style for null prev', () => {
      const next: Cell = { char: 'A', fg: '#ff0000', bg: '#000000' };
      const style = transitionStyle(null, next);
      expect(style).toContain('\x1b[38;2;255;0;0m');
      expect(style).toContain('\x1b[48;2;0;0;0m');
    });

    test('returns empty string for identical cells', () => {
      const cell: Cell = { char: 'A', fg: '#fff', bg: '#000' };
      const style = transitionStyle(cell, { ...cell });
      expect(style).toBe('');
    });

    test('returns only changed attributes', () => {
      const prev: Cell = { char: 'A', fg: '#ff0000', bg: '#000000' };
      const next: Cell = { char: 'B', fg: '#00ff00', bg: '#000000' };
      const style = transitionStyle(prev, next);
      expect(style).toContain('\x1b[38;2;0;255;0m'); // fg changed
      expect(style).not.toContain('\x1b[48;2'); // bg unchanged
    });

    test('handles style on/off transitions', () => {
      const prev: Cell = { char: 'A', fg: '#fff', bg: '#000', bold: true };
      const next: Cell = { char: 'B', fg: '#fff', bg: '#000', bold: false };
      const style = transitionStyle(prev, next);
      expect(style).toContain('\x1b[22m'); // bold off
    });

    test('handles style off/on transitions', () => {
      const prev: Cell = { char: 'A', fg: '#fff', bg: '#000' };
      const next: Cell = { char: 'B', fg: '#fff', bg: '#000', italic: true };
      const style = transitionStyle(prev, next);
      expect(style).toContain('\x1b[3m'); // italic on
    });
  });

  describe('stylesMatch', () => {
    test('returns true for identical styles', () => {
      const a: Cell = {
        char: 'A',
        fg: '#fff',
        bg: '#000',
        bold: true,
        italic: false,
      };
      const b: Cell = {
        char: 'B', // char can differ
        fg: '#fff',
        bg: '#000',
        bold: true,
        italic: false,
      };
      expect(stylesMatch(a, b)).toBe(true);
    });

    test('returns false for different fg', () => {
      const a: Cell = { char: 'A', fg: '#fff', bg: '#000' };
      const b: Cell = { char: 'A', fg: '#f00', bg: '#000' };
      expect(stylesMatch(a, b)).toBe(false);
    });

    test('returns false for different bg', () => {
      const a: Cell = { char: 'A', fg: '#fff', bg: '#000' };
      const b: Cell = { char: 'A', fg: '#fff', bg: '#111' };
      expect(stylesMatch(a, b)).toBe(false);
    });

    test('returns false for different bold', () => {
      const a: Cell = { char: 'A', fg: '#fff', bg: '#000', bold: true };
      const b: Cell = { char: 'A', fg: '#fff', bg: '#000', bold: false };
      expect(stylesMatch(a, b)).toBe(false);
    });

    test('treats undefined and false as different', () => {
      const a: Cell = { char: 'A', fg: '#fff', bg: '#000' };
      const b: Cell = { char: 'A', fg: '#fff', bg: '#000', bold: false };
      expect(stylesMatch(a, b)).toBe(false);
    });
  });
});
