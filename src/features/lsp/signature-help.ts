/**
 * Signature Help Component
 * 
 * Displays function signature information when typing function calls.
 */

import type { RenderContext } from '../../ui/renderer.ts';
import type { LSPSignatureHelp } from './client.ts';
import { themeLoader } from '../../ui/themes/theme-loader.ts';

export class SignatureHelpTooltip {
  private visible = false;
  private signatureHelp: LSPSignatureHelp | null = null;
  private x = 0;
  private y = 0;

  /**
   * Show signature help
   */
  show(help: LSPSignatureHelp, x: number, y: number): void {
    if (!help.signatures || help.signatures.length === 0) {
      this.hide();
      return;
    }
    
    this.signatureHelp = help;
    this.x = x;
    this.y = y;
    this.visible = true;
  }

  /**
   * Hide the tooltip
   */
  hide(): void {
    this.visible = false;
    this.signatureHelp = null;
  }

  /**
   * Check if visible
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Handle keyboard - Escape dismisses
   */
  handleKey(key: string): boolean {
    if (!this.visible) return false;

    if (key === 'ESCAPE') {
      this.hide();
      return true;
    }

    return false;
  }

  /**
   * Render the tooltip
   */
  render(ctx: RenderContext, screenWidth: number, screenHeight: number): void {
    if (!this.visible || !this.signatureHelp) return;

    const activeIndex = this.signatureHelp.activeSignature || 0;
    const signature = this.signatureHelp.signatures[activeIndex];
    if (!signature) return;

    // Build the display text
    const signatureLabel = signature.label;
    const activeParam = this.signatureHelp.activeParameter ?? 0;
    
    // Parse parameters to highlight the active one
    const params = signature.parameters || [];
    let highlightStart = -1;
    let highlightEnd = -1;
    
    if (params[activeParam]) {
      const paramLabel = params[activeParam].label;
      if (typeof paramLabel === 'string') {
        highlightStart = signatureLabel.indexOf(paramLabel);
        highlightEnd = highlightStart + paramLabel.length;
      } else if (Array.isArray(paramLabel)) {
        [highlightStart, highlightEnd] = paramLabel;
      }
    }

    // Get documentation for active parameter
    let paramDoc = '';
    if (params[activeParam]?.documentation) {
      const doc = params[activeParam].documentation;
      paramDoc = typeof doc === 'string' ? doc : doc?.value || '';
    }

    // Calculate dimensions
    const maxWidth = Math.min(80, screenWidth - 4);
    const lines: string[] = [];
    
    // Add signature (may wrap)
    if (signatureLabel.length > maxWidth) {
      lines.push(signatureLabel.substring(0, maxWidth - 3) + '...');
    } else {
      lines.push(signatureLabel);
    }
    
    // Add parameter documentation if any
    if (paramDoc) {
      lines.push('');
      const docLines = paramDoc.split('\n');
      for (const line of docLines.slice(0, 3)) {
        if (line.length > maxWidth) {
          lines.push(line.substring(0, maxWidth - 3) + '...');
        } else {
          lines.push(line);
        }
      }
    }

    // Add signature count if multiple
    if (this.signatureHelp.signatures.length > 1) {
      lines.push(`(${activeIndex + 1}/${this.signatureHelp.signatures.length})`);
    }

    const contentWidth = Math.max(...lines.map(l => l.length));
    const width = contentWidth + 4;
    const height = lines.length + 2;

    // Position above cursor
    let tooltipX = this.x;
    let tooltipY = this.y - height;

    if (tooltipX + width > screenWidth) {
      tooltipX = Math.max(1, screenWidth - width);
    }
    
    if (tooltipY < 1) {
      tooltipY = this.y + 1;
    }

    // Colors - use existing theme colors
    const bgColor = themeLoader.getColor('sideBar.background') || themeLoader.getColor('editor.background') || '#252526';
    const fgColor = themeLoader.getColor('editor.foreground') || '#d4d4d4';
    const borderColor = themeLoader.getColor('input.border') || themeLoader.getColor('focusBorder') || '#454545';
    const highlightColor = themeLoader.getColor('editorCursor.foreground') || '#ffcc00';

    // Draw background
    ctx.fill(tooltipX, tooltipY, width, height, ' ', fgColor, bgColor);

    // Top border
    ctx.drawStyled(tooltipX, tooltipY, '┌' + '─'.repeat(width - 2) + '┐', borderColor, bgColor);

    // Content lines
    for (let i = 0; i < lines.length; i++) {
      const lineY = tooltipY + 1 + i;
      const line = lines[i];
      
      // Left border
      ctx.drawStyled(tooltipX, lineY, '│', borderColor, bgColor);
      
      // Content with padding
      if (i === 0 && highlightStart >= 0) {
        // First line with highlighted parameter
        const before = line.substring(0, highlightStart);
        const highlight = line.substring(highlightStart, Math.min(highlightEnd, line.length));
        const after = line.substring(Math.min(highlightEnd, line.length));
        
        ctx.drawStyled(tooltipX + 1, lineY, ' ' + before, fgColor, bgColor);
        ctx.drawStyled(tooltipX + 2 + before.length, lineY, highlight, highlightColor, bgColor);
        ctx.drawStyled(tooltipX + 2 + before.length + highlight.length, lineY, after.padEnd(width - 3 - before.length - highlight.length), fgColor, bgColor);
      } else {
        const paddedLine = (' ' + line).padEnd(width - 2);
        ctx.drawStyled(tooltipX + 1, lineY, paddedLine, fgColor, bgColor);
      }
      
      // Right border
      ctx.drawStyled(tooltipX + width - 1, lineY, '│', borderColor, bgColor);
    }

    // Bottom border
    ctx.drawStyled(tooltipX, tooltipY + height - 1, '└' + '─'.repeat(width - 2) + '┘', borderColor, bgColor);
  }
}

// Singleton instance
export const signatureHelp = new SignatureHelpTooltip();

export default signatureHelp;
