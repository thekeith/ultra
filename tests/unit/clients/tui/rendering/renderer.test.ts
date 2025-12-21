/**
 * Renderer Tests
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
  Renderer,
  createRenderer,
  createTestRenderer,
} from '../../../../../src/clients/tui/rendering/renderer.ts';

describe('Renderer', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Test Renderer Factory
  // ─────────────────────────────────────────────────────────────────────────

  describe('createTestRenderer', () => {
    test('creates renderer with output capture', () => {
      const { renderer, getOutput } = createTestRenderer({ width: 80, height: 24 });
      expect(renderer).toBeInstanceOf(Renderer);
      expect(getOutput()).toBe('');
    });

    test('captures output', () => {
      const { renderer, getOutput } = createTestRenderer({ width: 80, height: 24 });
      renderer.initialize();
      const output = getOutput();
      expect(output.length).toBeGreaterThan(0);
    });

    test('clearOutput clears captured data', () => {
      const { renderer, getOutput, clearOutput } = createTestRenderer({ width: 80, height: 24 });
      renderer.initialize();
      expect(getOutput().length).toBeGreaterThan(0);
      clearOutput();
      expect(getOutput()).toBe('');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  describe('lifecycle', () => {
    test('initialize sets up terminal', () => {
      const { renderer, getOutput } = createTestRenderer({ width: 80, height: 24 });

      expect(renderer.isInitialized()).toBe(false);
      renderer.initialize();
      expect(renderer.isInitialized()).toBe(true);

      const output = getOutput();
      // Should contain cursor hide sequence
      expect(output).toContain('\x1b[?25l');
      // Should contain clear screen
      expect(output).toContain('\x1b[2J');
    });

    test('initialize is idempotent', () => {
      const { renderer, getOutput, clearOutput } = createTestRenderer({ width: 80, height: 24 });

      renderer.initialize();
      const firstOutput = getOutput();
      clearOutput();

      renderer.initialize();
      expect(getOutput()).toBe(''); // No additional output
    });

    test('cleanup restores terminal', () => {
      const { renderer, getOutput, clearOutput } = createTestRenderer({ width: 80, height: 24 });

      renderer.initialize();
      clearOutput();
      renderer.cleanup();

      const output = getOutput();
      // Should contain cursor show sequence
      expect(output).toContain('\x1b[?25h');
      // Should contain reset
      expect(output).toContain('\x1b[0m');
      expect(renderer.isInitialized()).toBe(false);
    });

    test('cleanup is idempotent', () => {
      const { renderer, getOutput, clearOutput } = createTestRenderer({ width: 80, height: 24 });

      renderer.initialize();
      renderer.cleanup();
      clearOutput();

      renderer.cleanup();
      expect(getOutput()).toBe(''); // No additional output
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Size Management
  // ─────────────────────────────────────────────────────────────────────────

  describe('size management', () => {
    test('getSize returns current size', () => {
      const { renderer } = createTestRenderer({ width: 100, height: 50 });
      expect(renderer.getSize()).toEqual({ width: 100, height: 50 });
    });

    test('resize updates size and buffer', () => {
      const { renderer } = createTestRenderer({ width: 80, height: 24 });
      renderer.resize({ width: 120, height: 40 });

      expect(renderer.getSize()).toEqual({ width: 120, height: 40 });
      expect(renderer.getBuffer().getSize()).toEqual({ width: 120, height: 40 });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Buffer Access
  // ─────────────────────────────────────────────────────────────────────────

  describe('buffer access', () => {
    test('getBuffer returns screen buffer', () => {
      const { renderer } = createTestRenderer({ width: 80, height: 24 });
      const buffer = renderer.getBuffer();
      expect(buffer.getSize()).toEqual({ width: 80, height: 24 });
    });

    test('buffer can be modified', () => {
      const { renderer } = createTestRenderer({ width: 80, height: 24 });
      const buffer = renderer.getBuffer();
      buffer.set(0, 0, { char: 'X', fg: '#fff', bg: '#000' });
      expect(buffer.get(0, 0)?.char).toBe('X');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────────────────

  describe('flush', () => {
    test('outputs nothing when no dirty cells', () => {
      const { renderer, getOutput, clearOutput } = createTestRenderer({ width: 80, height: 24 });
      renderer.getBuffer().clearDirty();
      clearOutput();

      renderer.flush();
      expect(getOutput()).toBe('');
    });

    test('outputs dirty cells', () => {
      const { renderer, getOutput, clearOutput } = createTestRenderer({ width: 80, height: 24 });
      const buffer = renderer.getBuffer();
      buffer.clearDirty();
      clearOutput();

      buffer.set(0, 0, { char: 'A', fg: '#ffffff', bg: '#000000' });
      renderer.flush();

      const output = getOutput();
      // Should contain cursor position
      expect(output).toContain('\x1b[1;1H'); // 0,0 -> 1,1 in ANSI
      // Should contain the character
      expect(output).toContain('A');
      // Should contain color codes
      expect(output).toContain('\x1b[38;2;255;255;255m'); // fg
      expect(output).toContain('\x1b[48;2;0;0;0m'); // bg
    });

    test('clears dirty flags after flush', () => {
      const { renderer } = createTestRenderer({ width: 80, height: 24 });
      const buffer = renderer.getBuffer();
      buffer.set(0, 0, { char: 'X', fg: '#fff', bg: '#000' });

      expect(buffer.hasDirty()).toBe(true);
      renderer.flush();
      expect(buffer.hasDirty()).toBe(false);
    });

    test('optimizes adjacent cells', () => {
      const { renderer, getOutput, clearOutput } = createTestRenderer({ width: 80, height: 24 });
      const buffer = renderer.getBuffer();
      buffer.clearDirty();
      clearOutput();

      // Write adjacent cells with same style
      buffer.set(0, 0, { char: 'A', fg: '#fff', bg: '#000' });
      buffer.set(1, 0, { char: 'B', fg: '#fff', bg: '#000' });
      buffer.set(2, 0, { char: 'C', fg: '#fff', bg: '#000' });
      renderer.flush();

      const output = getOutput();
      // Should only have one cursor position command
      const cursorMatches = output.match(/\x1b\[\d+;\d+H/g);
      expect(cursorMatches?.length).toBe(1);
    });

    test('moves cursor for non-adjacent cells', () => {
      const { renderer, getOutput, clearOutput } = createTestRenderer({ width: 80, height: 24 });
      const buffer = renderer.getBuffer();
      buffer.clearDirty();
      clearOutput();

      buffer.set(0, 0, { char: 'A', fg: '#fff', bg: '#000' });
      buffer.set(10, 5, { char: 'B', fg: '#fff', bg: '#000' });
      renderer.flush();

      const output = getOutput();
      // Should have two cursor position commands
      const cursorMatches = output.match(/\x1b\[\d+;\d+H/g);
      expect(cursorMatches?.length).toBe(2);
    });
  });

  describe('fullRedraw', () => {
    test('marks all cells dirty and flushes', () => {
      const { renderer, getOutput, clearOutput } = createTestRenderer({ width: 10, height: 5 });
      renderer.getBuffer().clearDirty();
      clearOutput();

      renderer.fullRedraw();

      // Should have output for all cells
      const output = getOutput();
      expect(output.length).toBeGreaterThan(0);
      expect(renderer.getBuffer().hasDirty()).toBe(false);
    });
  });

  describe('renderRegion', () => {
    test('marks and flushes specific region', () => {
      const { renderer, getOutput, clearOutput } = createTestRenderer({ width: 80, height: 24 });
      const buffer = renderer.getBuffer();
      buffer.clearDirty();
      clearOutput();

      // Set cells in region
      buffer.set(5, 5, { char: 'X', fg: '#fff', bg: '#000' });

      renderer.renderRegion(5, 5, 10, 5);

      expect(getOutput()).toContain('X');
      expect(buffer.hasDirty()).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Cursor Control
  // ─────────────────────────────────────────────────────────────────────────

  describe('cursor control', () => {
    test('showCursor outputs position and show', () => {
      const { renderer, getOutput, clearOutput } = createTestRenderer({ width: 80, height: 24 });
      clearOutput();

      renderer.showCursor(10, 5);

      const output = getOutput();
      expect(output).toContain('\x1b[6;11H'); // y=5 -> 6, x=10 -> 11
      expect(output).toContain('\x1b[?25h'); // show cursor
    });

    test('hideCursor outputs hide sequence', () => {
      const { renderer, getOutput, clearOutput } = createTestRenderer({ width: 80, height: 24 });
      clearOutput();

      renderer.hideCursor();

      expect(getOutput()).toContain('\x1b[?25l');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Style Optimization
  // ─────────────────────────────────────────────────────────────────────────

  describe('style optimization', () => {
    test('does not repeat unchanged styles', () => {
      const { renderer, getOutput, clearOutput } = createTestRenderer({ width: 80, height: 24 });
      const buffer = renderer.getBuffer();
      buffer.clearDirty();
      clearOutput();

      // Write cells with same style
      buffer.set(0, 0, { char: 'A', fg: '#ff0000', bg: '#000000' });
      buffer.set(1, 0, { char: 'B', fg: '#ff0000', bg: '#000000' });
      renderer.flush();

      const output = getOutput();
      // Count fg color sequences - should only appear once
      const fgMatches = output.match(/\x1b\[38;2;255;0;0m/g);
      expect(fgMatches?.length).toBe(1);
    });

    test('applies style changes when needed', () => {
      const { renderer, getOutput, clearOutput } = createTestRenderer({ width: 80, height: 24 });
      const buffer = renderer.getBuffer();
      buffer.clearDirty();
      clearOutput();

      // Write cells with different styles
      buffer.set(0, 0, { char: 'A', fg: '#ff0000', bg: '#000000' });
      buffer.set(1, 0, { char: 'B', fg: '#00ff00', bg: '#000000' });
      renderer.flush();

      const output = getOutput();
      // Should have both color sequences
      expect(output).toContain('\x1b[38;2;255;0;0m'); // red
      expect(output).toContain('\x1b[38;2;0;255;0m'); // green
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Options
  // ─────────────────────────────────────────────────────────────────────────

  describe('options', () => {
    test('alternateScreen option controls alternate buffer', () => {
      let output = '';
      const withAlt = new Renderer({ width: 80, height: 24 }, {
        output: (data) => { output = data; },
        alternateScreen: true,
        mouseTracking: false,
        bracketedPaste: false,
      });
      withAlt.initialize();
      expect(output).toContain('\x1b[?1049h');

      output = '';
      const withoutAlt = new Renderer({ width: 80, height: 24 }, {
        output: (data) => { output = data; },
        alternateScreen: false,
        mouseTracking: false,
        bracketedPaste: false,
      });
      withoutAlt.initialize();
      expect(output).not.toContain('\x1b[?1049h');
    });

    test('mouseTracking option controls mouse mode', () => {
      let output = '';
      const withMouse = new Renderer({ width: 80, height: 24 }, {
        output: (data) => { output = data; },
        alternateScreen: false,
        mouseTracking: true,
        bracketedPaste: false,
      });
      withMouse.initialize();
      expect(output).toContain('\x1b[?1002h'); // button tracking
      expect(output).toContain('\x1b[?1006h'); // SGR mode

      output = '';
      const withoutMouse = new Renderer({ width: 80, height: 24 }, {
        output: (data) => { output = data; },
        alternateScreen: false,
        mouseTracking: false,
        bracketedPaste: false,
      });
      withoutMouse.initialize();
      expect(output).not.toContain('\x1b[?1002h');
    });

    test('bracketedPaste option controls paste mode', () => {
      let output = '';
      const withPaste = new Renderer({ width: 80, height: 24 }, {
        output: (data) => { output = data; },
        alternateScreen: false,
        mouseTracking: false,
        bracketedPaste: true,
      });
      withPaste.initialize();
      expect(output).toContain('\x1b[?2004h');

      output = '';
      const withoutPaste = new Renderer({ width: 80, height: 24 }, {
        output: (data) => { output = data; },
        alternateScreen: false,
        mouseTracking: false,
        bracketedPaste: false,
      });
      withoutPaste.initialize();
      expect(output).not.toContain('\x1b[?2004h');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Factory
  // ─────────────────────────────────────────────────────────────────────────

  describe('createRenderer', () => {
    test('creates renderer with size', () => {
      let captured = '';
      const renderer = createRenderer({ width: 100, height: 50 }, {
        output: (data) => { captured += data; },
      });
      expect(renderer.getSize()).toEqual({ width: 100, height: 50 });
    });
  });
});
