/**
 * Integration Tests for Document ECP Methods
 *
 * Tests the document/* ECP methods via TestECPClient.
 * These tests verify the JSON-RPC protocol layer.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { TestECPClient } from '../helpers/ecp-client.ts';

describe('document/* ECP Methods', () => {
  let client: TestECPClient;

  beforeEach(() => {
    client = new TestECPClient();
  });

  afterEach(async () => {
    await client.shutdown();
  });

  // ───────────────────────────────────────────────────────────────────────
  // Document Lifecycle
  // ───────────────────────────────────────────────────────────────────────

  describe('document/open', () => {
    test('opens document with content', async () => {
      const result = await client.request<{
        documentId: string;
        info: { uri: string; lineCount: number };
      }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Hello, World!',
      });

      expect(result.documentId).toBeDefined();
      expect(result.info.uri).toBe('memory://test.txt');
      expect(result.info.lineCount).toBe(1);
    });

    test('returns error without uri', async () => {
      const response = await client.requestRaw('document/open', {
        content: 'Hello',
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32602); // InvalidParams
    });

    test('emits document/didOpen notification', async () => {
      await client.request('document/open', {
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      const notifications = client.getNotifications('document/didOpen');
      expect(notifications.length).toBe(1);
      expect((notifications[0].params as { uri: string }).uri).toBe('memory://test.txt');
    });
  });

  describe('document/close', () => {
    test('closes open document', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      const result = await client.request<{ success: boolean }>('document/close', {
        documentId,
      });

      expect(result.success).toBe(true);
    });

    test('returns false for non-existent document', async () => {
      const result = await client.request<{ success: boolean }>('document/close', {
        documentId: 'non-existent',
      });

      expect(result.success).toBe(false);
    });

    test('emits document/didClose notification', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      client.clearNotifications();

      await client.request('document/close', { documentId });

      const notifications = client.getNotifications('document/didClose');
      expect(notifications.length).toBe(1);
    });
  });

  describe('document/info', () => {
    test('returns document info', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.ts',
        content: 'const x = 1;',
      });

      const info = await client.request<{
        documentId: string;
        uri: string;
        languageId: string;
        lineCount: number;
      }>('document/info', { documentId });

      expect(info.documentId).toBe(documentId);
      expect(info.uri).toBe('memory://test.ts');
      expect(info.languageId).toBe('typescript');
      expect(info.lineCount).toBe(1);
    });

    test('returns error for non-existent document', async () => {
      const response = await client.requestRaw('document/info', {
        documentId: 'non-existent',
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32001); // DocumentNotFound
    });
  });

  describe('document/list', () => {
    test('returns all open documents', async () => {
      await client.request('document/open', { uri: 'memory://a.txt', content: 'A' });
      await client.request('document/open', { uri: 'memory://b.txt', content: 'B' });

      const result = await client.request<{
        documents: Array<{ uri: string }>;
      }>('document/list', {});

      expect(result.documents.length).toBe(2);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Content Access
  // ───────────────────────────────────────────────────────────────────────

  describe('document/content', () => {
    test('returns document content', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Line 1\nLine 2\nLine 3',
      });

      const result = await client.request<{
        content: string;
        version: number;
        lineCount: number;
      }>('document/content', { documentId });

      expect(result.content).toBe('Line 1\nLine 2\nLine 3');
      expect(result.lineCount).toBe(3);
    });
  });

  describe('document/line', () => {
    test('returns specific line', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Line 1\nLine 2\nLine 3',
      });

      const result = await client.request<{
        lineNumber: number;
        text: string;
      }>('document/line', { documentId, lineNumber: 1 });

      expect(result.lineNumber).toBe(1);
      expect(result.text).toBe('Line 2');
    });

    test('returns error for invalid line number', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Line 1',
      });

      const response = await client.requestRaw('document/line', {
        documentId,
        lineNumber: 10,
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32003); // InvalidPosition
    });
  });

  describe('document/lines', () => {
    test('returns range of lines', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Line 1\nLine 2\nLine 3\nLine 4',
      });

      const result = await client.request<{
        lines: Array<{ lineNumber: number; text: string }>;
      }>('document/lines', { documentId, startLine: 1, endLine: 3 });

      expect(result.lines.length).toBe(2);
      expect(result.lines[0].text).toBe('Line 2');
      expect(result.lines[1].text).toBe('Line 3');
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Text Editing
  // ───────────────────────────────────────────────────────────────────────

  describe('document/insert', () => {
    test('inserts text at position', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Hello World',
      });

      const result = await client.request<{
        success: boolean;
        version: number;
      }>('document/insert', {
        documentId,
        position: { line: 0, column: 5 },
        text: ' Beautiful',
      });

      expect(result.success).toBe(true);

      const content = await client.request<{ content: string }>('document/content', { documentId });
      expect(content.content).toBe('Hello Beautiful World');
    });

    test('emits document/didChange notification', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      client.clearNotifications();

      await client.request('document/insert', {
        documentId,
        position: { line: 0, column: 5 },
        text: ' World',
      });

      const notifications = client.getNotifications('document/didChange');
      expect(notifications.length).toBe(1);
    });
  });

  describe('document/delete', () => {
    test('deletes text in range', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Hello Beautiful World',
      });

      await client.request('document/delete', {
        documentId,
        range: {
          start: { line: 0, column: 5 },
          end: { line: 0, column: 15 },
        },
      });

      const content = await client.request<{ content: string }>('document/content', { documentId });
      expect(content.content).toBe('Hello World');
    });
  });

  describe('document/replace', () => {
    test('replaces text in range', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Hello World',
      });

      await client.request('document/replace', {
        documentId,
        range: {
          start: { line: 0, column: 6 },
          end: { line: 0, column: 11 },
        },
        text: 'Universe',
      });

      const content = await client.request<{ content: string }>('document/content', { documentId });
      expect(content.content).toBe('Hello Universe');
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Cursor Management
  // ───────────────────────────────────────────────────────────────────────

  describe('document/cursors', () => {
    test('returns cursor positions', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      const result = await client.request<{
        cursors: Array<{ position: { line: number; column: number } }>;
      }>('document/cursors', { documentId });

      expect(result.cursors.length).toBe(1);
      expect(result.cursors[0].position).toEqual({ line: 0, column: 0 });
    });
  });

  describe('document/setCursor', () => {
    test('sets cursor position', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Hello World',
      });

      await client.request('document/setCursor', {
        documentId,
        position: { line: 0, column: 5 },
      });

      const result = await client.request<{
        cursors: Array<{ position: { line: number; column: number } }>;
      }>('document/cursors', { documentId });

      expect(result.cursors[0].position).toEqual({ line: 0, column: 5 });
    });

    test('emits document/didChangeCursors notification', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      client.clearNotifications();

      await client.request('document/setCursor', {
        documentId,
        position: { line: 0, column: 3 },
      });

      const notifications = client.getNotifications('document/didChangeCursors');
      expect(notifications.length).toBe(1);
    });
  });

  describe('document/moveCursors', () => {
    test('moves cursors in direction', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Hello World',
      });

      await client.request('document/moveCursors', {
        documentId,
        direction: 'right',
        unit: 'word',
      });

      const result = await client.request<{
        cursors: Array<{ position: { line: number; column: number } }>;
      }>('document/cursors', { documentId });

      expect(result.cursors[0].position.column).toBeGreaterThan(0);
    });

    test('returns error for invalid direction', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      const response = await client.requestRaw('document/moveCursors', {
        documentId,
        direction: 'diagonal',
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32602); // InvalidParams
    });
  });

  describe('document/selectAll', () => {
    test('selects entire document', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Hello World',
      });

      await client.request('document/selectAll', { documentId });

      const result = await client.request<{
        selections: string[];
      }>('document/selections', { documentId });

      expect(result.selections[0]).toBe('Hello World');
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Undo/Redo
  // ───────────────────────────────────────────────────────────────────────

  describe('document/undo', () => {
    test('undoes last edit', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      await client.request('document/insert', {
        documentId,
        position: { line: 0, column: 5 },
        text: ' World',
      });

      const result = await client.request<{
        success: boolean;
        canUndo: boolean;
        canRedo: boolean;
      }>('document/undo', { documentId });

      expect(result.success).toBe(true);
      expect(result.canRedo).toBe(true);

      const content = await client.request<{ content: string }>('document/content', { documentId });
      expect(content.content).toBe('Hello');
    });
  });

  describe('document/redo', () => {
    test('redoes undone edit', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      await client.request('document/insert', {
        documentId,
        position: { line: 0, column: 5 },
        text: ' World',
      });

      await client.request('document/undo', { documentId });

      await client.request('document/redo', { documentId });

      const content = await client.request<{ content: string }>('document/content', { documentId });
      expect(content.content).toBe('Hello World');
    });
  });

  describe('document/canUndo', () => {
    test('returns undo availability', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      const before = await client.request<{ canUndo: boolean }>('document/canUndo', { documentId });
      expect(before.canUndo).toBe(false);

      await client.request('document/insert', {
        documentId,
        position: { line: 0, column: 5 },
        text: ' World',
      });

      const after = await client.request<{ canUndo: boolean }>('document/canUndo', { documentId });
      expect(after.canUndo).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Dirty State
  // ───────────────────────────────────────────────────────────────────────

  describe('document/isDirty', () => {
    test('tracks dirty state', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      const before = await client.request<{ isDirty: boolean }>('document/isDirty', { documentId });
      expect(before.isDirty).toBe(false);

      await client.request('document/insert', {
        documentId,
        position: { line: 0, column: 5 },
        text: ' World',
      });

      const after = await client.request<{ isDirty: boolean }>('document/isDirty', { documentId });
      expect(after.isDirty).toBe(true);
    });
  });

  describe('document/markClean', () => {
    test('clears dirty state', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      await client.request('document/insert', {
        documentId,
        position: { line: 0, column: 5 },
        text: ' World',
      });

      await client.request('document/markClean', { documentId });

      const result = await client.request<{ isDirty: boolean }>('document/isDirty', { documentId });
      expect(result.isDirty).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Utility Methods
  // ───────────────────────────────────────────────────────────────────────

  describe('document/positionToOffset', () => {
    test('converts position to offset', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Hello\nWorld',
      });

      const result = await client.request<{ offset: number }>('document/positionToOffset', {
        documentId,
        position: { line: 1, column: 0 },
      });

      expect(result.offset).toBe(6);
    });
  });

  describe('document/offsetToPosition', () => {
    test('converts offset to position', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Hello\nWorld',
      });

      const result = await client.request<{
        position: { line: number; column: number };
      }>('document/offsetToPosition', {
        documentId,
        offset: 6,
      });

      expect(result.position).toEqual({ line: 1, column: 0 });
    });
  });

  describe('document/wordAtPosition', () => {
    test('returns word at position', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Hello World',
      });

      const result = await client.request<{
        text: string;
        range: { start: { line: number; column: number }; end: { line: number; column: number } };
      } | null>('document/wordAtPosition', {
        documentId,
        position: { line: 0, column: 2 },
      });

      expect(result).not.toBeNull();
      expect(result!.text).toBe('Hello');
    });

    test('returns null when not on word', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Hello World',
      });

      const result = await client.request<{
        text: string;
      } | null>('document/wordAtPosition', {
        documentId,
        position: { line: 0, column: 5 },
      });

      expect(result).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Error Cases
  // ───────────────────────────────────────────────────────────────────────

  describe('error handling', () => {
    test('returns MethodNotFound for unknown method', async () => {
      const response = await client.requestRaw('document/unknownMethod', {});

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32601); // MethodNotFound
    });

    test('returns DocumentNotFound for non-existent document', async () => {
      const response = await client.requestRaw('document/content', {
        documentId: 'does-not-exist',
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32001); // DocumentNotFound
    });

    test('returns InvalidParams for missing required params', async () => {
      const response = await client.requestRaw('document/insert', {
        // Missing documentId, position, text
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32602); // InvalidParams
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Complex Workflows
  // ───────────────────────────────────────────────────────────────────────

  describe('workflows', () => {
    test('edit, undo, redo cycle', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      // Insert
      await client.request('document/insert', {
        documentId,
        position: { line: 0, column: 5 },
        text: ' World',
      });

      let content = await client.request<{ content: string }>('document/content', { documentId });
      expect(content.content).toBe('Hello World');

      // Undo
      await client.request('document/undo', { documentId });

      content = await client.request<{ content: string }>('document/content', { documentId });
      expect(content.content).toBe('Hello');

      // Redo
      await client.request('document/redo', { documentId });

      content = await client.request<{ content: string }>('document/content', { documentId });
      expect(content.content).toBe('Hello World');
    });

    test('multi-line editing', async () => {
      const { documentId } = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://test.txt',
        content: 'Line 1\nLine 2\nLine 3',
      });

      // Replace middle line
      await client.request('document/replace', {
        documentId,
        range: {
          start: { line: 1, column: 0 },
          end: { line: 1, column: 6 },
        },
        text: 'Modified Line 2',
      });

      const content = await client.request<{ content: string }>('document/content', { documentId });
      expect(content.content).toBe('Line 1\nModified Line 2\nLine 3');
    });

    test('open multiple documents', async () => {
      const doc1 = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://a.txt',
        content: 'Document A',
      });

      const doc2 = await client.request<{ documentId: string }>('document/open', {
        uri: 'memory://b.txt',
        content: 'Document B',
      });

      // Edit both independently
      await client.request('document/insert', {
        documentId: doc1.documentId,
        position: { line: 0, column: 10 },
        text: ' modified',
      });

      await client.request('document/insert', {
        documentId: doc2.documentId,
        position: { line: 0, column: 10 },
        text: ' changed',
      });

      const content1 = await client.request<{ content: string }>('document/content', {
        documentId: doc1.documentId,
      });
      const content2 = await client.request<{ content: string }>('document/content', {
        documentId: doc2.documentId,
      });

      expect(content1.content).toBe('Document A modified');
      expect(content2.content).toBe('Document B changed');
    });
  });
});
