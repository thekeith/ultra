/**
 * Terminal Service Integration Tests
 *
 * Tests terminal/* ECP methods via TestECPClient.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { TestECPClient } from '../helpers/ecp-client.ts';
import type { TerminalInfo, TerminalBuffer } from '../../src/services/terminal/types.ts';

describe('Terminal Service ECP Integration', () => {
  let client: TestECPClient;

  beforeEach(() => {
    client = new TestECPClient();
  });

  afterEach(async () => {
    await client.shutdown();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  describe('terminal/create', () => {
    test('creates a terminal with default options', async () => {
      const result = await client.request<{ terminalId: string }>(
        'terminal/create'
      );

      expect(result.terminalId).toBeDefined();
      expect(typeof result.terminalId).toBe('string');
    });

    test('creates a terminal with custom options', async () => {
      const result = await client.request<{ terminalId: string }>(
        'terminal/create',
        {
          cols: 120,
          rows: 40,
        }
      );

      expect(result.terminalId).toBeDefined();

      const { info } = await client.request<{ info: TerminalInfo | null }>(
        'terminal/getInfo',
        { terminalId: result.terminalId }
      );

      expect(info?.cols).toBe(120);
      expect(info?.rows).toBe(40);
    });

    test('creates multiple terminals', async () => {
      const { terminalId: id1 } = await client.request<{ terminalId: string }>(
        'terminal/create'
      );
      const { terminalId: id2 } = await client.request<{ terminalId: string }>(
        'terminal/create'
      );

      expect(id1).not.toBe(id2);

      const { terminals } = await client.request<{ terminals: TerminalInfo[] }>(
        'terminal/list'
      );

      expect(terminals).toHaveLength(2);
    });
  });

  describe('terminal/close', () => {
    test('closes a terminal', async () => {
      const { terminalId } = await client.request<{ terminalId: string }>(
        'terminal/create'
      );

      const result = await client.request<{ success: boolean }>(
        'terminal/close',
        { terminalId }
      );

      expect(result.success).toBe(true);

      const { exists } = await client.request<{ exists: boolean }>(
        'terminal/exists',
        { terminalId }
      );

      expect(exists).toBe(false);
    });

    test('returns error for missing terminalId', async () => {
      const response = await client.requestRaw('terminal/close', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe('terminal/closeAll', () => {
    test('closes all terminals', async () => {
      await client.request('terminal/create');
      await client.request('terminal/create');
      await client.request('terminal/create');

      const result = await client.request<{ success: boolean }>(
        'terminal/closeAll'
      );

      expect(result.success).toBe(true);

      const { terminals } = await client.request<{ terminals: TerminalInfo[] }>(
        'terminal/list'
      );

      expect(terminals).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('terminal/write', () => {
    test('writes data to terminal', async () => {
      const { terminalId } = await client.request<{ terminalId: string }>(
        'terminal/create'
      );

      const result = await client.request<{ success: boolean }>(
        'terminal/write',
        { terminalId, data: 'echo hello\n' }
      );

      expect(result.success).toBe(true);
    });

    test('returns error for non-existent terminal', async () => {
      const response = await client.requestRaw('terminal/write', {
        terminalId: 'non-existent',
        data: 'test',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32700); // TERMINAL_NOT_FOUND
    });

    test('returns error for missing params', async () => {
      const response = await client.requestRaw('terminal/write', {
        terminalId: 'some-id',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe('terminal/resize', () => {
    test('resizes a terminal', async () => {
      const { terminalId } = await client.request<{ terminalId: string }>(
        'terminal/create',
        { cols: 80, rows: 24 }
      );

      const result = await client.request<{ success: boolean }>(
        'terminal/resize',
        { terminalId, cols: 120, rows: 40 }
      );

      expect(result.success).toBe(true);

      const { info } = await client.request<{ info: TerminalInfo | null }>(
        'terminal/getInfo',
        { terminalId }
      );

      expect(info?.cols).toBe(120);
      expect(info?.rows).toBe(40);
    });

    test('returns error for non-existent terminal', async () => {
      const response = await client.requestRaw('terminal/resize', {
        terminalId: 'non-existent',
        cols: 80,
        rows: 24,
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32700);
    });

    test('returns error for missing params', async () => {
      const response = await client.requestRaw('terminal/resize', {
        terminalId: 'some-id',
        cols: 80,
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Buffer
  // ─────────────────────────────────────────────────────────────────────────

  describe('terminal/getBuffer', () => {
    test('returns buffer for existing terminal', async () => {
      const { terminalId } = await client.request<{ terminalId: string }>(
        'terminal/create',
        { cols: 80, rows: 24 }
      );

      const { buffer } = await client.request<{ buffer: TerminalBuffer | null }>(
        'terminal/getBuffer',
        { terminalId }
      );

      expect(buffer).not.toBeNull();
      expect(buffer?.cells).toBeDefined();
      expect(buffer?.cursor).toBeDefined();
      expect(buffer?.cells).toHaveLength(24);
      expect(buffer?.cells[0]).toHaveLength(80);
    });

    test('returns null for non-existent terminal', async () => {
      const { buffer } = await client.request<{ buffer: TerminalBuffer | null }>(
        'terminal/getBuffer',
        { terminalId: 'non-existent' }
      );

      expect(buffer).toBeNull();
    });

    test('returns error for missing terminalId', async () => {
      const response = await client.requestRaw('terminal/getBuffer', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe('terminal/scroll', () => {
    test('scrolls terminal view', async () => {
      const { terminalId } = await client.request<{ terminalId: string }>(
        'terminal/create'
      );

      const result = await client.request<{ success: boolean }>(
        'terminal/scroll',
        { terminalId, lines: 5 }
      );

      expect(result.success).toBe(true);
    });

    test('returns error for non-existent terminal', async () => {
      const response = await client.requestRaw('terminal/scroll', {
        terminalId: 'non-existent',
        lines: 5,
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32700);
    });
  });

  describe('terminal/scrollToBottom', () => {
    test('resets scroll position', async () => {
      const { terminalId } = await client.request<{ terminalId: string }>(
        'terminal/create'
      );

      // Scroll up first
      await client.request('terminal/scroll', { terminalId, lines: 10 });

      const result = await client.request<{ success: boolean }>(
        'terminal/scrollToBottom',
        { terminalId }
      );

      expect(result.success).toBe(true);

      const { buffer } = await client.request<{ buffer: TerminalBuffer | null }>(
        'terminal/getBuffer',
        { terminalId }
      );

      expect(buffer?.scrollOffset).toBe(0);
    });

    test('returns error for non-existent terminal', async () => {
      const response = await client.requestRaw('terminal/scrollToBottom', {
        terminalId: 'non-existent',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32700);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Info
  // ─────────────────────────────────────────────────────────────────────────

  describe('terminal/getInfo', () => {
    test('returns info for existing terminal', async () => {
      const { terminalId } = await client.request<{ terminalId: string }>(
        'terminal/create',
        { cols: 100, rows: 30 }
      );

      const { info } = await client.request<{ info: TerminalInfo | null }>(
        'terminal/getInfo',
        { terminalId }
      );

      expect(info).not.toBeNull();
      expect(info?.terminalId).toBe(terminalId);
      expect(info?.cols).toBe(100);
      expect(info?.rows).toBe(30);
      expect(info?.running).toBe(true);
      expect(info?.shell).toBeDefined();
      expect(info?.cwd).toBeDefined();
    });

    test('returns null for non-existent terminal', async () => {
      const { info } = await client.request<{ info: TerminalInfo | null }>(
        'terminal/getInfo',
        { terminalId: 'non-existent' }
      );

      expect(info).toBeNull();
    });

    test('returns error for missing terminalId', async () => {
      const response = await client.requestRaw('terminal/getInfo', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe('terminal/list', () => {
    test('returns empty array when no terminals', async () => {
      const { terminals } = await client.request<{ terminals: TerminalInfo[] }>(
        'terminal/list'
      );

      expect(terminals).toEqual([]);
    });

    test('returns all terminals', async () => {
      await client.request('terminal/create');
      await client.request('terminal/create');
      await client.request('terminal/create');

      const { terminals } = await client.request<{ terminals: TerminalInfo[] }>(
        'terminal/list'
      );

      expect(terminals).toHaveLength(3);
    });
  });

  describe('terminal/exists', () => {
    test('returns true for existing terminal', async () => {
      const { terminalId } = await client.request<{ terminalId: string }>(
        'terminal/create'
      );

      const { exists } = await client.request<{ exists: boolean }>(
        'terminal/exists',
        { terminalId }
      );

      expect(exists).toBe(true);
    });

    test('returns false for non-existent terminal', async () => {
      const { exists } = await client.request<{ exists: boolean }>(
        'terminal/exists',
        { terminalId: 'non-existent' }
      );

      expect(exists).toBe(false);
    });

    test('returns error for missing terminalId', async () => {
      const response = await client.requestRaw('terminal/exists', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe('terminal/isRunning', () => {
    test('returns true for running terminal', async () => {
      const { terminalId } = await client.request<{ terminalId: string }>(
        'terminal/create'
      );

      const { running } = await client.request<{ running: boolean }>(
        'terminal/isRunning',
        { terminalId }
      );

      expect(running).toBe(true);
    });

    test('returns false for non-existent terminal', async () => {
      const { running } = await client.request<{ running: boolean }>(
        'terminal/isRunning',
        { terminalId: 'non-existent' }
      );

      expect(running).toBe(false);
    });

    test('returns false for closed terminal', async () => {
      const { terminalId } = await client.request<{ terminalId: string }>(
        'terminal/create'
      );

      await client.request('terminal/close', { terminalId });

      const { running } = await client.request<{ running: boolean }>(
        'terminal/isRunning',
        { terminalId }
      );

      expect(running).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Error Handling
  // ─────────────────────────────────────────────────────────────────────────

  describe('error handling', () => {
    test('returns method not found for unknown method', async () => {
      const response = await client.requestRaw('terminal/unknownMethod', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601);
      expect(response.error?.message).toContain('Method not found');
    });
  });
});
