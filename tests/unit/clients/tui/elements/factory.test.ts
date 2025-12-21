/**
 * Element Factory Tests
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
  registerElement,
  isElementRegistered,
  getRegisteredTypes,
  unregisterElement,
  clearRegistry,
  createElement,
  createElementOrThrow,
  generateElementId,
  resetIdCounter,
  PlaceholderElement,
  createPlaceholder,
  createElementWithFallback,
  type ElementCreator,
} from '../../../../../src/clients/tui/elements/factory.ts';
import { BaseElement, createTestContext } from '../../../../../src/clients/tui/elements/base.ts';
import type { ElementContext } from '../../../../../src/clients/tui/elements/base.ts';
import type { ScreenBuffer } from '../../../../../src/clients/tui/rendering/buffer.ts';
import type { ElementType } from '../../../../../src/clients/tui/types.ts';

// ============================================
// Test Implementation
// ============================================

class MockElement extends BaseElement {
  public stateData: unknown;

  constructor(
    type: ElementType,
    id: string,
    title: string,
    ctx: ElementContext,
    state?: unknown
  ) {
    super(type, id, title, ctx);
    this.stateData = state;
  }

  render(_buffer: ScreenBuffer): void {
    // Mock render
  }
}

const createMockCreator = (type: ElementType): ElementCreator => {
  return (id, title, ctx, state) => new MockElement(type, id, title, ctx, state);
};

// ============================================
// Tests
// ============================================

describe('Element Factory', () => {
  let ctx: ElementContext;

  beforeEach(() => {
    clearRegistry();
    resetIdCounter();
    ctx = createTestContext();
  });

  afterEach(() => {
    clearRegistry();
    resetIdCounter();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Registration
  // ─────────────────────────────────────────────────────────────────────────

  describe('registerElement', () => {
    test('registers an element type', () => {
      registerElement('DocumentEditor', createMockCreator('DocumentEditor'));
      expect(isElementRegistered('DocumentEditor')).toBe(true);
    });

    test('can register multiple types', () => {
      registerElement('DocumentEditor', createMockCreator('DocumentEditor'));
      registerElement('FileTree', createMockCreator('FileTree'));
      registerElement('GitPanel', createMockCreator('GitPanel'));

      expect(isElementRegistered('DocumentEditor')).toBe(true);
      expect(isElementRegistered('FileTree')).toBe(true);
      expect(isElementRegistered('GitPanel')).toBe(true);
    });

    test('can override existing registration', () => {
      let version = 1;
      registerElement('DocumentEditor', () => {
        version = 1;
        return new MockElement('DocumentEditor', 'test', 'Test', ctx);
      });
      registerElement('DocumentEditor', () => {
        version = 2;
        return new MockElement('DocumentEditor', 'test', 'Test', ctx);
      });

      createElement({ type: 'DocumentEditor', id: 'test', title: 'Test' }, ctx);
      expect(version).toBe(2);
    });
  });

  describe('isElementRegistered', () => {
    test('returns false for unregistered type', () => {
      expect(isElementRegistered('FileTree')).toBe(false);
    });

    test('returns true for registered type', () => {
      registerElement('FileTree', createMockCreator('FileTree'));
      expect(isElementRegistered('FileTree')).toBe(true);
    });
  });

  describe('getRegisteredTypes', () => {
    test('returns empty array when no registrations', () => {
      expect(getRegisteredTypes()).toEqual([]);
    });

    test('returns all registered types', () => {
      registerElement('DocumentEditor', createMockCreator('DocumentEditor'));
      registerElement('FileTree', createMockCreator('FileTree'));

      const types = getRegisteredTypes();
      expect(types).toContain('DocumentEditor');
      expect(types).toContain('FileTree');
      expect(types).toHaveLength(2);
    });
  });

  describe('unregisterElement', () => {
    test('removes registered element', () => {
      registerElement('DocumentEditor', createMockCreator('DocumentEditor'));
      expect(unregisterElement('DocumentEditor')).toBe(true);
      expect(isElementRegistered('DocumentEditor')).toBe(false);
    });

    test('returns false for unregistered element', () => {
      expect(unregisterElement('FileTree')).toBe(false);
    });
  });

  describe('clearRegistry', () => {
    test('removes all registrations', () => {
      registerElement('DocumentEditor', createMockCreator('DocumentEditor'));
      registerElement('FileTree', createMockCreator('FileTree'));

      clearRegistry();

      expect(isElementRegistered('DocumentEditor')).toBe(false);
      expect(isElementRegistered('FileTree')).toBe(false);
      expect(getRegisteredTypes()).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Element Creation
  // ─────────────────────────────────────────────────────────────────────────

  describe('createElement', () => {
    test('creates element from registered type', () => {
      registerElement('DocumentEditor', createMockCreator('DocumentEditor'));

      const element = createElement(
        { type: 'DocumentEditor', id: 'doc-1', title: 'My Document' },
        ctx
      );

      expect(element).not.toBeNull();
      expect(element?.type).toBe('DocumentEditor');
      expect(element?.id).toBe('doc-1');
      expect(element?.getTitle()).toBe('My Document');
    });

    test('returns null for unregistered type', () => {
      const element = createElement(
        { type: 'FileTree', id: 'tree-1', title: 'Files' },
        ctx
      );
      expect(element).toBeNull();
    });

    test('passes state to creator', () => {
      registerElement('DocumentEditor', createMockCreator('DocumentEditor'));

      const element = createElement(
        {
          type: 'DocumentEditor',
          id: 'doc-1',
          title: 'Doc',
          state: { scrollTop: 100 },
        },
        ctx
      ) as MockElement;

      expect(element?.stateData).toEqual({ scrollTop: 100 });
    });
  });

  describe('createElementOrThrow', () => {
    test('creates element from registered type', () => {
      registerElement('DocumentEditor', createMockCreator('DocumentEditor'));

      const element = createElementOrThrow(
        { type: 'DocumentEditor', id: 'doc-1', title: 'Doc' },
        ctx
      );

      expect(element.type).toBe('DocumentEditor');
    });

    test('throws for unregistered type', () => {
      expect(() => {
        createElementOrThrow({ type: 'FileTree', id: 'tree-1', title: 'Files' }, ctx);
      }).toThrow('Unknown element type: FileTree');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ID Generation
  // ─────────────────────────────────────────────────────────────────────────

  describe('generateElementId', () => {
    test('generates unique IDs', () => {
      const id1 = generateElementId();
      const id2 = generateElementId();
      const id3 = generateElementId();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
    });

    test('uses default prefix', () => {
      const id = generateElementId();
      expect(id).toMatch(/^element-\d+$/);
    });

    test('uses custom prefix', () => {
      const id = generateElementId('doc');
      expect(id).toMatch(/^doc-\d+$/);
    });

    test('increments counter', () => {
      resetIdCounter();
      expect(generateElementId()).toBe('element-1');
      expect(generateElementId()).toBe('element-2');
      expect(generateElementId()).toBe('element-3');
    });
  });

  describe('resetIdCounter', () => {
    test('resets counter to 0', () => {
      generateElementId();
      generateElementId();
      resetIdCounter();
      expect(generateElementId()).toBe('element-1');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Placeholder Element
  // ─────────────────────────────────────────────────────────────────────────

  describe('PlaceholderElement', () => {
    test('creates placeholder with type and id', () => {
      const placeholder = new PlaceholderElement('FileTree', 'tree-1', ctx);
      expect(placeholder.type).toBe('FileTree');
      expect(placeholder.id).toBe('tree-1');
      expect(placeholder.getTitle()).toBe('Unknown: FileTree');
    });

    test('render is callable', () => {
      const placeholder = new PlaceholderElement('FileTree', 'tree-1', ctx);
      placeholder.setBounds({ x: 0, y: 0, width: 80, height: 24 });

      // Create a mock buffer
      const mockBuffer = {
        writeString: () => 0,
      } as unknown as ScreenBuffer;

      expect(() => placeholder.render(mockBuffer)).not.toThrow();
    });
  });

  describe('createPlaceholder', () => {
    test('creates placeholder element', () => {
      const placeholder = createPlaceholder('GitPanel', 'git-1', ctx);
      expect(placeholder).toBeInstanceOf(PlaceholderElement);
      expect(placeholder.type).toBe('GitPanel');
      expect(placeholder.id).toBe('git-1');
    });
  });

  describe('createElementWithFallback', () => {
    test('creates registered element', () => {
      registerElement('DocumentEditor', createMockCreator('DocumentEditor'));

      const element = createElementWithFallback(
        { type: 'DocumentEditor', id: 'doc-1', title: 'Doc' },
        ctx
      );

      expect(element).toBeInstanceOf(MockElement);
      expect(element.type).toBe('DocumentEditor');
    });

    test('creates placeholder for unregistered type', () => {
      const element = createElementWithFallback(
        { type: 'FileTree', id: 'tree-1', title: 'Files' },
        ctx
      );

      expect(element).toBeInstanceOf(PlaceholderElement);
      expect(element.type).toBe('FileTree');
    });
  });
});
