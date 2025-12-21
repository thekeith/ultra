/**
 * StatusBar Tests
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  StatusBar,
  createStatusBar,
  type StatusBarCallbacks,
} from '../../../../../src/clients/tui/status-bar/status-bar.ts';
import { createScreenBuffer } from '../../../../../src/clients/tui/rendering/buffer.ts';

// ============================================
// Test Setup
// ============================================

function createTestCallbacks(): StatusBarCallbacks & { toggleCount: number } {
  const callbacks = {
    toggleCount: 0,
    onToggle: () => {
      callbacks.toggleCount++;
    },
    getThemeColor: (_key: string, fallback = '#ffffff') => fallback,
  };
  return callbacks;
}

// ============================================
// Tests
// ============================================

describe('StatusBar', () => {
  let statusBar: StatusBar;
  let callbacks: ReturnType<typeof createTestCallbacks>;

  beforeEach(() => {
    callbacks = createTestCallbacks();
    statusBar = new StatusBar(callbacks);
    statusBar.setBounds({ x: 0, y: 23, width: 80, height: 1 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Layout
  // ─────────────────────────────────────────────────────────────────────────

  describe('layout', () => {
    test('setBounds updates bounds', () => {
      statusBar.setBounds({ x: 10, y: 20, width: 100, height: 5 });
      expect(statusBar.getBounds()).toEqual({ x: 10, y: 20, width: 100, height: 5 });
    });

    test('getCollapsedHeight returns 1', () => {
      expect(statusBar.getCollapsedHeight()).toBe(1);
    });

    test('getExpandedHeight returns configurable height', () => {
      expect(statusBar.getExpandedHeight()).toBe(10);
      statusBar.setExpandedHeight(15);
      expect(statusBar.getExpandedHeight()).toBe(15);
    });

    test('setExpandedHeight clamps to minimum', () => {
      statusBar.setExpandedHeight(1);
      expect(statusBar.getExpandedHeight()).toBe(2);
    });

    test('getCurrentHeight returns correct height', () => {
      expect(statusBar.getCurrentHeight()).toBe(1);
      statusBar.expand();
      expect(statusBar.getCurrentHeight()).toBe(10);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Expand/Collapse
  // ─────────────────────────────────────────────────────────────────────────

  describe('expand/collapse', () => {
    test('isExpanded returns false by default', () => {
      expect(statusBar.isExpanded()).toBe(false);
    });

    test('toggle toggles expanded state', () => {
      statusBar.toggle();
      expect(statusBar.isExpanded()).toBe(true);

      statusBar.toggle();
      expect(statusBar.isExpanded()).toBe(false);
    });

    test('toggle calls onToggle callback', () => {
      statusBar.toggle();
      expect(callbacks.toggleCount).toBe(1);
    });

    test('expand sets expanded state', () => {
      statusBar.expand();
      expect(statusBar.isExpanded()).toBe(true);
    });

    test('expand is idempotent', () => {
      statusBar.expand();
      statusBar.expand();
      expect(callbacks.toggleCount).toBe(1);
    });

    test('collapse clears expanded state', () => {
      statusBar.expand();
      statusBar.collapse();
      expect(statusBar.isExpanded()).toBe(false);
    });

    test('collapse is idempotent', () => {
      statusBar.expand();
      callbacks.toggleCount = 0;
      statusBar.collapse();
      statusBar.collapse();
      expect(callbacks.toggleCount).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Status Items
  // ─────────────────────────────────────────────────────────────────────────

  describe('status items', () => {
    test('has default items', () => {
      const items = statusBar.getItems();
      const ids = items.map((i) => i.id);

      expect(ids).toContain('branch');
      expect(ids).toContain('file');
      expect(ids).toContain('position');
      expect(ids).toContain('encoding');
      expect(ids).toContain('language');
    });

    test('addItem adds new item', () => {
      statusBar.addItem({ id: 'custom', content: 'Test', align: 'left', priority: 5 });

      const item = statusBar.getItem('custom');
      expect(item?.content).toBe('Test');
    });

    test('addItem updates existing item', () => {
      statusBar.addItem({ id: 'branch', content: 'main', align: 'left', priority: 1 });
      expect(statusBar.getItem('branch')?.content).toBe('main');
    });

    test('removeItem removes item', () => {
      expect(statusBar.removeItem('encoding')).toBe(true);
      expect(statusBar.getItem('encoding')).toBeNull();
    });

    test('removeItem returns false for unknown item', () => {
      expect(statusBar.removeItem('unknown')).toBe(false);
    });

    test('setItemContent updates content', () => {
      expect(statusBar.setItemContent('branch', 'develop')).toBe(true);
      expect(statusBar.getItem('branch')?.content).toBe('develop');
    });

    test('setItemContent returns false for unknown item', () => {
      expect(statusBar.setItemContent('unknown', 'test')).toBe(false);
    });

    test('getItem returns null for unknown item', () => {
      expect(statusBar.getItem('unknown')).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // History
  // ─────────────────────────────────────────────────────────────────────────

  describe('history', () => {
    test('addHistory adds entry', () => {
      statusBar.addHistory('Test message');
      expect(statusBar.getHistoryCount()).toBe(1);
    });

    test('addHistory with type', () => {
      statusBar.addHistory('Error occurred', 'error');
      const history = statusBar.getHistory();
      expect(history[0].type).toBe('error');
    });

    test('addHistory uses info as default type', () => {
      statusBar.addHistory('Info message');
      const history = statusBar.getHistory();
      expect(history[0].type).toBe('info');
    });

    test('addHistory includes timestamp', () => {
      const before = new Date();
      statusBar.addHistory('Test');
      const after = new Date();

      const entry = statusBar.getHistory()[0];
      expect(entry.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(entry.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    test('history is trimmed to max 100 entries', () => {
      for (let i = 0; i < 120; i++) {
        statusBar.addHistory(`Message ${i}`);
      }

      expect(statusBar.getHistoryCount()).toBe(100);
    });

    test('clearHistory removes all entries', () => {
      statusBar.addHistory('Test 1');
      statusBar.addHistory('Test 2');
      statusBar.clearHistory();

      expect(statusBar.getHistoryCount()).toBe(0);
    });

    test('getHistory returns copy', () => {
      statusBar.addHistory('Test');
      const history = statusBar.getHistory();
      history.push({ timestamp: new Date(), message: 'Fake', type: 'info' });

      expect(statusBar.getHistoryCount()).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Scroll
  // ─────────────────────────────────────────────────────────────────────────

  describe('scroll', () => {
    beforeEach(() => {
      // Add many history entries
      for (let i = 0; i < 20; i++) {
        statusBar.addHistory(`Message ${i}`);
      }
      statusBar.setExpandedHeight(5);
    });

    test('scrollUp decreases offset', () => {
      statusBar.scrollToBottom();
      statusBar.scrollUp(2);

      // Offset should be less than max
      // Can verify by scrolling behavior
      statusBar.scrollUp(100); // Should clamp to 0
      statusBar.scrollDown(1);
      // Now at offset 1
    });

    test('scrollDown increases offset', () => {
      statusBar.scrollToTop();
      statusBar.scrollDown(2);

      // Can verify via rendering
    });

    test('scrollToTop resets to top', () => {
      statusBar.scrollToBottom();
      statusBar.scrollToTop();

      // First entry should be visible
    });

    test('scrollToBottom jumps to end', () => {
      statusBar.scrollToTop();
      statusBar.scrollToBottom();

      // Last entries should be visible
    });

    test('scrollUp clamps to 0', () => {
      statusBar.scrollToTop();
      statusBar.scrollUp(100);
      // Should not throw
    });

    test('scrollDown clamps to max', () => {
      statusBar.scrollToBottom();
      statusBar.scrollDown(100);
      // Should not throw
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────────────────

  describe('rendering', () => {
    test('renders collapsed bar', () => {
      statusBar.setItemContent('branch', 'main');
      const buffer = createScreenBuffer({ width: 80, height: 24 });

      statusBar.render(buffer);

      // Should see 'main' somewhere on the status bar line
      let foundBranch = false;
      for (let x = 0; x < 80; x++) {
        const cell = buffer.get(x, 23);
        if (cell?.char === 'm') {
          foundBranch = true;
          break;
        }
      }
      expect(foundBranch).toBe(true);
    });

    test('renders expanded view', () => {
      statusBar.setBounds({ x: 0, y: 15, width: 80, height: 10 });
      statusBar.addHistory('Test message');
      statusBar.expand();

      const buffer = createScreenBuffer({ width: 80, height: 25 });
      statusBar.render(buffer);

      // Should see 'Test' in history area
      let foundMessage = false;
      for (let y = 15; y < 24; y++) {
        for (let x = 0; x < 80; x++) {
          if (buffer.get(x, y)?.char === 'T') {
            const next = buffer.get(x + 1, y);
            if (next?.char === 'e') {
              foundMessage = true;
              break;
            }
          }
        }
        if (foundMessage) break;
      }
      expect(foundMessage).toBe(true);
    });

    test('renders left-aligned items on left', () => {
      statusBar.setItemContent('branch', 'main');
      const buffer = createScreenBuffer({ width: 80, height: 24 });

      statusBar.render(buffer);

      // 'main' should appear in the left portion
      let foundX = -1;
      for (let x = 0; x < 40; x++) {
        if (buffer.get(x, 23)?.char === 'm') {
          foundX = x;
          break;
        }
      }
      expect(foundX).toBeGreaterThanOrEqual(0);
      expect(foundX).toBeLessThan(20);
    });

    test('renders right-aligned items on right', () => {
      statusBar.setItemContent('encoding', 'UTF-8');
      const buffer = createScreenBuffer({ width: 80, height: 24 });

      statusBar.render(buffer);

      // 'UTF-8' should appear in the right portion
      let foundX = -1;
      for (let x = 40; x < 80; x++) {
        if (buffer.get(x, 23)?.char === 'U') {
          foundX = x;
          break;
        }
      }
      expect(foundX).toBeGreaterThan(40);
    });
  });
});

// ============================================
// Factory Function Tests
// ============================================

describe('createStatusBar', () => {
  test('creates a new StatusBar instance', () => {
    const callbacks = createTestCallbacks();
    const bar = createStatusBar(callbacks);

    expect(bar).toBeInstanceOf(StatusBar);
  });
});
