/**
 * Unit Tests for LocalDocumentService
 *
 * Tests the DocumentService implementation directly without ECP.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { LocalDocumentService } from '../../../../src/services/document/local.ts';
import { sampleDocuments } from '../../../helpers/fixtures.ts';

describe('LocalDocumentService', () => {
  let service: LocalDocumentService;

  beforeEach(() => {
    service = new LocalDocumentService();
  });

  afterEach(async () => {
    // Clean up any open documents
    const docs = service.listOpen();
    for (const doc of docs) {
      await service.close(doc.documentId);
    }
  });

  // ───────────────────────────────────────────────────────────────────────
  // Document Lifecycle
  // ───────────────────────────────────────────────────────────────────────

  describe('open', () => {
    test('opens document with content', async () => {
      const result = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello, World!',
      });

      expect(result.documentId).toBeDefined();
      expect(result.info.uri).toBe('memory://test.txt');
      expect(result.info.isDirty).toBe(false);
      expect(result.info.lineCount).toBe(1);
    });

    test('opens empty document', async () => {
      const result = await service.open({
        uri: 'memory://empty.txt',
        content: '',
      });

      expect(result.info.lineCount).toBe(1);
    });

    test('returns existing document if already open', async () => {
      const result1 = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      const result2 = await service.open({
        uri: 'memory://test.txt',
        content: 'Different content',
      });

      expect(result1.documentId).toBe(result2.documentId);
    });

    test('detects language from extension', async () => {
      const result = await service.open({
        uri: 'memory://test.ts',
        content: 'const x = 1;',
      });

      expect(result.info.languageId).toBe('typescript');
    });

    test('uses provided languageId over detection', async () => {
      const result = await service.open({
        uri: 'memory://test.txt',
        content: 'const x = 1;',
        languageId: 'javascript',
      });

      expect(result.info.languageId).toBe('javascript');
    });

    test('opens as read-only when specified', async () => {
      const result = await service.open({
        uri: 'memory://readonly.txt',
        content: 'Cannot edit',
        readOnly: true,
      });

      expect(result.info.isReadOnly).toBe(true);
    });
  });

  describe('close', () => {
    test('closes open document', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      const closed = await service.close(documentId);

      expect(closed).toBe(true);
      expect(service.isOpen(documentId)).toBe(false);
    });

    test('returns false for non-existent document', async () => {
      const closed = await service.close('non-existent');
      expect(closed).toBe(false);
    });
  });

  describe('getInfo', () => {
    test('returns info for open document', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello\nWorld',
      });

      const info = service.getInfo(documentId);

      expect(info).not.toBeNull();
      expect(info!.documentId).toBe(documentId);
      expect(info!.lineCount).toBe(2);
    });

    test('returns null for non-existent document', () => {
      const info = service.getInfo('non-existent');
      expect(info).toBeNull();
    });
  });

  describe('listOpen', () => {
    test('returns empty array when no documents open', () => {
      const list = service.listOpen();
      expect(list).toEqual([]);
    });

    test('returns all open documents', async () => {
      await service.open({ uri: 'memory://a.txt', content: 'A' });
      await service.open({ uri: 'memory://b.txt', content: 'B' });
      await service.open({ uri: 'memory://c.txt', content: 'C' });

      const list = service.listOpen();
      expect(list.length).toBe(3);
    });
  });

  describe('findByUri', () => {
    test('finds document by URI', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      const found = service.findByUri('memory://test.txt');
      expect(found).toBe(documentId);
    });

    test('returns null for unknown URI', () => {
      const found = service.findByUri('memory://unknown.txt');
      expect(found).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Content Access
  // ───────────────────────────────────────────────────────────────────────

  describe('getContent', () => {
    test('returns full document content', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Line 1\nLine 2\nLine 3',
      });

      const result = service.getContent(documentId);

      expect(result).not.toBeNull();
      expect(result!.content).toBe('Line 1\nLine 2\nLine 3');
      expect(result!.lineCount).toBe(3);
    });

    test('returns null for non-existent document', () => {
      const result = service.getContent('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getLine', () => {
    test('returns specific line', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Line 1\nLine 2\nLine 3',
      });

      const line1 = service.getLine(documentId, 1);

      expect(line1).not.toBeNull();
      expect(line1!.lineNumber).toBe(1);
      expect(line1!.text).toBe('Line 2');
    });

    test('returns null for invalid line number', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Line 1\nLine 2',
      });

      expect(service.getLine(documentId, -1)).toBeNull();
      expect(service.getLine(documentId, 5)).toBeNull();
    });
  });

  describe('getLines', () => {
    test('returns range of lines', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Line 1\nLine 2\nLine 3\nLine 4',
      });

      const lines = service.getLines(documentId, 1, 3);

      expect(lines.length).toBe(2);
      expect(lines[0].text).toBe('Line 2');
      expect(lines[1].text).toBe('Line 3');
    });
  });

  describe('getVersion', () => {
    test('returns version number', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      const version = service.getVersion(documentId);
      expect(typeof version).toBe('number');
    });

    test('version increments on edit', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      const v1 = service.getVersion(documentId);

      service.insert({
        documentId,
        position: { line: 0, column: 5 },
        text: ' World',
      });

      const v2 = service.getVersion(documentId);

      expect(v2).toBeGreaterThan(v1!);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Text Editing
  // ───────────────────────────────────────────────────────────────────────

  describe('insert', () => {
    test('inserts text at position', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello World',
      });

      const result = service.insert({
        documentId,
        position: { line: 0, column: 5 },
        text: ' Beautiful',
      });

      expect(result.success).toBe(true);
      expect(service.getContent(documentId)!.content).toBe('Hello Beautiful World');
    });

    test('marks document as dirty', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      expect(service.isDirty(documentId)).toBe(false);

      service.insert({
        documentId,
        position: { line: 0, column: 5 },
        text: ' World',
      });

      expect(service.isDirty(documentId)).toBe(true);
    });

    test('fails on read-only document', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello',
        readOnly: true,
      });

      const result = service.insert({
        documentId,
        position: { line: 0, column: 0 },
        text: 'X',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('read-only');
    });
  });

  describe('delete', () => {
    test('deletes text in range', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello Beautiful World',
      });

      const result = service.delete({
        documentId,
        range: {
          start: { line: 0, column: 5 },
          end: { line: 0, column: 15 },
        },
      });

      expect(result.success).toBe(true);
      expect(service.getContent(documentId)!.content).toBe('Hello World');
    });
  });

  describe('replace', () => {
    test('replaces text in range', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello World',
      });

      const result = service.replace({
        documentId,
        range: {
          start: { line: 0, column: 6 },
          end: { line: 0, column: 11 },
        },
        text: 'Universe',
      });

      expect(result.success).toBe(true);
      expect(service.getContent(documentId)!.content).toBe('Hello Universe');
    });
  });

  describe('setContent', () => {
    test('replaces entire content', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Original content',
      });

      const result = service.setContent(documentId, 'New content');

      expect(result.success).toBe(true);
      expect(service.getContent(documentId)!.content).toBe('New content');
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Cursor Management
  // ───────────────────────────────────────────────────────────────────────

  describe('getCursors', () => {
    test('returns cursor positions', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      const cursors = service.getCursors(documentId);

      expect(cursors).not.toBeNull();
      expect(cursors!.length).toBe(1);
      expect(cursors![0].position).toEqual({ line: 0, column: 0 });
    });
  });

  describe('setCursor', () => {
    test('sets cursor position', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello World',
      });

      service.setCursor(documentId, { line: 0, column: 5 });

      const cursors = service.getCursors(documentId);
      expect(cursors![0].position).toEqual({ line: 0, column: 5 });
    });

    test('sets cursor with selection', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello World',
      });

      service.setCursor(
        documentId,
        { line: 0, column: 5 },
        { anchor: { line: 0, column: 0 }, active: { line: 0, column: 5 } }
      );

      const cursors = service.getCursors(documentId);
      expect(cursors![0].selection).toEqual({
        anchor: { line: 0, column: 0 },
        active: { line: 0, column: 5 },
      });
    });
  });

  describe('addCursor', () => {
    test('adds additional cursor', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello\nWorld',
      });

      service.addCursor(documentId, { line: 1, column: 0 });

      const cursors = service.getCursors(documentId);
      expect(cursors!.length).toBe(2);
    });
  });

  describe('selectAll', () => {
    test('selects entire document', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello\nWorld',
      });

      service.selectAll(documentId);

      const selections = service.getSelections(documentId);
      expect(selections).not.toBeNull();
      expect(selections!.length).toBe(1);
      expect(selections![0]).toBe('Hello\nWorld');
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Undo/Redo
  // ───────────────────────────────────────────────────────────────────────

  describe('undo', () => {
    test('undoes last edit', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      service.insert({
        documentId,
        position: { line: 0, column: 5 },
        text: ' World',
      });

      expect(service.getContent(documentId)!.content).toBe('Hello World');

      const result = service.undo(documentId);

      expect(result.success).toBe(true);
      expect(service.getContent(documentId)!.content).toBe('Hello');
    });

    test('returns canUndo/canRedo state', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      expect(service.canUndo(documentId)).toBe(false);

      service.insert({
        documentId,
        position: { line: 0, column: 5 },
        text: ' World',
      });

      expect(service.canUndo(documentId)).toBe(true);
    });
  });

  describe('redo', () => {
    test('redoes undone edit', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      service.insert({
        documentId,
        position: { line: 0, column: 5 },
        text: ' World',
      });

      service.undo(documentId);
      expect(service.getContent(documentId)!.content).toBe('Hello');

      const result = service.redo(documentId);

      expect(result.success).toBe(true);
      expect(service.getContent(documentId)!.content).toBe('Hello World');
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Dirty State
  // ───────────────────────────────────────────────────────────────────────

  describe('isDirty', () => {
    test('tracks dirty state', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      expect(service.isDirty(documentId)).toBe(false);

      service.insert({
        documentId,
        position: { line: 0, column: 5 },
        text: ' World',
      });

      expect(service.isDirty(documentId)).toBe(true);
    });
  });

  describe('markClean', () => {
    test('clears dirty state', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      service.insert({
        documentId,
        position: { line: 0, column: 5 },
        text: ' World',
      });

      expect(service.isDirty(documentId)).toBe(true);

      service.markClean(documentId);

      expect(service.isDirty(documentId)).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Events
  // ───────────────────────────────────────────────────────────────────────

  describe('events', () => {
    test('emits content change events', async () => {
      const events: Array<{ documentId: string; version: number }> = [];

      service.onDidChangeContent((event) => {
        events.push({ documentId: event.documentId, version: event.version });
      });

      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      service.insert({
        documentId,
        position: { line: 0, column: 5 },
        text: ' World',
      });

      expect(events.length).toBe(1);
      expect(events[0].documentId).toBe(documentId);
    });

    test('emits cursor change events', async () => {
      const events: Array<{ documentId: string }> = [];

      service.onDidChangeCursors((event) => {
        events.push({ documentId: event.documentId });
      });

      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello World',
      });

      service.setCursor(documentId, { line: 0, column: 5 });

      expect(events.length).toBe(1);
      expect(events[0].documentId).toBe(documentId);
    });

    test('emits open events', async () => {
      const events: Array<{ uri: string }> = [];

      service.onDidOpenDocument((event) => {
        events.push({ uri: event.uri });
      });

      await service.open({
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      expect(events.length).toBe(1);
      expect(events[0].uri).toBe('memory://test.txt');
    });

    test('emits close events', async () => {
      const events: Array<{ uri: string }> = [];

      service.onDidCloseDocument((event) => {
        events.push({ uri: event.uri });
      });

      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      await service.close(documentId);

      expect(events.length).toBe(1);
      expect(events[0].uri).toBe('memory://test.txt');
    });

    test('unsubscribes from events', async () => {
      const events: number[] = [];

      const unsubscribe = service.onDidChangeContent(() => {
        events.push(1);
      });

      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello',
      });

      service.insert({
        documentId,
        position: { line: 0, column: 5 },
        text: ' World',
      });

      expect(events.length).toBe(1);

      unsubscribe();

      service.insert({
        documentId,
        position: { line: 0, column: 11 },
        text: '!',
      });

      // Should not receive second event
      expect(events.length).toBe(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Utility Methods
  // ───────────────────────────────────────────────────────────────────────

  describe('positionToOffset', () => {
    test('converts position to offset', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello\nWorld',
      });

      expect(service.positionToOffset(documentId, { line: 0, column: 0 })).toBe(0);
      expect(service.positionToOffset(documentId, { line: 0, column: 5 })).toBe(5);
      expect(service.positionToOffset(documentId, { line: 1, column: 0 })).toBe(6);
    });
  });

  describe('offsetToPosition', () => {
    test('converts offset to position', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello\nWorld',
      });

      expect(service.offsetToPosition(documentId, 0)).toEqual({ line: 0, column: 0 });
      expect(service.offsetToPosition(documentId, 5)).toEqual({ line: 0, column: 5 });
      expect(service.offsetToPosition(documentId, 6)).toEqual({ line: 1, column: 0 });
    });
  });

  describe('getWordAtPosition', () => {
    test('returns word at position', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello World',
      });

      const word = service.getWordAtPosition(documentId, { line: 0, column: 2 });

      expect(word).not.toBeNull();
      expect(word!.text).toBe('Hello');
      expect(word!.range.start).toEqual({ line: 0, column: 0 });
      expect(word!.range.end).toEqual({ line: 0, column: 5 });
    });

    test('returns null when not on word', async () => {
      const { documentId } = await service.open({
        uri: 'memory://test.txt',
        content: 'Hello World',
      });

      const word = service.getWordAtPosition(documentId, { line: 0, column: 5 });
      expect(word).toBeNull();
    });
  });
});
