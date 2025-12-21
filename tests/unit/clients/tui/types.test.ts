/**
 * TUI Types Tests
 */

import { describe, test, expect } from 'bun:test';
import {
  isKeyEvent,
  isMouseEvent,
  isSplitConfig,
  isPaneConfig,
  containsPoint,
  rectsIntersect,
  rectIntersection,
  createEmptyCell,
  cloneCell,
  cellsEqual,
  type KeyEvent,
  type MouseEvent,
  type Rect,
  type Cell,
  type PaneConfig,
  type SplitConfig,
} from '../../../../src/clients/tui/types.ts';

describe('TUI Types', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Type Guards
  // ─────────────────────────────────────────────────────────────────────────

  describe('isKeyEvent', () => {
    test('returns true for key events', () => {
      const event: KeyEvent = {
        key: 'a',
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
      };
      expect(isKeyEvent(event)).toBe(true);
    });

    test('returns false for mouse events', () => {
      const event: MouseEvent = {
        type: 'press',
        button: 'left',
        x: 0,
        y: 0,
        ctrl: false,
        alt: false,
        shift: false,
      };
      expect(isKeyEvent(event)).toBe(false);
    });
  });

  describe('isMouseEvent', () => {
    test('returns true for mouse events', () => {
      const event: MouseEvent = {
        type: 'press',
        button: 'left',
        x: 10,
        y: 20,
        ctrl: false,
        alt: false,
        shift: false,
      };
      expect(isMouseEvent(event)).toBe(true);
    });

    test('returns false for key events', () => {
      const event: KeyEvent = {
        key: 'Enter',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };
      expect(isMouseEvent(event)).toBe(false);
    });
  });

  describe('isSplitConfig', () => {
    test('returns true for split config', () => {
      const config: SplitConfig = {
        id: 'split-1',
        direction: 'vertical',
        children: [],
        ratios: [0.5, 0.5],
      };
      expect(isSplitConfig(config)).toBe(true);
    });

    test('returns false for pane config', () => {
      const config: PaneConfig = {
        id: 'pane-1',
        mode: 'tabs',
        elements: [],
      };
      expect(isSplitConfig(config)).toBe(false);
    });
  });

  describe('isPaneConfig', () => {
    test('returns true for pane config', () => {
      const config: PaneConfig = {
        id: 'pane-1',
        mode: 'accordion',
        elements: [],
        expandedElementIds: ['el-1'],
      };
      expect(isPaneConfig(config)).toBe(true);
    });

    test('returns false for split config', () => {
      const config: SplitConfig = {
        id: 'split-1',
        direction: 'horizontal',
        children: [],
        ratios: [0.3, 0.7],
      };
      expect(isPaneConfig(config)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Geometry Utilities
  // ─────────────────────────────────────────────────────────────────────────

  describe('containsPoint', () => {
    const rect: Rect = { x: 10, y: 20, width: 30, height: 40 };

    test('returns true for point inside rect', () => {
      expect(containsPoint(rect, 15, 25)).toBe(true);
      expect(containsPoint(rect, 10, 20)).toBe(true); // Top-left corner
      expect(containsPoint(rect, 39, 59)).toBe(true); // Just inside bottom-right
    });

    test('returns false for point outside rect', () => {
      expect(containsPoint(rect, 9, 20)).toBe(false); // Left of rect
      expect(containsPoint(rect, 10, 19)).toBe(false); // Above rect
      expect(containsPoint(rect, 40, 20)).toBe(false); // Right edge (exclusive)
      expect(containsPoint(rect, 10, 60)).toBe(false); // Bottom edge (exclusive)
    });

    test('handles zero-origin rect', () => {
      const zeroRect: Rect = { x: 0, y: 0, width: 10, height: 10 };
      expect(containsPoint(zeroRect, 0, 0)).toBe(true);
      expect(containsPoint(zeroRect, 9, 9)).toBe(true);
      expect(containsPoint(zeroRect, 10, 10)).toBe(false);
    });
  });

  describe('rectsIntersect', () => {
    test('returns true for overlapping rects', () => {
      const a: Rect = { x: 0, y: 0, width: 10, height: 10 };
      const b: Rect = { x: 5, y: 5, width: 10, height: 10 };
      expect(rectsIntersect(a, b)).toBe(true);
    });

    test('returns true for one rect inside another', () => {
      const outer: Rect = { x: 0, y: 0, width: 100, height: 100 };
      const inner: Rect = { x: 10, y: 10, width: 20, height: 20 };
      expect(rectsIntersect(outer, inner)).toBe(true);
      expect(rectsIntersect(inner, outer)).toBe(true);
    });

    test('returns false for adjacent rects (touching edges)', () => {
      const a: Rect = { x: 0, y: 0, width: 10, height: 10 };
      const b: Rect = { x: 10, y: 0, width: 10, height: 10 };
      expect(rectsIntersect(a, b)).toBe(false);
    });

    test('returns false for separated rects', () => {
      const a: Rect = { x: 0, y: 0, width: 10, height: 10 };
      const b: Rect = { x: 20, y: 20, width: 10, height: 10 };
      expect(rectsIntersect(a, b)).toBe(false);
    });
  });

  describe('rectIntersection', () => {
    test('returns intersection for overlapping rects', () => {
      const a: Rect = { x: 0, y: 0, width: 10, height: 10 };
      const b: Rect = { x: 5, y: 5, width: 10, height: 10 };
      const result = rectIntersection(a, b);
      expect(result).toEqual({ x: 5, y: 5, width: 5, height: 5 });
    });

    test('returns inner rect when one is inside another', () => {
      const outer: Rect = { x: 0, y: 0, width: 100, height: 100 };
      const inner: Rect = { x: 10, y: 10, width: 20, height: 20 };
      const result = rectIntersection(outer, inner);
      expect(result).toEqual(inner);
    });

    test('returns null for non-intersecting rects', () => {
      const a: Rect = { x: 0, y: 0, width: 10, height: 10 };
      const b: Rect = { x: 20, y: 20, width: 10, height: 10 };
      expect(rectIntersection(a, b)).toBeNull();
    });

    test('returns null for adjacent rects', () => {
      const a: Rect = { x: 0, y: 0, width: 10, height: 10 };
      const b: Rect = { x: 10, y: 0, width: 10, height: 10 };
      expect(rectIntersection(a, b)).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Cell Utilities
  // ─────────────────────────────────────────────────────────────────────────

  describe('createEmptyCell', () => {
    test('creates cell with defaults', () => {
      const cell = createEmptyCell();
      expect(cell.char).toBe(' ');
      expect(cell.fg).toBe('default');
      expect(cell.bg).toBe('default');
    });

    test('creates cell with custom colors', () => {
      const cell = createEmptyCell('#000000', '#ffffff');
      expect(cell.char).toBe(' ');
      expect(cell.bg).toBe('#000000');
      expect(cell.fg).toBe('#ffffff');
    });
  });

  describe('cloneCell', () => {
    test('creates independent copy', () => {
      const original: Cell = {
        char: 'A',
        fg: '#ff0000',
        bg: '#000000',
        bold: true,
        italic: true,
      };
      const clone = cloneCell(original);

      expect(clone).toEqual(original);
      expect(clone).not.toBe(original);

      // Modify clone, original should be unchanged
      clone.char = 'B';
      expect(original.char).toBe('A');
    });
  });

  describe('cellsEqual', () => {
    test('returns true for identical cells', () => {
      const a: Cell = {
        char: 'X',
        fg: '#fff',
        bg: '#000',
        bold: true,
        italic: false,
        underline: true,
      };
      const b: Cell = {
        char: 'X',
        fg: '#fff',
        bg: '#000',
        bold: true,
        italic: false,
        underline: true,
      };
      expect(cellsEqual(a, b)).toBe(true);
    });

    test('returns false for different chars', () => {
      const a: Cell = { char: 'A', fg: '#fff', bg: '#000' };
      const b: Cell = { char: 'B', fg: '#fff', bg: '#000' };
      expect(cellsEqual(a, b)).toBe(false);
    });

    test('returns false for different colors', () => {
      const a: Cell = { char: 'A', fg: '#fff', bg: '#000' };
      const b: Cell = { char: 'A', fg: '#f00', bg: '#000' };
      expect(cellsEqual(a, b)).toBe(false);
    });

    test('returns false for different styles', () => {
      const a: Cell = { char: 'A', fg: '#fff', bg: '#000', bold: true };
      const b: Cell = { char: 'A', fg: '#fff', bg: '#000', bold: false };
      expect(cellsEqual(a, b)).toBe(false);
    });

    test('treats undefined and false as different for styles', () => {
      const a: Cell = { char: 'A', fg: '#fff', bg: '#000' };
      const b: Cell = { char: 'A', fg: '#fff', bg: '#000', bold: false };
      // undefined !== false
      expect(cellsEqual(a, b)).toBe(false);
    });
  });
});
