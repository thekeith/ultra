/**
 * Pane Tests
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  Pane,
  createPane,
  type PaneCallbacks,
} from '../../../../../src/clients/tui/layout/pane.ts';
import {
  registerElement,
  clearRegistry,
} from '../../../../../src/clients/tui/elements/factory.ts';
import {
  BaseElement,
  type ElementContext,
} from '../../../../../src/clients/tui/elements/base.ts';
import type { ScreenBuffer } from '../../../../../src/clients/tui/rendering/buffer.ts';
import { createScreenBuffer } from '../../../../../src/clients/tui/rendering/buffer.ts';

// ============================================
// Test Element
// ============================================

class TestElement extends BaseElement {
  public renderCount = 0;

  constructor(id: string, title: string, ctx: ElementContext) {
    super('DocumentEditor', id, title, ctx);
  }

  render(_buffer: ScreenBuffer): void {
    this.renderCount++;
  }
}

// ============================================
// Test Setup
// ============================================

function createTestCallbacks(): PaneCallbacks & {
  dirtyCount: number;
  focusRequests: string[];
} {
  const callbacks = {
    dirtyCount: 0,
    focusRequests: [] as string[],
    onDirty: () => {
      callbacks.dirtyCount++;
    },
    onFocusRequest: (id: string) => {
      callbacks.focusRequests.push(id);
    },
    getThemeColor: (_key: string, fallback = '#ffffff') => fallback,
    getSetting: <T>(_key: string, defaultValue: T): T => defaultValue,
    isPaneFocused: () => true,
    getBackgroundForFocus: (_type: string, _isFocused: boolean) => '#1e1e1e',
    getForegroundForFocus: (_type: string, _isFocused: boolean) => '#ffffff',
  };
  return callbacks;
}

// ============================================
// Tests
// ============================================

describe('Pane', () => {
  let pane: Pane;
  let callbacks: ReturnType<typeof createTestCallbacks>;

  beforeEach(() => {
    clearRegistry();

    // Register test element
    registerElement('DocumentEditor', (id, title, ctx) => {
      return new TestElement(id, title, ctx);
    });

    callbacks = createTestCallbacks();
    pane = new Pane('pane-1', callbacks);
    pane.setBounds({ x: 0, y: 0, width: 80, height: 24 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Construction
  // ─────────────────────────────────────────────────────────────────────────

  describe('construction', () => {
    test('creates pane with id', () => {
      expect(pane.id).toBe('pane-1');
    });

    test('defaults to tabs mode', () => {
      expect(pane.getMode()).toBe('tabs');
    });

    test('starts with no elements', () => {
      expect(pane.getElementCount()).toBe(0);
      expect(pane.getElements()).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Mode
  // ─────────────────────────────────────────────────────────────────────────

  describe('mode', () => {
    test('setMode changes mode', () => {
      pane.setMode('accordion');
      expect(pane.getMode()).toBe('accordion');
    });

    test('setMode marks dirty', () => {
      callbacks.dirtyCount = 0;
      pane.setMode('accordion');
      expect(callbacks.dirtyCount).toBeGreaterThan(0);
    });

    test('setMode does nothing if same mode', () => {
      pane.setMode('tabs');
      callbacks.dirtyCount = 0;
      pane.setMode('tabs');
      expect(callbacks.dirtyCount).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Element Management
  // ─────────────────────────────────────────────────────────────────────────

  describe('addElement', () => {
    test('adds element and returns id', () => {
      const id = pane.addElement('DocumentEditor');
      expect(id).toMatch(/^pane-1-elem-\d+$/);
      expect(pane.getElementCount()).toBe(1);
    });

    test('uses provided title', () => {
      const id = pane.addElement('DocumentEditor', 'My File.ts');
      const element = pane.getElement(id);
      expect(element?.getTitle()).toBe('My File.ts');
    });

    test('uses default title if not provided', () => {
      const id = pane.addElement('DocumentEditor');
      const element = pane.getElement(id);
      expect(element?.getTitle()).toBe('Untitled');
    });

    test('makes new element active in tabs mode', () => {
      pane.addElement('DocumentEditor', 'First');
      const secondId = pane.addElement('DocumentEditor', 'Second');
      expect(pane.getActiveElement()?.id).toBe(secondId);
    });

    test('marks dirty', () => {
      callbacks.dirtyCount = 0;
      pane.addElement('DocumentEditor');
      expect(callbacks.dirtyCount).toBeGreaterThan(0);
    });
  });

  describe('removeElement', () => {
    test('removes element by id', () => {
      const id = pane.addElement('DocumentEditor');
      expect(pane.removeElement(id)).toBe(true);
      expect(pane.getElementCount()).toBe(0);
    });

    test('returns false for unknown id', () => {
      expect(pane.removeElement('unknown')).toBe(false);
    });

    test('adjusts active index when removing active element', () => {
      const first = pane.addElement('DocumentEditor', 'First');
      pane.addElement('DocumentEditor', 'Second');
      const third = pane.addElement('DocumentEditor', 'Third');

      // Third is active
      expect(pane.getActiveElement()?.id).toBe(third);

      // Remove third
      pane.removeElement(third);

      // Second should be active
      expect(pane.getActiveElement()?.getTitle()).toBe('Second');
    });

    test('adjusts active index when removing element before active', () => {
      const first = pane.addElement('DocumentEditor', 'First');
      pane.addElement('DocumentEditor', 'Second');
      const third = pane.addElement('DocumentEditor', 'Third');

      // Remove first
      pane.removeElement(first);

      // Third should still be active (now at index 1)
      expect(pane.getActiveElement()?.id).toBe(third);
    });
  });

  describe('detachElement', () => {
    test('removes and returns element', () => {
      const id = pane.addElement('DocumentEditor', 'Test');
      const element = pane.detachElement(id);

      expect(element).not.toBeNull();
      expect(element?.getTitle()).toBe('Test');
      expect(pane.getElementCount()).toBe(0);
    });

    test('returns null for unknown id', () => {
      expect(pane.detachElement('unknown')).toBeNull();
    });
  });

  describe('attachElement', () => {
    test('adds detached element to pane', () => {
      const id = pane.addElement('DocumentEditor', 'Test');
      const element = pane.detachElement(id)!;

      const pane2 = new Pane('pane-2', callbacks);
      pane2.setBounds({ x: 0, y: 0, width: 80, height: 24 });
      pane2.attachElement(element);

      expect(pane2.getElementCount()).toBe(1);
      expect(pane2.hasElement(element.id)).toBe(true);
    });

    test('makes attached element active in tabs', () => {
      const id = pane.addElement('DocumentEditor', 'Test');
      const element = pane.detachElement(id)!;

      const pane2 = new Pane('pane-2', callbacks);
      pane2.setBounds({ x: 0, y: 0, width: 80, height: 24 });
      pane2.addElement('DocumentEditor', 'Existing');
      pane2.attachElement(element);

      expect(pane2.getActiveElement()?.id).toBe(element.id);
    });
  });

  describe('hasElement', () => {
    test('returns true for existing element', () => {
      const id = pane.addElement('DocumentEditor');
      expect(pane.hasElement(id)).toBe(true);
    });

    test('returns false for unknown element', () => {
      expect(pane.hasElement('unknown')).toBe(false);
    });
  });

  describe('getElement', () => {
    test('returns element by id', () => {
      const id = pane.addElement('DocumentEditor', 'Test');
      const element = pane.getElement(id);
      expect(element?.getTitle()).toBe('Test');
    });

    test('returns null for unknown id', () => {
      expect(pane.getElement('unknown')).toBeNull();
    });
  });

  describe('unmountAll', () => {
    test('removes all elements', () => {
      pane.addElement('DocumentEditor');
      pane.addElement('DocumentEditor');
      pane.unmountAll();

      expect(pane.getElementCount()).toBe(0);
      expect(pane.getActiveElement()).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Tab Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('tabs', () => {
    test('getActiveElement returns current tab', () => {
      const id = pane.addElement('DocumentEditor', 'First');
      expect(pane.getActiveElement()?.id).toBe(id);
    });

    test('getActiveElement returns null when empty', () => {
      expect(pane.getActiveElement()).toBeNull();
    });

    test('setActiveElement switches tab', () => {
      const first = pane.addElement('DocumentEditor', 'First');
      const second = pane.addElement('DocumentEditor', 'Second');

      expect(pane.getActiveElement()?.id).toBe(second);

      pane.setActiveElement(first);
      expect(pane.getActiveElement()?.id).toBe(first);
    });

    test('setActiveElement returns false for unknown id', () => {
      pane.addElement('DocumentEditor');
      expect(pane.setActiveElement('unknown')).toBe(false);
    });

    test('nextTab cycles through tabs', () => {
      pane.addElement('DocumentEditor', 'First');
      pane.addElement('DocumentEditor', 'Second');
      pane.addElement('DocumentEditor', 'Third');

      // Start at Third (last added)
      expect(pane.getActiveElement()?.getTitle()).toBe('Third');

      pane.nextTab();
      expect(pane.getActiveElement()?.getTitle()).toBe('First');

      pane.nextTab();
      expect(pane.getActiveElement()?.getTitle()).toBe('Second');

      pane.nextTab();
      expect(pane.getActiveElement()?.getTitle()).toBe('Third');
    });

    test('prevTab cycles backwards', () => {
      pane.addElement('DocumentEditor', 'First');
      pane.addElement('DocumentEditor', 'Second');
      pane.addElement('DocumentEditor', 'Third');

      expect(pane.getActiveElement()?.getTitle()).toBe('Third');

      pane.prevTab();
      expect(pane.getActiveElement()?.getTitle()).toBe('Second');

      pane.prevTab();
      expect(pane.getActiveElement()?.getTitle()).toBe('First');

      pane.prevTab();
      expect(pane.getActiveElement()?.getTitle()).toBe('Third');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Accordion Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('accordion', () => {
    beforeEach(() => {
      pane.setMode('accordion');
    });

    test('new elements are expanded by default', () => {
      const id = pane.addElement('DocumentEditor');
      expect(pane.isAccordionExpanded(id)).toBe(true);
    });

    test('toggleAccordionSection toggles expansion', () => {
      const id = pane.addElement('DocumentEditor');

      expect(pane.isAccordionExpanded(id)).toBe(true);

      pane.toggleAccordionSection(id);
      expect(pane.isAccordionExpanded(id)).toBe(false);

      pane.toggleAccordionSection(id);
      expect(pane.isAccordionExpanded(id)).toBe(true);
    });

    test('toggleAccordionSection returns false for unknown id', () => {
      expect(pane.toggleAccordionSection('unknown')).toBe(false);
    });

    test('expandAccordionSection expands section', () => {
      const id = pane.addElement('DocumentEditor');
      pane.collapseAccordionSection(id);

      expect(pane.isAccordionExpanded(id)).toBe(false);
      expect(pane.expandAccordionSection(id)).toBe(true);
      expect(pane.isAccordionExpanded(id)).toBe(true);
    });

    test('collapseAccordionSection collapses section', () => {
      const id = pane.addElement('DocumentEditor');

      expect(pane.isAccordionExpanded(id)).toBe(true);
      expect(pane.collapseAccordionSection(id)).toBe(true);
      expect(pane.isAccordionExpanded(id)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Layout
  // ─────────────────────────────────────────────────────────────────────────

  describe('layout', () => {
    test('setBounds updates bounds', () => {
      pane.setBounds({ x: 10, y: 20, width: 100, height: 50 });
      expect(pane.getBounds()).toEqual({ x: 10, y: 20, width: 100, height: 50 });
    });

    test('getBounds returns copy', () => {
      pane.setBounds({ x: 0, y: 0, width: 80, height: 24 });
      const bounds = pane.getBounds();
      bounds.x = 999;
      expect(pane.getBounds().x).toBe(0);
    });

    test('getContentBounds returns area below tab bar', () => {
      pane.setBounds({ x: 0, y: 0, width: 80, height: 24 });
      const content = pane.getContentBounds();
      expect(content.y).toBe(1); // Tab bar takes 1 row
      expect(content.height).toBe(23);
    });

    test('elements get content bounds in tabs mode', () => {
      pane.setBounds({ x: 0, y: 0, width: 80, height: 24 });
      const id = pane.addElement('DocumentEditor');
      const element = pane.getElement(id);

      expect(element?.getBounds()).toEqual({ x: 0, y: 1, width: 80, height: 23 });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────────────────

  describe('rendering', () => {
    test('renders tab bar in tabs mode', () => {
      pane.addElement('DocumentEditor', 'Test');
      const buffer = createScreenBuffer({ width: 80, height: 24 });
      buffer.clearDirty();

      pane.render(buffer);

      // Tab bar should be at y=0
      const cell = buffer.get(1, 0);
      expect(cell?.char).toBe('T'); // Start of "Test"
    });

    test('renders only active element in tabs mode', () => {
      const id1 = pane.addElement('DocumentEditor', 'First');
      const id2 = pane.addElement('DocumentEditor', 'Second');

      const buffer = createScreenBuffer({ width: 80, height: 24 });

      pane.render(buffer);

      const elem1 = pane.getElement(id1) as TestElement;
      const elem2 = pane.getElement(id2) as TestElement;

      // Only the active (second) should have been rendered
      // But both were added after we created them, so let's check visibility
      expect(elem2.isVisible()).toBe(true);
      expect(elem1.isVisible()).toBe(false);
    });

    test('renders accordion headers', () => {
      pane.setMode('accordion');
      pane.addElement('DocumentEditor', 'Section One');
      const buffer = createScreenBuffer({ width: 80, height: 24 });

      pane.render(buffer);

      // Header should be at y=0 with expand icon
      const cell = buffer.get(1, 0);
      expect(cell?.char).toBe('▼'); // Expanded icon
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Serialization
  // ─────────────────────────────────────────────────────────────────────────

  describe('serialization', () => {
    test('serialize captures pane state', () => {
      pane.addElement('DocumentEditor', 'First');
      const secondId = pane.addElement('DocumentEditor', 'Second');

      const config = pane.serialize();

      expect(config.id).toBe('pane-1');
      expect(config.mode).toBe('tabs');
      expect(config.elements).toHaveLength(2);
      expect(config.activeElementId).toBe(secondId);
    });

    test('serialize captures accordion expanded state', () => {
      pane.setMode('accordion');
      const id1 = pane.addElement('DocumentEditor', 'First');
      const id2 = pane.addElement('DocumentEditor', 'Second');
      pane.collapseAccordionSection(id1);

      const config = pane.serialize();

      expect(config.expandedElementIds).toEqual([id2]);
    });

    test('deserialize restores state', () => {
      const id1 = pane.addElement('DocumentEditor', 'First');
      pane.addElement('DocumentEditor', 'Second');
      pane.setActiveElement(id1);

      const config = pane.serialize();

      // Create new pane and deserialize
      const pane2 = new Pane('pane-2', callbacks);
      pane2.setBounds({ x: 0, y: 0, width: 80, height: 24 });
      pane2.deserialize(config);

      expect(pane2.getElementCount()).toBe(2);
      expect(pane2.getActiveElement()?.getTitle()).toBe('First');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Focus Requests
  // ─────────────────────────────────────────────────────────────────────────

  describe('focus requests', () => {
    test('element context requestFocus calls callback', () => {
      const id = pane.addElement('DocumentEditor');
      const element = pane.getElement(id)!;

      element.getContext().requestFocus();

      expect(callbacks.focusRequests).toContain(id);
    });
  });
});

// ============================================
// Factory Function Tests
// ============================================

describe('createPane', () => {
  test('creates a new Pane instance', () => {
    const callbacks = createTestCallbacks();
    const pane = createPane('test-pane', callbacks);

    expect(pane).toBeInstanceOf(Pane);
    expect(pane.id).toBe('test-pane');
  });
});
