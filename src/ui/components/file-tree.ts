/**
 * File Tree Component (Placeholder)
 * 
 * Will display the file tree sidebar.
 */

import type { RenderContext } from '../renderer.ts';
import type { Rect } from '../layout.ts';
import type { MouseHandler, MouseEvent } from '../mouse.ts';

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  isExpanded?: boolean;
  children?: FileNode[];
}

export class FileTree implements MouseHandler {
  private rect: Rect = { x: 1, y: 1, width: 30, height: 20 };
  private rootPath: string | null = null;
  private root: FileNode | null = null;
  private selectedPath: string | null = null;

  setRect(rect: Rect): void {
    this.rect = rect;
  }

  async loadDirectory(path: string): Promise<void> {
    this.rootPath = path;
    // TODO: Implement directory loading
  }

  render(ctx: RenderContext): void {
    // Fill with background
    for (let y = 0; y < this.rect.height; y++) {
      ctx.term.moveTo(this.rect.x, this.rect.y + y);
      ctx.term.bgColor256(235);
      ctx.term(' '.repeat(this.rect.width));
    }

    // Title
    ctx.term.moveTo(this.rect.x + 1, this.rect.y);
    ctx.term.color256(245);
    ctx.term('EXPLORER');

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
    // TODO: Implement mouse handling
    return false;
  }
}

export const fileTree = new FileTree();

export default fileTree;
