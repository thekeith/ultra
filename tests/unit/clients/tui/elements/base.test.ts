/**
 * BaseElement Tests
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  BaseElement,
  type ElementContext,
  createTestContext,
} from '../../../../../src/clients/tui/elements/base.ts';
import type { ScreenBuffer } from '../../../../../src/clients/tui/rendering/buffer.ts';
import type { KeyEvent, MouseEvent } from '../../../../../src/clients/tui/types.ts';

// ============================================
// Test Implementation
// ============================================

class TestElement extends BaseElement {
  public renderCalled = false;
  public lastRenderBuffer: ScreenBuffer | null = null;

  constructor(id: string, title: string, ctx: ElementContext) {
    super('DocumentEditor', id, title, ctx);
  }

  render(buffer: ScreenBuffer): void {
    this.renderCalled = true;
    this.lastRenderBuffer = buffer;
  }
}

// ============================================
// Tests
// ============================================

describe('BaseElement', () => {
  let ctx: ElementContext;
  let markDirtyCalled: boolean;
  let requestFocusCalled: boolean;
  let titleUpdates: string[];
  let statusUpdates: string[];

  beforeEach(() => {
    markDirtyCalled = false;
    requestFocusCalled = false;
    titleUpdates = [];
    statusUpdates = [];

    ctx = createTestContext({
      markDirty: () => {
        markDirtyCalled = true;
      },
      requestFocus: () => {
        requestFocusCalled = true;
      },
      updateTitle: (title) => {
        titleUpdates.push(title);
      },
      updateStatus: (status) => {
        statusUpdates.push(status);
      },
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Construction
  // ─────────────────────────────────────────────────────────────────────────

  describe('construction', () => {
    test('creates element with type, id, and title', () => {
      const element = new TestElement('test-1', 'Test Element', ctx);
      expect(element.type).toBe('DocumentEditor');
      expect(element.id).toBe('test-1');
      expect(element.getTitle()).toBe('Test Element');
    });

    test('initializes with default state', () => {
      const element = new TestElement('test-1', 'Test', ctx);
      expect(element.isFocused()).toBe(false);
      expect(element.isVisible()).toBe(false);
      expect(element.getStatus()).toBe('');
      expect(element.getBounds()).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  describe('lifecycle', () => {
    test('onMount is callable', () => {
      const element = new TestElement('test-1', 'Test', ctx);
      expect(() => element.onMount()).not.toThrow();
    });

    test('onUnmount is callable', () => {
      const element = new TestElement('test-1', 'Test', ctx);
      expect(() => element.onUnmount()).not.toThrow();
    });

    test('onFocus sets focused state and marks dirty', () => {
      const element = new TestElement('test-1', 'Test', ctx);
      element.onFocus();
      expect(element.isFocused()).toBe(true);
      expect(markDirtyCalled).toBe(true);
    });

    test('onBlur clears focused state and marks dirty', () => {
      const element = new TestElement('test-1', 'Test', ctx);
      element.onFocus();
      markDirtyCalled = false;

      element.onBlur();
      expect(element.isFocused()).toBe(false);
      expect(markDirtyCalled).toBe(true);
    });

    test('onResize updates bounds dimensions and marks dirty', () => {
      const element = new TestElement('test-1', 'Test', ctx);
      element.setBounds({ x: 10, y: 20, width: 100, height: 50 });
      markDirtyCalled = false;

      element.onResize({ width: 200, height: 80 });
      expect(element.getBounds().width).toBe(200);
      expect(element.getBounds().height).toBe(80);
      expect(markDirtyCalled).toBe(true);
    });

    test('onVisibilityChange updates visible state', () => {
      const element = new TestElement('test-1', 'Test', ctx);

      element.onVisibilityChange(true);
      expect(element.isVisible()).toBe(true);
      expect(markDirtyCalled).toBe(true);

      markDirtyCalled = false;
      element.onVisibilityChange(false);
      expect(element.isVisible()).toBe(false);
      // Should not mark dirty when becoming invisible
      expect(markDirtyCalled).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────────────────

  describe('render', () => {
    test('render is called with buffer', () => {
      const element = new TestElement('test-1', 'Test', ctx);
      const mockBuffer = {} as ScreenBuffer;

      element.render(mockBuffer);
      expect(element.renderCalled).toBe(true);
      expect(element.lastRenderBuffer).toBe(mockBuffer);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Input Handling
  // ─────────────────────────────────────────────────────────────────────────

  describe('input handling', () => {
    test('handleKey returns false by default', () => {
      const element = new TestElement('test-1', 'Test', ctx);
      const event: KeyEvent = { key: 'a', ctrl: false, alt: false, shift: false, meta: false };
      expect(element.handleKey(event)).toBe(false);
    });

    test('handleMouse returns false by default', () => {
      const element = new TestElement('test-1', 'Test', ctx);
      const event: MouseEvent = {
        type: 'press',
        button: 'left',
        x: 10,
        y: 20,
        ctrl: false,
        alt: false,
        shift: false,
      };
      expect(element.handleMouse(event)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // State Serialization
  // ─────────────────────────────────────────────────────────────────────────

  describe('state serialization', () => {
    test('getState returns empty object by default', () => {
      const element = new TestElement('test-1', 'Test', ctx);
      expect(element.getState()).toEqual({});
    });

    test('setState is callable', () => {
      const element = new TestElement('test-1', 'Test', ctx);
      expect(() => element.setState({ customState: true })).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Accessors
  // ─────────────────────────────────────────────────────────────────────────

  describe('title', () => {
    test('getTitle returns current title', () => {
      const element = new TestElement('test-1', 'My Title', ctx);
      expect(element.getTitle()).toBe('My Title');
    });

    test('setTitle updates title and calls callback', () => {
      const element = new TestElement('test-1', 'Original', ctx);
      element.setTitle('New Title');
      expect(element.getTitle()).toBe('New Title');
      expect(titleUpdates).toContain('New Title');
    });

    test('setTitle does not call callback if unchanged', () => {
      const element = new TestElement('test-1', 'Title', ctx);
      element.setTitle('Title');
      expect(titleUpdates).toHaveLength(0);
    });
  });

  describe('status', () => {
    test('getStatus returns current status', () => {
      const element = new TestElement('test-1', 'Test', ctx);
      expect(element.getStatus()).toBe('');
    });

    test('setStatus updates status and calls callback', () => {
      const element = new TestElement('test-1', 'Test', ctx);
      element.setStatus('Modified');
      expect(element.getStatus()).toBe('Modified');
      expect(statusUpdates).toContain('Modified');
    });

    test('setStatus does not call callback if unchanged', () => {
      const element = new TestElement('test-1', 'Test', ctx);
      element.setStatus('');
      expect(statusUpdates).toHaveLength(0);
    });
  });

  describe('bounds', () => {
    test('getBounds returns copy of bounds', () => {
      const element = new TestElement('test-1', 'Test', ctx);
      element.setBounds({ x: 10, y: 20, width: 100, height: 50 });

      const bounds = element.getBounds();
      expect(bounds).toEqual({ x: 10, y: 20, width: 100, height: 50 });

      // Modifying returned bounds should not affect element
      bounds.x = 999;
      expect(element.getBounds().x).toBe(10);
    });

    test('setBounds triggers onResize when size changes', () => {
      const element = new TestElement('test-1', 'Test', ctx);
      element.setBounds({ x: 0, y: 0, width: 100, height: 50 });
      markDirtyCalled = false;

      element.setBounds({ x: 10, y: 20, width: 200, height: 80 });
      expect(markDirtyCalled).toBe(true);
    });

    test('setBounds does not trigger onResize when size unchanged', () => {
      const element = new TestElement('test-1', 'Test', ctx);
      element.setBounds({ x: 0, y: 0, width: 100, height: 50 });
      markDirtyCalled = false;

      element.setBounds({ x: 10, y: 20, width: 100, height: 50 });
      expect(markDirtyCalled).toBe(false);
    });
  });

  describe('context', () => {
    test('getContext returns current context', () => {
      const element = new TestElement('test-1', 'Test', ctx);
      expect(element.getContext()).toBe(ctx);
    });

    test('setContext updates context', () => {
      const element = new TestElement('test-1', 'Test', ctx);
      const newCtx = createTestContext();
      element.setContext(newCtx);
      expect(element.getContext()).toBe(newCtx);
    });
  });
});

// ============================================
// createTestContext Tests
// ============================================

describe('createTestContext', () => {
  test('creates minimal context with defaults', () => {
    const ctx = createTestContext();
    expect(ctx.markDirty).toBeDefined();
    expect(ctx.requestFocus).toBeDefined();
    expect(ctx.updateTitle).toBeDefined();
    expect(ctx.updateStatus).toBeDefined();
    expect(ctx.getThemeColor).toBeDefined();
  });

  test('getThemeColor returns fallback', () => {
    const ctx = createTestContext();
    expect(ctx.getThemeColor('editor.background', '#123456')).toBe('#123456');
  });

  test('getThemeColor uses default fallback', () => {
    const ctx = createTestContext();
    expect(ctx.getThemeColor('unknown')).toBe('#ffffff');
  });

  test('allows overriding methods', () => {
    let called = false;
    const ctx = createTestContext({
      markDirty: () => {
        called = true;
      },
    });

    ctx.markDirty();
    expect(called).toBe(true);
  });
});
