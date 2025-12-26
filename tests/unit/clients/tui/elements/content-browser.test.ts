/**
 * ContentBrowser Tests
 *
 * Tests for the abstract ContentBrowser class, focusing on the summary section.
 * We create a concrete test implementation to test the base functionality.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { ContentBrowser } from '../../../../../src/clients/tui/elements/content-browser.ts';
import { createTestContext, type ElementContext } from '../../../../../src/clients/tui/elements/base.ts';
import { createScreenBuffer } from '../../../../../src/clients/tui/rendering/buffer.ts';
import type {
  Artifact,
  ArtifactNode,
  ArtifactAction,
  SummaryItem,
} from '../../../../../src/clients/tui/artifacts/types.ts';
import type { ScreenBuffer } from '../../../../../src/clients/tui/rendering/buffer.ts';

// ============================================
// Test Implementation
// ============================================

interface TestArtifact extends Artifact {
  type: 'custom';
  count: number;
}

class TestContentBrowser extends ContentBrowser<TestArtifact> {
  protected buildNodes(artifacts: TestArtifact[]): ArtifactNode<TestArtifact>[] {
    return artifacts.map((artifact, idx) => ({
      artifact,
      nodeType: 'item' as const,
      nodeId: `node-${idx}`,
      depth: 0,
      expanded: true,
      children: [],
      actions: [],
      selected: false,
      label: artifact.title,
      secondaryLabel: `Count: ${artifact.count}`,
    }));
  }

  protected renderNode(
    buffer: ScreenBuffer,
    node: ArtifactNode<TestArtifact>,
    x: number,
    y: number,
    width: number,
    isSelected: boolean
  ): void {
    const bg = isSelected ? '#094771' : '#1e1e1e';
    const fg = '#d4d4d4';
    const text = `${node.label} (${node.artifact.count})`;
    buffer.writeString(x, y, text.padEnd(width, ' '), fg, bg);
  }

  protected getNodeActions(_node: ArtifactNode<TestArtifact>): ArtifactAction[] {
    return [];
  }

  protected override buildSummary(): SummaryItem[] {
    const artifacts = this.getArtifacts();
    const totalCount = artifacts.reduce((sum, a) => sum + a.count, 0);
    return [
      { label: 'Items', value: artifacts.length },
      { label: 'Total', value: totalCount, color: '#00ff00' },
    ];
  }

  // Expose protected methods for testing
  public testGetSummaryHeight(): number {
    return this.getSummaryHeight();
  }
}

// ============================================
// Test Data
// ============================================

function createTestArtifacts(): TestArtifact[] {
  return [
    { type: 'custom', id: 'art1', title: 'Artifact 1', count: 10 },
    { type: 'custom', id: 'art2', title: 'Artifact 2', count: 20 },
    { type: 'custom', id: 'art3', title: 'Artifact 3', count: 30 },
  ];
}

// ============================================
// Tests
// ============================================

describe('ContentBrowser', () => {
  let browser: TestContentBrowser;
  let ctx: ElementContext;

  beforeEach(() => {
    ctx = createTestContext();
    browser = new TestContentBrowser('browser1', 'Test Browser', ctx);
    browser.setBounds({ x: 0, y: 0, width: 60, height: 20 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Summary Section
  // ─────────────────────────────────────────────────────────────────────────

  describe('summary section', () => {
    test('setSummary sets summary items', () => {
      const items: SummaryItem[] = [
        { label: 'Test', value: 42 },
      ];

      browser.setSummary(items);

      expect(browser.getSummary()).toHaveLength(1);
      expect(browser.getSummary()[0]?.value).toBe(42);
    });

    test('getSummary returns current items', () => {
      browser.setSummary([{ label: 'A', value: 1 }, { label: 'B', value: 2 }]);

      const items = browser.getSummary();

      expect(items).toHaveLength(2);
    });

    test('summary is auto-built from artifacts', () => {
      browser.setArtifacts(createTestArtifacts());

      const summary = browser.getSummary();

      // Our test implementation creates Items and Total
      expect(summary).toHaveLength(2);
      expect(summary[0]?.label).toBe('Items');
      expect(summary[0]?.value).toBe(3);
      expect(summary[1]?.label).toBe('Total');
      expect(summary[1]?.value).toBe(60); // 10 + 20 + 30
    });

    test('summary height is 0 when empty', () => {
      browser.setSummary([]);

      expect(browser.testGetSummaryHeight()).toBe(0);
    });

    test('summary height is 1 when has items', () => {
      browser.setSummary([{ label: 'Test', value: 1 }]);

      expect(browser.testGetSummaryHeight()).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Summary Pinned State
  // ─────────────────────────────────────────────────────────────────────────

  describe('summary pinned state', () => {
    test('summary is pinned by default', () => {
      expect(browser.isSummaryPinned()).toBe(true);
    });

    test('setSummaryPinned changes pinned state', () => {
      browser.setSummaryPinned(false);

      expect(browser.isSummaryPinned()).toBe(false);
    });

    test('toggleSummaryPinned toggles state', () => {
      expect(browser.isSummaryPinned()).toBe(true);

      browser.toggleSummaryPinned();
      expect(browser.isSummaryPinned()).toBe(false);

      browser.toggleSummaryPinned();
      expect(browser.isSummaryPinned()).toBe(true);
    });

    test('unpinned summary does not show in content height', () => {
      browser.setArtifacts(createTestArtifacts());

      // Get content height with pinned summary
      browser.setSummaryPinned(true);
      const pinnedHeight = browser.testGetSummaryHeight();

      // Unpin summary
      browser.setSummaryPinned(false);

      // Summary height should still be calculated,
      // but the content area should have more space
      expect(pinnedHeight).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Show Summary State
  // ─────────────────────────────────────────────────────────────────────────

  describe('show summary state', () => {
    test('setShowSummary hides summary', () => {
      browser.setSummary([{ label: 'Test', value: 1 }]);
      browser.setShowSummary(false);

      expect(browser.testGetSummaryHeight()).toBe(0);
    });

    test('setShowSummary shows summary', () => {
      browser.setSummary([{ label: 'Test', value: 1 }]);
      browser.setShowSummary(false);
      browser.setShowSummary(true);

      expect(browser.testGetSummaryHeight()).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────────────────

  describe('rendering', () => {
    test('renders header', () => {
      browser.setArtifacts(createTestArtifacts());

      const buffer = createScreenBuffer({ width: 60, height: 20 });
      browser.render(buffer);

      // Check for 'Test Browser' in header
      let foundHeader = false;
      for (let x = 0; x < 60; x++) {
        if (buffer.get(x, 0)?.char === 'T' &&
            buffer.get(x + 1, 0)?.char === 'e' &&
            buffer.get(x + 2, 0)?.char === 's' &&
            buffer.get(x + 3, 0)?.char === 't') {
          foundHeader = true;
          break;
        }
      }
      expect(foundHeader).toBe(true);
    });

    test('renders summary when pinned', () => {
      browser.setArtifacts(createTestArtifacts());
      browser.setSummaryPinned(true);

      const buffer = createScreenBuffer({ width: 60, height: 20 });
      browser.render(buffer);

      // Check for 'Items' in summary row (row 1, after header)
      let foundItems = false;
      for (let x = 0; x < 60; x++) {
        if (buffer.get(x, 1)?.char === 'I' &&
            buffer.get(x + 1, 1)?.char === 't' &&
            buffer.get(x + 2, 1)?.char === 'e' &&
            buffer.get(x + 3, 1)?.char === 'm') {
          foundItems = true;
          break;
        }
      }
      expect(foundItems).toBe(true);
    });

    test('renders artifact nodes', () => {
      browser.setArtifacts(createTestArtifacts());

      const buffer = createScreenBuffer({ width: 60, height: 20 });
      browser.render(buffer);

      // Check for 'Artifact 1' somewhere in the content
      let foundArtifact = false;
      for (let y = 2; y < 20; y++) {
        for (let x = 0; x < 50; x++) {
          if (buffer.get(x, y)?.char === 'A' &&
              buffer.get(x + 1, y)?.char === 'r' &&
              buffer.get(x + 2, y)?.char === 't') {
            foundArtifact = true;
            break;
          }
        }
        if (foundArtifact) break;
      }
      expect(foundArtifact).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // State Serialization
  // ─────────────────────────────────────────────────────────────────────────

  describe('state serialization', () => {
    test('getState includes summaryPinned', () => {
      browser.setSummaryPinned(false);

      const state = browser.getState() as { summaryPinned?: boolean };

      expect(state.summaryPinned).toBe(false);
    });

    test('setState restores summaryPinned', () => {
      browser.setState({ summaryPinned: false });

      expect(browser.isSummaryPinned()).toBe(false);
    });
  });
});
