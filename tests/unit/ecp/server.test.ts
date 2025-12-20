/**
 * ECPServer Tests
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { ECPServer, createECPServer } from '../../../src/ecp/server.ts';
import { ECPErrorCodes } from '../../../src/ecp/types.ts';

describe('ECPServer', () => {
  let server: ECPServer;

  beforeEach(() => {
    server = createECPServer();
  });

  afterEach(async () => {
    await server.shutdown();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  describe('lifecycle', () => {
    test('starts in running state', () => {
      expect(server.state).toBe('running');
    });

    test('transitions to shutdown state', async () => {
      await server.shutdown();
      expect(server.state).toBe('shutdown');
    });

    test('shutdown is idempotent', async () => {
      await server.shutdown();
      await server.shutdown();
      expect(server.state).toBe('shutdown');
    });

    test('rejects requests after shutdown', async () => {
      await server.shutdown();

      const response = await server.requestRaw('document/open', {
        uri: 'memory://test.txt',
        content: 'hello',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(ECPErrorCodes.ServerShuttingDown);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Request Routing
  // ─────────────────────────────────────────────────────────────────────────

  describe('request routing', () => {
    test('routes document/* methods', async () => {
      const result = await server.request<{ documentId: string }>(
        'document/open',
        { uri: 'memory://test.txt', content: 'hello' }
      );

      expect(result.documentId).toBeDefined();
    });

    test('routes file/* methods', async () => {
      const result = await server.request<{ exists: boolean }>(
        'file/exists',
        { uri: 'file:///nonexistent/path' }
      );

      expect(result.exists).toBe(false);
    });

    test('routes git/* methods', async () => {
      const result = await server.request<{ isRepo: boolean }>(
        'git/isRepo',
        { uri: `file://${process.cwd()}` }
      );

      expect(typeof result.isRepo).toBe('boolean');
    });

    test('routes syntax/* methods', async () => {
      await server.request('syntax/waitForReady');

      const result = await server.request<{ languages: string[] }>(
        'syntax/languages'
      );

      expect(result.languages).toContain('typescript');
    });

    test('routes terminal/* methods', async () => {
      const result = await server.request<{ terminalId: string }>(
        'terminal/create'
      );

      expect(result.terminalId).toBeDefined();
    });

    test('returns method not found for unknown methods', async () => {
      const response = await server.requestRaw('unknown/method', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(ECPErrorCodes.MethodNotFound);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Request/Response
  // ─────────────────────────────────────────────────────────────────────────

  describe('request method', () => {
    test('returns result on success', async () => {
      const result = await server.request<{ documentId: string }>(
        'document/open',
        { uri: 'memory://test.txt', content: 'hello' }
      );

      expect(result.documentId).toBeDefined();
    });

    test('throws on error', async () => {
      await expect(
        server.request('document/content', { documentId: 'nonexistent' })
      ).rejects.toThrow();
    });
  });

  describe('requestRaw method', () => {
    test('returns success response', async () => {
      const response = await server.requestRaw('document/open', {
        uri: 'memory://test.txt',
        content: 'hello',
      });

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBeDefined();
      expect('result' in response).toBe(true);
    });

    test('returns error response', async () => {
      const response = await server.requestRaw('document/content', {
        documentId: 'nonexistent',
      });

      expect(response.jsonrpc).toBe('2.0');
      expect('error' in response).toBe(true);
      expect(response.error?.code).toBeDefined();
      expect(response.error?.message).toBeDefined();
    });

    test('increments request IDs', async () => {
      const response1 = await server.requestRaw('syntax/languages');
      const response2 = await server.requestRaw('syntax/languages');

      expect(response1.id).not.toBe(response2.id);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Notifications
  // ─────────────────────────────────────────────────────────────────────────

  describe('notifications', () => {
    test('subscribes to notifications', async () => {
      const notifications: { method: string; params: unknown }[] = [];

      const unsubscribe = server.onNotification((method, params) => {
        notifications.push({ method, params });
      });

      // Create a terminal which may emit notifications
      await server.request('terminal/create');

      // Wait a bit for potential notifications
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    test('unsubscribe stops notifications', async () => {
      let callCount = 0;

      const unsubscribe = server.onNotification(() => {
        callCount++;
      });

      unsubscribe();

      // Create a terminal
      await server.request('terminal/create');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should not have received notifications after unsubscribe
      expect(callCount).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Service Access
  // ─────────────────────────────────────────────────────────────────────────

  describe('getService', () => {
    test('returns document service', () => {
      const service = server.getService('document');
      expect(service).toBeDefined();
    });

    test('returns file service', () => {
      const service = server.getService('file');
      expect(service).toBeDefined();
    });

    test('returns git service', () => {
      const service = server.getService('git');
      expect(service).toBeDefined();
    });

    test('returns session service', () => {
      const service = server.getService('session');
      expect(service).toBeDefined();
    });

    test('returns lsp service', () => {
      const service = server.getService('lsp');
      expect(service).toBeDefined();
    });

    test('returns syntax service', () => {
      const service = server.getService('syntax');
      expect(service).toBeDefined();
    });

    test('returns terminal service', () => {
      const service = server.getService('terminal');
      expect(service).toBeDefined();
    });

    test('throws for unknown service', () => {
      expect(() => server.getService('unknown' as any)).toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Integration Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('integration', () => {
    test('document editing workflow', async () => {
      // Open document
      const { documentId } = await server.request<{ documentId: string }>(
        'document/open',
        { uri: 'memory://test.txt', content: 'hello' }
      );

      // Insert text
      await server.request('document/insert', {
        documentId,
        position: { line: 0, column: 5 },
        text: ' world',
      });

      // Get content
      const { content } = await server.request<{ content: string }>(
        'document/content',
        { documentId }
      );

      expect(content).toBe('hello world');

      // Close document
      await server.request('document/close', { documentId });
    });

    test('syntax highlighting workflow', async () => {
      // Wait for syntax service to be ready
      await server.request('syntax/waitForReady');

      // Highlight code
      const result = await server.request<{
        lines: unknown[][];
        languageId: string;
      }>('syntax/highlight', {
        content: 'const x: number = 42;',
        languageId: 'typescript',
      });

      expect(result.languageId).toBe('typescript');
      expect(result.lines.length).toBeGreaterThan(0);
    });

    test('terminal workflow', async () => {
      // Create terminal
      const { terminalId } = await server.request<{ terminalId: string }>(
        'terminal/create',
        { cols: 80, rows: 24 }
      );

      // Get info
      const { info } = await server.request<{ info: unknown }>(
        'terminal/getInfo',
        { terminalId }
      );

      expect(info).not.toBeNull();

      // Close terminal
      await server.request('terminal/close', { terminalId });
    });
  });
});

describe('createECPServer', () => {
  test('creates server with default options', async () => {
    const server = createECPServer();
    expect(server.state).toBe('running');
    await server.shutdown();
  });

  test('creates server with custom workspace root', async () => {
    const server = createECPServer({ workspaceRoot: '/tmp' });
    expect(server.state).toBe('running');
    await server.shutdown();
  });
});
