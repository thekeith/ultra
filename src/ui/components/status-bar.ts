/**
 * Status Bar Component
 * 
 * Displays file info, cursor position, language, and encoding.
 */

import type { DocumentState } from '../../core/document.ts';
import type { Position } from '../../core/buffer.ts';
import type { RenderContext } from '../renderer.ts';
import type { Rect } from '../layout.ts';

export interface StatusBarState {
  document: DocumentState | null;
  cursorPosition: Position;
  cursorCount: number;
  gitBranch?: string;
  mode?: string;  // For future vim modes etc.
}

export class StatusBar {
  private rect: Rect = { x: 1, y: 24, width: 80, height: 1 };
  private state: StatusBarState = {
    document: null,
    cursorPosition: { line: 0, column: 0 },
    cursorCount: 1
  };

  /**
   * Set the status bar rect
   */
  setRect(rect: Rect): void {
    this.rect = rect;
  }

  /**
   * Update state
   */
  setState(state: Partial<StatusBarState>): void {
    this.state = { ...this.state, ...state };
  }

  /**
   * Render the status bar
   */
  render(ctx: RenderContext): void {
    const { x, y, width } = this.rect;

    // Background
    ctx.term.moveTo(x, y);
    ctx.term.bgColor256(236);  // Dark gray background
    ctx.term(' '.repeat(width));
    ctx.term.moveTo(x, y);

    // Build left side content
    let left = '';
    
    // File name with dirty indicator
    if (this.state.document) {
      if (this.state.document.isDirty) {
        ctx.term.color256(203);  // Red for dirty
        left += '● ';
        ctx.term(left);
        left = '';
      }
      ctx.term.color256(252);  // Bright white
      left += this.state.document.fileName;
    } else {
      ctx.term.color256(245);  // Gray
      left += 'No file';
    }
    ctx.term(left);

    // Git branch (if available)
    if (this.state.gitBranch) {
      ctx.term.color256(245);
      ctx.term('  ');
      ctx.term.color256(141);  // Purple
      ctx.term('⎇ ' + this.state.gitBranch);
    }

    // Build right side content
    const rightParts: string[] = [];

    // Cursor position
    const line = this.state.cursorPosition.line + 1;
    const col = this.state.cursorPosition.column + 1;
    rightParts.push(`Ln ${line}, Col ${col}`);

    // Multi-cursor indicator
    if (this.state.cursorCount > 1) {
      rightParts.push(`${this.state.cursorCount} cursors`);
    }

    // Language
    if (this.state.document) {
      rightParts.push(this.formatLanguage(this.state.document.language));
    }

    // Encoding
    if (this.state.document) {
      rightParts.push(this.state.document.encoding.toUpperCase());
    }

    // Line ending
    if (this.state.document) {
      rightParts.push(this.state.document.lineEnding.toUpperCase());
    }

    const right = rightParts.join('  │  ');
    
    // Position and render right side
    const rightX = x + width - right.length - 1;
    ctx.term.moveTo(rightX, y);
    ctx.term.color256(245);  // Gray
    ctx.term(right);

    ctx.term.styleReset();
  }

  /**
   * Format language name for display
   */
  private formatLanguage(language: string): string {
    const languageNames: Record<string, string> = {
      'typescript': 'TypeScript',
      'typescriptreact': 'TypeScript React',
      'javascript': 'JavaScript',
      'javascriptreact': 'JavaScript React',
      'json': 'JSON',
      'markdown': 'Markdown',
      'python': 'Python',
      'ruby': 'Ruby',
      'rust': 'Rust',
      'go': 'Go',
      'c': 'C',
      'cpp': 'C++',
      'java': 'Java',
      'html': 'HTML',
      'css': 'CSS',
      'scss': 'SCSS',
      'yaml': 'YAML',
      'toml': 'TOML',
      'shellscript': 'Shell',
      'plaintext': 'Plain Text'
    };

    return languageNames[language] || language;
  }
}

export const statusBar = new StatusBar();

export default statusBar;
