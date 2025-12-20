/**
 * Unit tests for LocalSyntaxService
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { LocalSyntaxService } from '../../../../src/services/syntax/service.ts';
import { SyntaxError } from '../../../../src/services/syntax/errors.ts';

describe('LocalSyntaxService', () => {
  let service: LocalSyntaxService;

  beforeEach(() => {
    service = new LocalSyntaxService();
  });

  afterEach(() => {
    service.resetMetrics();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────────────────────────────────────────

  describe('initialization', () => {
    test('isReady returns boolean', () => {
      const ready = service.isReady();
      expect(typeof ready).toBe('boolean');
    });

    test('waitForReady returns true when ready', async () => {
      const ready = await service.waitForReady();
      expect(ready).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Highlighting
  // ─────────────────────────────────────────────────────────────────────────

  describe('highlight', () => {
    test('highlights TypeScript code', async () => {
      await service.waitForReady();

      const result = await service.highlight(
        'const x: number = 42;',
        'typescript'
      );

      expect(result.languageId).toBe('typescript');
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].length).toBeGreaterThan(0);
    });

    test('highlights multi-line code', async () => {
      await service.waitForReady();

      const code = `function hello() {
  return 'world';
}`;

      const result = await service.highlight(code, 'javascript');

      expect(result.languageId).toBe('javascript');
      expect(result.lines).toHaveLength(3);
    });

    test('returns plaintext for unsupported language', async () => {
      await service.waitForReady();

      const result = await service.highlight('some text', 'unknownlang');

      expect(result.languageId).toBe('plaintext');
      expect(result.lines).toHaveLength(0);
    });

    test('includes timing information', async () => {
      await service.waitForReady();

      const result = await service.highlight('const x = 1;', 'typescript');

      expect(result.timing).toBeDefined();
      expect(result.timing).toBeGreaterThanOrEqual(0);
    });

    test('tokens have correct structure', async () => {
      await service.waitForReady();

      const result = await service.highlight('const x = 1;', 'typescript');

      for (const line of result.lines) {
        for (const token of line) {
          expect(token).toHaveProperty('start');
          expect(token).toHaveProperty('end');
          expect(token).toHaveProperty('scope');
          expect(typeof token.start).toBe('number');
          expect(typeof token.end).toBe('number');
          expect(typeof token.scope).toBe('string');
          expect(token.end).toBeGreaterThanOrEqual(token.start);
        }
      }
    });
  });

  describe('highlightLine', () => {
    test('highlights a single line', async () => {
      await service.waitForReady();

      const code = `const a = 1;
const b = 2;
const c = 3;`;

      const tokens = await service.highlightLine(code, 'typescript', 1);

      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);
    });

    test('returns empty array for unsupported language', async () => {
      await service.waitForReady();

      const tokens = await service.highlightLine('text', 'unknownlang', 0);

      expect(tokens).toEqual([]);
    });

    test('returns empty array for out of bounds line', async () => {
      await service.waitForReady();

      const tokens = await service.highlightLine('single line', 'typescript', 10);

      expect(tokens).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Sessions
  // ─────────────────────────────────────────────────────────────────────────

  describe('createSession', () => {
    test('creates a session', async () => {
      await service.waitForReady();

      const session = await service.createSession(
        'doc-1',
        'typescript',
        'const x = 1;'
      );

      expect(session.sessionId).toBeDefined();
      expect(session.documentId).toBe('doc-1');
      expect(session.languageId).toBe('typescript');
      expect(session.version).toBe(1);
    });

    test('generates unique session IDs', async () => {
      await service.waitForReady();

      const session1 = await service.createSession('doc-1', 'typescript', 'a');
      const session2 = await service.createSession('doc-2', 'typescript', 'b');

      expect(session1.sessionId).not.toBe(session2.sessionId);
    });
  });

  describe('updateSession', () => {
    test('updates session content', async () => {
      await service.waitForReady();

      const session = await service.createSession(
        'doc-1',
        'typescript',
        'const x = 1;'
      );

      await service.updateSession(session.sessionId, 'const x = 2;');

      const updated = service.getSession(session.sessionId);
      expect(updated?.version).toBe(2);
    });

    test('throws for non-existent session', async () => {
      await service.waitForReady();

      await expect(
        service.updateSession('non-existent', 'content')
      ).rejects.toThrow(SyntaxError);
    });
  });

  describe('getSessionTokens', () => {
    test('returns tokens for a line', async () => {
      await service.waitForReady();

      const session = await service.createSession(
        'doc-1',
        'typescript',
        'const x = 1;\nconst y = 2;'
      );

      const tokens = service.getSessionTokens(session.sessionId, 0);

      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);
    });

    test('returns empty array for invalid session', async () => {
      const tokens = service.getSessionTokens('non-existent', 0);
      expect(tokens).toEqual([]);
    });

    test('returns empty array for out of bounds line', async () => {
      await service.waitForReady();

      const session = await service.createSession(
        'doc-1',
        'typescript',
        'const x = 1;'
      );

      const tokens = service.getSessionTokens(session.sessionId, 100);

      expect(tokens).toEqual([]);
    });
  });

  describe('getSessionAllTokens', () => {
    test('returns all tokens', async () => {
      await service.waitForReady();

      const session = await service.createSession(
        'doc-1',
        'typescript',
        'const x = 1;\nconst y = 2;'
      );

      const allTokens = service.getSessionAllTokens(session.sessionId);

      expect(allTokens).toHaveLength(2);
      expect(allTokens[0].length).toBeGreaterThan(0);
      expect(allTokens[1].length).toBeGreaterThan(0);
    });

    test('returns empty array for invalid session', () => {
      const tokens = service.getSessionAllTokens('non-existent');
      expect(tokens).toEqual([]);
    });
  });

  describe('disposeSession', () => {
    test('disposes a session', async () => {
      await service.waitForReady();

      const session = await service.createSession(
        'doc-1',
        'typescript',
        'const x = 1;'
      );

      service.disposeSession(session.sessionId);

      const disposed = service.getSession(session.sessionId);
      expect(disposed).toBeNull();
    });

    test('does not throw for non-existent session', () => {
      expect(() => service.disposeSession('non-existent')).not.toThrow();
    });
  });

  describe('getSession', () => {
    test('returns session info', async () => {
      await service.waitForReady();

      const created = await service.createSession(
        'doc-1',
        'typescript',
        'const x = 1;'
      );

      const session = service.getSession(created.sessionId);

      expect(session).not.toBeNull();
      expect(session?.sessionId).toBe(created.sessionId);
      expect(session?.documentId).toBe('doc-1');
      expect(session?.languageId).toBe('typescript');
      expect(session?.version).toBe(1);
    });

    test('returns null for non-existent session', () => {
      const session = service.getSession('non-existent');
      expect(session).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Language Support
  // ─────────────────────────────────────────────────────────────────────────

  describe('getSupportedLanguages', () => {
    test('returns array of languages', () => {
      const languages = service.getSupportedLanguages();

      expect(Array.isArray(languages)).toBe(true);
      expect(languages.length).toBeGreaterThan(0);
      expect(languages).toContain('typescript');
      expect(languages).toContain('javascript');
      expect(languages).toContain('python');
    });
  });

  describe('isLanguageSupported', () => {
    test('returns true for supported languages', () => {
      expect(service.isLanguageSupported('typescript')).toBe(true);
      expect(service.isLanguageSupported('javascript')).toBe(true);
      expect(service.isLanguageSupported('python')).toBe(true);
      expect(service.isLanguageSupported('rust')).toBe(true);
    });

    test('returns false for unsupported languages', () => {
      expect(service.isLanguageSupported('unknownlang')).toBe(false);
      expect(service.isLanguageSupported('')).toBe(false);
    });
  });

  describe('detectLanguage', () => {
    test('detects TypeScript', () => {
      expect(service.detectLanguage('file.ts')).toBe('typescript');
      expect(service.detectLanguage('/path/to/file.ts')).toBe('typescript');
    });

    test('detects JavaScript', () => {
      expect(service.detectLanguage('file.js')).toBe('javascript');
      expect(service.detectLanguage('file.mjs')).toBe('javascript');
      expect(service.detectLanguage('file.cjs')).toBe('javascript');
    });

    test('detects TSX/JSX', () => {
      expect(service.detectLanguage('Component.tsx')).toBe('typescriptreact');
      expect(service.detectLanguage('Component.jsx')).toBe('javascriptreact');
    });

    test('detects Python', () => {
      expect(service.detectLanguage('script.py')).toBe('python');
    });

    test('detects Rust', () => {
      expect(service.detectLanguage('main.rs')).toBe('rust');
    });

    test('returns null for unknown extensions', () => {
      expect(service.detectLanguage('file.xyz')).toBeNull();
      expect(service.detectLanguage('noextension')).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Themes
  // ─────────────────────────────────────────────────────────────────────────

  describe('getAvailableThemes', () => {
    test('returns array of themes', () => {
      const themes = service.getAvailableThemes();

      expect(Array.isArray(themes)).toBe(true);
      expect(themes.length).toBeGreaterThan(0);
      expect(themes).toContain('catppuccin-frappe');
      expect(themes).toContain('catppuccin-mocha');
      expect(themes).toContain('github-dark');
    });
  });

  describe('setTheme', () => {
    test('sets a valid theme', () => {
      service.setTheme('catppuccin-mocha');
      expect(service.getTheme()).toBe('catppuccin-mocha');
    });

    test('throws for invalid theme', () => {
      expect(() => service.setTheme('invalid-theme')).toThrow(SyntaxError);
    });
  });

  describe('getTheme', () => {
    test('returns default theme', () => {
      const theme = service.getTheme();
      expect(theme).toBe('catppuccin-frappe');
    });

    test('returns current theme after change', () => {
      service.setTheme('github-dark');
      expect(service.getTheme()).toBe('github-dark');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Metrics
  // ─────────────────────────────────────────────────────────────────────────

  describe('getMetrics', () => {
    test('returns metrics object', () => {
      const metrics = service.getMetrics();

      expect(metrics).toHaveProperty('parseCount');
      expect(metrics).toHaveProperty('cacheHits');
      expect(metrics).toHaveProperty('cacheMisses');
      expect(metrics).toHaveProperty('averageParseTime');
    });

    test('parseCount increases after highlighting', async () => {
      await service.waitForReady();

      const before = service.getMetrics().parseCount;
      await service.highlight('const x = 1;', 'typescript');
      const after = service.getMetrics().parseCount;

      expect(after).toBeGreaterThan(before);
    });

    test('cacheHits increases when using session tokens', async () => {
      await service.waitForReady();

      const session = await service.createSession(
        'doc-1',
        'typescript',
        'const x = 1;'
      );

      const before = service.getMetrics().cacheHits;
      service.getSessionTokens(session.sessionId, 0);
      const after = service.getMetrics().cacheHits;

      expect(after).toBeGreaterThan(before);
    });
  });

  describe('resetMetrics', () => {
    test('resets all metrics to zero', async () => {
      await service.waitForReady();
      await service.highlight('const x = 1;', 'typescript');

      service.resetMetrics();
      const metrics = service.getMetrics();

      expect(metrics.parseCount).toBe(0);
      expect(metrics.cacheHits).toBe(0);
      expect(metrics.cacheMisses).toBe(0);
      expect(metrics.averageParseTime).toBe(0);
    });
  });
});
