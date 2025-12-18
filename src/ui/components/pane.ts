/**
 * Pane Component
 *
 * A tabbed editor pane that uses the panel content abstraction.
 * This implementation wraps PanelContainer and EditorContent to provide
 * backward-compatible API while using the new flexible architecture.
 */

import type { Document } from '../../core/document.ts';
import type { RenderContext } from '../renderer.ts';
import type { Rect } from '../layout.ts';
import type { MouseHandler, MouseEvent } from '../mouse.ts';
import type { Position } from '../../core/buffer.ts';
import type { GitLineChange } from '../../features/git/git-integration.ts';
import { EditorContent } from '../panels/editor-content.ts';
import { Minimap } from './minimap.ts';
import { TabBar, type Tab } from './tab-bar.ts';
import { themeLoader } from '../themes/theme-loader.ts';
import { hexToRgb } from '../colors.ts';
import { debugLog, isDebugEnabled } from '../../debug.ts';

// ==================== Types ====================

interface PaneTab {
  id: string;
  documentId: string;
  editorContent: EditorContent;
}

// ==================== Pane ====================

/**
 * A tabbed editor pane.
 *
 * Maintains backward-compatible API while internally using the new
 * EditorContent architecture for rendering.
 */
export class Pane implements MouseHandler {
  readonly id: string;

  // Tab management
  private tabs: PaneTab[] = [];
  private activeTabId: string | null = null;
  private tabIdCounter: number = 0;

  // Layout
  private rect: Rect = { x: 1, y: 1, width: 80, height: 24 };
  private tabBarHeight: number = 1;

  // State
  private isFocused: boolean = false;

  // Sub-components
  private tabBar: TabBar;

  // Callbacks
  private onClickCallback?: (position: Position, clickCount: number, event: MouseEvent) => void;
  private onDragCallback?: (position: Position, event: MouseEvent) => void;
  private onScrollCallback?: (deltaX: number, deltaY: number) => void;
  private onFocusCallback?: () => void;
  private onTabSelectCallback?: (document: Document) => void;
  private onTabCloseCallback?: (document: Document, tabId: string) => void;
  private onFoldToggleCallback?: (line: number) => void;
  private onGitGutterClickCallback?: (line: number) => void;
  private onInlineDiffStageCallback?: (filePath: string, line: number) => Promise<void>;
  private onInlineDiffRevertCallback?: (filePath: string, line: number) => Promise<void>;

  constructor(id: string) {
    this.id = id;
    this.tabBar = new TabBar();
    this.setupTabBarCallbacks();
  }

  private setupTabBarCallbacks(): void {
    this.tabBar.onTabClick((tabId) => {
      this.activateTab(tabId);
    });

    this.tabBar.onTabClose((tabId) => {
      const tab = this.tabs.find(t => t.id === tabId);
      if (tab && this.onTabCloseCallback) {
        const doc = tab.editorContent.getDocument();
        if (doc) {
          this.onTabCloseCallback(doc, tabId);
        }
      }
    });
  }

  // ==================== Tab Management ====================

  private generateTabId(): string {
    return `${this.id}-tab-${++this.tabIdCounter}`;
  }

  private getActiveEditorContent(): EditorContent | null {
    if (!this.activeTabId) return null;
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    return tab?.editorContent || null;
  }

  /**
   * Open a document in this pane (creates a new tab or activates existing)
   */
  openDocument(document: Document, documentId?: string): string {
    // Check if document is already open
    const existingTab = this.tabs.find(t => t.editorContent.getDocument() === document);
    if (existingTab) {
      this.activateTab(existingTab.id);
      return existingTab.id;
    }

    const tabId = this.generateTabId();
    const docId = documentId || tabId;

    // Create EditorContent for this document
    const editorContent = new EditorContent(tabId, document, docId);
    this.setupEditorContentCallbacks(editorContent);

    // Set initial rect
    editorContent.setRect({
      x: this.rect.x,
      y: this.rect.y + this.tabBarHeight,
      width: this.rect.width,
      height: this.rect.height - this.tabBarHeight,
    });

    const tab: PaneTab = {
      id: tabId,
      documentId: docId,
      editorContent,
    };

    this.tabs.push(tab);
    this.activateTab(tabId);

    return tabId;
  }

  private setupEditorContentCallbacks(editorContent: EditorContent): void {
    editorContent.onClick((position, clickCount, event) => {
      if (this.onClickCallback) {
        this.onClickCallback(position, clickCount, event);
      }
    });

    editorContent.onDrag((position, event) => {
      if (this.onDragCallback) {
        this.onDragCallback(position, event);
      }
    });

    editorContent.onScroll((deltaX, deltaY) => {
      if (this.onScrollCallback) {
        this.onScrollCallback(deltaX, deltaY);
      }
    });

    editorContent.onFoldToggle((line) => {
      if (this.onFoldToggleCallback) {
        this.onFoldToggleCallback(line);
      }
    });

    editorContent.onGitGutterClick((line) => {
      if (this.onGitGutterClickCallback) {
        this.onGitGutterClickCallback(line);
      }
    });

    editorContent.onInlineDiffStage((filePath, line) => {
      if (this.onInlineDiffStageCallback) {
        return this.onInlineDiffStageCallback(filePath, line);
      }
      return Promise.resolve();
    });

    editorContent.onInlineDiffRevert((filePath, line) => {
      if (this.onInlineDiffRevertCallback) {
        return this.onInlineDiffRevertCallback(filePath, line);
      }
      return Promise.resolve();
    });
  }

  /**
   * Close a tab by ID
   */
  closeTab(tabId: string): void {
    const index = this.tabs.findIndex(t => t.id === tabId);
    if (index === -1) return;

    const tab = this.tabs[index]!;
    tab.editorContent.dispose?.();
    this.tabs.splice(index, 1);

    if (this.activeTabId === tabId) {
      if (this.tabs.length > 0) {
        const newIndex = Math.min(index, this.tabs.length - 1);
        this.activateTab(this.tabs[newIndex]!.id);
      } else {
        this.activeTabId = null;
      }
    }
  }

  /**
   * Close tab containing a specific document
   */
  closeDocument(document: Document): void {
    const tab = this.tabs.find(t => t.editorContent.getDocument() === document);
    if (tab) {
      this.closeTab(tab.id);
    }
  }

  /**
   * Activate a tab
   */
  private activateTab(tabId: string): void {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    // Deactivate previous
    if (this.activeTabId && this.activeTabId !== tabId) {
      const prevTab = this.tabs.find(t => t.id === this.activeTabId);
      if (prevTab) {
        prevTab.editorContent.setVisible(false);
        prevTab.editorContent.onDeactivated?.();
      }
    }

    this.activeTabId = tabId;
    tab.editorContent.setVisible(true);
    tab.editorContent.setFocused(this.isFocused);
    tab.editorContent.onActivated?.();

    const doc = tab.editorContent.getDocument();
    if (doc && this.onTabSelectCallback) {
      this.onTabSelectCallback(doc);
    }
  }

  /**
   * Get active document
   */
  getActiveDocument(): Document | null {
    const content = this.getActiveEditorContent();
    return content?.getDocument() || null;
  }

  /**
   * Get active tab ID
   */
  getActiveTabId(): string | null {
    return this.activeTabId;
  }

  /**
   * Check if pane has any tabs
   */
  hasTabs(): boolean {
    return this.tabs.length > 0;
  }

  /**
   * Get tab count
   */
  getTabCount(): number {
    return this.tabs.length;
  }

  /**
   * Check if document is open in this pane
   */
  hasDocument(document: Document): boolean {
    return this.tabs.some(t => t.editorContent.getDocument() === document);
  }

  /**
   * Check if document with given ID is open
   */
  hasDocumentById(id: string): boolean {
    return this.tabs.some(t => t.documentId === id);
  }

  /**
   * Add a document with a specific ID
   */
  addDocument(id: string, document: Document): void {
    if (this.tabs.some(t => t.documentId === id)) return;

    const tabId = this.generateTabId();
    const editorContent = new EditorContent(tabId, document, id);
    this.setupEditorContentCallbacks(editorContent);

    // Set initial rect
    editorContent.setRect({
      x: this.rect.x,
      y: this.rect.y + this.tabBarHeight,
      width: this.rect.width,
      height: this.rect.height - this.tabBarHeight,
    });

    const tab: PaneTab = {
      id: tabId,
      documentId: id,
      editorContent,
    };

    this.tabs.push(tab);
  }

  /**
   * Set active document by ID
   */
  setActiveDocument(id: string, document: Document): void {
    let tab = this.tabs.find(t => t.documentId === id);
    if (!tab) {
      this.addDocument(id, document);
      tab = this.tabs.find(t => t.documentId === id);
    }

    if (tab) {
      this.activateTab(tab.id);
    }
  }

  /**
   * Get the active document ID
   */
  getActiveDocumentId(): string | null {
    if (!this.activeTabId) return null;
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    return tab?.documentId || null;
  }

  /**
   * Get all tabs info for session state
   */
  getTabsInfo(): Array<{
    documentId: string;
    filePath: string | null;
    isActive: boolean;
    tabOrder: number;
  }> {
    return this.tabs.map((tab, index) => {
      const doc = tab.editorContent.getDocument();
      return {
        documentId: tab.documentId,
        filePath: doc?.filePath || null,
        isActive: tab.id === this.activeTabId,
        tabOrder: index,
      };
    });
  }

  /**
   * Get all document IDs
   */
  getDocumentIds(): string[] {
    return this.tabs.map(t => t.documentId);
  }

  /**
   * Remove a document by ID
   */
  removeDocument(id: string): void {
    const index = this.tabs.findIndex(t => t.documentId === id);
    if (index === -1) return;

    const closedTab = this.tabs[index]!;
    closedTab.editorContent.dispose?.();
    this.tabs.splice(index, 1);

    if (this.activeTabId === closedTab.id) {
      if (this.tabs.length > 0) {
        const newIndex = Math.min(index, this.tabs.length - 1);
        const newTab = this.tabs[newIndex]!;
        this.activateTab(newTab.id);
      } else {
        this.activeTabId = null;
      }
    }
  }

  // ==================== Focus Management ====================

  setFocused(focused: boolean): void {
    const wasFocused = this.isFocused;
    this.isFocused = focused;

    const activeContent = this.getActiveEditorContent();
    if (activeContent) {
      activeContent.setFocused(focused);
    }

    if (focused && !wasFocused && this.onFocusCallback) {
      this.onFocusCallback();
    }
  }

  getFocused(): boolean {
    return this.isFocused;
  }

  // ==================== Layout ====================

  setRect(rect: Rect): void {
    debugLog(`[Pane ${this.id}] setRect(${JSON.stringify(rect)})`);
    this.rect = rect;

    // Tab bar takes top row
    this.tabBar.setRect({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: this.tabBarHeight,
    });

    // Editor content area (below tab bar)
    const contentRect: Rect = {
      x: rect.x,
      y: rect.y + this.tabBarHeight,
      width: rect.width,
      height: rect.height - this.tabBarHeight,
    };

    // Update all editor contents
    for (const tab of this.tabs) {
      tab.editorContent.setRect(contentRect);
    }
  }

  getRect(): Rect {
    return this.rect;
  }

  getEditorRect(): Rect {
    const content = this.getActiveEditorContent();
    if (content) {
      return content.getRect();
    }
    return {
      x: this.rect.x,
      y: this.rect.y + this.tabBarHeight,
      width: this.rect.width,
      height: this.rect.height - this.tabBarHeight,
    };
  }

  // ==================== Scrolling ====================

  setScrollTop(value: number): void {
    const content = this.getActiveEditorContent();
    if (content) {
      content.setScrollTop(value);
    }
  }

  getScrollTop(): number {
    const content = this.getActiveEditorContent();
    return content?.getScrollTop() || 0;
  }

  setScrollLeft(value: number): void {
    const content = this.getActiveEditorContent();
    if (content) {
      content.setScrollLeft(value);
    }
  }

  getScrollLeft(): number {
    const content = this.getActiveEditorContent();
    return content?.getScrollLeft() || 0;
  }

  getVisibleLineCount(): number {
    return this.rect.height - this.tabBarHeight;
  }

  ensureCursorVisible(): void {
    const content = this.getActiveEditorContent();
    if (content) {
      content.ensureCursorVisible();
    }
  }

  // ==================== Rendering ====================

  render(ctx: RenderContext): void {
    debugLog(`[Pane ${this.id}] render() called`);

    // Render tab bar
    this.renderTabBar(ctx);

    // Render active editor content
    const content = this.getActiveEditorContent();
    if (content) {
      content.render(ctx);
    } else {
      this.renderEmptyState(ctx);
    }

    // Render focus indicator
    if (this.isFocused) {
      this.renderFocusBorder(ctx);
    }
  }

  private renderTabBar(ctx: RenderContext): void {
    const tabBarTabs: Tab[] = this.tabs.map(t => {
      const doc = t.editorContent.getDocument();
      return {
        id: t.id,
        fileName: doc?.fileName || 'Untitled',
        filePath: doc?.filePath || null,
        isDirty: doc?.isDirty || false,
        isActive: t.id === this.activeTabId,
        isMissing: doc?.isMissing || false,
      };
    });

    this.tabBar.setTabs(tabBarTabs);
    this.tabBar.setFocused(this.isFocused);
    this.tabBar.render(ctx);
  }

  private renderEmptyState(ctx: RenderContext): void {
    const editorRect = this.getEditorRect();

    // Fill background
    const bgColor = themeLoader.getColor('editor.background') || '#282c34';
    const bgRgb = hexToRgb(bgColor);
    if (bgRgb) {
      const bg = `\x1b[48;2;${bgRgb.r};${bgRgb.g};${bgRgb.b}m`;
      for (let y = editorRect.y; y < editorRect.y + editorRect.height; y++) {
        ctx.buffer(`\x1b[${y};${editorRect.x}H${bg}${' '.repeat(editorRect.width)}\x1b[0m`);
      }
    }

    const message = 'No file open';
    const x = editorRect.x + Math.floor((editorRect.width - message.length) / 2);
    const y = editorRect.y + Math.floor(editorRect.height / 2);

    const fgColor = themeLoader.getColor('editorLineNumber.foreground') || '#495162';
    const fgRgb = hexToRgb(fgColor);
    const fg = fgRgb ? `\x1b[38;2;${fgRgb.r};${fgRgb.g};${fgRgb.b}m` : '';

    ctx.buffer(`\x1b[${y};${x}H${fg}${message}\x1b[0m`);
  }

  private renderFocusBorder(ctx: RenderContext): void {
    const accentColor = themeLoader.getColor('focusBorder') || '#528bff';
    const rgb = hexToRgb(accentColor);
    if (rgb) {
      ctx.buffer(`\x1b[${this.rect.y};${this.rect.x}H\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m▎\x1b[0m`);
    }
  }

  // ==================== Mouse Handling ====================

  containsPoint(x: number, y: number): boolean {
    return (
      x >= this.rect.x &&
      x < this.rect.x + this.rect.width &&
      y >= this.rect.y &&
      y < this.rect.y + this.rect.height
    );
  }

  onMouseEvent(event: MouseEvent): boolean {
    // Check tab bar first
    if (event.y === this.rect.y) {
      return this.tabBar.onMouseEvent(event);
    }

    // Delegate to active editor content
    const content = this.getActiveEditorContent();
    if (content && content.containsPoint?.(event.x, event.y)) {
      return content.handleMouse?.(event) || false;
    }

    return false;
  }

  // ==================== Callbacks ====================

  onClick(callback: (position: Position, clickCount: number, event: MouseEvent) => void): () => void {
    this.onClickCallback = callback;
    return () => { this.onClickCallback = undefined; };
  }

  onDrag(callback: (position: Position, event: MouseEvent) => void): () => void {
    this.onDragCallback = callback;
    return () => { this.onDragCallback = undefined; };
  }

  onScroll(callback: (deltaX: number, deltaY: number) => void): () => void {
    this.onScrollCallback = callback;
    return () => { this.onScrollCallback = undefined; };
  }

  onFocus(callback: () => void): () => void {
    this.onFocusCallback = callback;
    return () => { this.onFocusCallback = undefined; };
  }

  onTabSelect(callback: (document: Document) => void): () => void {
    this.onTabSelectCallback = callback;
    return () => { this.onTabSelectCallback = undefined; };
  }

  onTabClose(callback: (document: Document, tabId: string) => void): () => void {
    this.onTabCloseCallback = callback;
    return () => { this.onTabCloseCallback = undefined; };
  }

  onFoldToggle(callback: (line: number) => void): () => void {
    this.onFoldToggleCallback = callback;
    return () => { this.onFoldToggleCallback = undefined; };
  }

  onGitGutterClick(callback: (line: number) => void): () => void {
    this.onGitGutterClickCallback = callback;
    return () => { this.onGitGutterClickCallback = undefined; };
  }

  onInlineDiffStage(callback: (filePath: string, line: number) => Promise<void>): () => void {
    this.onInlineDiffStageCallback = callback;
    return () => { this.onInlineDiffStageCallback = undefined; };
  }

  onInlineDiffRevert(callback: (filePath: string, line: number) => Promise<void>): () => void {
    this.onInlineDiffRevertCallback = callback;
    return () => { this.onInlineDiffRevertCallback = undefined; };
  }

  // ==================== Folding ====================

  toggleFoldAtCursor(): boolean {
    const content = this.getActiveEditorContent();
    if (!content) return false;

    const doc = content.getDocument();
    if (!doc) return false;

    const foldManager = content.getFoldManager();
    const cursorLine = doc.primaryCursor.position.line;

    if (foldManager.isFolded(cursorLine)) {
      foldManager.unfold(cursorLine);
      return true;
    } else if (foldManager.canFold(cursorLine)) {
      foldManager.fold(cursorLine);
      return true;
    }

    return false;
  }

  foldAll(): void {
    const content = this.getActiveEditorContent();
    if (content) {
      content.getFoldManager().foldAll();
    }
  }

  unfoldAll(): void {
    const content = this.getActiveEditorContent();
    if (content) {
      content.getFoldManager().unfoldAll();
    }
  }

  isFoldingEnabled(): boolean {
    return true;
  }

  setFoldingEnabled(_enabled: boolean): void {
    // Could be implemented to toggle folding
  }

  // ==================== Minimap ====================

  getMinimap(): Minimap | null {
    // Minimap is now managed by EditorContent
    return null;
  }

  toggleMinimap(): void {
    // Could be implemented to toggle minimap in active content
  }

  // ==================== Git Integration ====================

  setGitLineChanges(changes: GitLineChange[]): void {
    const content = this.getActiveEditorContent();
    if (content) {
      const map = new Map<number, GitLineChange['type']>();
      for (const change of changes) {
        map.set(change.line, change.type);
      }
      content.setGitLineChanges(map);
    }
  }

  clearGitLineChanges(): void {
    const content = this.getActiveEditorContent();
    if (content) {
      content.setGitLineChanges(new Map());
    }
  }

  getGitLineChanges(): GitLineChange[] {
    return [];
  }

  // ==================== Inline Diff ====================

  showInlineDiff(line: number, diffLines: string[], filePath: string): void {
    const content = this.getActiveEditorContent();
    if (content) {
      content.showInlineDiff(line, diffLines, filePath);
    }
  }

  hideInlineDiff(): void {
    const content = this.getActiveEditorContent();
    if (content) {
      content.hideInlineDiff();
    }
  }

  isInlineDiffVisible(): boolean {
    const content = this.getActiveEditorContent();
    return content?.isInlineDiffVisible() || false;
  }

  handleInlineDiffKey(_key: string, _ctrl: boolean, _shift: boolean): boolean {
    return false;
  }
}

export default Pane;
