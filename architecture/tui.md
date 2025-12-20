# Ultra 1.0 TUI Architecture

## Overview

Implement the TUI (Terminal User Interface) layer for Ultra 1.0. The TUI is completely decoupled from the ECP (Editor Command Protocol) and underlying services. It renders to the terminal and translates user input into ECP commands.
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Ultra TUI                                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                           Window                                    │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │                      Pane Container                         │    │    │
│  │  │   ┌─────────────┐   ┌─────────────────────────────────┐     │    │    │
│  │  │   │   Pane      │   │           Pane                  │     │    │    │
│  │  │   │ (Accordion) │   │          (Tabs)                 │     │    │    │
│  │  │   │ ┌─────────┐ │   │ ┌─────────────────────────────┐ │     │    │    │
│  │  │   │ │FileTree │ │   │ │ Tab: file.ts | Tab: main.ts │ │     │    │    │
│  │  │   │ ├─────────┤ │   │ ├─────────────────────────────┤ │     │    │    │
│  │  │   │ │GitPanel │ │   │ │                             │ │     │    │    │
│  │  │   │ └─────────┘ │   │ │      DocumentEditor         │ │     │    │    │
│  │  │   └─────────────┘   │ │                             │ │     │    │    │
│  │  │                     │ └─────────────────────────────┘ │     │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │                         Status Bar                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      Overlay Layer (Z-ordered)                      │    │
│  │   - Command Palette                                                 │    │
│  │   - Dialogs                                                         │    │
│  │   - Notifications/Toasts                                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure
```
src/tui/
├── index.ts                    # TUI entry point
├── window.ts                   # Window manager
├── types.ts                    # Core types
├── rendering/
│   ├── renderer.ts             # Main render loop with dirty tracking
│   ├── buffer.ts               # Double-buffered screen buffer
│   ├── primitives.ts           # Box drawing, text, colors
│   └── theme.ts                # Theme/color management
├── layout/
│   ├── pane.ts                 # Pane container
│   ├── pane-container.ts       # Split pane management
│   ├── tab-container.ts        # Tab bar + content
│   ├── accordion-container.ts  # Collapsible sections
│   └── layout-presets.ts       # Preset layouts
├── elements/
│   ├── base.ts                 # BaseElement class
│   ├── document-editor.ts      # Code/text editor
│   ├── file-tree.ts            # File explorer
│   ├── git-panel.ts            # Git status/changes
│   ├── git-diff-view.ts        # Diff viewer (read-only)
│   ├── agent-chat.ts           # AI agent chat
│   ├── terminal-session.ts     # Embedded terminal
│   ├── search-find-results.ts  # Search results
│   └── diagnostics-view.ts     # Problems/errors
├── overlays/
│   ├── overlay-manager.ts      # Z-order overlay management
│   ├── command-palette.ts      # Command palette dialog
│   ├── file-picker.ts          # File picker dialog
│   ├── dialog.ts               # Generic dialog base
│   ├── confirmation.ts         # Confirmation dialog
│   └── notification.ts         # Toast notifications
├── status-bar/
│   ├── status-bar.ts           # Status bar component
│   └── status-history.ts       # Expandable history
├── input/
│   ├── input-handler.ts        # Keyboard/mouse routing
│   ├── focus-manager.ts        # Global focus tracking
│   ├── pane-navigation.ts      # Pane navigation mode
│   └── keybindings.ts          # Keybinding definitions
└── session/
    └── layout-serializer.ts    # Serialize/deserialize layout
```

---

## Core Types

### src/tui/types.ts
```typescript
// ============================================
// Geometry
// ============================================

export interface Rect {
  x: number;      // Column (0-indexed)
  y: number;      // Row (0-indexed)
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

// ============================================
// Element Types
// ============================================

export type ElementType =
  | 'DocumentEditor'
  | 'FileTree'
  | 'GitPanel'
  | 'GitDiffView'
  | 'AgentChat'
  | 'TerminalSession'
  | 'SearchFindResults'
  | 'DiagnosticsView';

export interface ElementConfig {
  type: ElementType;
  id: string;           // Unique instance ID
  title: string;        // Display title
  state?: unknown;      // Element-specific state
}

// ============================================
// Container Types
// ============================================

export type ContainerMode = 'tabs' | 'accordion';

export type SplitDirection = 'horizontal' | 'vertical';

export interface PaneConfig {
  id: string;
  mode: ContainerMode;
  elements: ElementConfig[];
  activeElementId?: string;        // For tabs
  expandedElementIds?: string[];   // For accordion
}

export interface SplitConfig {
  id: string;
  direction: SplitDirection;
  children: Array<PaneConfig | SplitConfig>;
  ratios: number[];   // e.g., [0.33, 0.33, 0.34] for three-way split
}

export interface LayoutConfig {
  root: PaneConfig | SplitConfig;
  focusedPaneId: string;
  focusedElementId: string;
}

// ============================================
// Rendering
// ============================================

export interface Cell {
  char: string;
  fg: string;         // Foreground color (hex or name)
  bg: string;         // Background color
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface DirtyRegion {
  rect: Rect;
  reason: string;
}

// ============================================
// Input
// ============================================

export interface KeyEvent {
  key: string;          // e.g., 'a', 'Enter', 'ArrowUp'
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

export interface MouseEvent {
  type: 'press' | 'release' | 'drag' | 'scroll' | 'move';
  button: 'left' | 'middle' | 'right' | 'none';
  x: number;
  y: number;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}

// ============================================
// Lifecycle
// ============================================

export interface ElementLifecycle {
  onMount(): void;
  onUnmount(): void;
  onFocus(): void;
  onBlur(): void;
  onResize(size: Size): void;
  onVisibilityChange(visible: boolean): void;
}
```

---

## Base Element Class

### src/tui/elements/base.ts
```typescript
import type { 
  Rect, 
  Size, 
  ElementType, 
  ElementLifecycle,
  KeyEvent,
  MouseEvent,
  Cell,
} from '../types';
import type { ScreenBuffer } from '../rendering/buffer';
import type { ECP } from '../../ecp/client';

export interface ElementContext {
  ecp: ECP;                          // ECP client for commands
  markDirty: (region?: Rect) => void; // Mark for re-render
  requestFocus: () => void;           // Request focus
  updateTitle: (title: string) => void;
  updateStatus: (status: string) => void; // For accordion headers
}

export abstract class BaseElement implements ElementLifecycle {
  readonly type: ElementType;
  readonly id: string;
  
  protected title: string;
  protected status: string = '';
  protected bounds: Rect = { x: 0, y: 0, width: 0, height: 0 };
  protected visible: boolean = false;
  protected focused: boolean = false;
  protected ctx: ElementContext;
  
  constructor(type: ElementType, id: string, title: string, ctx: ElementContext) {
    this.type = type;
    this.id = id;
    this.title = title;
    this.ctx = ctx;
  }
  
  // ============================================
  // Lifecycle (override in subclasses)
  // ============================================
  
  onMount(): void {}
  onUnmount(): void {}
  
  onFocus(): void {
    this.focused = true;
    this.ctx.markDirty();
  }
  
  onBlur(): void {
    this.focused = false;
    this.ctx.markDirty();
  }
  
  onResize(size: Size): void {
    this.bounds.width = size.width;
    this.bounds.height = size.height;
    this.ctx.markDirty();
  }
  
  onVisibilityChange(visible: boolean): void {
    this.visible = visible;
    if (visible) {
      this.ctx.markDirty();
    }
  }
  
  // ============================================
  // Rendering (must implement)
  // ============================================
  
  /**
   * Render element content to the buffer.
   * Coordinates are relative to bounds (0,0 is top-left of element).
   */
  abstract render(buffer: ScreenBuffer): void;
  
  // ============================================
  // Input (override as needed)
  // ============================================
  
  /**
   * Handle keyboard input.
   * Return true if handled, false to propagate.
   */
  handleKey(event: KeyEvent): boolean {
    return false;
  }
  
  /**
   * Handle mouse input.
   * Coordinates are relative to element bounds.
   * Return true if handled, false to propagate.
   */
  handleMouse(event: MouseEvent): boolean {
    return false;
  }
  
  // ============================================
  // State Serialization
  // ============================================
  
  /**
   * Get state for session persistence.
   * Override to include element-specific state.
   */
  getState(): unknown {
    return {};
  }
  
  /**
   * Restore state from session.
   * Override to restore element-specific state.
   */
  setState(state: unknown): void {}
  
  // ============================================
  // Accessors
  // ============================================
  
  getTitle(): string {
    return this.title;
  }
  
  getStatus(): string {
    return this.status;
  }
  
  getBounds(): Rect {
    return { ...this.bounds };
  }
  
  setBounds(bounds: Rect): void {
    this.bounds = { ...bounds };
    this.onResize({ width: bounds.width, height: bounds.height });
  }
  
  isFocused(): boolean {
    return this.focused;
  }
  
  isVisible(): boolean {
    return this.visible;
  }
}
```

---

## Window Manager

### src/tui/window.ts
```typescript
import type { Size, LayoutConfig, KeyEvent, MouseEvent } from './types';
import { PaneContainer } from './layout/pane-container';
import { StatusBar } from './status-bar/status-bar';
import { OverlayManager } from './overlays/overlay-manager';
import { FocusManager } from './input/focus-manager';
import { Renderer } from './rendering/renderer';
import type { ECP } from '../ecp/client';

export interface WindowConfig {
  ecp: ECP;
  initialLayout?: LayoutConfig;
}

export class Window {
  private size: Size = { width: 80, height: 24 };
  private paneContainer: PaneContainer;
  private statusBar: StatusBar;
  private overlayManager: OverlayManager;
  private focusManager: FocusManager;
  private renderer: Renderer;
  private ecp: ECP;
  
  constructor(config: WindowConfig) {
    this.ecp = config.ecp;
    this.renderer = new Renderer();
    this.focusManager = new FocusManager();
    this.overlayManager = new OverlayManager(this.renderer);
    this.statusBar = new StatusBar(this.ecp);
    this.paneContainer = new PaneContainer(this.ecp, this.focusManager);
    
    if (config.initialLayout) {
      this.loadLayout(config.initialLayout);
    }
  }
  
  // ============================================
  // Lifecycle
  // ============================================
  
  async start(): Promise<void> {
    // Get terminal size
    this.size = await this.getTerminalSize();
    
    // Set up resize handler
    process.stdout.on('resize', () => this.handleResize());
    
    // Initialize rendering
    this.renderer.initialize(this.size);
    
    // Layout components
    this.layout();
    
    // Initial render
    this.render();
    
    // Start input loop
    this.startInputLoop();
  }
  
  async stop(): Promise<void> {
    this.renderer.cleanup();
  }
  
  // ============================================
  // Layout
  // ============================================
  
  private layout(): void {
    const statusBarHeight = this.statusBar.isExpanded() 
      ? this.statusBar.getExpandedHeight() 
      : 1;
    
    // Pane container gets everything except status bar
    this.paneContainer.setBounds({
      x: 0,
      y: 0,
      width: this.size.width,
      height: this.size.height - statusBarHeight,
    });
    
    // Status bar at bottom
    this.statusBar.setBounds({
      x: 0,
      y: this.size.height - statusBarHeight,
      width: this.size.width,
      height: statusBarHeight,
    });
  }
  
  private handleResize(): void {
    this.size = this.getTerminalSizeSync();
    this.renderer.resize(this.size);
    this.layout();
    this.render();
  }
  
  // ============================================
  // Rendering
  // ============================================
  
  render(): void {
    const buffer = this.renderer.getBuffer();
    
    // Clear buffer
    buffer.clear();
    
    // Render pane container
    this.paneContainer.render(buffer);
    
    // Render status bar
    this.statusBar.render(buffer);
    
    // Render overlays on top
    this.overlayManager.render(buffer);
    
    // Flush to terminal
    this.renderer.flush();
  }
  
  // ============================================
  // Input Handling
  // ============================================
  
  private startInputLoop(): void {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    
    // Enable mouse
    process.stdout.write('\x1b[?1000h'); // Enable mouse tracking
    process.stdout.write('\x1b[?1006h'); // SGR extended mode
    
    process.stdin.on('data', (data) => {
      const events = this.parseInput(data);
      for (const event of events) {
        this.handleInput(event);
      }
    });
  }
  
  private handleInput(event: KeyEvent | MouseEvent): void {
    // 1. Overlays get first chance
    if (this.overlayManager.hasOverlays()) {
      if (this.overlayManager.handleInput(event)) {
        this.render();
        return;
      }
    }
    
    // 2. Focus manager for navigation mode
    if (this.focusManager.isInNavigationMode()) {
      if (this.focusManager.handleInput(event)) {
        this.render();
        return;
      }
    }
    
    // 3. Route to focused element
    const focusedElement = this.focusManager.getFocusedElement();
    if (focusedElement) {
      if ('key' in event) {
        if (focusedElement.handleKey(event)) {
          this.render();
          return;
        }
      } else {
        if (focusedElement.handleMouse(event)) {
          this.render();
          return;
        }
      }
    }
    
    // 4. Global keybindings
    this.handleGlobalKeybinding(event);
    this.render();
  }
  
  private handleGlobalKeybinding(event: KeyEvent | MouseEvent): void {
    if (!('key' in event)) return;
    
    // Ctrl+Shift+P: Command palette
    // Ctrl+B: Toggle sidebar
    // Ctrl+\: Split vertical
    // Ctrl+Shift+\: Split horizontal
    // Ctrl+W: Close current tab/element
    // Ctrl+Tab: Next tab
    // Ctrl+Shift+Tab: Previous tab
    // Alt+Arrow: Move focus between panes
    // Ctrl+G: Pane navigation mode
    // ... etc
  }
  
  // ============================================
  // Pane Operations (exposed to ECP)
  // ============================================
  
  splitPane(direction: SplitDirection, paneId?: string): string {
    return this.paneContainer.split(direction, paneId);
  }
  
  closePane(paneId: string): void {
    this.paneContainer.close(paneId);
    this.layout();
    this.render();
  }
  
  addElement(paneId: string, elementType: ElementType, config?: unknown): string {
    return this.paneContainer.addElement(paneId, elementType, config);
  }
  
  removeElement(elementId: string): void {
    this.paneContainer.removeElement(elementId);
    this.render();
  }
  
  moveElement(elementId: string, targetPaneId: string): void {
    this.paneContainer.moveElement(elementId, targetPaneId);
    this.render();
  }
  
  focusPane(paneId: string): void {
    this.focusManager.focusPane(paneId);
    this.render();
  }
  
  focusElement(elementId: string): void {
    this.focusManager.focusElement(elementId);
    this.render();
  }
  
  // ============================================
  // Overlay Operations
  // ============================================
  
  showCommandPalette(): void {
    this.overlayManager.showCommandPalette();
    this.render();
  }
  
  showFilePicker(options?: FilePickerOptions): Promise<string | null> {
    return this.overlayManager.showFilePicker(options);
  }
  
  showConfirmation(message: string, options?: ConfirmOptions): Promise<boolean> {
    return this.overlayManager.showConfirmation(message, options);
  }
  
  showNotification(message: string, type: 'info' | 'warning' | 'error'): void {
    this.overlayManager.showNotification(message, type);
    this.render();
  }
  
  // ============================================
  // Layout Persistence
  // ============================================
  
  getLayout(): LayoutConfig {
    return {
      root: this.paneContainer.serialize(),
      focusedPaneId: this.focusManager.getFocusedPaneId(),
      focusedElementId: this.focusManager.getFocusedElementId(),
    };
  }
  
  loadLayout(layout: LayoutConfig): void {
    this.paneContainer.deserialize(layout.root);
    this.focusManager.setFocus(layout.focusedPaneId, layout.focusedElementId);
    this.layout();
  }
}
```

---

## Pane Container

### src/tui/layout/pane-container.ts
```typescript
import type { 
  Rect, 
  SplitDirection, 
  PaneConfig, 
  SplitConfig,
  ElementType,
} from '../types';
import { Pane } from './pane';
import type { ScreenBuffer } from '../rendering/buffer';
import type { ECP } from '../../ecp/client';
import type { FocusManager } from '../input/focus-manager';

type LayoutNode = Pane | SplitNode;

interface SplitNode {
  type: 'split';
  id: string;
  direction: SplitDirection;
  children: LayoutNode[];
  ratios: number[];
  bounds: Rect;
}

export class PaneContainer {
  private root: LayoutNode | null = null;
  private panes: Map<string, Pane> = new Map();
  private bounds: Rect = { x: 0, y: 0, width: 0, height: 0 };
  private ecp: ECP;
  private focusManager: FocusManager;
  private nextPaneId = 1;
  private nextSplitId = 1;
  
  constructor(ecp: ECP, focusManager: FocusManager) {
    this.ecp = ecp;
    this.focusManager = focusManager;
  }
  
  // ============================================
  // Initialization
  // ============================================
  
  /**
   * Create initial single pane if none exists.
   */
  ensureRoot(): Pane {
    if (!this.root) {
      const pane = this.createPane();
      this.root = pane;
    }
    
    if (this.root instanceof Pane) {
      return this.root;
    }
    
    // Find first pane in split
    return this.findFirstPane(this.root);
  }
  
  private createPane(): Pane {
    const id = `pane-${this.nextPaneId++}`;
    const pane = new Pane(id, this.ecp, this.focusManager, {
      onDirty: () => this.markDirty(),
    });
    this.panes.set(id, pane);
    return pane;
  }
  
  // ============================================
  // Layout
  // ============================================
  
  setBounds(bounds: Rect): void {
    this.bounds = bounds;
    if (this.root) {
      this.layoutNode(this.root, bounds);
    }
  }
  
  private layoutNode(node: LayoutNode, bounds: Rect): void {
    if (node instanceof Pane) {
      node.setBounds(bounds);
      return;
    }
    
    // Split node
    node.bounds = bounds;
    const { direction, children, ratios } = node;
    
    let offset = direction === 'horizontal' ? bounds.y : bounds.x;
    const totalSize = direction === 'horizontal' ? bounds.height : bounds.width;
    
    children.forEach((child, i) => {
      const size = Math.floor(totalSize * ratios[i]);
      
      const childBounds: Rect = direction === 'horizontal'
        ? { x: bounds.x, y: offset, width: bounds.width, height: size }
        : { x: offset, y: bounds.y, width: size, height: bounds.height };
      
      // Account for divider (1 char)
      if (i > 0) {
        if (direction === 'horizontal') {
          childBounds.y += 1;
          childBounds.height -= 1;
        } else {
          childBounds.x += 1;
          childBounds.width -= 1;
        }
      }
      
      this.layoutNode(child, childBounds);
      offset += size;
    });
  }
  
  // ============================================
  // Splitting
  // ============================================
  
  /**
   * Split a pane. Returns new pane ID.
   * Content stays in original pane (left for vertical, top for horizontal).
   */
  split(direction: SplitDirection, paneId?: string): string {
    const targetPaneId = paneId || this.focusManager.getFocusedPaneId();
    const targetPane = this.panes.get(targetPaneId);
    if (!targetPane) {
      throw new Error(`Pane not found: ${targetPaneId}`);
    }
    
    const newPane = this.createPane();
    const parent = this.findParent(this.root!, targetPane);
    
    const splitNode: SplitNode = {
      type: 'split',
      id: `split-${this.nextSplitId++}`,
      direction,
      children: [targetPane, newPane],
      ratios: [0.5, 0.5],
      bounds: targetPane.getBounds(),
    };
    
    if (!parent) {
      // Target is root
      this.root = splitNode;
    } else if (parent instanceof Pane) {
      // This shouldn't happen
      throw new Error('Invalid parent');
    } else {
      // Replace in parent split
      const idx = parent.children.indexOf(targetPane);
      parent.children[idx] = splitNode;
    }
    
    // Re-layout
    this.layoutNode(this.root!, this.bounds);
    
    return newPane.id;
  }
  
  /**
   * Close a pane. Sibling expands to fill.
   */
  close(paneId: string): void {
    const pane = this.panes.get(paneId);
    if (!pane) return;
    
    // Unmount all elements
    pane.unmountAll();
    this.panes.delete(paneId);
    
    const parent = this.findParent(this.root!, pane);
    
    if (!parent) {
      // Closing root pane - create new empty one
      this.root = this.createPane();
    } else if ('children' in parent) {
      const idx = parent.children.indexOf(pane);
      parent.children.splice(idx, 1);
      parent.ratios.splice(idx, 1);
      
      // Redistribute ratios
      const total = parent.ratios.reduce((a, b) => a + b, 0);
      parent.ratios = parent.ratios.map(r => r / total);
      
      // If only one child left, collapse the split
      if (parent.children.length === 1) {
        const child = parent.children[0];
        const grandparent = this.findParent(this.root!, parent);
        
        if (!grandparent) {
          this.root = child;
        } else if ('children' in grandparent) {
          const idx = grandparent.children.indexOf(parent);
          grandparent.children[idx] = child;
        }
      }
    }
    
    // Move focus to sibling
    if (this.focusManager.getFocusedPaneId() === paneId) {
      const firstPane = this.findFirstPane(this.root!);
      this.focusManager.focusPane(firstPane.id);
    }
    
    this.layoutNode(this.root!, this.bounds);
  }
  
  // ============================================
  // Element Management
  // ============================================
  
  addElement(paneId: string, elementType: ElementType, config?: unknown): string {
    const pane = this.panes.get(paneId);
    if (!pane) {
      throw new Error(`Pane not found: ${paneId}`);
    }
    return pane.addElement(elementType, config);
  }
  
  removeElement(elementId: string): void {
    for (const pane of this.panes.values()) {
      if (pane.hasElement(elementId)) {
        pane.removeElement(elementId);
        return;
      }
    }
  }
  
  moveElement(elementId: string, targetPaneId: string): void {
    // Find source pane
    let sourcePane: Pane | null = null;
    for (const pane of this.panes.values()) {
      if (pane.hasElement(elementId)) {
        sourcePane = pane;
        break;
      }
    }
    
    if (!sourcePane) {
      throw new Error(`Element not found: ${elementId}`);
    }
    
    const targetPane = this.panes.get(targetPaneId);
    if (!targetPane) {
      throw new Error(`Pane not found: ${targetPaneId}`);
    }
    
    const element = sourcePane.detachElement(elementId);
    targetPane.attachElement(element);
  }
  
  // ============================================
  // Rendering
  // ============================================
  
  render(buffer: ScreenBuffer): void {
    if (this.root) {
      this.renderNode(this.root, buffer);
    }
  }
  
  private renderNode(node: LayoutNode, buffer: ScreenBuffer): void {
    if (node instanceof Pane) {
      node.render(buffer);
      return;
    }
    
    // Render children
    for (const child of node.children) {
      this.renderNode(child, buffer);
    }
    
    // Render dividers
    this.renderDividers(node, buffer);
  }
  
  private renderDividers(split: SplitNode, buffer: ScreenBuffer): void {
    const { direction, bounds, children } = split;
    
    let offset = direction === 'horizontal' ? bounds.y : bounds.x;
    const totalSize = direction === 'horizontal' ? bounds.height : bounds.width;
    
    for (let i = 1; i < children.length; i++) {
      const size = Math.floor(totalSize * split.ratios[i - 1]);
      offset += size;
      
      if (direction === 'horizontal') {
        // Horizontal divider
        for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
          buffer.set(x, offset, { char: '─', fg: 'gray', bg: 'default' });
        }
      } else {
        // Vertical divider
        for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
          buffer.set(offset, y, { char: '│', fg: 'gray', bg: 'default' });
        }
      }
    }
  }
  
  // ============================================
  // Serialization
  // ============================================
  
  serialize(): PaneConfig | SplitConfig {
    if (!this.root) {
      return { id: 'empty', mode: 'tabs', elements: [] };
    }
    return this.serializeNode(this.root);
  }
  
  private serializeNode(node: LayoutNode): PaneConfig | SplitConfig {
    if (node instanceof Pane) {
      return node.serialize();
    }
    
    return {
      id: node.id,
      direction: node.direction,
      children: node.children.map(c => this.serializeNode(c)),
      ratios: node.ratios,
    };
  }
  
  deserialize(config: PaneConfig | SplitConfig): void {
    this.panes.clear();
    this.root = this.deserializeNode(config);
    this.layoutNode(this.root, this.bounds);
  }
  
  private deserializeNode(config: PaneConfig | SplitConfig): LayoutNode {
    if ('mode' in config) {
      // PaneConfig
      const pane = this.createPane();
      pane.deserialize(config);
      return pane;
    }
    
    // SplitConfig
    return {
      type: 'split',
      id: config.id,
      direction: config.direction,
      children: config.children.map(c => this.deserializeNode(c)),
      ratios: config.ratios,
      bounds: { x: 0, y: 0, width: 0, height: 0 },
    };
  }
  
  // ============================================
  // Helpers
  // ============================================
  
  private findParent(node: LayoutNode, target: LayoutNode): SplitNode | null {
    if (node instanceof Pane) {
      return null;
    }
    
    for (const child of node.children) {
      if (child === target) {
        return node;
      }
      const found = this.findParent(child, target);
      if (found) return found;
    }
    
    return null;
  }
  
  private findFirstPane(node: LayoutNode): Pane {
    if (node instanceof Pane) {
      return node;
    }
    return this.findFirstPane(node.children[0]);
  }
  
  getPanes(): Pane[] {
    return Array.from(this.panes.values());
  }
  
  getPane(id: string): Pane | undefined {
    return this.panes.get(id);
  }
}
```

---

## Pane (Tab/Accordion Container)

### src/tui/layout/pane.ts
```typescript
import type { 
  Rect, 
  Size, 
  ContainerMode, 
  PaneConfig, 
  ElementType,
  ElementConfig,
} from '../types';
import type { BaseElement, ElementContext } from '../elements/base';
import type { ScreenBuffer } from '../rendering/buffer';
import type { ECP } from '../../ecp/client';
import type { FocusManager } from '../input/focus-manager';
import { createElement } from '../elements/factory';

interface PaneCallbacks {
  onDirty: () => void;
}

export class Pane {
  readonly id: string;
  
  private mode: ContainerMode = 'tabs';
  private elements: BaseElement[] = [];
  private activeElementIndex = 0;        // For tabs
  private expandedElementIds: Set<string> = new Set();  // For accordion
  private bounds: Rect = { x: 0, y: 0, width: 0, height: 0 };
  private ecp: ECP;
  private focusManager: FocusManager;
  private callbacks: PaneCallbacks;
  private nextElementId = 1;
  
  constructor(
    id: string, 
    ecp: ECP, 
    focusManager: FocusManager,
    callbacks: PaneCallbacks
  ) {
    this.id = id;
    this.ecp = ecp;
    this.focusManager = focusManager;
    this.callbacks = callbacks;
  }
  
  // ============================================
  // Mode
  // ============================================
  
  getMode(): ContainerMode {
    return this.mode;
  }
  
  setMode(mode: ContainerMode): void {
    this.mode = mode;
    this.layoutElements();
    this.markDirty();
  }
  
  // ============================================
  // Element Management
  // ============================================
  
  addElement(type: ElementType, config?: unknown): string {
    const id = `${this.id}-element-${this.nextElementId++}`;
    const title = this.getDefaultTitle(type);
    
    const ctx: ElementContext = {
      ecp: this.ecp,
      markDirty: (region) => this.markDirty(region),
      requestFocus: () => this.focusManager.focusElement(id),
      updateTitle: (t) => this.updateElementTitle(id, t),
      updateStatus: (s) => this.updateElementStatus(id, s),
    };
    
    const element = createElement(type, id, title, ctx, config);
    this.elements.push(element);
    
    // Mount
    element.onMount();
    
    // For tabs, make new element active
    if (this.mode === 'tabs') {
      this.activeElementIndex = this.elements.length - 1;
    }
    
    // For accordion, expand it
    if (this.mode === 'accordion') {
      this.expandedElementIds.add(id);
    }
    
    this.layoutElements();
    element.onVisibilityChange(true);
    this.markDirty();
    
    return id;
  }
  
  removeElement(elementId: string): void {
    const idx = this.elements.findIndex(e => e.id === elementId);
    if (idx === -1) return;
    
    const element = this.elements[idx];
    element.onUnmount();
    this.elements.splice(idx, 1);
    this.expandedElementIds.delete(elementId);
    
    // Adjust active index
    if (this.mode === 'tabs' && this.activeElementIndex >= idx) {
      this.activeElementIndex = Math.max(0, this.activeElementIndex - 1);
    }
    
    this.layoutElements();
    this.markDirty();
  }
  
  detachElement(elementId: string): BaseElement {
    const idx = this.elements.findIndex(e => e.id === elementId);
    if (idx === -1) {
      throw new Error(`Element not found: ${elementId}`);
    }
    
    const element = this.elements[idx];
    element.onVisibilityChange(false);
    this.elements.splice(idx, 1);
    this.expandedElementIds.delete(elementId);
    
    this.layoutElements();
    this.markDirty();
    
    return element;
  }
  
  attachElement(element: BaseElement): void {
    this.elements.push(element);
    
    if (this.mode === 'tabs') {
      this.activeElementIndex = this.elements.length - 1;
    }
    if (this.mode === 'accordion') {
      this.expandedElementIds.add(element.id);
    }
    
    this.layoutElements();
    element.onVisibilityChange(true);
    this.markDirty();
  }
  
  hasElement(elementId: string): boolean {
    return this.elements.some(e => e.id === elementId);
  }
  
  getElement(elementId: string): BaseElement | undefined {
    return this.elements.find(e => e.id === elementId);
  }
  
  unmountAll(): void {
    for (const element of this.elements) {
      element.onUnmount();
    }
    this.elements = [];
  }
  
  // ============================================
  // Tab Operations
  // ============================================
  
  getActiveElement(): BaseElement | null {
    if (this.mode !== 'tabs' || this.elements.length === 0) {
      return null;
    }
    return this.elements[this.activeElementIndex];
  }
  
  setActiveElement(elementId: string): void {
    if (this.mode !== 'tabs') return;
    
    const idx = this.elements.findIndex(e => e.id === elementId);
    if (idx !== -1) {
      const prev = this.elements[this.activeElementIndex];
      prev?.onVisibilityChange(false);
      
      this.activeElementIndex = idx;
      
      const next = this.elements[idx];
      next.onVisibilityChange(true);
      this.layoutElements();
      this.markDirty();
    }
  }
  
  nextTab(): void {
    if (this.mode !== 'tabs' || this.elements.length === 0) return;
    
    const prev = this.elements[this.activeElementIndex];
    prev?.onVisibilityChange(false);
    
    this.activeElementIndex = (this.activeElementIndex + 1) % this.elements.length;
    
    const next = this.elements[this.activeElementIndex];
    next.onVisibilityChange(true);
    this.layoutElements();
    this.markDirty();
  }
  
  prevTab(): void {
    if (this.mode !== 'tabs' || this.elements.length === 0) return;
    
    const prev = this.elements[this.activeElementIndex];
    prev?.onVisibilityChange(false);
    
    this.activeElementIndex = (this.activeElementIndex - 1 + this.elements.length) % this.elements.length;
    
    const next = this.elements[this.activeElementIndex];
    next.onVisibilityChange(true);
    this.layoutElements();
    this.markDirty();
  }
  
  // ============================================
  // Accordion Operations
  // ============================================
  
  toggleAccordionSection(elementId: string): void {
    if (this.mode !== 'accordion') return;
    
    if (this.expandedElementIds.has(elementId)) {
      this.expandedElementIds.delete(elementId);
      this.getElement(elementId)?.onVisibilityChange(false);
    } else {
      this.expandedElementIds.add(elementId);
      this.getElement(elementId)?.onVisibilityChange(true);
    }
    
    this.layoutElements();
    this.markDirty();
  }
  
  isAccordionExpanded(elementId: string): boolean {
    return this.expandedElementIds.has(elementId);
  }
  
  // ============================================
  // Layout
  // ============================================
  
  setBounds(bounds: Rect): void {
    this.bounds = bounds;
    this.layoutElements();
  }
  
  getBounds(): Rect {
    return { ...this.bounds };
  }
  
  private layoutElements(): void {
    if (this.mode === 'tabs') {
      this.layoutTabs();
    } else {
      this.layoutAccordion();
    }
  }
  
  private layoutTabs(): void {
    const TAB_BAR_HEIGHT = 1;
    
    // All elements share same content bounds
    const contentBounds: Rect = {
      x: this.bounds.x,
      y: this.bounds.y + TAB_BAR_HEIGHT,
      width: this.bounds.width,
      height: this.bounds.height - TAB_BAR_HEIGHT,
    };
    
    for (const element of this.elements) {
      element.setBounds(contentBounds);
    }
  }
  
  private layoutAccordion(): void {
    const HEADER_HEIGHT = 1;
    let y = this.bounds.y;
    
    // First pass: calculate expanded heights
    const expandedCount = this.expandedElementIds.size;
    const totalHeaderHeight = this.elements.length * HEADER_HEIGHT;
    const availableContentHeight = this.bounds.height - totalHeaderHeight;
    const heightPerExpanded = expandedCount > 0 
      ? Math.floor(availableContentHeight / expandedCount)
      : 0;
    
    for (const element of this.elements) {
      const isExpanded = this.expandedElementIds.has(element.id);
      
      if (isExpanded) {
        element.setBounds({
          x: this.bounds.x,
          y: y + HEADER_HEIGHT,  // After header
          width: this.bounds.width,
          height: heightPerExpanded,
        });
        y += HEADER_HEIGHT + heightPerExpanded;
      } else {
        // Just header, no content
        element.setBounds({
          x: this.bounds.x,
          y: y + HEADER_HEIGHT,
          width: this.bounds.width,
          height: 0,
        });
        y += HEADER_HEIGHT;
      }
    }
  }
  
  // ============================================
  // Rendering
  // ============================================
  
  render(buffer: ScreenBuffer): void {
    if (this.mode === 'tabs') {
      this.renderTabs(buffer);
    } else {
      this.renderAccordion(buffer);
    }
  }
  
  private renderTabs(buffer: ScreenBuffer): void {
    // Render tab bar
    this.renderTabBar(buffer);
    
    // Render active element only
    const activeElement = this.getActiveElement();
    if (activeElement) {
      activeElement.render(buffer);
    }
  }
  
  private renderTabBar(buffer: ScreenBuffer): void {
    const y = this.bounds.y;
    let x = this.bounds.x;
    
    for (let i = 0; i < this.elements.length; i++) {
      const element = this.elements[i];
      const isActive = i === this.activeElementIndex;
      const title = this.truncateTitle(element.getTitle(), 20);
      
      // Tab background
      const bg = isActive ? 'blue' : 'gray';
      const fg = isActive ? 'white' : 'black';
      
      // Tab content: " title [x] "
      const tabContent = ` ${title} × `;
      
      for (let j = 0; j < tabContent.length && x + j < this.bounds.x + this.bounds.width; j++) {
        buffer.set(x + j, y, { char: tabContent[j], fg, bg });
      }
      
      x += tabContent.length;
      
      // Separator
      if (i < this.elements.length - 1 && x < this.bounds.x + this.bounds.width) {
        buffer.set(x, y, { char: '│', fg: 'gray', bg: 'default' });
        x += 1;
      }
    }
    
    // Fill rest of tab bar
    while (x < this.bounds.x + this.bounds.width) {
      buffer.set(x, y, { char: ' ', fg: 'default', bg: 'default' });
      x++;
    }
  }
  
  private renderAccordion(buffer: ScreenBuffer): void {
    let y = this.bounds.y;
    
    for (const element of this.elements) {
      const isExpanded = this.expandedElementIds.has(element.id);
      
      // Render header
      this.renderAccordionHeader(buffer, element, y, isExpanded);
      y += 1;
      
      // Render content if expanded
      if (isExpanded) {
        element.render(buffer);
        y += element.getBounds().height;
      }
    }
  }
  
  private renderAccordionHeader(
    buffer: ScreenBuffer, 
    element: BaseElement, 
    y: number,
    isExpanded: boolean
  ): void {
    const icon = isExpanded ? '▼' : '▶';
    const title = element.getTitle();
    const status = element.getStatus();
    
    let x = this.bounds.x;
    
    // Icon
    buffer.set(x, y, { char: icon, fg: 'cyan', bg: 'default' });
    x += 2;
    
    // Title
    const maxTitleLen = this.bounds.width - 4 - (status ? status.length + 2 : 0);
    const displayTitle = this.truncateTitle(title, maxTitleLen);
    
    for (const char of displayTitle) {
      if (x >= this.bounds.x + this.bounds.width) break;
      buffer.set(x, y, { char, fg: 'white', bg: 'default' });
      x++;
    }
    
    // Status (right-aligned)
    if (status) {
      const statusX = this.bounds.x + this.bounds.width - status.length - 1;
      for (let i = 0; i < status.length; i++) {
        buffer.set(statusX + i, y, { char: status[i], fg: 'yellow', bg: 'default' });
      }
    }
  }
  
  // ============================================
  // Serialization
  // ============================================
  
  serialize(): PaneConfig {
    return {
      id: this.id,
      mode: this.mode,
      elements: this.elements.map(e => ({
        type: e.type,
        id: e.id,
        title: e.getTitle(),
        state: e.getState(),
      })),
      activeElementId: this.mode === 'tabs' && this.elements.length > 0
        ? this.elements[this.activeElementIndex].id
        : undefined,
      expandedElementIds: this.mode === 'accordion'
        ? Array.from(this.expandedElementIds)
        : undefined,
    };
  }
  
  deserialize(config: PaneConfig): void {
    this.mode = config.mode;
    this.elements = [];
    
    for (const elementConfig of config.elements) {
      const ctx: ElementContext = {
        ecp: this.ecp,
        markDirty: (region) => this.markDirty(region),
        requestFocus: () => this.focusManager.focusElement(elementConfig.id),
        updateTitle: (t) => this.updateElementTitle(elementConfig.id, t),
        updateStatus: (s) => this.updateElementStatus(elementConfig.id, s),
      };
      
      const element = createElement(
        elementConfig.type, 
        elementConfig.id, 
        elementConfig.title, 
        ctx,
        elementConfig.state
      );
      element.setState(elementConfig.state);
      element.onMount();
      this.elements.push(element);
    }
    
    if (config.activeElementId) {
      const idx = this.elements.findIndex(e => e.id === config.activeElementId);
      if (idx !== -1) this.activeElementIndex = idx;
    }
    
    if (config.expandedElementIds) {
      this.expandedElementIds = new Set(config.expandedElementIds);
    }
  }
  
  // ============================================
  // Helpers
  // ============================================
  
  private markDirty(region?: Rect): void {
    this.callbacks.onDirty();
  }
  
  private truncateTitle(title: string, maxLen: number): string {
    if (title.length <= maxLen) return title;
    return title.slice(0, maxLen - 1) + '…';
  }
  
  private getDefaultTitle(type: ElementType): string {
    const titles: Record<ElementType, string> = {
      DocumentEditor: 'Untitled',
      FileTree: 'Files',
      GitPanel: 'Source Control',
      GitDiffView: 'Diff',
      AgentChat: 'Agent',
      TerminalSession: 'Terminal',
      SearchFindResults: 'Search',
      DiagnosticsView: 'Problems',
    };
    return titles[type];
  }
  
  private updateElementTitle(elementId: string, title: string): void {
    // Title updates are stored in element, trigger re-render
    this.markDirty();
  }
  
  private updateElementStatus(elementId: string, status: string): void {
    this.markDirty();
  }
}
```

---

## Screen Buffer (Double Buffering)

### src/tui/rendering/buffer.ts
```typescript
import type { Cell, Rect, Size } from '../types';

const DEFAULT_CELL: Cell = {
  char: ' ',
  fg: 'default',
  bg: 'default',
};

export class ScreenBuffer {
  private width: number;
  private height: number;
  private cells: Cell[][];
  private dirty: boolean[][];
  
  constructor(size: Size) {
    this.width = size.width;
    this.height = size.height;
    this.cells = this.createGrid();
    this.dirty = this.createDirtyGrid(true);
  }
  
  private createGrid(): Cell[][] {
    return Array.from({ length: this.height }, () =>
      Array.from({ length: this.width }, () => ({ ...DEFAULT_CELL }))
    );
  }
  
  private createDirtyGrid(initialValue: boolean): boolean[][] {
    return Array.from({ length: this.height }, () =>
      Array.from({ length: this.width }, () => initialValue)
    );
  }
  
  resize(size: Size): void {
    this.width = size.width;
    this.height = size.height;
    this.cells = this.createGrid();
    this.dirty = this.createDirtyGrid(true);
  }
  
  clear(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.cells[y][x] = { ...DEFAULT_CELL };
        this.dirty[y][x] = true;
      }
    }
  }
  
  set(x: number, y: number, cell: Cell): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return;
    }
    
    const existing = this.cells[y][x];
    if (
      existing.char !== cell.char ||
      existing.fg !== cell.fg ||
      existing.bg !== cell.bg ||
      existing.bold !== cell.bold ||
      existing.italic !== cell.italic ||
      existing.underline !== cell.underline
    ) {
      this.cells[y][x] = { ...cell };
      this.dirty[y][x] = true;
    }
  }
  
  get(x: number, y: number): Cell | null {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return null;
    }
    return this.cells[y][x];
  }
  
  /**
   * Write string starting at position.
   */
  writeString(x: number, y: number, text: string, fg: string, bg: string): void {
    for (let i = 0; i < text.length; i++) {
      this.set(x + i, y, { char: text[i], fg, bg });
    }
  }
  
  /**
   * Fill rect with character.
   */
  fillRect(rect: Rect, cell: Cell): void {
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      for (let x = rect.x; x < rect.x + rect.width; x++) {
        this.set(x, y, cell);
      }
    }
  }
  
  /**
   * Draw box border.
   */
  drawBox(rect: Rect, fg: string, bg: string): void {
    const { x, y, width, height } = rect;
    
    // Corners
    this.set(x, y, { char: '┌', fg, bg });
    this.set(x + width - 1, y, { char: '┐', fg, bg });
    this.set(x, y + height - 1, { char: '└', fg, bg });
    this.set(x + width - 1, y + height - 1, { char: '┘', fg, bg });
    
    // Top/bottom edges
    for (let i = 1; i < width - 1; i++) {
      this.set(x + i, y, { char: '─', fg, bg });
      this.set(x + i, y + height - 1, { char: '─', fg, bg });
    }
    
    // Left/right edges
    for (let i = 1; i < height - 1; i++) {
      this.set(x, y + i, { char: '│', fg, bg });
      this.set(x + width - 1, y + i, { char: '│', fg, bg });
    }
  }
  
  /**
   * Get dirty cells for incremental rendering.
   */
  getDirtyCells(): Array<{ x: number; y: number; cell: Cell }> {
    const result: Array<{ x: number; y: number; cell: Cell }> = [];
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.dirty[y][x]) {
          result.push({ x, y, cell: this.cells[y][x] });
        }
      }
    }
    
    return result;
  }
  
  /**
   * Clear dirty flags after render.
   */
  clearDirty(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.dirty[y][x] = false;
      }
    }
  }
  
  /**
   * Mark region as dirty.
   */
  markDirty(rect: Rect): void {
    for (let y = rect.y; y < rect.y + rect.height && y < this.height; y++) {
      for (let x = rect.x; x < rect.x + rect.width && x < this.width; x++) {
        if (y >= 0 && x >= 0) {
          this.dirty[y][x] = true;
        }
      }
    }
  }
  
  getSize(): Size {
    return { width: this.width, height: this.height };
  }
}
```

---

## Renderer

### src/tui/rendering/renderer.ts
```typescript
import type { Size, Cell } from '../types';
import { ScreenBuffer } from './buffer';

export class Renderer {
  private buffer: ScreenBuffer;
  private size: Size = { width: 80, height: 24 };
  private initialized = false;
  
  constructor() {
    this.buffer = new ScreenBuffer(this.size);
  }
  
  initialize(size: Size): void {
    this.size = size;
    this.buffer = new ScreenBuffer(size);
    
    // Hide cursor
    process.stdout.write('\x1b[?25l');
    
    // Clear screen
    process.stdout.write('\x1b[2J');
    
    // Move to top-left
    process.stdout.write('\x1b[H');
    
    // Enable alternate screen buffer
    process.stdout.write('\x1b[?1049h');
    
    this.initialized = true;
  }
  
  cleanup(): void {
    if (!this.initialized) return;
    
    // Show cursor
    process.stdout.write('\x1b[?25h');
    
    // Disable alternate screen buffer
    process.stdout.write('\x1b[?1049l');
    
    // Disable mouse
    process.stdout.write('\x1b[?1000l');
    process.stdout.write('\x1b[?1006l');
    
    this.initialized = false;
  }
  
  resize(size: Size): void {
    this.size = size;
    this.buffer.resize(size);
  }
  
  getBuffer(): ScreenBuffer {
    return this.buffer;
  }
  
  /**
   * Flush buffer to terminal (only dirty cells).
   */
  flush(): void {
    const dirtyCells = this.buffer.getDirtyCells();
    
    if (dirtyCells.length === 0) return;
    
    let output = '';
    let lastX = -1;
    let lastY = -1;
    let lastFg = '';
    let lastBg = '';
    let lastBold = false;
    let lastItalic = false;
    let lastUnderline = false;
    
    for (const { x, y, cell } of dirtyCells) {
      // Move cursor if needed
      if (y !== lastY || x !== lastX + 1) {
        output += `\x1b[${y + 1};${x + 1}H`;
      }
      
      // Apply styles if changed
      const styleChanges: string[] = [];
      
      if (cell.fg !== lastFg) {
        styleChanges.push(this.fgColor(cell.fg));
        lastFg = cell.fg;
      }
      
      if (cell.bg !== lastBg) {
        styleChanges.push(this.bgColor(cell.bg));
        lastBg = cell.bg;
      }
      
      if (cell.bold !== lastBold) {
        styleChanges.push(cell.bold ? '\x1b[1m' : '\x1b[22m');
        lastBold = !!cell.bold;
      }
      
      if (cell.italic !== lastItalic) {
        styleChanges.push(cell.italic ? '\x1b[3m' : '\x1b[23m');
        lastItalic = !!cell.italic;
      }
      
      if (cell.underline !== lastUnderline) {
        styleChanges.push(cell.underline ? '\x1b[4m' : '\x1b[24m');
        lastUnderline = !!cell.underline;
      }
      
      output += styleChanges.join('');
      output += cell.char;
      
      lastX = x;
      lastY = y;
    }
    
    // Reset styles
    output += '\x1b[0m';
    
    process.stdout.write(output);
    this.buffer.clearDirty();
  }
  
  private fgColor(color: string): string {
    if (color === 'default') return '\x1b[39m';
    return `\x1b[38;2;${this.hexToRgb(color)}m`;
  }
  
  private bgColor(color: string): string {
    if (color === 'default') return '\x1b[49m';
    return `\x1b[48;2;${this.hexToRgb(color)}m`;
  }
  
  private hexToRgb(hex: string): string {
    // Named colors
    const named: Record<string, string> = {
      black: '0;0;0',
      red: '255;0;0',
      green: '0;255;0',
      blue: '0;0;255',
      yellow: '255;255;0',
      cyan: '0;255;255',
      magenta: '255;0;255',
      white: '255;255;255',
      gray: '128;128;128',
    };
    
    if (named[hex]) return named[hex];
    
    // Hex color
    if (hex.startsWith('#')) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `${r};${g};${b}`;
    }
    
    return '255;255;255';
  }
}
```

---

## Overlay Manager

### src/tui/overlays/overlay-manager.ts
```typescript
import type { Rect, Size, KeyEvent, MouseEvent } from '../types';
import type { ScreenBuffer } from '../rendering/buffer';
import type { Renderer } from '../rendering/renderer';
import { CommandPalette } from './command-palette';
import { FilePicker, FilePickerOptions } from './file-picker';
import { ConfirmationDialog, ConfirmOptions } from './confirmation';
import { Notification } from './notification';

interface Overlay {
  id: string;
  zIndex: number;
  render(buffer: ScreenBuffer): void;
  handleInput(event: KeyEvent | MouseEvent): boolean;
  close(): void;
}

export class OverlayManager {
  private overlays: Overlay[] = [];
  private nextZIndex = 100;
  private renderer: Renderer;
  private notifications: Notification[] = [];
  
  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }
  
  hasOverlays(): boolean {
    return this.overlays.length > 0;
  }
  
  // ============================================
  // Command Palette
  // ============================================
  
  showCommandPalette(): void {
    const palette = new CommandPalette({
      zIndex: this.nextZIndex++,
      onClose: () => this.removeOverlay(palette),
      onSelect: (command) => {
        this.removeOverlay(palette);
        // Execute command via ECP
      },
    });
    
    this.overlays.push(palette);
  }
  
  // ============================================
  // File Picker
  // ============================================
  
  showFilePicker(options?: FilePickerOptions): Promise<string | null> {
    return new Promise((resolve) => {
      const picker = new FilePicker({
        zIndex: this.nextZIndex++,
        ...options,
        onClose: () => {
          this.removeOverlay(picker);
          resolve(null);
        },
        onSelect: (path) => {
          this.removeOverlay(picker);
          resolve(path);
        },
      });
      
      this.overlays.push(picker);
    });
  }
  
  // ============================================
  // Confirmation Dialog
  // ============================================
  
  showConfirmation(message: string, options?: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const dialog = new ConfirmationDialog({
        message,
        zIndex: this.nextZIndex++,
        ...options,
        onClose: () => {
          this.removeOverlay(dialog);
          resolve(false);
        },
        onConfirm: () => {
          this.removeOverlay(dialog);
          resolve(true);
        },
      });
      
      this.overlays.push(dialog);
    });
  }
  
  // ============================================
  // Notifications
  // ============================================
  
  showNotification(message: string, type: 'info' | 'warning' | 'error'): void {
    const size = this.renderer.getBuffer().getSize();
    
    const notification = new Notification({
      message,
      type,
      position: this.getNextNotificationPosition(size),
      onDismiss: () => {
        this.notifications = this.notifications.filter(n => n !== notification);
      },
    });
    
    this.notifications.push(notification);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      notification.dismiss();
    }, 5000);
  }
  
  private getNextNotificationPosition(size: Size): { x: number; y: number } {
    const TOAST_HEIGHT = 3;
    const TOAST_MARGIN = 1;
    const startY = size.height - TOAST_HEIGHT - 2;  // Above status bar
    
    return {
      x: size.width - 50 - 2,  // Right side, 50 chars wide
      y: startY - (this.notifications.length * (TOAST_HEIGHT + TOAST_MARGIN)),
    };
  }
  
  // ============================================
  // Input Handling
  // ============================================
  
  handleInput(event: KeyEvent | MouseEvent): boolean {
    // Top overlay gets input first
    if (this.overlays.length > 0) {
      const top = this.overlays[this.overlays.length - 1];
      return top.handleInput(event);
    }
    return false;
  }
  
  // ============================================
  // Rendering
  // ============================================
  
  render(buffer: ScreenBuffer): void {
    // Render overlays in z-order
    const sorted = [...this.overlays].sort((a, b) => a.zIndex - b.zIndex);
    for (const overlay of sorted) {
      overlay.render(buffer);
    }
    
    // Render notifications
    for (const notification of this.notifications) {
      notification.render(buffer);
    }
  }
  
  // ============================================
  // Helpers
  // ============================================
  
  private removeOverlay(overlay: Overlay): void {
    this.overlays = this.overlays.filter(o => o !== overlay);
  }
}
```

---

## Status Bar

### src/tui/status-bar/status-bar.ts
```typescript
import type { Rect, KeyEvent, MouseEvent } from '../types';
import type { ScreenBuffer } from '../rendering/buffer';
import type { ECP } from '../../ecp/client';

interface StatusItem {
  id: string;
  content: string;
  align: 'left' | 'right';
  priority: number;
}

interface HistoryEntry {
  timestamp: Date;
  message: string;
  type: 'info' | 'warning' | 'error';
}

export class StatusBar {
  private bounds: Rect = { x: 0, y: 0, width: 0, height: 1 };
  private items: StatusItem[] = [];
  private history: HistoryEntry[] = [];
  private expanded = false;
  private expandedHeight = 10;
  private scrollOffset = 0;
  private ecp: ECP;
  
  constructor(ecp: ECP) {
    this.ecp = ecp;
    
    // Default items
    this.items = [
      { id: 'branch', content: '', align: 'left', priority: 1 },
      { id: 'file', content: '', align: 'left', priority: 2 },
      { id: 'position', content: '', align: 'right', priority: 1 },
      { id: 'encoding', content: 'UTF-8', align: 'right', priority: 3 },
      { id: 'language', content: '', align: 'right', priority: 2 },
    ];
  }
  
  setBounds(bounds: Rect): void {
    this.bounds = bounds;
  }
  
  isExpanded(): boolean {
    return this.expanded;
  }
  
  getExpandedHeight(): number {
    return this.expandedHeight;
  }
  
  toggleExpanded(): void {
    this.expanded = !this.expanded;
  }
  
  // ============================================
  // Status Items
  // ============================================
  
  setItem(id: string, content: string): void {
    const item = this.items.find(i => i.id === id);
    if (item) {
      item.content = content;
    }
  }
  
  addHistoryEntry(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
    this.history.push({
      timestamp: new Date(),
      message,
      type,
    });
    
    // Keep last 100 entries
    if (this.history.length > 100) {
      this.history.shift();
    }
  }
  
  // ============================================
  // Rendering
  // ============================================
  
  render(buffer: ScreenBuffer): void {
    if (this.expanded) {
      this.renderExpanded(buffer);
    } else {
      this.renderCollapsed(buffer);
    }
  }
  
  private renderCollapsed(buffer: ScreenBuffer): void {
    const y = this.bounds.y;
    
    // Background
    for (let x = this.bounds.x; x < this.bounds.x + this.bounds.width; x++) {
      buffer.set(x, y, { char: ' ', fg: 'white', bg: '#1e1e1e' });
    }
    
    // Left items
    let leftX = this.bounds.x + 1;
    const leftItems = this.items
      .filter(i => i.align === 'left' && i.content)
      .sort((a, b) => a.priority - b.priority);
    
    for (const item of leftItems) {
      for (const char of item.content) {
        if (leftX >= this.bounds.x + this.bounds.width / 2) break;
        buffer.set(leftX++, y, { char, fg: 'white', bg: '#1e1e1e' });
      }
      leftX += 2;  // Separator
    }
    
    // Right items
    let rightX = this.bounds.x + this.bounds.width - 1;
    const rightItems = this.items
      .filter(i => i.align === 'right' && i.content)
      .sort((a, b) => a.priority - b.priority);
    
    for (const item of rightItems.reverse()) {
      rightX -= item.content.length;
      if (rightX < this.bounds.x + this.bounds.width / 2) break;
      
      for (let i = 0; i < item.content.length; i++) {
        buffer.set(rightX + i, y, { char: item.content[i], fg: 'white', bg: '#1e1e1e' });
      }
      rightX -= 2;  // Separator
    }
  }
  
  private renderExpanded(buffer: ScreenBuffer): void {
    // Header line (same as collapsed)
    this.renderCollapsed(buffer);
    
    // History area
    const historyStart = this.bounds.y + 1;
    const historyHeight = this.bounds.height - 1;
    
    // Background
    for (let y = historyStart; y < historyStart + historyHeight; y++) {
      for (let x = this.bounds.x; x < this.bounds.x + this.bounds.width; x++) {
        buffer.set(x, y, { char: ' ', fg: 'white', bg: '#252526' });
      }
    }
    
    // History entries (scrollable)
    const visibleEntries = this.history.slice(
      Math.max(0, this.history.length - historyHeight - this.scrollOffset),
      this.history.length - this.scrollOffset
    );
    
    let y = historyStart;
    for (const entry of visibleEntries) {
      if (y >= historyStart + historyHeight) break;
      
      const timeStr = entry.timestamp.toLocaleTimeString();
      const fg = entry.type === 'error' ? 'red' : entry.type === 'warning' ? 'yellow' : 'gray';
      
      buffer.writeString(this.bounds.x + 1, y, `[${timeStr}] ${entry.message}`, fg, '#252526');
      y++;
    }
  }
  
  // ============================================
  // Input
  // ============================================
  
  handleMouse(event: MouseEvent): boolean {
    // Click on status bar toggles expansion
    if (event.type === 'press' && event.y === this.bounds.y) {
      this.toggleExpanded();
      return true;
    }
    
    // Scroll in expanded mode
    if (this.expanded && event.type === 'scroll') {
      if (event.button === 'up' || event.y < 0) {
        this.scrollOffset = Math.min(this.scrollOffset + 1, this.history.length - 1);
      } else {
        this.scrollOffset = Math.max(this.scrollOffset - 1, 0);
      }
      return true;
    }
    
    return false;
  }
}
```

---

## Focus Manager

### src/tui/input/focus-manager.ts
```typescript
import type { KeyEvent, MouseEvent } from '../types';
import type { BaseElement } from '../elements/base';
import type { PaneContainer } from '../layout/pane-container';

export class FocusManager {
  private paneContainer: PaneContainer | null = null;
  private focusedPaneId: string = '';
  private focusedElementId: string = '';
  private navigationMode = false;
  
  setPaneContainer(container: PaneContainer): void {
    this.paneContainer = container;
  }
  
  // ============================================
  // Focus
  // ============================================
  
  focusPane(paneId: string): void {
    const pane = this.paneContainer?.getPane(paneId);
    if (!pane) return;
    
    // Blur previous
    if (this.focusedElementId) {
      const prevElement = this.getFocusedElement();
      prevElement?.onBlur();
    }
    
    this.focusedPaneId = paneId;
    
    // Focus first/active element in pane
    const activeElement = pane.getActiveElement() || pane.getElements()[0];
    if (activeElement) {
      this.focusedElementId = activeElement.id;
      activeElement.onFocus();
    }
  }
  
  focusElement(elementId: string): void {
    // Find pane containing element
    for (const pane of this.paneContainer?.getPanes() || []) {
      if (pane.hasElement(elementId)) {
        // Blur previous
        if (this.focusedElementId) {
          const prevElement = this.getFocusedElement();
          prevElement?.onBlur();
        }
        
        this.focusedPaneId = pane.id;
        this.focusedElementId = elementId;
        
        const element = pane.getElement(elementId);
        element?.onFocus();
        
        return;
      }
    }
  }
  
  setFocus(paneId: string, elementId: string): void {
    this.focusedPaneId = paneId;
    this.focusedElementId = elementId;
  }
  
  getFocusedPaneId(): string {
    return this.focusedPaneId;
  }
  
  getFocusedElementId(): string {
    return this.focusedElementId;
  }
  
  getFocusedElement(): BaseElement | null {
    const pane = this.paneContainer?.getPane(this.focusedPaneId);
    if (!pane) return null;
    return pane.getElement(this.focusedElementId) || null;
  }
  
  // ============================================
  // Navigation Mode
  // ============================================
  
  isInNavigationMode(): boolean {
    return this.navigationMode;
  }
  
  enterNavigationMode(): void {
    this.navigationMode = true;
  }
  
  exitNavigationMode(): void {
    this.navigationMode = false;
  }
  
  handleInput(event: KeyEvent | MouseEvent): boolean {
    if (!this.navigationMode) return false;
    if (!('key' in event)) return false;
    
    const panes = this.paneContainer?.getPanes() || [];
    const currentIndex = panes.findIndex(p => p.id === this.focusedPaneId);
    
    switch (event.key) {
      case 'Escape':
        this.exitNavigationMode();
        return true;
        
      case 'Enter':
        this.exitNavigationMode();
        return true;
        
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown':
        // Find adjacent pane based on position
        const adjacentPane = this.findAdjacentPane(event.key);
        if (adjacentPane) {
          this.focusPane(adjacentPane.id);
        }
        return true;
        
      case 'Tab':
        // Cycle through panes
        const nextIndex = event.shift 
          ? (currentIndex - 1 + panes.length) % panes.length
          : (currentIndex + 1) % panes.length;
        this.focusPane(panes[nextIndex].id);
        return true;
    }
    
    return false;
  }
  
  private findAdjacentPane(direction: string): Pane | null {
    // This requires spatial awareness of pane layout
    // Simplified: just use tab-like navigation for now
    const panes = this.paneContainer?.getPanes() || [];
    const currentIndex = panes.findIndex(p => p.id === this.focusedPaneId);
    
    if (direction === 'ArrowRight' || direction === 'ArrowDown') {
      return panes[(currentIndex + 1) % panes.length];
    } else {
      return panes[(currentIndex - 1 + panes.length) % panes.length];
    }
  }
}
```

---

## Element Factory

### src/tui/elements/factory.ts
```typescript
import type { ElementType } from '../types';
import type { BaseElement, ElementContext } from './base';
import { DocumentEditor } from './document-editor';
import { FileTree } from './file-tree';
import { GitPanel } from './git-panel';
import { GitDiffView } from './git-diff-view';
import { AgentChat } from './agent-chat';
import { TerminalSession } from './terminal-session';
import { SearchFindResults } from './search-find-results';
import { DiagnosticsView } from './diagnostics-view';

type ElementConstructor = new (
  id: string,
  title: string,
  ctx: ElementContext,
  config?: unknown
) => BaseElement;

const elementRegistry = new Map<ElementType, ElementConstructor>([
  ['DocumentEditor', DocumentEditor],
  ['FileTree', FileTree],
  ['GitPanel', GitPanel],
  ['GitDiffView', GitDiffView],
  ['AgentChat', AgentChat],
  ['TerminalSession', TerminalSession],
  ['SearchFindResults', SearchFindResults],
  ['DiagnosticsView', DiagnosticsView],
]);

/**
 * Create an element instance.
 */
export function createElement(
  type: ElementType,
  id: string,
  title: string,
  ctx: ElementContext,
  config?: unknown
): BaseElement {
  const Constructor = elementRegistry.get(type);
  if (!Constructor) {
    throw new Error(`Unknown element type: ${type}`);
  }
  return new Constructor(id, title, ctx, config);
}

/**
 * Register a custom element type.
 * For future extensibility.
 */
export function registerElementType(
  type: string,
  constructor: ElementConstructor
): void {
  elementRegistry.set(type as ElementType, constructor);
}
```

---

## Layout Presets

### src/tui/layout/layout-presets.ts
```typescript
import type { LayoutConfig, PaneConfig, SplitConfig } from '../types';

export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  layout: LayoutConfig;
}

export const defaultPresets: LayoutPreset[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Single editor pane',
    layout: {
      root: {
        id: 'main',
        mode: 'tabs',
        elements: [
          { type: 'DocumentEditor', id: 'editor-1', title: 'Untitled' },
        ],
      },
      focusedPaneId: 'main',
      focusedElementId: 'editor-1',
    },
  },
  {
    id: 'standard',
    name: 'Standard',
    description: 'Sidebar + Editor',
    layout: {
      root: {
        id: 'split-1',
        direction: 'vertical',
        ratios: [0.25, 0.75],
        children: [
          {
            id: 'sidebar',
            mode: 'accordion',
            elements: [
              { type: 'FileTree', id: 'files', title: 'Files' },
              { type: 'GitPanel', id: 'git', title: 'Source Control' },
            ],
            expandedElementIds: ['files'],
          },
          {
            id: 'main',
            mode: 'tabs',
            elements: [
              { type: 'DocumentEditor', id: 'editor-1', title: 'Untitled' },
            ],
          },
        ],
      },
      focusedPaneId: 'main',
      focusedElementId: 'editor-1',
    },
  },
  {
    id: 'full-ide',
    name: 'Full IDE',
    description: 'Sidebar + Editor + Terminal + Diagnostics',
    layout: {
      root: {
        id: 'split-h-1',
        direction: 'horizontal',
        ratios: [0.75, 0.25],
        children: [
          {
            id: 'split-v-1',
            direction: 'vertical',
            ratios: [0.25, 0.75],
            children: [
              {
                id: 'sidebar',
                mode: 'accordion',
                elements: [
                  { type: 'FileTree', id: 'files', title: 'Files' },
                  { type: 'GitPanel', id: 'git', title: 'Source Control' },
                ],
                expandedElementIds: ['files'],
              },
              {
                id: 'main',
                mode: 'tabs',
                elements: [
                  { type: 'DocumentEditor', id: 'editor-1', title: 'Untitled' },
                ],
              },
            ],
          },
          {
            id: 'bottom',
            mode: 'tabs',
            elements: [
              { type: 'TerminalSession', id: 'term-1', title: 'Terminal' },
              { type: 'DiagnosticsView', id: 'problems', title: 'Problems' },
            ],
          },
        ],
      },
      focusedPaneId: 'main',
      focusedElementId: 'editor-1',
    },
  },
  {
    id: 'focus',
    name: 'Focus Mode',
    description: 'Distraction-free editing',
    layout: {
      root: {
        id: 'main',
        mode: 'tabs',
        elements: [
          { type: 'DocumentEditor', id: 'editor-1', title: 'Untitled' },
        ],
      },
      focusedPaneId: 'main',
      focusedElementId: 'editor-1',
    },
  },
  {
    id: 'split-editors',
    name: 'Split Editors',
    description: 'Two editors side by side',
    layout: {
      root: {
        id: 'split-1',
        direction: 'vertical',
        ratios: [0.5, 0.5],
        children: [
          {
            id: 'left',
            mode: 'tabs',
            elements: [
              { type: 'DocumentEditor', id: 'editor-1', title: 'Untitled' },
            ],
          },
          {
            id: 'right',
            mode: 'tabs',
            elements: [
              { type: 'DocumentEditor', id: 'editor-2', title: 'Untitled' },
            ],
          },
        ],
      },
      focusedPaneId: 'left',
      focusedElementId: 'editor-1',
    },
  },
];

export function getPreset(id: string): LayoutPreset | undefined {
  return defaultPresets.find(p => p.id === id);
}

export function getDefaultPreset(): LayoutPreset {
  return defaultPresets.find(p => p.id === 'standard')!;
}
```

---

## Implementation Order

1. **Core types** (`types.ts`)
2. **Screen buffer** (`rendering/buffer.ts`)
3. **Renderer** (`rendering/renderer.ts`)
4. **Base element** (`elements/base.ts`)
5. **Element factory** (`elements/factory.ts`)
6. **Pane** (`layout/pane.ts`) - tabs and accordion logic
7. **Pane container** (`layout/pane-container.ts`) - splits
8. **Focus manager** (`input/focus-manager.ts`)
9. **Status bar** (`status-bar/status-bar.ts`)
10. **Overlay manager** (`overlays/overlay-manager.ts`)
11. **Window** (`window.ts`) - ties everything together
12. **Layout presets** (`layout/layout-presets.ts`)
13. **Individual elements** (stub implementations first):
    - DocumentEditor
    - FileTree
    - GitPanel
    - GitDiffView
    - AgentChat
    - TerminalSession
    - SearchFindResults
    - DiagnosticsView
14. **Overlays**:
    - CommandPalette
    - FilePicker
    - ConfirmationDialog
    - Notification

---

## Notes

- All elements extend `BaseElement` and can be subclassed for custom functionality
- Elements communicate with services via ECP client, never directly
- Session service extracts layout state via `window.getLayout()`
- Dirty region tracking minimizes terminal writes
- Double buffering prevents flicker
- Focus is global (one element active at a time)
- Pane navigation mode (Ctrl+G) allows keyboard-only pane switching
- Tab overflow handling is configurable (scroll/dropdown/truncate)
- Borders are configurable (will be added to theme settings)