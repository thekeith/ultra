/**
 * AI Panel Component (Placeholder)
 * 
 * Chat interface for Claude AI integration.
 */

import type { RenderContext } from '../renderer.ts';
import type { Rect } from '../layout.ts';
import type { MouseHandler, MouseEvent } from '../mouse.ts';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export class AIPanel implements MouseHandler {
  private rect: Rect = { x: 1, y: 1, width: 40, height: 20 };
  private messages: ChatMessage[] = [];
  private inputText: string = '';
  private scrollOffset: number = 0;

  setRect(rect: Rect): void {
    this.rect = rect;
  }

  addMessage(message: ChatMessage): void {
    this.messages.push(message);
  }

  clearMessages(): void {
    this.messages = [];
  }

  setInput(text: string): void {
    this.inputText = text;
  }

  render(ctx: RenderContext): void {
    // Background
    for (let y = 0; y < this.rect.height; y++) {
      ctx.term.moveTo(this.rect.x, this.rect.y + y);
      ctx.term.bgColor256(235);
      ctx.term(' '.repeat(this.rect.width));
    }

    // Title bar
    ctx.term.moveTo(this.rect.x, this.rect.y);
    ctx.term.bgColor256(237);
    ctx.term.color256(252);
    ctx.term(' AI ASSISTANT'.padEnd(this.rect.width));

    // Placeholder content
    ctx.term.moveTo(this.rect.x + 2, this.rect.y + 2);
    ctx.term.bgColor256(235);
    ctx.term.color256(245);
    ctx.term('AI panel coming soon...');

    // Input area at bottom
    ctx.term.moveTo(this.rect.x, this.rect.y + this.rect.height - 1);
    ctx.term.bgColor256(238);
    ctx.term.color256(250);
    const inputDisplay = ('> ' + this.inputText).slice(0, this.rect.width);
    ctx.term(inputDisplay.padEnd(this.rect.width));

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
    // TODO: Implement AI panel mouse events
    return false;
  }
}

export const aiPanel = new AIPanel();

export default aiPanel;
