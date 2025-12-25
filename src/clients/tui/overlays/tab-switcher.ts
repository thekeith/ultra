/**
 * Tab Switcher Dialog
 *
 * Searchable dialog for switching between open tabs.
 * Can show tabs from current pane only or all panes.
 */

import { SearchableDialog, type SearchableDialogConfig, type ItemDisplay } from './searchable-dialog.ts';
import type { OverlayManagerCallbacks } from './overlay-manager.ts';

// ============================================
// Types
// ============================================

/**
 * Tab info for the switcher.
 */
export interface TabInfo {
  /** Element ID */
  id: string;
  /** Tab title */
  title: string;
  /** Pane ID containing this tab */
  paneId: string;
  /** Whether this is the active tab */
  isActive: boolean;
  /** Whether the document is modified */
  isModified?: boolean;
  /** Optional file path for display */
  filePath?: string;
}

// ============================================
// Tab Switcher Dialog
// ============================================

/**
 * Dialog for switching between open tabs.
 */
export class TabSwitcherDialog extends SearchableDialog<TabInfo> {
  constructor(callbacks: OverlayManagerCallbacks) {
    super('tab-switcher', callbacks);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SearchableDialog Implementation
  // ─────────────────────────────────────────────────────────────────────────

  protected scoreItem(tab: TabInfo, query: string): number {
    if (!query) return 1; // Show all when no query

    const lowerQuery = query.toLowerCase();
    const lowerTitle = tab.title.toLowerCase();
    const lowerPath = (tab.filePath ?? '').toLowerCase();

    // Exact title match
    if (lowerTitle === lowerQuery) return 100;

    // Title starts with query
    if (lowerTitle.startsWith(lowerQuery)) return 80;

    // Title contains query
    if (lowerTitle.includes(lowerQuery)) return 60;

    // Path contains query
    if (lowerPath.includes(lowerQuery)) return 40;

    // Fuzzy match on title
    let queryIdx = 0;
    for (const char of lowerTitle) {
      if (char === lowerQuery[queryIdx]) {
        queryIdx++;
        if (queryIdx >= lowerQuery.length) return 20;
      }
    }

    return 0;
  }

  protected getItemDisplay(tab: TabInfo, isSelected: boolean): ItemDisplay {
    const icon = tab.isModified ? '●' : ' ';
    const secondary = tab.filePath ? this.shortenPath(tab.filePath) : undefined;

    return {
      text: tab.title,
      secondary,
      icon,
      isCurrent: tab.isActive,
    };
  }

  protected getItemId(tab: TabInfo): string {
    return tab.id;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Shorten a file path for display.
   */
  private shortenPath(path: string): string {
    // Show last 2-3 segments
    const parts = path.split('/');
    if (parts.length <= 3) return path;
    return '…/' + parts.slice(-2).join('/');
  }
}

// ============================================
// Factory
// ============================================

let instance: TabSwitcherDialog | null = null;

/**
 * Get or create the tab switcher dialog instance.
 */
export function getTabSwitcherDialog(callbacks: OverlayManagerCallbacks): TabSwitcherDialog {
  if (!instance) {
    instance = new TabSwitcherDialog(callbacks);
  }
  return instance;
}
