/**
 * Terminal Pane Component (Placeholder)
 * 
 * Embedded terminal with PTY support.
 */

import type { RenderContext } from '../renderer.ts';
import type { Rect } from '../layout.ts';
import type { MouseHandler, MouseEvent } from '../mouse.ts';

export class TerminalPane implements MouseHandler {
  private rect: Rect = { x: 1, y: 1, width: 80, height: 10 };
  private isActive: boolean = false;

  setRect(rect: Rect): void {
    this.rect = rect;
  }

  setActive(active: boolean): void {
    this.isActive = active;
  }

  render(ctx: RenderContext): void {
    // Background
    for (let y = 0; y < this.rect.height; y++) {
      ctx.term.moveTo(this.rect.x, this.rect.y + y);
      ctx.term.bgColor256(233);  // Very dark
      ctx.term(' '.repeat(this.rect.width));
    }

    // Border/title
    ctx.term.moveTo(this.rect.x, this.rect.y);
    ctx.term.bgColor256(236);
    ctx.term.color256(245);
    ctx.term(' TERMINAL'.padEnd(this.rect.width));

    // Placeholder content
    ctx.term.moveTo(this.rect.x + 2, this.rect.y + 2);
    ctx.term.bgColor256(233);
    ctx.term.color256(245);
    ctx.term('Terminal coming soon...');

    ctx.term.styleReset();
  }

  containsPoint(x: number, y: number): boolean {
    return (
      x >= this.rect.x &&
      x < this.rect.x + this.rect.width &&
      y >= this.rect.y &&
      y < this.rect.y + this.rect.height
    );
  }

  onMouseEvent(event: MouseEvent): boolean {
    // TODO: Implement terminal mouse events
    return false;
  }
}

export const terminalPane = new TerminalPane();

export default terminalPane;
