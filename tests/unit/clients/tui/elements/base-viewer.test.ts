/**
 * BaseViewer Tests
 *
 * Tests for the abstract BaseViewer class.
 * We create a concrete test implementation to test the base functionality.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { BaseViewer } from '../../../../../src/clients/tui/elements/base-viewer.ts';
import { createTestContext, type ElementContext } from '../../../../../src/clients/tui/elements/base.ts';
import { createScreenBuffer } from '../../../../../src/clients/tui/rendering/buffer.ts';
import type { ViewerItem, ViewerCallbacks } from '../../../../../src/clients/tui/artifacts/types.ts';
import type { ScreenBuffer } from '../../../../../src/clients/tui/rendering/buffer.ts';

// ============================================
// Test Implementation
// ============================================

interface TestItem extends ViewerItem {
  value: number;
}

class TestViewer extends BaseViewer<TestItem> {
  protected renderItem(
    buffer: ScreenBuffer,
    item: TestItem,
    x: number,
    y: number,
    width: number,
    isSelected: boolean
  ): void {
    const bg = isSelected ? '#094771' : '#1e1e1e';
    const fg = '#d4d4d4';
    const indent = '  '.repeat(item.depth);
    const icon = item.expandable
      ? (this.collapsedIds.has(item.id) ? '▶' : '▼')
      : ' ';
    const text = `${indent}${icon} ${item.label}`;
    buffer.writeString(x, y, text.padEnd(width, ' '), fg, bg);
  }

  // Expose protected methods for testing
  public testGetContentHeight(): number {
    return this.getContentHeight();
  }

  public testGetFlatItems(): TestItem[] {
    return this.flatItems;
  }

  public testGetScrollTop(): number {
    return this.scrollTop;
  }

  public testGetSelectedIndex(): number {
    return this.selectedIndex;
  }
}

// ============================================
// Test Data
// ============================================

function createTestItems(): TestItem[] {
  return [
    {
      id: 'root1',
      label: 'Root 1',
      depth: 0,
      expandable: true,
      children: [
        { id: 'child1', label: 'Child 1', depth: 1, expandable: false, children: [], value: 1 },
        { id: 'child2', label: 'Child 2', depth: 1, expandable: false, children: [], value: 2 },
      ],
      value: 0,
    },
    {
      id: 'root2',
      label: 'Root 2',
      depth: 0,
      expandable: true,
      children: [
        { id: 'child3', label: 'Child 3', depth: 1, expandable: false, children: [], value: 3 },
      ],
      value: 0,
    },
    {
      id: 'root3',
      label: 'Root 3',
      depth: 0,
      expandable: false,
      children: [],
      value: 100,
    },
  ];
}

// ============================================
// Tests
// ============================================

describe('BaseViewer', () => {
  let viewer: TestViewer;
  let ctx: ElementContext;

  beforeEach(() => {
    ctx = createTestContext();
    viewer = new TestViewer('viewer1', 'Test Viewer', ctx);
    viewer.setBounds({ x: 0, y: 0, width: 40, height: 20 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Item Management
  // ─────────────────────────────────────────────────────────────────────────

  describe('item management', () => {
    test('setItems sets items', () => {
      const items = createTestItems();
      viewer.setItems(items);

      expect(viewer.getItems()).toHaveLength(3);
    });

    test('setItems flattens tree', () => {
      viewer.setItems(createTestItems());

      // Should have: root1, child1, child2, root2, child3, root3 = 6 items
      expect(viewer.testGetFlatItems()).toHaveLength(6);
    });

    test('getSelectedItem returns current selection', () => {
      viewer.setItems(createTestItems());

      const selected = viewer.getSelectedItem();
      expect(selected).not.toBeNull();
      expect(selected?.id).toBe('root1');
    });

    test('getItems returns copy of items', () => {
      const items = createTestItems();
      viewer.setItems(items);

      const retrieved = viewer.getItems();
      expect(retrieved).not.toBe(items);
      expect(retrieved).toHaveLength(items.length);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────────────────────────────────────────

  describe('navigation', () => {
    beforeEach(() => {
      viewer.setItems(createTestItems());
    });

    test('moveDown moves selection down', () => {
      viewer.moveDown();

      expect(viewer.testGetSelectedIndex()).toBe(1);
      expect(viewer.getSelectedItem()?.id).toBe('child1');
    });

    test('moveUp moves selection up', () => {
      viewer.moveDown();
      viewer.moveDown();
      viewer.moveUp();

      expect(viewer.testGetSelectedIndex()).toBe(1);
    });

    test('moveUp at top stays at top', () => {
      viewer.moveUp();

      expect(viewer.testGetSelectedIndex()).toBe(0);
    });

    test('moveDown at bottom stays at bottom', () => {
      // Move to last item
      for (let i = 0; i < 10; i++) {
        viewer.moveDown();
      }

      const lastIndex = viewer.testGetFlatItems().length - 1;
      expect(viewer.testGetSelectedIndex()).toBe(lastIndex);
    });

    test('pageDown moves by content height', () => {
      // Create many items to test paging
      const manyItems: TestItem[] = [];
      for (let i = 0; i < 50; i++) {
        manyItems.push({
          id: `item${i}`,
          label: `Item ${i}`,
          depth: 0,
          expandable: false,
          children: [],
          value: i,
        });
      }
      viewer.setItems(manyItems);

      viewer.pageDown();

      // Should move by content height (height - header - hints)
      expect(viewer.testGetSelectedIndex()).toBeGreaterThan(5);
    });

    test('pageUp moves by content height', () => {
      const manyItems: TestItem[] = [];
      for (let i = 0; i < 50; i++) {
        manyItems.push({
          id: `item${i}`,
          label: `Item ${i}`,
          depth: 0,
          expandable: false,
          children: [],
          value: i,
        });
      }
      viewer.setItems(manyItems);

      // Move down first
      viewer.pageDown();
      viewer.pageDown();
      const afterDown = viewer.testGetSelectedIndex();

      viewer.pageUp();

      expect(viewer.testGetSelectedIndex()).toBeLessThan(afterDown);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Expand/Collapse
  // ─────────────────────────────────────────────────────────────────────────

  describe('expand/collapse', () => {
    beforeEach(() => {
      viewer.setItems(createTestItems());
    });

    test('toggleExpand collapses expandable item', () => {
      // root1 is expandable and expanded by default
      viewer.toggleExpand();

      // After collapsing root1, we should have: root1, root2, child3, root3 = 4 items
      expect(viewer.testGetFlatItems()).toHaveLength(4);
    });

    test('toggleExpand expands collapsed item', () => {
      viewer.toggleExpand(); // Collapse
      viewer.toggleExpand(); // Expand

      // Should be back to 6 items
      expect(viewer.testGetFlatItems()).toHaveLength(6);
    });

    test('toggleExpand on non-expandable does nothing', () => {
      // Navigate to root3 (non-expandable)
      for (let i = 0; i < 5; i++) {
        viewer.moveDown();
      }

      const before = viewer.testGetFlatItems().length;
      viewer.toggleExpand();
      const after = viewer.testGetFlatItems().length;

      expect(after).toBe(before);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // State Serialization
  // ─────────────────────────────────────────────────────────────────────────

  describe('state serialization', () => {
    test('getState returns current state', () => {
      viewer.setItems(createTestItems());
      // First item is root1, collapse it
      viewer.toggleExpand(); // Collapse root1

      const state = viewer.getState();

      expect(state.selectedIndex).toBe(0);
      expect(state.collapsedIds).toContain('root1');
    });

    test('setState restores state', () => {
      viewer.setItems(createTestItems());

      viewer.setState({
        scrollTop: 5,
        selectedIndex: 2,
        collapsedIds: ['root1'],
      });

      expect(viewer.testGetScrollTop()).toBe(5);
      expect(viewer.testGetSelectedIndex()).toBe(2);
      // root1 should be collapsed
      expect(viewer.testGetFlatItems()).toHaveLength(4);
    });

    test('setState clamps selectedIndex to valid range', () => {
      viewer.setItems(createTestItems());

      viewer.setState({
        selectedIndex: 100, // Way beyond bounds
        collapsedIds: [],
      });

      // Should be clamped to last valid index
      expect(viewer.testGetSelectedIndex()).toBeLessThan(10);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Callbacks
  // ─────────────────────────────────────────────────────────────────────────

  describe('callbacks', () => {
    test('onSelect called on selection change', () => {
      let selectedItem: TestItem | null = null;
      const callbacks: ViewerCallbacks<TestItem> = {
        onSelect: (item) => {
          selectedItem = item;
        },
      };

      viewer.setCallbacks(callbacks);
      viewer.setItems(createTestItems());
      viewer.moveDown();

      expect(selectedItem).not.toBeNull();
      expect(selectedItem?.id).toBe('child1');
    });

    test('onActivate called on Enter', () => {
      let activatedItem: TestItem | null = null;
      const callbacks: ViewerCallbacks<TestItem> = {
        onActivate: (item) => {
          activatedItem = item;
        },
      };

      viewer.setCallbacks(callbacks);
      viewer.setItems(createTestItems());
      viewer.moveDown(); // Select child1

      viewer.handleKey({ key: 'Enter', ctrl: false, alt: false, shift: false, meta: false });

      expect(activatedItem).not.toBeNull();
      expect(activatedItem?.id).toBe('child1');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Input Handling
  // ─────────────────────────────────────────────────────────────────────────

  describe('input handling', () => {
    beforeEach(() => {
      viewer.setItems(createTestItems());
    });

    test('ArrowDown moves selection down', () => {
      const result = viewer.handleKey({ key: 'ArrowDown', ctrl: false, alt: false, shift: false, meta: false });

      expect(result).toBe(true);
      expect(viewer.testGetSelectedIndex()).toBe(1);
    });

    test('ArrowUp moves selection up', () => {
      viewer.moveDown();
      const result = viewer.handleKey({ key: 'ArrowUp', ctrl: false, alt: false, shift: false, meta: false });

      expect(result).toBe(true);
      expect(viewer.testGetSelectedIndex()).toBe(0);
    });

    test('Space toggles expand', () => {
      const beforeLength = viewer.testGetFlatItems().length;

      viewer.handleKey({ key: ' ', ctrl: false, alt: false, shift: false, meta: false });

      expect(viewer.testGetFlatItems().length).not.toBe(beforeLength);
    });

    test('PageDown pages down', () => {
      const result = viewer.handleKey({ key: 'PageDown', ctrl: false, alt: false, shift: false, meta: false });

      expect(result).toBe(true);
    });

    test('PageUp pages up', () => {
      viewer.moveDown();
      viewer.moveDown();
      const result = viewer.handleKey({ key: 'PageUp', ctrl: false, alt: false, shift: false, meta: false });

      expect(result).toBe(true);
    });

    test('unhandled key returns false', () => {
      const result = viewer.handleKey({ key: 'x', ctrl: false, alt: false, shift: false, meta: false });

      expect(result).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Mouse Handling
  // ─────────────────────────────────────────────────────────────────────────

  describe('mouse handling', () => {
    beforeEach(() => {
      viewer.setItems(createTestItems());
    });

    test('click selects item', () => {
      // Click on row 3 (after header)
      const result = viewer.handleMouse({
        type: 'press',
        button: 'left',
        x: 10,
        y: 3,
        ctrl: false,
        alt: false,
        shift: false,
      });

      expect(result).toBe(true);
      expect(viewer.testGetSelectedIndex()).toBe(2); // Row 3 = index 2 (after header)
    });

    test('scroll down increases scrollTop', () => {
      const manyItems: TestItem[] = [];
      for (let i = 0; i < 50; i++) {
        manyItems.push({
          id: `item${i}`,
          label: `Item ${i}`,
          depth: 0,
          expandable: false,
          children: [],
          value: i,
        });
      }
      viewer.setItems(manyItems);

      const beforeScroll = viewer.testGetScrollTop();

      viewer.handleMouse({
        type: 'scroll',
        button: 'none',
        x: 10,
        y: 5,
        ctrl: false,
        alt: false,
        shift: false,
        scrollDirection: 1, // Down
      });

      expect(viewer.testGetScrollTop()).toBeGreaterThan(beforeScroll);
    });

    test('scroll up decreases scrollTop', () => {
      const manyItems: TestItem[] = [];
      for (let i = 0; i < 50; i++) {
        manyItems.push({
          id: `item${i}`,
          label: `Item ${i}`,
          depth: 0,
          expandable: false,
          children: [],
          value: i,
        });
      }
      viewer.setItems(manyItems);

      // First scroll down
      viewer.handleMouse({
        type: 'scroll',
        button: 'none',
        x: 10,
        y: 5,
        ctrl: false,
        alt: false,
        shift: false,
        scrollDirection: 1,
      });
      viewer.handleMouse({
        type: 'scroll',
        button: 'none',
        x: 10,
        y: 5,
        ctrl: false,
        alt: false,
        shift: false,
        scrollDirection: 1,
      });

      const beforeScroll = viewer.testGetScrollTop();

      viewer.handleMouse({
        type: 'scroll',
        button: 'none',
        x: 10,
        y: 5,
        ctrl: false,
        alt: false,
        shift: false,
        scrollDirection: -1, // Up
      });

      expect(viewer.testGetScrollTop()).toBeLessThan(beforeScroll);
    });

    test('drag event is not handled', () => {
      const result = viewer.handleMouse({
        type: 'drag',
        button: 'left',
        x: 10,
        y: 5,
        ctrl: false,
        alt: false,
        shift: false,
      });

      expect(result).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────────────────

  describe('rendering', () => {
    test('renders header', () => {
      viewer.setItems(createTestItems());

      const buffer = createScreenBuffer({ width: 40, height: 20 });
      viewer.render(buffer);

      // Check for 'Test Viewer' in header (row 0)
      let foundTitle = false;
      for (let x = 0; x < 40; x++) {
        if (buffer.get(x, 0)?.char === 'T' &&
            buffer.get(x + 1, 0)?.char === 'e' &&
            buffer.get(x + 2, 0)?.char === 's' &&
            buffer.get(x + 3, 0)?.char === 't') {
          foundTitle = true;
          break;
        }
      }
      expect(foundTitle).toBe(true);
    });

    test('renders items', () => {
      viewer.setItems(createTestItems());

      const buffer = createScreenBuffer({ width: 40, height: 20 });
      viewer.render(buffer);

      // Check for 'Root 1' in content
      let foundRoot1 = false;
      for (let y = 1; y < 20; y++) {
        for (let x = 0; x < 35; x++) {
          if (buffer.get(x, y)?.char === 'R' &&
              buffer.get(x + 1, y)?.char === 'o' &&
              buffer.get(x + 2, y)?.char === 'o' &&
              buffer.get(x + 3, y)?.char === 't') {
            foundRoot1 = true;
            break;
          }
        }
        if (foundRoot1) break;
      }
      expect(foundRoot1).toBe(true);
    });

    test('renders empty state', () => {
      viewer.setItems([]);

      const buffer = createScreenBuffer({ width: 40, height: 20 });
      viewer.render(buffer);

      // Check for 'No items'
      let foundEmpty = false;
      for (let y = 0; y < 20; y++) {
        for (let x = 0; x < 35; x++) {
          if (buffer.get(x, y)?.char === 'N' &&
              buffer.get(x + 1, y)?.char === 'o' &&
              buffer.get(x + 2, y)?.char === ' ' &&
              buffer.get(x + 3, y)?.char === 'i') {
            foundEmpty = true;
            break;
          }
        }
        if (foundEmpty) break;
      }
      expect(foundEmpty).toBe(true);
    });
  });
});
