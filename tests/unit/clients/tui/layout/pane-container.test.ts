/**
 * PaneContainer Tests
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  PaneContainer,
  createPaneContainer,
  type PaneContainerCallbacks,
} from '../../../../../src/clients/tui/layout/pane-container.ts';
import {
  FocusManager,
  createFocusManager,
} from '../../../../../src/clients/tui/input/focus-manager.ts';
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
  constructor(id: string, title: string, ctx: ElementContext) {
    super('DocumentEditor', id, title, ctx);
  }

  render(_buffer: ScreenBuffer): void {}
}

// ============================================
// Test Setup
// ============================================

function createTestCallbacks(): PaneContainerCallbacks & { dirtyCount: number } {
  const callbacks = {
    dirtyCount: 0,
    onDirty: () => {
      callbacks.dirtyCount++;
    },
    getThemeColor: (_key: string, fallback = '#ffffff') => fallback,
    getSetting: <T>(_key: string, defaultValue: T): T => defaultValue,
    getBackgroundForFocus: (_type: string, _isFocused: boolean) => '#1e1e1e',
    getForegroundForFocus: (_type: string, _isFocused: boolean) => '#ffffff',
    getSelectionBackground: (_type: string, _isFocused: boolean) => '#264f78',
  };
  return callbacks;
}

// ============================================
// Tests
// ============================================

describe('PaneContainer', () => {
  let container: PaneContainer;
  let callbacks: ReturnType<typeof createTestCallbacks>;
  let focusManager: FocusManager;

  beforeEach(() => {
    clearRegistry();

    // Register test element
    registerElement('DocumentEditor', (id, title, ctx) => {
      return new TestElement(id, title, ctx);
    });

    callbacks = createTestCallbacks();
    container = new PaneContainer(callbacks);
    container.setBounds({ x: 0, y: 0, width: 80, height: 24 });

    focusManager = createFocusManager();
    container.setFocusManager(focusManager);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Construction & Initialization
  // ─────────────────────────────────────────────────────────────────────────

  describe('construction', () => {
    test('starts empty', () => {
      expect(container.isEmpty()).toBe(true);
      expect(container.getPaneCount()).toBe(0);
    });

    test('ensureRoot creates first pane', () => {
      const pane = container.ensureRoot();
      expect(pane).toBeDefined();
      expect(container.getPaneCount()).toBe(1);
    });

    test('ensureRoot is idempotent', () => {
      const pane1 = container.ensureRoot();
      const pane2 = container.ensureRoot();
      expect(pane1.id).toBe(pane2.id);
      expect(container.getPaneCount()).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Layout
  // ─────────────────────────────────────────────────────────────────────────

  describe('layout', () => {
    test('setBounds updates bounds', () => {
      container.setBounds({ x: 10, y: 20, width: 100, height: 50 });
      expect(container.getBounds()).toEqual({ x: 10, y: 20, width: 100, height: 50 });
    });

    test('pane receives container bounds', () => {
      container.setBounds({ x: 0, y: 0, width: 80, height: 24 });
      const pane = container.ensureRoot();
      expect(pane.getBounds()).toEqual({ x: 0, y: 0, width: 80, height: 24 });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Splitting
  // ─────────────────────────────────────────────────────────────────────────

  describe('split', () => {
    test('vertical split creates two panes side by side', () => {
      const root = container.ensureRoot();
      const newPaneId = container.split('vertical');

      expect(container.getPaneCount()).toBe(2);

      const newPane = container.getPane(newPaneId);
      expect(newPane).not.toBeNull();

      // Original should be on left, new on right
      const rootBounds = root.getBounds();
      const newBounds = newPane!.getBounds();

      expect(rootBounds.x).toBe(0);
      expect(newBounds.x).toBeGreaterThan(rootBounds.x);
    });

    test('horizontal split creates two panes stacked', () => {
      const root = container.ensureRoot();
      const newPaneId = container.split('horizontal');

      expect(container.getPaneCount()).toBe(2);

      const newPane = container.getPane(newPaneId);

      // Original should be on top, new on bottom
      const rootBounds = root.getBounds();
      const newBounds = newPane!.getBounds();

      expect(rootBounds.y).toBe(0);
      expect(newBounds.y).toBeGreaterThan(rootBounds.y);
    });

    test('split respects 50/50 ratio', () => {
      container.setBounds({ x: 0, y: 0, width: 80, height: 24 });
      container.ensureRoot();
      const newPaneId = container.split('vertical');

      const root = container.getPanes()[0];
      const newPane = container.getPane(newPaneId);

      // Account for 1 char divider: (80 - 1) / 2 = 39.5
      expect(root.getBounds().width).toBeCloseTo(39, 1);
      expect(newPane!.getBounds().width).toBeCloseTo(39, 1);
    });

    test('split specific pane', () => {
      const pane1 = container.ensureRoot();
      const pane2Id = container.split('vertical', pane1.id);
      const pane3Id = container.split('vertical', pane2Id);

      expect(container.getPaneCount()).toBe(3);
    });

    test('split marks dirty', () => {
      container.ensureRoot();
      callbacks.dirtyCount = 0;
      container.split('vertical');
      expect(callbacks.dirtyCount).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Close
  // ─────────────────────────────────────────────────────────────────────────

  describe('close', () => {
    test('close removes pane', () => {
      const root = container.ensureRoot();
      const newPaneId = container.split('vertical');

      expect(container.close(newPaneId)).toBe(true);
      expect(container.getPaneCount()).toBe(1);
      expect(container.getPane(newPaneId)).toBeNull();
    });

    test('closing last pane creates new empty pane', () => {
      const root = container.ensureRoot();
      container.close(root.id);

      expect(container.getPaneCount()).toBe(1);
      // It's a new pane, not the old one
      expect(container.getPane(root.id)).toBeNull();
    });

    test('close returns false for unknown pane', () => {
      expect(container.close('unknown')).toBe(false);
    });

    test('close collapses split with single child', () => {
      container.ensureRoot();
      const pane2 = container.split('vertical');
      const pane3 = container.split('vertical', pane2);

      // Close middle pane
      container.close(pane2);

      // Should still have 2 panes
      expect(container.getPaneCount()).toBe(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Element Management
  // ─────────────────────────────────────────────────────────────────────────

  describe('element management', () => {
    test('addElement adds to specified pane', () => {
      const pane = container.ensureRoot();
      const elemId = container.addElement(pane.id, 'DocumentEditor', 'Test');

      expect(pane.hasElement(elemId)).toBe(true);
    });

    test('addElement throws for unknown pane', () => {
      expect(() => container.addElement('unknown', 'DocumentEditor')).toThrow();
    });

    test('removeElement removes from any pane', () => {
      const pane = container.ensureRoot();
      const elemId = container.addElement(pane.id, 'DocumentEditor', 'Test');

      expect(container.removeElement(elemId)).toBe(true);
      expect(pane.hasElement(elemId)).toBe(false);
    });

    test('removeElement returns false for unknown element', () => {
      container.ensureRoot();
      expect(container.removeElement('unknown')).toBe(false);
    });

    test('moveElement moves between panes', () => {
      const pane1 = container.ensureRoot();
      const pane2Id = container.split('vertical');
      const pane2 = container.getPane(pane2Id)!;

      const elemId = container.addElement(pane1.id, 'DocumentEditor', 'Test');

      expect(container.moveElement(elemId, pane2Id)).toBe(true);
      expect(pane1.hasElement(elemId)).toBe(false);
      expect(pane2.hasElement(elemId)).toBe(true);
    });

    test('moveElement returns false for unknown target', () => {
      const pane = container.ensureRoot();
      const elemId = container.addElement(pane.id, 'DocumentEditor');

      expect(container.moveElement(elemId, 'unknown')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Focus Resolver
  // ─────────────────────────────────────────────────────────────────────────

  describe('focus resolver', () => {
    test('getPaneIds returns all pane IDs', () => {
      container.ensureRoot();
      container.split('vertical');

      const ids = container.getPaneIds();
      expect(ids).toHaveLength(2);
    });

    test('getElement finds element across panes', () => {
      const pane = container.ensureRoot();
      const elemId = container.addElement(pane.id, 'DocumentEditor', 'Test');

      const element = container.getElement(elemId);
      expect(element).not.toBeNull();
      expect(element?.getTitle()).toBe('Test');
    });

    test('findPaneForElement returns correct pane ID', () => {
      const pane = container.ensureRoot();
      const elemId = container.addElement(pane.id, 'DocumentEditor');

      expect(container.findPaneForElement(elemId)).toBe(pane.id);
    });

    test('getActiveElementInPane returns active element', () => {
      const pane = container.ensureRoot();
      container.addElement(pane.id, 'DocumentEditor', 'First');
      const secondId = container.addElement(pane.id, 'DocumentEditor', 'Second');

      const active = container.getActiveElementInPane(pane.id);
      expect(active?.id).toBe(secondId);
    });

    test('getElementsInPane returns all elements', () => {
      const pane = container.ensureRoot();
      container.addElement(pane.id, 'DocumentEditor');
      container.addElement(pane.id, 'DocumentEditor');

      const elements = container.getElementsInPane(pane.id);
      expect(elements).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────────────────

  describe('rendering', () => {
    test('render is callable', () => {
      container.ensureRoot();
      const buffer = createScreenBuffer({ width: 80, height: 24 });

      expect(() => container.render(buffer)).not.toThrow();
    });

    test('renders dividers for splits', () => {
      container.ensureRoot();
      container.split('vertical');
      const buffer = createScreenBuffer({ width: 80, height: 24 });

      container.render(buffer);

      // There should be a vertical divider somewhere in the middle
      // Approximately at x = 39 (half of 79)
      let foundDivider = false;
      for (let x = 35; x < 45; x++) {
        const cell = buffer.get(x, 12);
        if (cell?.char === '│') {
          foundDivider = true;
          break;
        }
      }
      expect(foundDivider).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Serialization
  // ─────────────────────────────────────────────────────────────────────────

  describe('serialization', () => {
    test('serialize captures layout', () => {
      container.ensureRoot();
      container.split('vertical');

      const config = container.serialize();

      // Should be a SplitConfig at root
      expect('direction' in config).toBe(true);
    });

    test('deserialize restores layout', () => {
      container.ensureRoot();
      container.split('vertical');
      const config = container.serialize();

      // Create new container
      const container2 = new PaneContainer(callbacks);
      container2.setBounds({ x: 0, y: 0, width: 80, height: 24 });
      container2.deserialize(config);

      expect(container2.getPaneCount()).toBe(2);
    });

    test('serialize single pane returns PaneConfig', () => {
      const pane = container.ensureRoot();
      pane.addElement('DocumentEditor', 'Test');

      const config = container.serialize();

      expect('mode' in config).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Queries
  // ─────────────────────────────────────────────────────────────────────────

  describe('queries', () => {
    test('getPanes returns all panes', () => {
      container.ensureRoot();
      container.split('vertical');

      const panes = container.getPanes();
      expect(panes).toHaveLength(2);
    });

    test('getPane returns pane by ID', () => {
      const root = container.ensureRoot();
      expect(container.getPane(root.id)).toBe(root);
    });

    test('getPane returns null for unknown ID', () => {
      expect(container.getPane('unknown')).toBeNull();
    });

    test('isEmpty returns false when panes exist', () => {
      container.ensureRoot();
      expect(container.isEmpty()).toBe(false);
    });
  });
});

// ============================================
// Factory Function Tests
// ============================================

describe('createPaneContainer', () => {
  test('creates a new PaneContainer instance', () => {
    const callbacks = createTestCallbacks();
    const container = createPaneContainer(callbacks);

    expect(container).toBeInstanceOf(PaneContainer);
  });
});
