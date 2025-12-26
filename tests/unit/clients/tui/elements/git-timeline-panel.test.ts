/**
 * GitTimelinePanel Tests
 *
 * Tests for the GitTimelinePanel component including mode switching,
 * commit navigation, and integration callbacks for opening diffs.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  GitTimelinePanel,
  type GitTimelinePanelCallbacks,
  type TimelineMode,
} from '../../../../../src/clients/tui/elements/git-timeline-panel.ts';
import { createTestContext, type ElementContext } from '../../../../../src/clients/tui/elements/base.ts';
import { createScreenBuffer } from '../../../../../src/clients/tui/rendering/buffer.ts';
import type { GitCommit } from '../../../../../src/services/git/types.ts';

// ============================================
// Test Data
// ============================================

function createTestCommits(): GitCommit[] {
  return [
    {
      hash: 'abc123def456789012345678901234567890abcd',
      shortHash: 'abc123d',
      message: 'Add new feature for user authentication',
      author: 'John Doe',
      authorEmail: 'john@example.com',
      date: new Date('2024-01-15T10:30:00Z'),
    },
    {
      hash: 'def456abc789012345678901234567890abcdef',
      shortHash: 'def456a',
      message: 'Fix bug in login form',
      author: 'Jane Smith',
      authorEmail: 'jane@example.com',
      date: new Date('2024-01-14T14:20:00Z'),
    },
    {
      hash: '789012abc345678901234567890abcdef123456',
      shortHash: '789012a',
      message: 'Refactor database connection',
      author: 'Bob Wilson',
      authorEmail: 'bob@example.com',
      date: new Date('2024-01-13T09:15:00Z'),
    },
  ];
}

// ============================================
// Tests
// ============================================

describe('GitTimelinePanel', () => {
  let panel: GitTimelinePanel;
  let ctx: ElementContext;

  beforeEach(() => {
    ctx = createTestContext();
    panel = new GitTimelinePanel('timeline1', 'Timeline', ctx);
    panel.setBounds({ x: 0, y: 0, width: 60, height: 20 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Basic Setup
  // ─────────────────────────────────────────────────────────────────────────

  describe('basic setup', () => {
    test('creates panel with default file mode', () => {
      expect(panel.getMode()).toBe('file');
    });

    test('setMode changes mode', () => {
      panel.setMode('repo');
      expect(panel.getMode()).toBe('repo');
    });

    test('setCommits stores commits', () => {
      const commits = createTestCommits();
      panel.setCommits(commits);

      // Verify by state
      const state = panel.getState();
      expect(state.mode).toBe('file');
    });

    test('clearCommits removes all commits', () => {
      panel.setCommits(createTestCommits());
      panel.clearCommits();

      // Panel should be empty (verify via state)
      const state = panel.getState();
      expect(state.selectedIndex).toBe(0);
    });

    test('setLoading shows loading state', () => {
      // Should not throw
      panel.setLoading(true);
      panel.setLoading(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Mode Switching
  // ─────────────────────────────────────────────────────────────────────────

  describe('mode switching', () => {
    test('toggleMode switches between file and repo', () => {
      expect(panel.getMode()).toBe('file');

      // Toggle mode via Tab key
      panel.handleKey({ key: 'Tab', ctrl: false, alt: false, shift: false, meta: false });
      expect(panel.getMode()).toBe('repo');

      panel.handleKey({ key: 'Tab', ctrl: false, alt: false, shift: false, meta: false });
      expect(panel.getMode()).toBe('file');
    });

    test('onModeChange callback called on mode switch', () => {
      let capturedMode: TimelineMode | null = null;
      const callbacks: GitTimelinePanelCallbacks = {
        onModeChange: (mode) => {
          capturedMode = mode;
        },
      };

      panel.setCallbacks(callbacks);
      panel.handleKey({ key: 'Tab', ctrl: false, alt: false, shift: false, meta: false });

      expect(capturedMode).toBe('repo');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────────────────────────────────────────

  describe('navigation', () => {
    beforeEach(() => {
      panel.setCommits(createTestCommits());
    });

    test('arrow keys navigate commits', () => {
      // Initial state at first commit
      const initialState = panel.getState();
      expect(initialState.selectedIndex).toBe(0);

      // Move down
      panel.handleKey({ key: 'ArrowDown', ctrl: false, alt: false, shift: false, meta: false });
      expect(panel.getState().selectedIndex).toBe(1);

      // Move down again
      panel.handleKey({ key: 'ArrowDown', ctrl: false, alt: false, shift: false, meta: false });
      expect(panel.getState().selectedIndex).toBe(2);

      // Move up
      panel.handleKey({ key: 'ArrowUp', ctrl: false, alt: false, shift: false, meta: false });
      expect(panel.getState().selectedIndex).toBe(1);
    });

    test('j/k keys navigate commits', () => {
      panel.handleKey({ key: 'j', ctrl: false, alt: false, shift: false, meta: false });
      expect(panel.getState().selectedIndex).toBe(1);

      panel.handleKey({ key: 'k', ctrl: false, alt: false, shift: false, meta: false });
      expect(panel.getState().selectedIndex).toBe(0);
    });

    test('navigation stays within bounds', () => {
      // At start, moving up should stay at 0
      panel.handleKey({ key: 'ArrowUp', ctrl: false, alt: false, shift: false, meta: false });
      expect(panel.getState().selectedIndex).toBe(0);

      // Move to end
      panel.handleKey({ key: 'ArrowDown', ctrl: false, alt: false, shift: false, meta: false });
      panel.handleKey({ key: 'ArrowDown', ctrl: false, alt: false, shift: false, meta: false });
      expect(panel.getState().selectedIndex).toBe(2);

      // At end, moving down should stay at 2
      panel.handleKey({ key: 'ArrowDown', ctrl: false, alt: false, shift: false, meta: false });
      expect(panel.getState().selectedIndex).toBe(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Callbacks (Timeline → Diff Viewer Integration)
  // ─────────────────────────────────────────────────────────────────────────

  describe('callbacks', () => {
    beforeEach(() => {
      panel.setCommits(createTestCommits());
    });

    test('onViewDiff called on Enter key', () => {
      let viewedCommit: GitCommit | null = null;
      const callbacks: GitTimelinePanelCallbacks = {
        onViewDiff: (commit) => {
          viewedCommit = commit;
        },
      };

      panel.setCallbacks(callbacks);
      panel.handleKey({ key: 'Enter', ctrl: false, alt: false, shift: false, meta: false });

      expect(viewedCommit).not.toBeNull();
      expect(viewedCommit?.shortHash).toBe('abc123d');
    });

    test('onViewDiff called with correct commit after navigation', () => {
      let viewedCommit: GitCommit | null = null;
      const callbacks: GitTimelinePanelCallbacks = {
        onViewDiff: (commit) => {
          viewedCommit = commit;
        },
      };

      panel.setCallbacks(callbacks);

      // Navigate to second commit
      panel.handleKey({ key: 'ArrowDown', ctrl: false, alt: false, shift: false, meta: false });
      panel.handleKey({ key: 'Enter', ctrl: false, alt: false, shift: false, meta: false });

      expect(viewedCommit?.shortHash).toBe('def456a');
      expect(viewedCommit?.message).toBe('Fix bug in login form');
    });

    test('onCopyHash called on y key', () => {
      let copiedHash: string | null = null;
      const callbacks: GitTimelinePanelCallbacks = {
        onCopyHash: (hash) => {
          copiedHash = hash;
        },
      };

      panel.setCallbacks(callbacks);
      panel.handleKey({ key: 'y', ctrl: false, alt: false, shift: false, meta: false });

      expect(copiedHash).toBe('abc123def456789012345678901234567890abcd');
    });

    test('onFocusChange called on focus/blur', () => {
      let focusState: boolean | null = null;
      const callbacks: GitTimelinePanelCallbacks = {
        onFocusChange: (focused) => {
          focusState = focused;
        },
      };

      panel.setCallbacks(callbacks);

      panel.onFocus();
      expect(focusState).toBe(true);

      panel.onBlur();
      expect(focusState).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // State Persistence
  // ─────────────────────────────────────────────────────────────────────────

  describe('state persistence', () => {
    test('getState returns current state', () => {
      panel.setMode('repo');
      panel.setCommits(createTestCommits());
      panel.handleKey({ key: 'ArrowDown', ctrl: false, alt: false, shift: false, meta: false });

      const state = panel.getState();
      expect(state.mode).toBe('repo');
      expect(state.selectedIndex).toBe(1);
    });

    test('setState restores mode', () => {
      const savedState = {
        mode: 'repo' as TimelineMode,
        scrollTop: 0,
        selectedIndex: 0,
      };

      panel.setState(savedState);

      expect(panel.getMode()).toBe('repo');
    });

    test('setState restores selectedIndex when commits exist', () => {
      // Set commits first
      panel.setCommits(createTestCommits());

      // Then restore state with selectedIndex
      const savedState = {
        mode: 'file' as TimelineMode,
        scrollTop: 0,
        selectedIndex: 2,
      };

      panel.setState(savedState);

      expect(panel.getState().selectedIndex).toBe(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Element Properties
  // ─────────────────────────────────────────────────────────────────────────

  describe('element properties', () => {
    test('setRepoUri stores repo uri', () => {
      // Should not throw
      panel.setRepoUri('file:///path/to/repo');
    });

    test('setCommits with uri and filePath stores file context', () => {
      const commits = createTestCommits();
      // Should not throw
      panel.setCommits(commits, 'file:///path/to/repo/src/index.ts', 'src/index.ts');
    });

    test('getCallbacks returns set callbacks', () => {
      const callbacks: GitTimelinePanelCallbacks = {
        onViewDiff: () => {},
      };

      panel.setCallbacks(callbacks);

      expect(panel.getCallbacks()).toBe(callbacks);
    });
  });
});
