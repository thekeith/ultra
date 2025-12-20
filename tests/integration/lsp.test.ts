/**
 * LSP Service Integration Tests
 *
 * Tests for the LSP Service ECP adapter methods.
 * These tests verify the JSON-RPC interface works correctly.
 *
 * Note: Most tests don't require actual language servers since we're
 * testing the ECP adapter layer, not the actual LSP functionality.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { TestECPClient, createTestClient } from '../helpers/ecp-client.ts';

describe('LSP Service ECP Integration', () => {
  let client: TestECPClient;

  beforeEach(() => {
    client = createTestClient({ workspaceRoot: '/test/workspace' });
  });

  afterEach(async () => {
    await client.shutdown();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Server Status Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('lsp/status', () => {
    test('returns empty array when no servers running', async () => {
      const result = await client.request<{ servers: unknown[] }>('lsp/status', {});

      expect(result.servers).toBeDefined();
      expect(result.servers).toEqual([]);
    });

    test('returns status for specific language', async () => {
      const result = await client.request<{ servers: Array<{ languageId: string; status: string }> }>(
        'lsp/status',
        { languageId: 'typescript' }
      );

      expect(result.servers.length).toBe(1);
      expect(result.servers[0]?.languageId).toBe('typescript');
      expect(result.servers[0]?.status).toBe('stopped');
    });
  });

  describe('lsp/stop', () => {
    test('succeeds even when no server running', async () => {
      const result = await client.request<{ success: boolean }>('lsp/stop', {
        languageId: 'typescript',
      });

      expect(result.success).toBe(true);
    });

    test('returns error for missing languageId', async () => {
      const response = await client.requestRaw('lsp/stop', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602); // InvalidParams
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Configuration Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('lsp/getServerConfig', () => {
    test('returns default config for typescript', async () => {
      const result = await client.request<{ config: { command: string; args: string[] } | null }>(
        'lsp/getServerConfig',
        { languageId: 'typescript' }
      );

      expect(result.config).not.toBeNull();
      expect(result.config?.command).toBe('typescript-language-server');
      expect(result.config?.args).toEqual(['--stdio']);
    });

    test('returns null for unknown language', async () => {
      const result = await client.request<{ config: null }>('lsp/getServerConfig', {
        languageId: 'unknown-language',
      });

      expect(result.config).toBeNull();
    });

    test('returns error for missing languageId', async () => {
      const response = await client.requestRaw('lsp/getServerConfig', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe('lsp/setServerConfig', () => {
    test('sets custom server config', async () => {
      const result = await client.request<{ success: boolean }>('lsp/setServerConfig', {
        languageId: 'custom-lang',
        config: {
          command: 'custom-server',
          args: ['--mode', 'lsp'],
        },
      });

      expect(result.success).toBe(true);

      // Verify it was set
      const { config } = await client.request<{ config: { command: string } }>('lsp/getServerConfig', {
        languageId: 'custom-lang',
      });
      expect(config.command).toBe('custom-server');
    });

    test('returns error for missing config', async () => {
      const response = await client.requestRaw('lsp/setServerConfig', {
        languageId: 'typescript',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe('lsp/getLanguageId', () => {
    test('returns languageId for TypeScript file', async () => {
      const result = await client.request<{ languageId: string | null }>('lsp/getLanguageId', {
        filePath: '/path/to/file.ts',
      });

      expect(result.languageId).toBe('typescript');
    });

    test('returns languageId for Python file', async () => {
      const result = await client.request<{ languageId: string | null }>('lsp/getLanguageId', {
        filePath: '/path/to/file.py',
      });

      expect(result.languageId).toBe('python');
    });

    test('returns null for unknown extension', async () => {
      const result = await client.request<{ languageId: string | null }>('lsp/getLanguageId', {
        filePath: '/path/to/file.xyz',
      });

      expect(result.languageId).toBeNull();
    });

    test('returns error for missing filePath', async () => {
      const response = await client.requestRaw('lsp/getLanguageId', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe('lsp/hasServerFor', () => {
    test('returns true for TypeScript', async () => {
      const result = await client.request<{ available: boolean }>('lsp/hasServerFor', {
        languageId: 'typescript',
      });

      expect(result.available).toBe(true);
    });

    test('returns true for Python', async () => {
      const result = await client.request<{ available: boolean }>('lsp/hasServerFor', {
        languageId: 'python',
      });

      expect(result.available).toBe(true);
    });

    test('returns false for unknown language', async () => {
      const result = await client.request<{ available: boolean }>('lsp/hasServerFor', {
        languageId: 'unknown-language',
      });

      expect(result.available).toBe(false);
    });

    test('returns error for missing languageId', async () => {
      const response = await client.requestRaw('lsp/hasServerFor', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Document Sync Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('lsp/documentOpen', () => {
    test('succeeds for valid document', async () => {
      const result = await client.request<{ success: boolean }>('lsp/documentOpen', {
        uri: 'file:///test/file.ts',
        languageId: 'typescript',
        content: 'const x = 1;',
      });

      expect(result.success).toBe(true);
    });

    test('returns error for missing uri', async () => {
      const response = await client.requestRaw('lsp/documentOpen', {
        languageId: 'typescript',
        content: 'const x = 1;',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });

    test('returns error for missing languageId', async () => {
      const response = await client.requestRaw('lsp/documentOpen', {
        uri: 'file:///test/file.ts',
        content: 'const x = 1;',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe('lsp/documentChange', () => {
    test('succeeds for valid change', async () => {
      const result = await client.request<{ success: boolean }>('lsp/documentChange', {
        uri: 'file:///test/file.ts',
        content: 'const x = 2;',
        version: 2,
      });

      expect(result.success).toBe(true);
    });

    test('returns error for missing uri', async () => {
      const response = await client.requestRaw('lsp/documentChange', {
        content: 'const x = 2;',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe('lsp/documentSave', () => {
    test('succeeds for valid save', async () => {
      const result = await client.request<{ success: boolean }>('lsp/documentSave', {
        uri: 'file:///test/file.ts',
      });

      expect(result.success).toBe(true);
    });

    test('returns error for missing uri', async () => {
      const response = await client.requestRaw('lsp/documentSave', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe('lsp/documentClose', () => {
    test('succeeds for valid close', async () => {
      const result = await client.request<{ success: boolean }>('lsp/documentClose', {
        uri: 'file:///test/file.ts',
      });

      expect(result.success).toBe(true);
    });

    test('returns error for missing uri', async () => {
      const response = await client.requestRaw('lsp/documentClose', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Code Intelligence Tests (Without Server)
  // ─────────────────────────────────────────────────────────────────────────

  describe('lsp/completion', () => {
    test('returns empty items for unopened document', async () => {
      const result = await client.request<{ items: unknown[] }>('lsp/completion', {
        uri: 'file:///test/file.ts',
        position: { line: 0, character: 0 },
      });

      expect(result.items).toEqual([]);
    });

    test('returns error for missing uri', async () => {
      const response = await client.requestRaw('lsp/completion', {
        position: { line: 0, character: 0 },
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });

    test('returns error for missing position', async () => {
      const response = await client.requestRaw('lsp/completion', {
        uri: 'file:///test/file.ts',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe('lsp/hover', () => {
    test('returns null for unopened document', async () => {
      const result = await client.request<null>('lsp/hover', {
        uri: 'file:///test/file.ts',
        position: { line: 0, character: 0 },
      });

      expect(result).toBeNull();
    });

    test('returns error for missing parameters', async () => {
      const response = await client.requestRaw('lsp/hover', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe('lsp/signatureHelp', () => {
    test('returns null for unopened document', async () => {
      const result = await client.request<null>('lsp/signatureHelp', {
        uri: 'file:///test/file.ts',
        position: { line: 0, character: 0 },
      });

      expect(result).toBeNull();
    });

    test('returns error for missing parameters', async () => {
      const response = await client.requestRaw('lsp/signatureHelp', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe('lsp/definition', () => {
    test('returns empty locations for unopened document', async () => {
      const result = await client.request<{ locations: unknown[] }>('lsp/definition', {
        uri: 'file:///test/file.ts',
        position: { line: 0, character: 0 },
      });

      expect(result.locations).toEqual([]);
    });

    test('returns error for missing parameters', async () => {
      const response = await client.requestRaw('lsp/definition', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe('lsp/references', () => {
    test('returns empty locations for unopened document', async () => {
      const result = await client.request<{ locations: unknown[] }>('lsp/references', {
        uri: 'file:///test/file.ts',
        position: { line: 0, character: 0 },
      });

      expect(result.locations).toEqual([]);
    });

    test('returns error for missing parameters', async () => {
      const response = await client.requestRaw('lsp/references', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe('lsp/documentSymbol', () => {
    test('returns empty symbols for unopened document', async () => {
      const result = await client.request<{ symbols: unknown[] }>('lsp/documentSymbol', {
        uri: 'file:///test/file.ts',
      });

      expect(result.symbols).toEqual([]);
    });

    test('returns error for missing uri', async () => {
      const response = await client.requestRaw('lsp/documentSymbol', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe('lsp/rename', () => {
    test('returns null for unopened document', async () => {
      const result = await client.request<{ edit: null }>('lsp/rename', {
        uri: 'file:///test/file.ts',
        position: { line: 0, character: 0 },
        newName: 'newName',
      });

      expect(result.edit).toBeNull();
    });

    test('returns error for missing parameters', async () => {
      const response = await client.requestRaw('lsp/rename', {
        uri: 'file:///test/file.ts',
        position: { line: 0, character: 0 },
        // Missing newName
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Diagnostics Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('lsp/diagnostics', () => {
    test('returns empty diagnostics for unknown URI', async () => {
      const result = await client.request<{ diagnostics: unknown[] }>('lsp/diagnostics', {
        uri: 'file:///test/file.ts',
      });

      expect(result.diagnostics).toEqual([]);
    });

    test('returns error for missing uri', async () => {
      const response = await client.requestRaw('lsp/diagnostics', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });

  describe('lsp/allDiagnostics', () => {
    test('returns empty diagnostics initially', async () => {
      const result = await client.request<{ diagnostics: Record<string, unknown[]> }>(
        'lsp/allDiagnostics',
        {}
      );

      expect(result.diagnostics).toBeDefined();
      expect(Object.keys(result.diagnostics).length).toBe(0);
    });
  });

  describe('lsp/diagnosticsSummary', () => {
    test('returns zeros initially', async () => {
      const result = await client.request<{ errors: number; warnings: number }>(
        'lsp/diagnosticsSummary',
        {}
      );

      expect(result.errors).toBe(0);
      expect(result.warnings).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Error Handling Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('error handling', () => {
    test('returns method not found for unknown method', async () => {
      const response = await client.requestRaw('lsp/unknownMethod', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601); // MethodNotFound
    });
  });
});
