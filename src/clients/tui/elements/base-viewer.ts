/**
 * Base Viewer Element
 *
 * Abstract base class for simple list/tree viewers.
 * Provides core scrolling, navigation, and rendering infrastructure.
 *
 * This is a simpler alternative to ContentBrowser for viewers that
 * don't need the full artifact system (actions, complex metadata, etc.).
 *
 * Use this when:
 * - You need a simple scrollable list or tree
 * - Items don't need complex actions
 * - You want minimal overhead
 *
 * Use ContentBrowser when:
 * - Items have multiple actions (stage, discard, etc.)
 * - You need artifact-level metadata
 * - Items have complex node types (file, hunk, line)
 */

import { BaseElement, type ElementContext } from './base.ts';
import type { KeyEvent, MouseEvent } from '../types.ts';
import type { ScreenBuffer } from '../rendering/buffer.ts';
import type { ViewerItem, ViewerCallbacks, ViewerState } from '../artifacts/types.ts';

// ============================================
// Base Viewer Class
// ============================================

/**
 * Abstract base class for simple viewers.
 *
 * Provides:
 * - Tree/flat display with expand/collapse
 * - Keyboard navigation (up/down, page up/down)
 * - Mouse selection and scrolling
 * - Scrollbar rendering
 * - State serialization
 *
 * Subclasses implement:
 * - buildItems() - convert data to ViewerItem[]
 * - renderItem() - render a single item
 * - getKeyboardHints() - optional keyboard hints
 */
export abstract class BaseViewer<T extends ViewerItem = ViewerItem> extends BaseElement {
  // ─────────────────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────────────────

  /** Root items */
  protected rootItems: T[] = [];

  /** Flattened items for display (respects collapsed state) */
  protected flatItems: T[] = [];

  /** Currently selected index in flatItems */
  protected selectedIndex = 0;

  /** Scroll offset */
  protected scrollTop = 0;

  /** IDs of collapsed items */
  protected collapsedIds = new Set<string>();

  /** Callbacks */
  protected callbacks: ViewerCallbacks<T>;

  /** Title shown in header */
  protected viewerTitle = '';

  /** Whether to show the header row */
  protected showHeader = true;

  /** Height of the hints bar when focused (0 to disable) */
  protected hintBarHeight = 1;

  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────

  constructor(
    id: string,
    title: string,
    ctx: ElementContext,
    callbacks: ViewerCallbacks<T> = {}
  ) {
    super('BaseViewer', id, title, ctx);
    this.callbacks = callbacks;
    this.viewerTitle = title;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Abstract Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Render a single item to the buffer.
   */
  protected abstract renderItem(
    buffer: ScreenBuffer,
    item: T,
    x: number,
    y: number,
    width: number,
    isSelected: boolean
  ): void;

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set items to display.
   */
  setItems(items: T[]): void {
    this.rootItems = items;
    this.rebuildFlatView();
    this.ctx.markDirty();
  }

  /**
   * Get currently displayed items.
   */
  getItems(): T[] {
    return [...this.rootItems];
  }

  /**
   * Get selected item.
   */
  getSelectedItem(): T | null {
    return this.flatItems[this.selectedIndex] ?? null;
  }

  /**
   * Set callbacks.
   */
  setCallbacks(callbacks: ViewerCallbacks<T>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // State Serialization
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get current state for serialization.
   */
  getState(): ViewerState {
    return {
      scrollTop: this.scrollTop,
      selectedIndex: this.selectedIndex,
      collapsedIds: [...this.collapsedIds],
    };
  }

  /**
   * Restore state from serialized data.
   */
  setState(state: Partial<ViewerState>): void {
    if (state.scrollTop !== undefined) {
      this.scrollTop = state.scrollTop;
    }
    if (state.selectedIndex !== undefined) {
      this.selectedIndex = Math.min(state.selectedIndex, this.flatItems.length - 1);
    }
    if (state.collapsedIds) {
      this.collapsedIds = new Set(state.collapsedIds);
      this.rebuildFlatView();
    }
    this.ctx.markDirty();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Move selection up.
   */
  moveUp(count = 1): void {
    this.selectedIndex = Math.max(0, this.selectedIndex - count);
    this.ensureVisible();
    this.notifySelection();
    this.ctx.markDirty();
  }

  /**
   * Move selection down.
   */
  moveDown(count = 1): void {
    this.selectedIndex = Math.min(this.flatItems.length - 1, this.selectedIndex + count);
    this.ensureVisible();
    this.notifySelection();
    this.ctx.markDirty();
  }

  /**
   * Page up.
   */
  pageUp(): void {
    this.moveUp(this.getContentHeight());
  }

  /**
   * Page down.
   */
  pageDown(): void {
    this.moveDown(this.getContentHeight());
  }

  /**
   * Toggle expand/collapse for current item.
   */
  toggleExpand(): void {
    const item = this.getSelectedItem();
    if (!item || !item.expandable) return;

    if (this.collapsedIds.has(item.id)) {
      this.collapsedIds.delete(item.id);
    } else {
      this.collapsedIds.add(item.id);
    }

    this.rebuildFlatView();
    this.ctx.markDirty();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Rebuild flat view from root items, respecting collapsed state.
   */
  protected rebuildFlatView(): void {
    this.flatItems = [];

    const collect = (items: T[]) => {
      for (const item of items) {
        this.flatItems.push(item);
        if (item.expandable && !this.collapsedIds.has(item.id)) {
          collect(item.children as T[]);
        }
      }
    };

    collect(this.rootItems);

    // Clamp selection
    if (this.selectedIndex >= this.flatItems.length) {
      this.selectedIndex = Math.max(0, this.flatItems.length - 1);
    }
  }

  /**
   * Get content area height.
   */
  protected getContentHeight(): number {
    const headerHeight = this.showHeader ? 1 : 0;
    const hintsHeight = this.focused && this.hintBarHeight > 0 ? this.hintBarHeight : 0;
    return Math.max(0, this.bounds.height - headerHeight - hintsHeight);
  }

  /**
   * Ensure selected item is visible.
   */
  protected ensureVisible(): void {
    const contentHeight = this.getContentHeight();
    if (contentHeight <= 0) return;

    if (this.selectedIndex < this.scrollTop) {
      this.scrollTop = this.selectedIndex;
    } else if (this.selectedIndex >= this.scrollTop + contentHeight) {
      this.scrollTop = this.selectedIndex - contentHeight + 1;
    }
  }

  /**
   * Notify selection change callback.
   */
  protected notifySelection(): void {
    const item = this.getSelectedItem();
    if (item) {
      this.callbacks.onSelect?.(item);
    }
  }

  /**
   * Get keyboard hints to display.
   */
  protected getKeyboardHints(): string[] {
    return [' ↑↓:navigate  Enter:select'];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────────────────

  override render(buffer: ScreenBuffer): void {
    const { x, y, width, height } = this.bounds;
    if (height === 0 || width === 0) return;

    // Colors
    const bg = this.ctx.getBackgroundForFocus('sidebar', this.focused);
    const fg = this.ctx.getForegroundForFocus('sidebar', this.focused);
    const headerBg = this.ctx.getThemeColor('sideBarSectionHeader.background', '#383838');
    const headerFg = this.ctx.getThemeColor('sideBarSectionHeader.foreground', '#cccccc');

    // Clear background
    for (let row = 0; row < height; row++) {
      buffer.writeString(x, y + row, ' '.repeat(width), fg, bg);
    }

    let currentY = y;

    // Render header
    if (this.showHeader) {
      let headerText = ` ${this.viewerTitle}`;
      if (headerText.length > width) {
        headerText = headerText.slice(0, width - 1) + '…';
      }
      buffer.writeString(x, currentY, headerText.padEnd(width, ' '), headerFg, headerBg);
      currentY++;
    }

    // Calculate content area
    const contentHeight = this.getContentHeight();
    const contentStartY = currentY;

    // Render items
    const scrollbarWidth = this.flatItems.length > contentHeight ? 1 : 0;
    const itemWidth = width - scrollbarWidth;

    for (let row = 0; row < contentHeight; row++) {
      const viewIdx = this.scrollTop + row;
      if (viewIdx >= this.flatItems.length) break;

      const item = this.flatItems[viewIdx]!;
      const screenY = contentStartY + row;
      const isSelected = viewIdx === this.selectedIndex;

      this.renderItem(buffer, item, x, screenY, itemWidth, isSelected);
    }

    // Empty state
    if (this.flatItems.length === 0) {
      const msg = 'No items';
      const msgX = x + Math.floor((width - msg.length) / 2);
      buffer.writeString(msgX, contentStartY + 2, msg, '#888888', bg);
    }

    // Render scrollbar
    if (scrollbarWidth > 0) {
      this.renderScrollbar(buffer, x + width - 1, contentStartY, contentHeight);
    }

    // Render hints bar
    if (this.focused && this.hintBarHeight > 0) {
      this.renderHintsBar(buffer, x, contentStartY + contentHeight, width);
    }
  }

  /**
   * Render scrollbar.
   */
  protected renderScrollbar(
    buffer: ScreenBuffer,
    x: number,
    y: number,
    height: number
  ): void {
    const totalItems = this.flatItems.length;
    if (totalItems <= height) return;

    const bg = this.ctx.getThemeColor('scrollbarSlider.background', '#555555');
    const trackBg = this.ctx.getBackgroundForFocus('sidebar', this.focused);

    // Calculate thumb position and size
    const thumbSize = Math.max(1, Math.floor((height / totalItems) * height));
    const thumbPos = Math.floor((this.scrollTop / (totalItems - height)) * (height - thumbSize));

    for (let row = 0; row < height; row++) {
      const isThumb = row >= thumbPos && row < thumbPos + thumbSize;
      buffer.set(x, y + row, { char: ' ', fg: '#888888', bg: isThumb ? bg : trackBg });
    }
  }

  /**
   * Render hints bar.
   */
  protected renderHintsBar(buffer: ScreenBuffer, x: number, y: number, width: number): void {
    const hintBg = this.ctx.getThemeColor('editorWidget.background', '#2d2d2d');
    const hintFg = this.ctx.getThemeColor('editorWidget.foreground', '#cccccc');
    const hints = this.getKeyboardHints();

    for (let i = 0; i < this.hintBarHeight; i++) {
      const hint = hints[i] ?? '';
      const displayHint = hint.length > width ? hint.slice(0, width) : hint.padEnd(width, ' ');
      buffer.writeString(x, y + i, displayHint, hintFg, hintBg);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event Handling
  // ─────────────────────────────────────────────────────────────────────────

  override handleKey(event: KeyEvent): boolean {
    switch (event.key) {
      case 'ArrowUp':
        this.moveUp();
        return true;
      case 'ArrowDown':
        this.moveDown();
        return true;
      case 'PageUp':
        this.pageUp();
        return true;
      case 'PageDown':
        this.pageDown();
        return true;
      case 'Enter':
        this.handleActivation();
        return true;
      case ' ':
        this.toggleExpand();
        return true;
    }

    return false;
  }

  override handleMouseEvent(event: MouseEvent): boolean {
    if (event.type !== 'mousedown' && event.type !== 'wheel') {
      return false;
    }

    const { x, y, width, height } = this.bounds;
    const headerHeight = this.showHeader ? 1 : 0;
    const contentStartY = y + headerHeight;
    const contentHeight = this.getContentHeight();

    // Handle wheel scrolling
    if (event.type === 'wheel') {
      if (event.direction === 'up') {
        this.scrollTop = Math.max(0, this.scrollTop - 3);
      } else {
        this.scrollTop = Math.min(
          Math.max(0, this.flatItems.length - contentHeight),
          this.scrollTop + 3
        );
      }
      this.ctx.markDirty();
      return true;
    }

    // Handle click selection
    if (event.type === 'mousedown') {
      const clickY = event.y;
      if (clickY >= contentStartY && clickY < contentStartY + contentHeight) {
        const clickedIndex = this.scrollTop + (clickY - contentStartY);
        if (clickedIndex < this.flatItems.length) {
          this.selectedIndex = clickedIndex;
          this.notifySelection();
          this.ctx.markDirty();
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Handle item activation (Enter key).
   */
  protected handleActivation(): void {
    const item = this.getSelectedItem();
    if (!item) return;

    // If expandable, toggle expand/collapse
    if (item.expandable) {
      this.toggleExpand();
    }

    // Always call activation callback
    this.callbacks.onActivate?.(item);
  }
}

