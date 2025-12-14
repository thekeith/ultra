/**
 * Command Palette Component (Placeholder)
 * 
 * Fuzzy search command palette for executing commands.
 */

import type { RenderContext } from '../renderer.ts';
import type { MouseHandler, MouseEvent } from '../mouse.ts';
import type { Command } from '../../input/commands.ts';

export class CommandPalette implements MouseHandler {
  private isVisible: boolean = false;
  private query: string = '';
  private commands: Command[] = [];
  private filteredCommands: Command[] = [];
  private selectedIndex: number = 0;
  private x: number = 0;
  private y: number = 0;
  private width: number = 60;
  private height: number = 20;

  show(commands: Command[], screenWidth: number, screenHeight: number): void {
    this.isVisible = true;
    this.commands = commands;
    this.filteredCommands = commands;
    this.query = '';
    this.selectedIndex = 0;
    
    // Center the palette
    this.width = Math.min(60, screenWidth - 4);
    this.height = Math.min(20, screenHeight - 4);
    this.x = Math.floor((screenWidth - this.width) / 2) + 1;
    this.y = 2;
  }

  hide(): void {
    this.isVisible = false;
  }

  isOpen(): boolean {
    return this.isVisible;
  }

  setQuery(query: string): void {
    this.query = query;
    this.filter();
  }

  getSelectedCommand(): Command | null {
    return this.filteredCommands[this.selectedIndex] || null;
  }

  selectNext(): void {
    if (this.selectedIndex < this.filteredCommands.length - 1) {
      this.selectedIndex++;
    }
  }

  selectPrevious(): void {
    if (this.selectedIndex > 0) {
      this.selectedIndex--;
    }
  }

  private filter(): void {
    const lowerQuery = this.query.toLowerCase();
    this.filteredCommands = this.commands.filter(cmd =>
      cmd.title.toLowerCase().includes(lowerQuery) ||
      cmd.id.toLowerCase().includes(lowerQuery)
    );
    this.selectedIndex = 0;
  }

  render(ctx: RenderContext): void {
    if (!this.isVisible) return;

    // Background/border
    for (let y = 0; y < this.height; y++) {
      ctx.term.moveTo(this.x, this.y + y);
      ctx.term.bgColor256(237);
      ctx.term(' '.repeat(this.width));
    }

    // Input field
    ctx.term.moveTo(this.x + 1, this.y);
    ctx.term.bgColor256(239);
    ctx.term.color256(252);
    const inputText = ('> ' + this.query).padEnd(this.width - 2);
    ctx.term(inputText);

    // Results
    const maxResults = this.height - 2;
    for (let i = 0; i < maxResults; i++) {
      const cmd = this.filteredCommands[i];
      ctx.term.moveTo(this.x + 1, this.y + 1 + i);
      
      if (!cmd) {
        ctx.term.bgColor256(237);
        ctx.term(' '.repeat(this.width - 2));
        continue;
      }

      if (i === this.selectedIndex) {
        ctx.term.bgColor256(240);
        ctx.term.color256(255);
      } else {
        ctx.term.bgColor256(237);
        ctx.term.color256(250);
      }

      const title = cmd.title.slice(0, this.width - 4);
      ctx.term((' ' + title).padEnd(this.width - 2));
    }

    ctx.term.styleReset();
  }

  containsPoint(x: number, y: number): boolean {
    if (!this.isVisible) return false;
    return (
      x >= this.x &&
      x < this.x + this.width &&
      y >= this.y &&
      y < this.y + this.height
    );
  }

  onMouseEvent(event: MouseEvent): boolean {
    if (!this.isVisible) return false;
    
    if (event.name === 'MOUSE_LEFT_BUTTON_PRESSED') {
      // Calculate which item was clicked
      const itemY = event.y - this.y - 1;
      if (itemY >= 0 && itemY < this.filteredCommands.length) {
        this.selectedIndex = itemY;
        return true;
      }
    }
    
    return false;
  }
}

export const commandPalette = new CommandPalette();

export default commandPalette;
