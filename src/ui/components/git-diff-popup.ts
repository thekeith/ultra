/**
 * Git Diff Popup Component
 * 
 * Shows inline diff view when clicking on git gutter indicators.
 * Allows staging, reverting, and navigating between changes.
 */

import type { RenderContext } from '../renderer.ts';
import type { MouseHandler, MouseEvent } from '../mouse.ts';
import type { Rect } from '../layout.ts';
import { themeLoader } from '../themes/theme-loader.ts';
import { settings } from '../../config/settings.ts';
import { gitIntegration, type GitLineChange } from '../../features/git/git-integration.ts';
import { debugLog } from '../../debug.ts';

interface DiffLine {
  type: 'context' | 'added' | 'deleted' | 'header';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

export class GitDiffPopup implements MouseHandler {
  private visible = false;
  private rect: Rect = { x: 0, y: 0, width: 80, height: 20 };
  
  // Current state
  private filePath: string = '';
  private changes: GitLineChange[] = [];
  private currentChangeIndex: number = 0;
  private hunks: DiffHunk[] = [];
  private scrollTop: number = 0;
  
  // Callbacks
  private onCloseCallback?: () => void;
  private onStageCallback?: (filePath: string, lineStart: number, lineEnd: number) => Promise<void>;
  private onRevertCallback?: (filePath: string, lineStart: number, lineEnd: number) => Promise<void>;
  private onRefreshCallback?: () => void;

  /**
   * Show the diff popup for a specific line change
   */
  async show(filePath: string, changes: GitLineChange[], targetLine: number): Promise<void> {
    this.filePath = filePath;
    this.changes = changes;
    this.scrollTop = 0;
    
    // Find the change closest to targetLine
    this.currentChangeIndex = this.findClosestChangeIndex(targetLine);
    
    // Load the diff hunks
    await this.loadDiffHunks();
    
    this.visible = true;
    debugLog(`[GitDiffPopup] Showing for ${filePath} at line ${targetLine}, change index ${this.currentChangeIndex}`);
  }

  /**
   * Hide the popup
   */
  hide(): void {
    this.visible = false;
    this.hunks = [];
    if (this.onCloseCallback) {
      this.onCloseCallback();
    }
  }

  isVisible(): boolean {
    return this.visible;
  }

  setRect(rect: Rect): void {
    this.rect = rect;
  }

  /**
   * Find the change index closest to a given line
   */
  private findClosestChangeIndex(targetLine: number): number {
    if (this.changes.length === 0) return 0;
    
    let closest = 0;
    let minDiff = Math.abs(this.changes[0]!.line - targetLine);
    
    for (let i = 1; i < this.changes.length; i++) {
      const diff = Math.abs(this.changes[i]!.line - targetLine);
      if (diff < minDiff) {
        minDiff = diff;
        closest = i;
      }
    }
    
    return closest;
  }

  /**
   * Load diff hunks from git
   */
  private async loadDiffHunks(): Promise<void> {
    try {
      const diffHunks = await gitIntegration.diff(this.filePath);
      const contextLines = settings.get('git.diffContextLines') || 3;
      
      this.hunks = diffHunks.map(hunk => ({
        oldStart: hunk.oldStart,
        oldCount: hunk.oldCount,
        newStart: hunk.newStart,
        newCount: hunk.newCount,
        lines: this.parseHunkLines(hunk.content, contextLines)
      }));
      
      debugLog(`[GitDiffPopup] Loaded ${this.hunks.length} hunks`);
    } catch (e) {
      debugLog(`[GitDiffPopup] Error loading diff: ${e}`);
      this.hunks = [];
    }
  }

  /**
   * Parse hunk content into diff lines
   */
  private parseHunkLines(content: string, _contextLines: number): DiffLine[] {
    const lines: DiffLine[] = [];
    const rawLines = content.split('\n');
    
    let oldLineNum = 0;
    let newLineNum = 0;
    
    for (const line of rawLines) {
      if (line.startsWith('@@')) {
        // Parse header to get line numbers
        const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match) {
          oldLineNum = parseInt(match[1]!, 10);
          newLineNum = parseInt(match[2]!, 10);
        }
        lines.push({ type: 'header', content: line });
      } else if (line.startsWith('-')) {
        lines.push({ 
          type: 'deleted', 
          content: line.substring(1),
          oldLineNum: oldLineNum++
        });
      } else if (line.startsWith('+')) {
        lines.push({ 
          type: 'added', 
          content: line.substring(1),
          newLineNum: newLineNum++
        });
      } else if (line.startsWith(' ') || line === '') {
        lines.push({ 
          type: 'context', 
          content: line.substring(1) || '',
          oldLineNum: oldLineNum++,
          newLineNum: newLineNum++
        });
      }
    }
    
    return lines;
  }

  /**
   * Navigate to next change
   */
  nextChange(): void {
    if (this.changes.length === 0) return;
    this.currentChangeIndex = (this.currentChangeIndex + 1) % this.changes.length;
    this.scrollTop = 0;
    this.loadDiffHunks();
  }

  /**
   * Navigate to previous change
   */
  previousChange(): void {
    if (this.changes.length === 0) return;
    this.currentChangeIndex = (this.currentChangeIndex - 1 + this.changes.length) % this.changes.length;
    this.scrollTop = 0;
    this.loadDiffHunks();
  }

  /**
   * Stage the current hunk
   */
  async stageCurrentHunk(): Promise<void> {
    if (this.onStageCallback && this.hunks.length > 0) {
      const hunk = this.getCurrentHunk();
      if (hunk) {
        await this.onStageCallback(this.filePath, hunk.newStart, hunk.newStart + hunk.newCount - 1);
        if (this.onRefreshCallback) {
          this.onRefreshCallback();
        }
      }
    }
  }

  /**
   * Revert the current hunk
   */
  async revertCurrentHunk(): Promise<void> {
    if (this.onRevertCallback && this.hunks.length > 0) {
      const hunk = this.getCurrentHunk();
      if (hunk) {
        await this.onRevertCallback(this.filePath, hunk.newStart, hunk.newStart + hunk.newCount - 1);
        if (this.onRefreshCallback) {
          this.onRefreshCallback();
        }
      }
    }
  }

  /**
   * Get the hunk for the current change
   */
  private getCurrentHunk(): DiffHunk | null {
    if (this.changes.length === 0 || this.hunks.length === 0) return null;
    
    const currentChange = this.changes[this.currentChangeIndex]!;
    const targetLine = currentChange.line;
    
    // Find the hunk that contains this line
    for (const hunk of this.hunks) {
      if (targetLine >= hunk.newStart && targetLine < hunk.newStart + Math.max(hunk.newCount, 1)) {
        return hunk;
      }
    }
    
    // Return first hunk if no exact match
    return this.hunks[0] || null;
  }

  /**
   * Handle keyboard input
   */
  handleKey(key: string, ctrl: boolean, _shift: boolean): boolean {
    if (!this.visible) return false;
    
    switch (key) {
      case 'Escape':
      case 'c':
        this.hide();
        return true;
        
      case 'n':
        if (!ctrl) {
          this.nextChange();
          return true;
        }
        break;
        
      case 'p':
        if (!ctrl) {
          this.previousChange();
          return true;
        }
        break;
        
      case 's':
        if (!ctrl) {
          this.stageCurrentHunk();
          return true;
        }
        break;
        
      case 'r':
        if (!ctrl) {
          this.revertCurrentHunk();
          return true;
        }
        break;
        
      case 'ArrowUp':
      case 'k':
        this.scrollTop = Math.max(0, this.scrollTop - 1);
        return true;
        
      case 'ArrowDown':
      case 'j':
        this.scrollTop++;
        return true;
    }
    
    return false;
  }

  // Mouse handler implementation
  containsPoint(x: number, y: number): boolean {
    if (!this.visible) return false;
    return x >= this.rect.x && x < this.rect.x + this.rect.width &&
           y >= this.rect.y && y < this.rect.y + this.rect.height;
  }

  onMouseEvent(event: MouseEvent): boolean {
    if (!this.visible) return false;
    
    switch (event.name) {
      case 'MOUSE_LEFT_BUTTON_PRESSED': {
        const relY = event.y - this.rect.y;
        
        // Check if clicking on header buttons (first row)
        if (relY === 0) {
          // Calculate button positions to match render()
          const buttons = ' 󰐕  󰜺  󰒭  󰒮  󰅖 ';
          const buttonX = this.rect.x + this.rect.width - buttons.length - 2;
          const clickX = event.x;
          
          // Check each button (each is 4 chars wide)
          if (clickX >= buttonX + 16 && clickX < buttonX + 20) {
            // Close button
            this.hide();
            return true;
          } else if (clickX >= buttonX + 12 && clickX < buttonX + 16) {
            // Previous button
            this.previousChange();
            return true;
          } else if (clickX >= buttonX + 8 && clickX < buttonX + 12) {
            // Next button
            this.nextChange();
            return true;
          } else if (clickX >= buttonX + 4 && clickX < buttonX + 8) {
            // Revert button
            this.revertCurrentHunk();
            return true;
          } else if (clickX >= buttonX && clickX < buttonX + 4) {
            // Stage button
            this.stageCurrentHunk();
            return true;
          }
        }
        return true;
      }
      
      case 'MOUSE_WHEEL_UP':
        this.scrollTop = Math.max(0, this.scrollTop - 3);
        return true;
        
      case 'MOUSE_WHEEL_DOWN':
        this.scrollTop += 3;
        return true;
    }
    
    return false;
  }

  /**
   * Render the diff popup
   */
  render(ctx: RenderContext): void {
    if (!this.visible) return;
    
    const theme = themeLoader.getCurrentTheme();
    if (!theme) return;
    const colors = theme.colors;
    
    const x = this.rect.x;
    const y = this.rect.y;
    const width = this.rect.width;
    const height = this.rect.height;
    
    // Background
    const bgColor = colors['editor.background'] || '#1e1e1e';
    const borderColor = colors['panel.border'] || '#404040';
    const fgColor = colors['editor.foreground'] || '#d4d4d4';
    
    // Draw background
    for (let row = 0; row < height; row++) {
      ctx.drawStyled(x, y + row, ' '.repeat(width), fgColor, bgColor);
    }
    
    // Draw border
    ctx.drawStyled(x, y, '┌' + '─'.repeat(width - 2) + '┐', borderColor, bgColor);
    for (let row = 1; row < height - 1; row++) {
      ctx.drawStyled(x, y + row, '│', borderColor, bgColor);
      ctx.drawStyled(x + width - 1, y + row, '│', borderColor, bgColor);
    }
    ctx.drawStyled(x, y + height - 1, '└' + '─'.repeat(width - 2) + '┘', borderColor, bgColor);
    
    // Header with file info and buttons
    const fileName = this.filePath.split('/').pop() || this.filePath;
    const changeInfo = this.changes.length > 0 
      ? `${this.currentChangeIndex + 1}/${this.changes.length}` 
      : '0/0';
    
    // Icons: 󰐕 stage, 󰜺 revert, 󰒭 next, 󰒮 previous, 󰅖 close
    const buttons = ' 󰐕  󰜺  󰒭  󰒮  󰅖 ';
    const headerText = ` ${fileName} - Changes ${changeInfo}`;
    const availableWidth = width - 4 - buttons.length;
    const truncatedHeader = headerText.length > availableWidth 
      ? headerText.substring(0, availableWidth - 1) + '…'
      : headerText.padEnd(availableWidth);
    
    const headerBg = colors['titleBar.activeBackground'] || '#3c3c3c';
    ctx.drawStyled(x + 1, y, truncatedHeader, fgColor, headerBg);
    
    // Render buttons with colors
    const buttonX = x + width - buttons.length - 2;
    const greenColor = colors['gitDecoration.addedResourceForeground'] || '#89d185';
    const redColor = colors['gitDecoration.deletedResourceForeground'] || '#f14c4c';
    const blueColor = colors['textLink.foreground'] || '#3794ff';
    
    ctx.drawStyled(buttonX, y, ' 󰐕 ', greenColor, headerBg);      // stage
    ctx.drawStyled(buttonX + 4, y, ' 󰜺 ', redColor, headerBg);    // revert
    ctx.drawStyled(buttonX + 8, y, ' 󰒭 ', blueColor, headerBg);   // next
    ctx.drawStyled(buttonX + 12, y, ' 󰒮 ', blueColor, headerBg);  // previous
    ctx.drawStyled(buttonX + 16, y, ' 󰅖 ', fgColor, headerBg);    // close
    
    // Render diff content
    const currentHunk = this.getCurrentHunk();
    if (!currentHunk) {
      ctx.drawStyled(x + 2, y + 2, 'No changes to display', fgColor, bgColor);
      return;
    }
    
    const contentHeight = height - 3;  // Minus header and borders
    const lines = currentHunk.lines;
    const maxScroll = Math.max(0, lines.length - contentHeight);
    this.scrollTop = Math.min(this.scrollTop, maxScroll);
    
    const addedBg = colors['diffEditor.insertedLineBackground'] || '#2ea04326';
    const deletedBg = colors['diffEditor.removedLineBackground'] || '#f8514926';
    const addedFg = colors['gitDecoration.addedResourceForeground'] || '#89d185';
    const deletedFg = colors['gitDecoration.deletedResourceForeground'] || '#f14c4c';
    const lineNumColor = colors['editorLineNumber.foreground'] || '#858585';
    
    for (let i = 0; i < contentHeight && this.scrollTop + i < lines.length; i++) {
      const line = lines[this.scrollTop + i]!;
      const lineY = y + 1 + i;
      const contentWidth = width - 14;  // Leave room for line numbers and gutter
      
      let lineBg = bgColor;
      let lineFg = fgColor;
      let gutterChar = ' ';
      let oldNum = '    ';
      let newNum = '    ';
      
      switch (line.type) {
        case 'header':
          lineFg = colors['textPreformat.foreground'] || '#d7ba7d';
          break;
        case 'added':
          lineBg = addedBg;
          lineFg = addedFg;
          gutterChar = '+';
          newNum = line.newLineNum !== undefined 
            ? line.newLineNum.toString().padStart(4) 
            : '    ';
          break;
        case 'deleted':
          lineBg = deletedBg;
          lineFg = deletedFg;
          gutterChar = '-';
          oldNum = line.oldLineNum !== undefined 
            ? line.oldLineNum.toString().padStart(4) 
            : '    ';
          break;
        case 'context':
          oldNum = line.oldLineNum !== undefined 
            ? line.oldLineNum.toString().padStart(4) 
            : '    ';
          newNum = line.newLineNum !== undefined 
            ? line.newLineNum.toString().padStart(4) 
            : '    ';
          break;
      }
      
      // Draw line numbers
      ctx.drawStyled(x + 1, lineY, oldNum, lineNumColor, bgColor);
      ctx.drawStyled(x + 6, lineY, newNum, lineNumColor, bgColor);
      
      // Draw gutter indicator
      const gutterColor = line.type === 'added' ? addedFg : 
                          line.type === 'deleted' ? deletedFg : fgColor;
      ctx.drawStyled(x + 11, lineY, gutterChar, gutterColor, lineBg);
      
      // Draw content
      const content = line.content.substring(0, contentWidth);
      const paddedContent = content.padEnd(contentWidth);
      ctx.drawStyled(x + 13, lineY, paddedContent, lineFg, lineBg);
    }
    
    // Footer with key hints
    const footerY = y + height - 1;
    const footerText = ' s:stage r:revert n:next p:prev c/Esc:close ';
    const footerX = x + Math.floor((width - footerText.length) / 2);
    ctx.drawStyled(footerX, footerY, footerText, lineNumColor, bgColor);
  }

  // Callbacks
  onClose(callback: () => void): void {
    this.onCloseCallback = callback;
  }

  onStage(callback: (filePath: string, lineStart: number, lineEnd: number) => Promise<void>): void {
    this.onStageCallback = callback;
  }

  onRevert(callback: (filePath: string, lineStart: number, lineEnd: number) => Promise<void>): void {
    this.onRevertCallback = callback;
  }

  onRefresh(callback: () => void): void {
    this.onRefreshCallback = callback;
  }
}

export const gitDiffPopup = new GitDiffPopup();
export default gitDiffPopup;
