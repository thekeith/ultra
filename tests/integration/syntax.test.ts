/**
 * Syntax Service Integration Tests
 *
 * Tests syntax/* ECP methods via TestECPClient.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { TestECPClient } from '../helpers/ecp-client.ts';
import type { HighlightToken, SyntaxSession, SyntaxMetrics } from '../../src/services/syntax/types.ts';

describe('Syntax Service ECP Integration', () => {
  let client: TestECPClient;

  beforeEach(async () => {
    client = new TestECPClient();
    // Wait for syntax service to be ready
    await client.request('syntax/waitForReady');
  });

  afterEach(async () => {
    await client.shutdown();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Highlighting
  // ─────────────────────────────────────────────────────────────────────────

  describe('syntax/highlight', () => {
    test('highlights TypeScript code', async () => {
      const result = await client.request<{
        lines: HighlightToken[][];
        languageId: string;
        timing?: number;
      }>('syntax/highlight', {
        content: 'const x: number = 42;',
        languageId: 'typescript',
      });

      expect(result.languageId).toBe('typescript');
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].length).toBeGreaterThan(0);
    });

    test('highlights multi-line code', async () => {
      const result = await client.request<{
        lines: HighlightToken[][];
        languageId: string;
      }>('syntax/highlight', {
        content: `function add(a: number, b: number): number {
  return a + b;
}`,
        languageId: 'typescript',
      });

      expect(result.lines).toHaveLength(3);
    });

    test('supports theme override', async () => {
      const result = await client.request<{
        lines: HighlightToken[][];
        languageId: string;
      }>('syntax/highlight', {
        content: 'const x = 1;',
        languageId: 'typescript',
        theme: 'github-dark',
      });

      expect(result.languageId).toBe('typescript');
    });

    test('returns error for missing params', async () => {
      const response = await client.requestRaw('syntax/highlight', {
        content: 'test',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe('syntax/highlightLine', () => {
    test('highlights a single line', async () => {
      const result = await client.request<{ tokens: HighlightToken[] }>(
        'syntax/highlightLine',
        {
          content: `const a = 1;
const b = 2;
const c = 3;`,
          languageId: 'typescript',
          lineNumber: 1,
        }
      );

      expect(Array.isArray(result.tokens)).toBe(true);
      expect(result.tokens.length).toBeGreaterThan(0);
    });

    test('returns error for missing params', async () => {
      const response = await client.requestRaw('syntax/highlightLine', {
        content: 'test',
        languageId: 'typescript',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Sessions
  // ─────────────────────────────────────────────────────────────────────────

  describe('syntax/createSession', () => {
    test('creates a syntax session', async () => {
      const result = await client.request<{ session: SyntaxSession }>(
        'syntax/createSession',
        {
          documentId: 'doc-1',
          languageId: 'typescript',
          content: 'const x = 1;',
        }
      );

      expect(result.session).toBeDefined();
      expect(result.session.sessionId).toBeDefined();
      expect(result.session.documentId).toBe('doc-1');
      expect(result.session.languageId).toBe('typescript');
      expect(result.session.version).toBe(1);
    });

    test('returns error for missing params', async () => {
      const response = await client.requestRaw('syntax/createSession', {
        documentId: 'doc-1',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe('syntax/updateSession', () => {
    test('updates session content', async () => {
      const { session } = await client.request<{ session: SyntaxSession }>(
        'syntax/createSession',
        {
          documentId: 'doc-1',
          languageId: 'typescript',
          content: 'const x = 1;',
        }
      );

      const result = await client.request<{ success: boolean }>(
        'syntax/updateSession',
        {
          sessionId: session.sessionId,
          content: 'const x = 2;',
        }
      );

      expect(result.success).toBe(true);

      const { session: updated } = await client.request<{
        session: SyntaxSession | null;
      }>('syntax/getSession', { sessionId: session.sessionId });

      expect(updated?.version).toBe(2);
    });

    test('returns error for non-existent session', async () => {
      const response = await client.requestRaw('syntax/updateSession', {
        sessionId: 'non-existent',
        content: 'test',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32503); // SESSION_NOT_FOUND
    });
  });

  describe('syntax/getSessionTokens', () => {
    test('returns tokens for a line', async () => {
      const { session } = await client.request<{ session: SyntaxSession }>(
        'syntax/createSession',
        {
          documentId: 'doc-1',
          languageId: 'typescript',
          content: 'const x = 1;\nconst y = 2;',
        }
      );

      const result = await client.request<{ tokens: HighlightToken[] }>(
        'syntax/getSessionTokens',
        {
          sessionId: session.sessionId,
          lineNumber: 0,
        }
      );

      expect(Array.isArray(result.tokens)).toBe(true);
      expect(result.tokens.length).toBeGreaterThan(0);
    });

    test('returns error for missing params', async () => {
      const response = await client.requestRaw('syntax/getSessionTokens', {
        sessionId: 'some-id',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe('syntax/getSessionAllTokens', () => {
    test('returns all tokens', async () => {
      const { session } = await client.request<{ session: SyntaxSession }>(
        'syntax/createSession',
        {
          documentId: 'doc-1',
          languageId: 'typescript',
          content: 'const x = 1;\nconst y = 2;',
        }
      );

      const result = await client.request<{ lines: HighlightToken[][] }>(
        'syntax/getSessionAllTokens',
        { sessionId: session.sessionId }
      );

      expect(result.lines).toHaveLength(2);
      expect(result.lines[0].length).toBeGreaterThan(0);
    });

    test('returns error for missing sessionId', async () => {
      const response = await client.requestRaw('syntax/getSessionAllTokens', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe('syntax/disposeSession', () => {
    test('disposes a session', async () => {
      const { session } = await client.request<{ session: SyntaxSession }>(
        'syntax/createSession',
        {
          documentId: 'doc-1',
          languageId: 'typescript',
          content: 'const x = 1;',
        }
      );

      const result = await client.request<{ success: boolean }>(
        'syntax/disposeSession',
        { sessionId: session.sessionId }
      );

      expect(result.success).toBe(true);

      const { session: disposed } = await client.request<{
        session: SyntaxSession | null;
      }>('syntax/getSession', { sessionId: session.sessionId });

      expect(disposed).toBeNull();
    });
  });

  describe('syntax/getSession', () => {
    test('returns session info', async () => {
      const { session: created } = await client.request<{ session: SyntaxSession }>(
        'syntax/createSession',
        {
          documentId: 'doc-1',
          languageId: 'typescript',
          content: 'const x = 1;',
        }
      );

      const { session } = await client.request<{ session: SyntaxSession | null }>(
        'syntax/getSession',
        { sessionId: created.sessionId }
      );

      expect(session).not.toBeNull();
      expect(session?.sessionId).toBe(created.sessionId);
      expect(session?.documentId).toBe('doc-1');
    });

    test('returns null for non-existent session', async () => {
      const { session } = await client.request<{ session: SyntaxSession | null }>(
        'syntax/getSession',
        { sessionId: 'non-existent' }
      );

      expect(session).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Language Support
  // ─────────────────────────────────────────────────────────────────────────

  describe('syntax/languages', () => {
    test('returns supported languages', async () => {
      const result = await client.request<{ languages: string[] }>(
        'syntax/languages'
      );

      expect(Array.isArray(result.languages)).toBe(true);
      expect(result.languages.length).toBeGreaterThan(0);
      expect(result.languages).toContain('typescript');
      expect(result.languages).toContain('javascript');
      expect(result.languages).toContain('python');
    });
  });

  describe('syntax/isSupported', () => {
    test('returns true for supported language', async () => {
      const result = await client.request<{ supported: boolean }>(
        'syntax/isSupported',
        { languageId: 'typescript' }
      );

      expect(result.supported).toBe(true);
    });

    test('returns false for unsupported language', async () => {
      const result = await client.request<{ supported: boolean }>(
        'syntax/isSupported',
        { languageId: 'unknownlang' }
      );

      expect(result.supported).toBe(false);
    });

    test('returns error for missing languageId', async () => {
      const response = await client.requestRaw('syntax/isSupported', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe('syntax/detectLanguage', () => {
    test('detects TypeScript', async () => {
      const result = await client.request<{ languageId: string | null }>(
        'syntax/detectLanguage',
        { filePath: 'src/file.ts' }
      );

      expect(result.languageId).toBe('typescript');
    });

    test('detects JavaScript', async () => {
      const result = await client.request<{ languageId: string | null }>(
        'syntax/detectLanguage',
        { filePath: 'app.js' }
      );

      expect(result.languageId).toBe('javascript');
    });

    test('returns null for unknown extension', async () => {
      const result = await client.request<{ languageId: string | null }>(
        'syntax/detectLanguage',
        { filePath: 'file.xyz' }
      );

      expect(result.languageId).toBeNull();
    });

    test('returns error for missing filePath', async () => {
      const response = await client.requestRaw('syntax/detectLanguage', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Themes
  // ─────────────────────────────────────────────────────────────────────────

  describe('syntax/themes', () => {
    test('returns available themes', async () => {
      const result = await client.request<{ themes: string[] }>('syntax/themes');

      expect(Array.isArray(result.themes)).toBe(true);
      expect(result.themes.length).toBeGreaterThan(0);
      expect(result.themes).toContain('catppuccin-frappe');
      expect(result.themes).toContain('github-dark');
    });
  });

  describe('syntax/setTheme', () => {
    test('sets a valid theme', async () => {
      const result = await client.request<{ success: boolean }>(
        'syntax/setTheme',
        { theme: 'catppuccin-mocha' }
      );

      expect(result.success).toBe(true);

      const { theme } = await client.request<{ theme: string }>(
        'syntax/getTheme'
      );

      expect(theme).toBe('catppuccin-mocha');
    });

    test('returns error for invalid theme', async () => {
      const response = await client.requestRaw('syntax/setTheme', {
        theme: 'invalid-theme',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32502); // THEME_NOT_FOUND
    });

    test('returns error for missing theme', async () => {
      const response = await client.requestRaw('syntax/setTheme', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe('syntax/getTheme', () => {
    test('returns current theme', async () => {
      const result = await client.request<{ theme: string }>('syntax/getTheme');

      expect(typeof result.theme).toBe('string');
      expect(result.theme.length).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Metrics
  // ─────────────────────────────────────────────────────────────────────────

  describe('syntax/metrics', () => {
    test('returns metrics object', async () => {
      const result = await client.request<{ metrics: SyntaxMetrics }>(
        'syntax/metrics'
      );

      expect(result.metrics).toBeDefined();
      expect(result.metrics).toHaveProperty('parseCount');
      expect(result.metrics).toHaveProperty('cacheHits');
      expect(result.metrics).toHaveProperty('cacheMisses');
      expect(result.metrics).toHaveProperty('averageParseTime');
    });
  });

  describe('syntax/resetMetrics', () => {
    test('resets metrics', async () => {
      // Generate some metrics
      await client.request('syntax/highlight', {
        content: 'const x = 1;',
        languageId: 'typescript',
      });

      const result = await client.request<{ success: boolean }>(
        'syntax/resetMetrics'
      );

      expect(result.success).toBe(true);

      const { metrics } = await client.request<{ metrics: SyntaxMetrics }>(
        'syntax/metrics'
      );

      expect(metrics.parseCount).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Status
  // ─────────────────────────────────────────────────────────────────────────

  describe('syntax/isReady', () => {
    test('returns ready status', async () => {
      const result = await client.request<{ ready: boolean }>('syntax/isReady');

      expect(typeof result.ready).toBe('boolean');
      expect(result.ready).toBe(true);
    });
  });

  describe('syntax/waitForReady', () => {
    test('returns true when ready', async () => {
      const result = await client.request<{ ready: boolean }>(
        'syntax/waitForReady'
      );

      expect(result.ready).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Error Handling
  // ─────────────────────────────────────────────────────────────────────────

  describe('error handling', () => {
    test('returns method not found for unknown method', async () => {
      const response = await client.requestRaw('syntax/unknownMethod', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601);
      expect(response.error?.message).toContain('Method not found');
    });
  });
});
