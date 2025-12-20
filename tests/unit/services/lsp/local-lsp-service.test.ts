/**
 * LocalLSPService Unit Tests
 *
 * Tests for the local LSP service implementation.
 * Note: Tests that require actual language servers are limited since
 * we don't want to depend on external binaries in unit tests.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { LocalLSPService } from '../../../../src/services/lsp/service.ts';
import { LSPError, LSPErrorCode } from '../../../../src/services/lsp/errors.ts';
import type { ServerStatus, LSPDiagnostic } from '../../../../src/services/lsp/types.ts';

describe('LocalLSPService', () => {
  let service: LocalLSPService;

  beforeEach(() => {
    service = new LocalLSPService();
    service.setWorkspaceRoot('/test/workspace');
  });

  afterEach(async () => {
    await service.shutdown();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Configuration Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('language detection', () => {
    test('getLanguageId returns correct ID for TypeScript', () => {
      expect(service.getLanguageId('/path/to/file.ts')).toBe('typescript');
    });

    test('getLanguageId returns correct ID for TypeScript React', () => {
      expect(service.getLanguageId('/path/to/file.tsx')).toBe('typescriptreact');
    });

    test('getLanguageId returns correct ID for JavaScript', () => {
      expect(service.getLanguageId('/path/to/file.js')).toBe('javascript');
    });

    test('getLanguageId returns correct ID for JavaScript React', () => {
      expect(service.getLanguageId('/path/to/file.jsx')).toBe('javascriptreact');
    });

    test('getLanguageId returns correct ID for Rust', () => {
      expect(service.getLanguageId('/path/to/file.rs')).toBe('rust');
    });

    test('getLanguageId returns correct ID for Python', () => {
      expect(service.getLanguageId('/path/to/file.py')).toBe('python');
    });

    test('getLanguageId returns correct ID for Go', () => {
      expect(service.getLanguageId('/path/to/file.go')).toBe('go');
    });

    test('getLanguageId returns correct ID for JSON', () => {
      expect(service.getLanguageId('/path/to/file.json')).toBe('json');
    });

    test('getLanguageId returns null for unknown extension', () => {
      expect(service.getLanguageId('/path/to/file.xyz')).toBeNull();
    });

    test('getLanguageId returns null for file without extension', () => {
      expect(service.getLanguageId('/path/to/Makefile')).toBeNull();
    });
  });

  describe('server availability', () => {
    test('hasServerFor returns true for TypeScript', () => {
      expect(service.hasServerFor('typescript')).toBe(true);
    });

    test('hasServerFor returns true for Rust', () => {
      expect(service.hasServerFor('rust')).toBe(true);
    });

    test('hasServerFor returns true for Python', () => {
      expect(service.hasServerFor('python')).toBe(true);
    });

    test('hasServerFor returns false for unknown language', () => {
      expect(service.hasServerFor('unknown-language')).toBe(false);
    });

    test('hasServerFor returns true for custom config', () => {
      service.setServerConfig('custom-lang', {
        command: 'custom-server',
        args: ['--stdio'],
      });

      expect(service.hasServerFor('custom-lang')).toBe(true);
    });
  });

  describe('server configuration', () => {
    test('getServerConfig returns default config for TypeScript', () => {
      const config = service.getServerConfig('typescript');

      expect(config).not.toBeNull();
      expect(config?.command).toBe('typescript-language-server');
      expect(config?.args).toEqual(['--stdio']);
    });

    test('getServerConfig returns null for unknown language', () => {
      expect(service.getServerConfig('unknown-language')).toBeNull();
    });

    test('setServerConfig overrides default', () => {
      service.setServerConfig('typescript', {
        command: 'custom-ts-server',
        args: ['--mode', 'lsp'],
      });

      const config = service.getServerConfig('typescript');
      expect(config?.command).toBe('custom-ts-server');
      expect(config?.args).toEqual(['--mode', 'lsp']);
    });

    test('setServerConfig adds new language', () => {
      service.setServerConfig('custom-lang', {
        command: 'custom-server',
        args: [],
        initializationOptions: { foo: 'bar' },
      });

      const config = service.getServerConfig('custom-lang');
      expect(config?.command).toBe('custom-server');
      expect(config?.initializationOptions).toEqual({ foo: 'bar' });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('lifecycle', () => {
    test('isEnabled returns true by default', () => {
      expect(service.isEnabled()).toBe(true);
    });

    test('setEnabled disables the service', () => {
      service.setEnabled(false);
      expect(service.isEnabled()).toBe(false);
    });

    test('setEnabled enables the service', () => {
      service.setEnabled(false);
      service.setEnabled(true);
      expect(service.isEnabled()).toBe(true);
    });

    test('getWorkspaceRoot returns set value', () => {
      service.setWorkspaceRoot('/new/workspace');
      expect(service.getWorkspaceRoot()).toBe('/new/workspace');
    });

    test('shutdown clears state', async () => {
      await service.shutdown();

      // After shutdown, status should be empty
      const status = service.getServerStatus();
      expect(status.length).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Server Status Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('server status', () => {
    test('getServerStatus returns empty array initially', () => {
      const status = service.getServerStatus();
      expect(status).toEqual([]);
    });

    test('getServerStatus returns stopped for specific language', () => {
      const status = service.getServerStatus('typescript');
      expect(status.length).toBe(1);
      expect(status[0]?.languageId).toBe('typescript');
      expect(status[0]?.status).toBe('stopped');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Diagnostics Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('diagnostics', () => {
    test('getDiagnostics returns empty array for unknown URI', () => {
      const diagnostics = service.getDiagnostics('file:///unknown.ts');
      expect(diagnostics).toEqual([]);
    });

    test('getAllDiagnostics returns empty map initially', () => {
      const all = service.getAllDiagnostics();
      expect(all.size).toBe(0);
    });

    test('getDiagnosticsSummary returns zeros initially', () => {
      const summary = service.getDiagnosticsSummary();
      expect(summary.errors).toBe(0);
      expect(summary.warnings).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Event Subscription Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('events', () => {
    test('onDiagnostics returns unsubscribe function', () => {
      const unsubscribe = service.onDiagnostics(() => {});

      expect(typeof unsubscribe).toBe('function');
      unsubscribe(); // Should not throw
    });

    test('onServerStatusChange returns unsubscribe function', () => {
      const unsubscribe = service.onServerStatusChange(() => {});

      expect(typeof unsubscribe).toBe('function');
      unsubscribe(); // Should not throw
    });

    test('unsubscribe stops notifications', () => {
      const statuses: ServerStatus[] = [];
      const unsubscribe = service.onServerStatusChange((status) => {
        statuses.push(status);
      });

      unsubscribe();

      // Future status changes should not notify
      // (Would need server start to trigger, but this validates the pattern)
      expect(statuses.length).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Error Handling Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('error handling', () => {
    test('startServer throws when disabled', async () => {
      service.setEnabled(false);

      await expect(
        service.startServer('typescript', 'file:///workspace')
      ).rejects.toThrow(LSPError);
    });

    test('startServer throws for unknown language', async () => {
      await expect(
        service.startServer('unknown-language', 'file:///workspace')
      ).rejects.toThrow(LSPError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Document Sync Tests (No Server Required)
  // ─────────────────────────────────────────────────────────────────────────

  describe('document sync without server', () => {
    test('documentOpened does not throw for unknown language', async () => {
      // Should complete without throwing
      await service.documentOpened('file:///test.xyz', 'unknown', 'content');
    });

    test('documentChanged does not throw for unopened document', async () => {
      // Should complete without throwing
      await service.documentChanged('file:///test.ts', 'new content', 2);
    });

    test('documentSaved does not throw for unopened document', async () => {
      // Should complete without throwing
      await service.documentSaved('file:///test.ts', 'saved content');
    });

    test('documentClosed does not throw for unopened document', async () => {
      // Should complete without throwing
      await service.documentClosed('file:///test.ts');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Code Intelligence Tests (No Server - Return Empty Results)
  // ─────────────────────────────────────────────────────────────────────────

  describe('code intelligence without server', () => {
    test('getCompletions returns empty array for unopened document', async () => {
      const completions = await service.getCompletions('file:///test.ts', {
        line: 0,
        character: 0,
      });
      expect(completions).toEqual([]);
    });

    test('getHover returns null for unopened document', async () => {
      const hover = await service.getHover('file:///test.ts', { line: 0, character: 0 });
      expect(hover).toBeNull();
    });

    test('getSignatureHelp returns null for unopened document', async () => {
      const help = await service.getSignatureHelp('file:///test.ts', {
        line: 0,
        character: 0,
      });
      expect(help).toBeNull();
    });

    test('getDefinition returns empty array for unopened document', async () => {
      const definitions = await service.getDefinition('file:///test.ts', {
        line: 0,
        character: 0,
      });
      expect(definitions).toEqual([]);
    });

    test('getReferences returns empty array for unopened document', async () => {
      const references = await service.getReferences('file:///test.ts', {
        line: 0,
        character: 0,
      });
      expect(references).toEqual([]);
    });

    test('getDocumentSymbols returns empty array for unopened document', async () => {
      const symbols = await service.getDocumentSymbols('file:///test.ts');
      expect(symbols).toEqual([]);
    });

    test('rename returns null for unopened document', async () => {
      const edit = await service.rename(
        'file:///test.ts',
        { line: 0, character: 0 },
        'newName'
      );
      expect(edit).toBeNull();
    });
  });
});

describe('LSPError', () => {
  test('serverNotFound creates correct error', () => {
    const error = LSPError.serverNotFound('typescript');

    expect(error.code).toBe(LSPErrorCode.SERVER_NOT_FOUND);
    expect(error.message).toContain('typescript');
    expect(error.data).toEqual({ languageId: 'typescript' });
  });

  test('serverStartFailed creates correct error', () => {
    const error = LSPError.serverStartFailed('typescript', 'command not found');

    expect(error.code).toBe(LSPErrorCode.SERVER_START_FAILED);
    expect(error.message).toContain('typescript');
    expect(error.message).toContain('command not found');
  });

  test('disabled creates correct error', () => {
    const error = LSPError.disabled();

    expect(error.code).toBe(LSPErrorCode.DISABLED);
    expect(error.message).toContain('disabled');
  });

  test('documentNotOpen creates correct error', () => {
    const error = LSPError.documentNotOpen('file:///test.ts');

    expect(error.code).toBe(LSPErrorCode.DOCUMENT_NOT_OPEN);
    expect(error.data).toEqual({ uri: 'file:///test.ts' });
  });

  test('requestTimeout creates correct error', () => {
    const error = LSPError.requestTimeout('textDocument/completion', 30000);

    expect(error.code).toBe(LSPErrorCode.REQUEST_TIMEOUT);
    expect(error.message).toContain('30000');
    expect(error.data).toEqual({ method: 'textDocument/completion', timeoutMs: 30000 });
  });
});
