/**
 * Debug Console Component
 *
 * Scrollable, searchable debug log viewer.
 * Shows debug messages in real-time with filtering and copy support.
 */

import type { RenderContext } from '../renderer.ts';
import type { Rect } from '../layout.ts';
import type { MouseEvent } from '../mouse.ts';
import type { KeyEvent } from '../../terminal/input.ts';
import { themeLoader } from '../themes/theme-loader.ts';
import { settings } from '../../config/settings.ts';

export interface DebugLogEntry {
  timestamp: string;
  message: string;
}

export class DebugConsole {
  private rect: Rect = { x: 1, y: 1, width: 80, height: 20 };
  private logs: DebugLogEntry[] = [];
  private scrollTop: number = 0;
  private searchQuery: string = '';
  private isSearchActive: boolean = false;
  private maxLines: number = 10000;

  constructor() {
    this.maxLines = settings.get('debug.console.maxLines') as number || 10000;
  }

  /**
   * Add a log entry
   */
  addLog(timestamp: string, message: string): void {
    this.logs.push({ timestamp, message });

    // Trim to max lines
    if (this.logs.length > this.maxLines) {
      this.logs = this.logs.slice(-this.maxLines);
      // Adjust scroll if needed
      if (this.scrollTop > 0) {
        this.scrollTop = Math.max(0, this.scrollTop - (this.logs.length - this.maxLines));
      }
    }

    // Auto-scroll to bottom if at bottom
    if (this.isAtBottom()) {
      this.scrollToBottom();
    }
  }

  /**
   * Get filtered logs based on search query
   */
  private getFilteredLogs(): DebugLogEntry[] {
    if (!this.searchQuery) {
      return this.logs;
    }

    const query = this.searchQuery.toLowerCase();
    return this.logs.filter(log =>
      log.message.toLowerCase().includes(query) ||
      log.timestamp.toLowerCase().includes(query)
    );
  }

  /**
   * Set search query
   */
  setSearchQuery(query: string): void {
    this.searchQuery = query;
    this.scrollTop = 0; // Reset scroll when searching
  }

  /**
   * Toggle search mode
   */
  toggleSearch(): void {
    this.isSearchActive = !this.isSearchActive;
    if (!this.isSearchActive) {
      this.searchQuery = '';
    }
  }

  /**
   * Get search query
   */
  getSearchQuery(): string {
    return this.searchQuery;
  }

  /**
   * Check if search is active
   */
  isSearching(): boolean {
    return this.isSearchActive;
  }

  /**
   * Set rectangle
   */
  setRect(rect: Rect): void {
    this.rect = rect;
  }

  /**
   * Check if scrolled to bottom
   */
  private isAtBottom(): boolean {
    const filtered = this.getFilteredLogs();
    const visibleLines = this.rect.height - 2; // -2 for header and footer
    return this.scrollTop >= Math.max(0, filtered.length - visibleLines);
  }

  /**
   * Scroll to bottom
   */
  scrollToBottom(): void {
    const filtered = this.getFilteredLogs();
    const visibleLines = this.rect.height - 2;
    this.scrollTop = Math.max(0, filtered.length - visibleLines);
  }

  /**
   * Scroll up
   */
  scrollUp(lines: number = 3): void {
    this.scrollTop = Math.max(0, this.scrollTop - lines);
  }

  /**
   * Scroll down
   */
  scrollDown(lines: number = 3): void {
    const filtered = this.getFilteredLogs();
    const visibleLines = this.rect.height - 2;
    const maxScroll = Math.max(0, filtered.length - visibleLines);
    this.scrollTop = Math.min(maxScroll, this.scrollTop + lines);
  }

  /**
   * Page up
   */
  pageUp(): void {
    const visibleLines = this.rect.height - 2;
    this.scrollUp(visibleLines);
  }

  /**
   * Page down
   */
  pageDown(): void {
    const visibleLines = this.rect.height - 2;
    this.scrollDown(visibleLines);
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = [];
    this.scrollTop = 0;
  }

  /**
   * Get filtered content as text (for copying)
   */
  getFilteredText(): string {
    const filtered = this.getFilteredLogs();
    return filtered.map(log => `[${log.timestamp}] ${log.message}`).join('\n');
  }

  /**
   * Get visible log count
   */
  getLogCount(): number {
    return this.logs.length;
  }

  /**
   * Get filtered log count
   */
  getFilteredCount(): number {
    return this.getFilteredLogs().length;
  }

  /**
   * Handle mouse event (MouseHandler interface)
   */
  onMouseEvent(event: MouseEvent): boolean {
    if (!this.containsPoint(event.x, event.y)) {
      return false;
    }

    switch (event.name) {
      case 'MOUSE_WHEEL_UP':
        this.scrollUp();
        return true;

      case 'MOUSE_WHEEL_DOWN':
        this.scrollDown();
        return true;
    }

    return true;
  }

  /**
   * Check if point is within console bounds
   */
  containsPoint(x: number, y: number): boolean {
    return x >= this.rect.x && x < this.rect.x + this.rect.width &&
           y >= this.rect.y && y < this.rect.y + this.rect.height;
  }

  /**
   * Handle keyboard input
   */
  handleKey(event: KeyEvent): boolean {
    // Search mode
    if (this.isSearchActive) {
      if (event.key === 'ESCAPE') {
        this.toggleSearch();
        return true;
      }
      if (event.key === 'ENTER') {
        this.toggleSearch();
        return true;
      }
      if (event.key === 'BACKSPACE') {
        this.searchQuery = this.searchQuery.slice(0, -1);
        return true;
      }
      if (event.char && event.char.length === 1) {
        this.searchQuery += event.char;
        return true;
      }
      return false;
    }

    // Normal mode
    switch (event.key) {
      case 'UP':
      case 'K':
        this.scrollUp(1);
        return true;

      case 'DOWN':
      case 'J':
        this.scrollDown(1);
        return true;

      case 'PAGEUP':
        this.pageUp();
        return true;

      case 'PAGEDOWN':
        this.pageDown();
        return true;

      case 'HOME':
      case 'G':
        if (!event.shift) {
          this.scrollTop = 0;
          return true;
        }
        break;

      case 'END':
        this.scrollToBottom();
        return true;

      case '/':
        this.toggleSearch();
        return true;

      case 'C':
        if (!event.shift) {
          this.clear();
          return true;
        }
        break;
    }

    return false;
  }

  /**
   * Render the debug console
   */
  render(ctx: RenderContext): void {
    const bgColor = themeLoader.getColor('terminal.background') || '#1e1e1e';
    const fgColor = themeLoader.getColor('terminal.foreground') || '#cccccc';
    const dimColor = themeLoader.getColor('editorLineNumber.foreground') || '#858585';
    const highlightColor = themeLoader.getColor('editor.findMatchHighlightBackground') || '#ea5c00';
    const searchBg = themeLoader.getColor('input.background') || '#3c3c3c';

    const bgRgb = this.hexToRgb(bgColor) || { r: 30, g: 30, b: 30 };
    const fgRgb = this.hexToRgb(fgColor) || { r: 204, g: 204, b: 204 };
    const dimRgb = this.hexToRgb(dimColor) || { r: 133, g: 133, b: 133 };
    const highlightRgb = this.hexToRgb(highlightColor) || { r: 234, g: 92, b: 0 };
    const searchBgRgb = this.hexToRgb(searchBg) || { r: 60, g: 60, b: 60 };

    // Clear background
    ctx.fill(this.rect.x, this.rect.y, this.rect.width, this.rect.height, ' ', fgColor, bgColor);

    // Header
    const filtered = this.getFilteredLogs();
    const headerText = this.searchQuery
      ? ` Debug Console (${filtered.length}/${this.logs.length} filtered) `
      : ` Debug Console (${this.logs.length} lines) `;
    ctx.drawStyled(this.rect.x, this.rect.y, headerText.padEnd(this.rect.width), fgColor, bgColor);

    // Log lines
    const visibleLines = this.rect.height - 2; // -2 for header and footer
    const endIndex = Math.min(this.scrollTop + visibleLines, filtered.length);

    for (let i = 0; i < visibleLines; i++) {
      const logIndex = this.scrollTop + i;
      const y = this.rect.y + 1 + i;

      if (logIndex < filtered.length) {
        const log = filtered[logIndex]!;
        const timestampStr = log.timestamp.substring(11, 23); // HH:MM:SS.mmm
        const displayText = `${timestampStr} ${log.message}`;

        let text = displayText;
        if (text.length > this.rect.width) {
          text = text.substring(0, this.rect.width - 1) + '…';
        }

        // Highlight search matches
        if (this.searchQuery && displayText.toLowerCase().includes(this.searchQuery.toLowerCase())) {
          // Simple highlight - just change the color for now
          ctx.drawStyled(this.rect.x, y, text.padEnd(this.rect.width), fgColor, bgColor);
        } else {
          ctx.drawStyled(this.rect.x, y, text.padEnd(this.rect.width), fgColor, bgColor);
        }
      } else {
        ctx.drawStyled(this.rect.x, y, ' '.repeat(this.rect.width), fgColor, bgColor);
      }
    }

    // Footer with status/search
    const footerY = this.rect.y + this.rect.height - 1;
    if (this.isSearchActive) {
      const searchText = `/ ${this.searchQuery}`;
      ctx.fill(this.rect.x, footerY, this.rect.width, 1, ' ', fgColor, searchBg);
      ctx.drawStyled(this.rect.x, footerY, searchText.substring(0, this.rect.width), fgColor, searchBg);
    } else {
      const helpText = ' /:search  c:clear  j/k:scroll  g/G:top/bottom  PgUp/PgDn:page';
      const statusText = filtered.length < this.logs.length
        ? ` [${this.scrollTop + 1}-${endIndex}/${filtered.length} filtered] `
        : ` [${this.scrollTop + 1}-${endIndex}/${this.logs.length}] `;

      const combinedText = helpText + statusText;
      const displayFooter = combinedText.length > this.rect.width
        ? combinedText.substring(0, this.rect.width)
        : combinedText.padEnd(this.rect.width);

      ctx.drawStyled(this.rect.x, footerY, displayFooter, dimColor, bgColor);
    }
  }

  /**
   * Convert hex to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const match = hex?.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!match) return null;
    return {
      r: parseInt(match[1]!, 16),
      g: parseInt(match[2]!, 16),
      b: parseInt(match[3]!, 16)
    };
  }
}
