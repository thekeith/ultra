/**
 * Layout Management
 * 
 * Manages pane layout, splits, and component positioning.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutNode {
  type: 'leaf' | 'horizontal' | 'vertical';
  rect: Rect;
  children?: LayoutNode[];
  ratio?: number[];  // Split ratios
  id?: string;       // For leaf nodes, identifies the pane
}

export class LayoutManager {
  private root: LayoutNode;
  private _screenWidth: number = 80;
  private _screenHeight: number = 24;
  
  // Reserved areas
  private tabBarHeight: number = 1;
  private statusBarHeight: number = 1;
  private sidebarWidth: number = 0;
  private sidebarVisible: boolean = false;
  private sidebarLocation: 'left' | 'right' = 'left';
  private terminalHeight: number = 0;
  private terminalVisible: boolean = false;
  private aiPanelWidth: number = 0;
  private aiPanelVisible: boolean = false;

  constructor() {
    this.root = {
      type: 'leaf',
      rect: { x: 1, y: 2, width: 80, height: 22 },
      id: 'main'
    };
  }

  /**
   * Update layout dimensions based on screen size
   */
  updateDimensions(width: number, height: number): void {
    this._screenWidth = width;
    this._screenHeight = height;
    this.recalculateLayout();
  }

  /**
   * Get screen dimensions
   */
  get screenWidth(): number {
    return this._screenWidth;
  }

  get screenHeight(): number {
    return this._screenHeight;
  }

  /**
   * Get tab bar rect
   */
  getTabBarRect(): Rect {
    const sidebarOnLeft = this.sidebarLocation === 'left';
    const x = (this.sidebarVisible && sidebarOnLeft) ? this.sidebarWidth + 1 : 1;
    let width = this._screenWidth - x + 1;
    if (this.aiPanelVisible) {
      width -= this.aiPanelWidth;
    }
    if (this.sidebarVisible && !sidebarOnLeft) {
      width -= this.sidebarWidth;
    }
    return {
      x,
      y: 1,
      width,
      height: this.tabBarHeight
    };
  }

  /**
   * Get status bar rect
   */
  getStatusBarRect(): Rect {
    return {
      x: 1,
      y: this._screenHeight,
      width: this._screenWidth,
      height: this.statusBarHeight
    };
  }

  /**
   * Get sidebar rect
   */
  getSidebarRect(): Rect | null {
    if (!this.sidebarVisible) return null;
    const sidebarOnLeft = this.sidebarLocation === 'left';
    return {
      x: sidebarOnLeft ? 1 : this._screenWidth - this.sidebarWidth + 1,
      y: 1,
      width: this.sidebarWidth,
      height: this._screenHeight - this.statusBarHeight
    };
  }

  /**
   * Get terminal rect
   */
  getTerminalRect(): Rect | null {
    if (!this.terminalVisible) return null;
    const sidebarOnLeft = this.sidebarLocation === 'left';
    const x = (this.sidebarVisible && sidebarOnLeft) ? this.sidebarWidth + 1 : 1;
    let width = this._screenWidth - x + 1;
    if (this.aiPanelVisible) {
      width -= this.aiPanelWidth;
    }
    if (this.sidebarVisible && !sidebarOnLeft) {
      width -= this.sidebarWidth;
    }
    return {
      x,
      y: this._screenHeight - this.statusBarHeight - this.terminalHeight + 1,
      width,
      height: this.terminalHeight
    };
  }

  /**
   * Get AI panel rect
   */
  getAIPanelRect(): Rect | null {
    if (!this.aiPanelVisible) return null;
    return {
      x: this._screenWidth - this.aiPanelWidth + 1,
      y: this.tabBarHeight + 1,
      width: this.aiPanelWidth,
      height: this._screenHeight - this.tabBarHeight - this.statusBarHeight
    };
  }

  /**
   * Get main editor area rect
   */
  getEditorAreaRect(): Rect {
    const sidebarOnLeft = this.sidebarLocation === 'left';
    const x = (this.sidebarVisible && sidebarOnLeft) ? this.sidebarWidth + 1 : 1;
    const y = this.tabBarHeight + 1;
    let width = this._screenWidth - x + 1;
    let height = this._screenHeight - this.tabBarHeight - this.statusBarHeight;

    if (this.aiPanelVisible) {
      width -= this.aiPanelWidth;
    }
    
    if (this.sidebarVisible && !sidebarOnLeft) {
      width -= this.sidebarWidth;
    }

    if (this.terminalVisible) {
      height -= this.terminalHeight;
    }

    return { x, y, width, height };
  }

  /**
   * Toggle sidebar
   */
  toggleSidebar(width: number = 30): void {
    if (this.sidebarVisible) {
      this.sidebarVisible = false;
      this.sidebarWidth = 0;
    } else {
      this.sidebarVisible = true;
      this.sidebarWidth = Math.min(width, Math.floor(this._screenWidth * 0.4));
    }
    this.recalculateLayout();
  }

  /**
   * Toggle terminal
   */
  toggleTerminal(height: number = 10): void {
    if (this.terminalVisible) {
      this.terminalVisible = false;
      this.terminalHeight = 0;
    } else {
      this.terminalVisible = true;
      this.terminalHeight = Math.min(height, Math.floor(this._screenHeight * 0.4));
    }
    this.recalculateLayout();
  }

  /**
   * Toggle AI panel
   */
  toggleAIPanel(width: number = 40): void {
    if (this.aiPanelVisible) {
      this.aiPanelVisible = false;
      this.aiPanelWidth = 0;
    } else {
      this.aiPanelVisible = true;
      this.aiPanelWidth = Math.min(width, Math.floor(this._screenWidth * 0.4));
    }
    this.recalculateLayout();
  }

  /**
   * Set sidebar width
   */
  setSidebarWidth(width: number): void {
    if (this.sidebarVisible) {
      this.sidebarWidth = Math.max(10, Math.min(width, Math.floor(this._screenWidth * 0.5)));
      this.recalculateLayout();
    }
  }

  /**
   * Set sidebar location
   */
  setSidebarLocation(location: 'left' | 'right'): void {
    this.sidebarLocation = location;
    this.recalculateLayout();
  }

  /**
   * Get sidebar location
   */
  getSidebarLocation(): 'left' | 'right' {
    return this.sidebarLocation;
  }

  /**
   * Set terminal height
   */
  setTerminalHeight(height: number): void {
    if (this.terminalVisible) {
      this.terminalHeight = Math.max(3, Math.min(height, Math.floor(this._screenHeight * 0.6)));
      this.recalculateLayout();
    }
  }

  /**
   * Set AI panel width
   */
  setAIPanelWidth(width: number): void {
    if (this.aiPanelVisible) {
      this.aiPanelWidth = Math.max(20, Math.min(width, Math.floor(this._screenWidth * 0.5)));
      this.recalculateLayout();
    }
  }

  /**
   * Check if point is on sidebar divider
   */
  isOnSidebarDivider(x: number): boolean {
    if (!this.sidebarVisible) return false;
    if (this.sidebarLocation === 'left') {
      return x === this.sidebarWidth;
    } else {
      return x === this._screenWidth - this.sidebarWidth + 1;
    }
  }

  /**
   * Check if point is on terminal divider
   */
  isOnTerminalDivider(y: number): boolean {
    if (!this.terminalVisible) return false;
    const termRect = this.getTerminalRect();
    return termRect !== null && y === termRect.y - 1;
  }

  /**
   * Check if point is on AI panel divider
   */
  isOnAIPanelDivider(x: number): boolean {
    if (!this.aiPanelVisible) return false;
    const aiRect = this.getAIPanelRect();
    return aiRect !== null && x === aiRect.x - 1;
  }

  /**
   * Recalculate all layout positions
   */
  private recalculateLayout(): void {
    const editorRect = this.getEditorAreaRect();
    this.updateNodeRect(this.root, editorRect);
  }

  /**
   * Update rect for a layout node and its children
   */
  private updateNodeRect(node: LayoutNode, rect: Rect): void {
    node.rect = rect;

    if (node.type === 'leaf' || !node.children) {
      return;
    }

    const ratios = node.ratio || node.children.map(() => 1 / node.children!.length);
    
    if (node.type === 'horizontal') {
      // Split horizontally (side by side)
      let currentX = rect.x;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]!;
        const width = Math.floor(rect.width * ratios[i]!);
        this.updateNodeRect(child, {
          x: currentX,
          y: rect.y,
          width: i === node.children.length - 1 ? rect.x + rect.width - currentX : width,
          height: rect.height
        });
        currentX += width;
      }
    } else {
      // Split vertically (stacked)
      let currentY = rect.y;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]!;
        const height = Math.floor(rect.height * ratios[i]!);
        this.updateNodeRect(child, {
          x: rect.x,
          y: currentY,
          width: rect.width,
          height: i === node.children.length - 1 ? rect.y + rect.height - currentY : height
        });
        currentY += height;
      }
    }
  }

  /**
   * Get pane at coordinates
   */
  getPaneAtPoint(x: number, y: number): string | null {
    return this.findPaneAtPoint(this.root, x, y);
  }

  private findPaneAtPoint(node: LayoutNode, x: number, y: number): string | null {
    const { rect } = node;
    
    if (x < rect.x || x >= rect.x + rect.width || y < rect.y || y >= rect.y + rect.height) {
      return null;
    }

    if (node.type === 'leaf') {
      return node.id || null;
    }

    if (node.children) {
      for (const child of node.children) {
        const result = this.findPaneAtPoint(child, x, y);
        if (result) return result;
      }
    }

    return null;
  }

  /**
   * Get visibility states
   */
  isSidebarVisible(): boolean {
    return this.sidebarVisible;
  }

  isTerminalVisible(): boolean {
    return this.terminalVisible;
  }

  isAIPanelVisible(): boolean {
    return this.aiPanelVisible;
  }
}

// Singleton instance
export const layoutManager = new LayoutManager();

export default layoutManager;
