/**
 * ScreenBuffer Tests
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  ScreenBuffer,
  createScreenBuffer,
} from '../../../../../src/clients/tui/rendering/buffer.ts';
import type { Cell, Rect } from '../../../../../src/clients/tui/types.ts';

describe('ScreenBuffer', () => {
  let buffer: ScreenBuffer;

  beforeEach(() => {
    buffer = new ScreenBuffer({ width: 80, height: 24 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────────────────────────────────────────

  describe('initialization', () => {
    test('creates buffer with correct size', () => {
      expect(buffer.getSize()).toEqual({ width: 80, height: 24 });
    });

    test('initializes cells with empty content', () => {
      const cell = buffer.get(0, 0);
      expect(cell?.char).toBe(' ');
      expect(cell?.fg).toBe('default');
      expect(cell?.bg).toBe('default');
    });

    test('marks all cells as dirty initially', () => {
      expect(buffer.isDirty(0, 0)).toBe(true);
      expect(buffer.isDirty(79, 23)).toBe(true);
      expect(buffer.getDirtyCount()).toBe(80 * 24);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Size Management
  // ─────────────────────────────────────────────────────────────────────────

  describe('resize', () => {
    test('changes buffer size', () => {
      buffer.resize({ width: 100, height: 30 });
      expect(buffer.getSize()).toEqual({ width: 100, height: 30 });
    });

    test('clears contents on resize', () => {
      buffer.set(0, 0, { char: 'X', fg: '#fff', bg: '#000' });
      buffer.resize({ width: 100, height: 30 });
      expect(buffer.get(0, 0)?.char).toBe(' ');
    });

    test('marks all cells dirty on resize', () => {
      buffer.clearDirty();
      buffer.resize({ width: 50, height: 20 });
      expect(buffer.getDirtyCount()).toBe(50 * 20);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Cell Access
  // ─────────────────────────────────────────────────────────────────────────

  describe('get/set', () => {
    test('get returns cell at position', () => {
      const cell: Cell = { char: 'A', fg: '#ff0000', bg: '#000000' };
      buffer.set(10, 5, cell);
      const retrieved = buffer.get(10, 5);
      expect(retrieved?.char).toBe('A');
      expect(retrieved?.fg).toBe('#ff0000');
      expect(retrieved?.bg).toBe('#000000');
    });

    test('get returns null for out of bounds', () => {
      expect(buffer.get(-1, 0)).toBeNull();
      expect(buffer.get(0, -1)).toBeNull();
      expect(buffer.get(80, 0)).toBeNull();
      expect(buffer.get(0, 24)).toBeNull();
    });

    test('set ignores out of bounds', () => {
      // Should not throw
      buffer.set(-1, 0, { char: 'X', fg: '#fff', bg: '#000' });
      buffer.set(0, -1, { char: 'X', fg: '#fff', bg: '#000' });
      buffer.set(100, 0, { char: 'X', fg: '#fff', bg: '#000' });
      buffer.set(0, 100, { char: 'X', fg: '#fff', bg: '#000' });
    });

    test('set marks cell as dirty', () => {
      buffer.clearDirty();
      buffer.set(5, 5, { char: 'X', fg: '#fff', bg: '#000' });
      expect(buffer.isDirty(5, 5)).toBe(true);
    });

    test('set does not mark dirty if unchanged', () => {
      const cell: Cell = { char: 'A', fg: '#fff', bg: '#000' };
      buffer.set(5, 5, cell);
      buffer.clearDirty();
      buffer.set(5, 5, { ...cell }); // Same content
      expect(buffer.isDirty(5, 5)).toBe(false);
    });

    test('setChar only changes character', () => {
      buffer.set(5, 5, { char: 'A', fg: '#ff0000', bg: '#000000', bold: true });
      buffer.clearDirty();
      buffer.setChar(5, 5, 'B');
      const cell = buffer.get(5, 5);
      expect(cell?.char).toBe('B');
      expect(cell?.fg).toBe('#ff0000');
      expect(cell?.bold).toBe(true);
      expect(buffer.isDirty(5, 5)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Bulk Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('clear', () => {
    test('clears buffer with defaults', () => {
      buffer.set(0, 0, { char: 'X', fg: '#fff', bg: '#000' });
      buffer.clear();
      const cell = buffer.get(0, 0);
      expect(cell?.char).toBe(' ');
      expect(cell?.fg).toBe('default');
      expect(cell?.bg).toBe('default');
    });

    test('clears buffer with custom colors', () => {
      buffer.clear('#000000', '#ffffff');
      const cell = buffer.get(0, 0);
      expect(cell?.bg).toBe('#000000');
      expect(cell?.fg).toBe('#ffffff');
    });

    test('marks changed cells as dirty', () => {
      buffer.set(0, 0, { char: 'X', fg: '#fff', bg: '#000' });
      buffer.clearDirty();
      buffer.clear();
      expect(buffer.isDirty(0, 0)).toBe(true);
    });
  });

  describe('writeString', () => {
    test('writes string at position', () => {
      buffer.writeString(5, 10, 'Hello', '#fff', '#000');
      expect(buffer.get(5, 10)?.char).toBe('H');
      expect(buffer.get(6, 10)?.char).toBe('e');
      expect(buffer.get(7, 10)?.char).toBe('l');
      expect(buffer.get(8, 10)?.char).toBe('l');
      expect(buffer.get(9, 10)?.char).toBe('o');
    });

    test('applies colors to all characters', () => {
      buffer.writeString(0, 0, 'ABC', '#ff0000', '#000000');
      expect(buffer.get(0, 0)?.fg).toBe('#ff0000');
      expect(buffer.get(1, 0)?.fg).toBe('#ff0000');
      expect(buffer.get(2, 0)?.fg).toBe('#ff0000');
    });

    test('applies style options', () => {
      buffer.writeString(0, 0, 'Bold', '#fff', '#000', { bold: true, italic: true });
      expect(buffer.get(0, 0)?.bold).toBe(true);
      expect(buffer.get(0, 0)?.italic).toBe(true);
    });

    test('clips at right edge', () => {
      const written = buffer.writeString(75, 0, 'HelloWorld', '#fff', '#000');
      expect(written).toBe(5); // Only 5 chars fit
      expect(buffer.get(79, 0)?.char).toBe('o');
      expect(buffer.get(80, 0)).toBeNull();
    });

    test('skips negative x positions', () => {
      buffer.writeString(-2, 0, 'Hello', '#fff', '#000');
      expect(buffer.get(0, 0)?.char).toBe('l');
      expect(buffer.get(1, 0)?.char).toBe('l');
      expect(buffer.get(2, 0)?.char).toBe('o');
    });

    test('returns characters written', () => {
      const written = buffer.writeString(0, 0, 'Test', '#fff', '#000');
      expect(written).toBe(4);
    });
  });

  describe('fillRect', () => {
    test('fills rectangle with cell', () => {
      const cell: Cell = { char: '#', fg: '#fff', bg: '#000' };
      buffer.fillRect({ x: 5, y: 5, width: 10, height: 5 }, cell);

      expect(buffer.get(5, 5)?.char).toBe('#');
      expect(buffer.get(14, 9)?.char).toBe('#');
      expect(buffer.get(4, 5)?.char).toBe(' '); // Outside
      expect(buffer.get(15, 5)?.char).toBe(' '); // Outside
    });
  });

  describe('clearRect', () => {
    test('clears rectangle with empty cells', () => {
      buffer.set(5, 5, { char: 'X', fg: '#fff', bg: '#000' });
      buffer.clearRect({ x: 0, y: 0, width: 10, height: 10 });
      expect(buffer.get(5, 5)?.char).toBe(' ');
    });

    test('uses custom colors', () => {
      buffer.clearRect({ x: 0, y: 0, width: 5, height: 5 }, '#111', '#222');
      expect(buffer.get(2, 2)?.bg).toBe('#111');
      expect(buffer.get(2, 2)?.fg).toBe('#222');
    });
  });

  describe('drawBox', () => {
    test('draws single-style box', () => {
      buffer.drawBox({ x: 0, y: 0, width: 10, height: 5 }, '#fff', '#000', 'single');

      expect(buffer.get(0, 0)?.char).toBe('┌');
      expect(buffer.get(9, 0)?.char).toBe('┐');
      expect(buffer.get(0, 4)?.char).toBe('└');
      expect(buffer.get(9, 4)?.char).toBe('┘');
      expect(buffer.get(5, 0)?.char).toBe('─');
      expect(buffer.get(0, 2)?.char).toBe('│');
    });

    test('draws rounded-style box', () => {
      buffer.drawBox({ x: 0, y: 0, width: 5, height: 3 }, '#fff', '#000', 'rounded');
      expect(buffer.get(0, 0)?.char).toBe('╭');
      expect(buffer.get(4, 0)?.char).toBe('╮');
    });

    test('draws double-style box', () => {
      buffer.drawBox({ x: 0, y: 0, width: 5, height: 3 }, '#fff', '#000', 'double');
      expect(buffer.get(0, 0)?.char).toBe('╔');
      expect(buffer.get(4, 0)?.char).toBe('╗');
      expect(buffer.get(2, 0)?.char).toBe('═');
    });

    test('handles boxes too small', () => {
      // Should not throw, just skip drawing
      buffer.drawBox({ x: 0, y: 0, width: 1, height: 1 }, '#fff', '#000');
      buffer.drawBox({ x: 0, y: 0, width: 0, height: 0 }, '#fff', '#000');
    });
  });

  describe('drawHLine/drawVLine', () => {
    test('draws horizontal line', () => {
      buffer.drawHLine(5, 10, 10, '#fff', '#000');
      expect(buffer.get(5, 10)?.char).toBe('─');
      expect(buffer.get(14, 10)?.char).toBe('─');
      expect(buffer.get(4, 10)?.char).toBe(' ');
    });

    test('draws vertical line', () => {
      buffer.drawVLine(10, 5, 5, '#fff', '#000');
      expect(buffer.get(10, 5)?.char).toBe('│');
      expect(buffer.get(10, 9)?.char).toBe('│');
      expect(buffer.get(10, 4)?.char).toBe(' ');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Dirty Tracking
  // ─────────────────────────────────────────────────────────────────────────

  describe('dirty tracking', () => {
    test('isDirty returns false for out of bounds', () => {
      expect(buffer.isDirty(-1, 0)).toBe(false);
      expect(buffer.isDirty(100, 0)).toBe(false);
    });

    test('markDirty marks region', () => {
      buffer.clearDirty();
      buffer.markDirty({ x: 5, y: 5, width: 10, height: 5 });
      expect(buffer.isDirty(5, 5)).toBe(true);
      expect(buffer.isDirty(14, 9)).toBe(true);
      expect(buffer.isDirty(4, 5)).toBe(false);
      expect(buffer.getDirtyCount()).toBe(50);
    });

    test('markAllDirty marks entire buffer', () => {
      buffer.clearDirty();
      buffer.markAllDirty();
      expect(buffer.getDirtyCount()).toBe(80 * 24);
    });

    test('clearDirty clears all flags', () => {
      buffer.clearDirty();
      expect(buffer.getDirtyCount()).toBe(0);
      expect(buffer.hasDirty()).toBe(false);
    });

    test('getDirtyCells returns all dirty cells', () => {
      buffer.clearDirty();
      buffer.set(0, 0, { char: 'A', fg: '#fff', bg: '#000' });
      buffer.set(1, 0, { char: 'B', fg: '#fff', bg: '#000' });

      const dirty = buffer.getDirtyCells();
      expect(dirty.length).toBe(2);
      expect(dirty[0]).toEqual({ x: 0, y: 0, cell: expect.objectContaining({ char: 'A' }) });
      expect(dirty[1]).toEqual({ x: 1, y: 0, cell: expect.objectContaining({ char: 'B' }) });
    });

    test('hasDirty returns correct state', () => {
      buffer.clearDirty();
      expect(buffer.hasDirty()).toBe(false);

      buffer.set(0, 0, { char: 'X', fg: '#fff', bg: '#000' });
      expect(buffer.hasDirty()).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Iteration
  // ─────────────────────────────────────────────────────────────────────────

  describe('iteration', () => {
    test('iterateRect yields cells in region', () => {
      buffer.set(5, 5, { char: 'A', fg: '#fff', bg: '#000' });
      buffer.set(6, 5, { char: 'B', fg: '#fff', bg: '#000' });

      const cells: Array<{ x: number; y: number; cell: Cell }> = [];
      for (const item of buffer.iterateRect({ x: 5, y: 5, width: 2, height: 1 })) {
        cells.push(item);
      }

      expect(cells.length).toBe(2);
      expect(cells[0].cell.char).toBe('A');
      expect(cells[1].cell.char).toBe('B');
    });

    test('iterateAll yields all cells', () => {
      const smallBuffer = new ScreenBuffer({ width: 3, height: 2 });
      const cells = [...smallBuffer.iterateAll()];
      expect(cells.length).toBe(6);
      expect(cells[0]).toEqual({ x: 0, y: 0, cell: expect.any(Object) });
      expect(cells[5]).toEqual({ x: 2, y: 1, cell: expect.any(Object) });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Factory
  // ─────────────────────────────────────────────────────────────────────────

  describe('createScreenBuffer', () => {
    test('creates buffer with size', () => {
      const buf = createScreenBuffer({ width: 100, height: 50 });
      expect(buf.getSize()).toEqual({ width: 100, height: 50 });
    });
  });
});
