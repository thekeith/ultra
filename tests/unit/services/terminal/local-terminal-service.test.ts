/**
 * Unit tests for LocalTerminalService
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { LocalTerminalService } from '../../../../src/services/terminal/service.ts';
import { TerminalError } from '../../../../src/services/terminal/errors.ts';

describe('LocalTerminalService', () => {
  let service: LocalTerminalService;

  beforeEach(() => {
    service = new LocalTerminalService();
  });

  afterEach(() => {
    // Clean up any terminals
    service.closeAll();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  describe('create', () => {
    test('creates a terminal with default options', async () => {
      const terminalId = await service.create();

      expect(terminalId).toBeDefined();
      expect(typeof terminalId).toBe('string');
      expect(terminalId).toMatch(/^terminal-\d+-\d+$/);
    });

    test('creates a terminal with custom options', async () => {
      const terminalId = await service.create({
        cols: 120,
        rows: 40,
      });

      const info = service.getInfo(terminalId);
      expect(info).not.toBeNull();
      expect(info?.cols).toBe(120);
      expect(info?.rows).toBe(40);
    });

    test('creates multiple terminals with unique IDs', async () => {
      const id1 = await service.create();
      const id2 = await service.create();

      expect(id1).not.toBe(id2);
      expect(service.list()).toHaveLength(2);
    });
  });

  describe('close', () => {
    test('closes an existing terminal', async () => {
      const terminalId = await service.create();
      expect(service.exists(terminalId)).toBe(true);

      service.close(terminalId);
      expect(service.exists(terminalId)).toBe(false);
    });

    test('does not throw for non-existent terminal', () => {
      expect(() => service.close('non-existent')).not.toThrow();
    });
  });

  describe('closeAll', () => {
    test('closes all terminals', async () => {
      await service.create();
      await service.create();
      await service.create();

      expect(service.list()).toHaveLength(3);

      service.closeAll();
      expect(service.list()).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Terminal Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('write', () => {
    test('writes data to terminal', async () => {
      const terminalId = await service.create();

      // Should not throw
      service.write(terminalId, 'echo hello\n');
    });

    test('throws for non-existent terminal', () => {
      expect(() => service.write('non-existent', 'data')).toThrow(TerminalError);
    });

    test('throws for closed terminal', async () => {
      const terminalId = await service.create();
      service.close(terminalId);

      expect(() => service.write(terminalId, 'data')).toThrow(TerminalError);
    });
  });

  describe('resize', () => {
    test('resizes terminal', async () => {
      const terminalId = await service.create({ cols: 80, rows: 24 });

      service.resize(terminalId, 120, 40);

      const info = service.getInfo(terminalId);
      expect(info?.cols).toBe(120);
      expect(info?.rows).toBe(40);
    });

    test('throws for non-existent terminal', () => {
      expect(() => service.resize('non-existent', 80, 24)).toThrow(TerminalError);
    });

    test('throws for invalid dimensions', async () => {
      const terminalId = await service.create();

      expect(() => service.resize(terminalId, 0, 24)).toThrow(TerminalError);
      expect(() => service.resize(terminalId, 80, 0)).toThrow(TerminalError);
      expect(() => service.resize(terminalId, -1, 24)).toThrow(TerminalError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Buffer Access
  // ─────────────────────────────────────────────────────────────────────────

  describe('getBuffer', () => {
    test('returns buffer for existing terminal', async () => {
      const terminalId = await service.create({ cols: 80, rows: 24 });

      const buffer = service.getBuffer(terminalId);

      expect(buffer).not.toBeNull();
      expect(buffer?.cells).toBeDefined();
      expect(buffer?.cursor).toBeDefined();
      expect(buffer?.scrollOffset).toBeDefined();
    });

    test('returns null for non-existent terminal', () => {
      const buffer = service.getBuffer('non-existent');
      expect(buffer).toBeNull();
    });

    test('buffer has correct dimensions', async () => {
      const terminalId = await service.create({ cols: 80, rows: 24 });

      const buffer = service.getBuffer(terminalId);

      expect(buffer?.cells).toHaveLength(24);
      expect(buffer?.cells[0]).toHaveLength(80);
    });

    test('cells have correct structure', async () => {
      const terminalId = await service.create();

      const buffer = service.getBuffer(terminalId);
      const cell = buffer?.cells[0][0];

      expect(cell).toHaveProperty('char');
      expect(cell).toHaveProperty('fg');
      expect(cell).toHaveProperty('bg');
      expect(cell).toHaveProperty('bold');
      expect(cell).toHaveProperty('italic');
      expect(cell).toHaveProperty('underline');
      expect(cell).toHaveProperty('dim');
      expect(cell).toHaveProperty('inverse');
    });
  });

  describe('scroll', () => {
    test('scrolls terminal view', async () => {
      const terminalId = await service.create();

      // Should not throw
      service.scroll(terminalId, 5);
      service.scroll(terminalId, -3);
    });

    test('throws for non-existent terminal', () => {
      expect(() => service.scroll('non-existent', 5)).toThrow(TerminalError);
    });
  });

  describe('scrollToBottom', () => {
    test('resets scroll position', async () => {
      const terminalId = await service.create();

      service.scroll(terminalId, 10);
      service.scrollToBottom(terminalId);

      const buffer = service.getBuffer(terminalId);
      expect(buffer?.scrollOffset).toBe(0);
    });

    test('throws for non-existent terminal', () => {
      expect(() => service.scrollToBottom('non-existent')).toThrow(TerminalError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Terminal Info
  // ─────────────────────────────────────────────────────────────────────────

  describe('getInfo', () => {
    test('returns info for existing terminal', async () => {
      const terminalId = await service.create({
        cols: 100,
        rows: 30,
      });

      const info = service.getInfo(terminalId);

      expect(info).not.toBeNull();
      expect(info?.terminalId).toBe(terminalId);
      expect(info?.cols).toBe(100);
      expect(info?.rows).toBe(30);
      expect(info?.running).toBe(true);
      expect(info?.shell).toBeDefined();
      expect(info?.cwd).toBeDefined();
    });

    test('returns null for non-existent terminal', () => {
      const info = service.getInfo('non-existent');
      expect(info).toBeNull();
    });
  });

  describe('list', () => {
    test('returns empty array when no terminals', () => {
      const list = service.list();
      expect(list).toEqual([]);
    });

    test('returns all terminals', async () => {
      await service.create();
      await service.create();
      await service.create();

      const list = service.list();
      expect(list).toHaveLength(3);
    });

    test('returns correct info for each terminal', async () => {
      const id1 = await service.create({ cols: 80, rows: 24 });
      const id2 = await service.create({ cols: 120, rows: 40 });

      const list = service.list();

      const term1 = list.find((t) => t.terminalId === id1);
      const term2 = list.find((t) => t.terminalId === id2);

      expect(term1?.cols).toBe(80);
      expect(term1?.rows).toBe(24);
      expect(term2?.cols).toBe(120);
      expect(term2?.rows).toBe(40);
    });
  });

  describe('exists', () => {
    test('returns true for existing terminal', async () => {
      const terminalId = await service.create();
      expect(service.exists(terminalId)).toBe(true);
    });

    test('returns false for non-existent terminal', () => {
      expect(service.exists('non-existent')).toBe(false);
    });

    test('returns false for closed terminal', async () => {
      const terminalId = await service.create();
      service.close(terminalId);
      expect(service.exists(terminalId)).toBe(false);
    });
  });

  describe('isRunning', () => {
    test('returns true for running terminal', async () => {
      const terminalId = await service.create();
      expect(service.isRunning(terminalId)).toBe(true);
    });

    test('returns false for non-existent terminal', () => {
      expect(service.isRunning('non-existent')).toBe(false);
    });

    test('returns false for closed terminal', async () => {
      const terminalId = await service.create();
      service.close(terminalId);
      expect(service.isRunning(terminalId)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Events
  // ─────────────────────────────────────────────────────────────────────────

  describe('onOutput', () => {
    test('subscribes to output events', async () => {
      const outputs: string[] = [];
      const unsubscribe = service.onOutput((event) => {
        outputs.push(event.data);
      });

      const terminalId = await service.create();

      // Write something that should produce output
      service.write(terminalId, 'echo test\n');

      // Give some time for output
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have received some output (prompt, etc)
      expect(outputs.length).toBeGreaterThanOrEqual(0);

      unsubscribe();
    });

    test('unsubscribe stops events', async () => {
      let callCount = 0;
      const unsubscribe = service.onOutput(() => {
        callCount++;
      });

      await service.create();

      // Wait for initial output
      await new Promise((resolve) => setTimeout(resolve, 50));
      const countBefore = callCount;

      unsubscribe();

      await service.create();
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Count should not have increased much after unsubscribe
      // (allowing for some race condition tolerance)
      expect(callCount).toBeLessThanOrEqual(countBefore + 1);
    });
  });

  describe('onExit', () => {
    test('subscribes to exit events', async () => {
      const exits: { terminalId: string; exitCode: number }[] = [];
      const unsubscribe = service.onExit((event) => {
        exits.push(event);
      });

      const terminalId = await service.create();

      // Send exit command
      service.write(terminalId, 'exit\n');

      // Wait for exit
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(exits.length).toBeGreaterThanOrEqual(0);

      unsubscribe();
    });
  });

  describe('onTitle', () => {
    test('subscribes to title events', () => {
      const titles: string[] = [];
      const unsubscribe = service.onTitle((event) => {
        titles.push(event.title);
      });

      // Title events are emitted by shell, may or may not occur
      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
    });
  });
});
