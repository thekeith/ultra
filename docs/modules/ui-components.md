# UI Components Module

This module covers Ultra's UI component system including dialogs, panels, and widgets.

## Overview

Ultra's UI is built from composable components that:
- Render to specific screen regions
- Handle keyboard input when focused
- Use the render scheduler for updates

## Location

```
src/ui/components/
├── base-dialog.ts       # Base class for dialogs
├── input-dialog.ts      # Single-line input dialog
├── searchable-dialog.ts # List with search filter
├── command-palette.ts   # Command palette
├── file-picker.ts       # File selection dialog
├── file-browser.ts      # File open dialog
├── save-browser.ts      # File save dialog
├── commit-dialog.ts     # Git commit dialog
├── pane.ts              # Editor pane
├── pane-manager.ts      # Pane orchestration
├── tab-bar.ts           # Tab bar
├── status-bar.ts        # Status bar
├── file-tree.ts         # Sidebar file tree
├── git-panel.ts         # Git status panel
├── minimap.ts           # Code minimap
├── search-widget.ts     # In-file search
├── text-input.ts        # Text input widget
└── ai-panel.ts          # AI assistant panel
```

## Base Dialog

### BaseDialog Class

All dialogs extend `BaseDialog`:

```typescript
// base-dialog.ts
abstract class BaseDialog {
  protected visible: boolean = false;
  protected rect: Rect;

  abstract render(): void;
  abstract handleKey(event: KeyEvent): boolean;

  show(): void {
    this.visible = true;
    renderScheduler.scheduleRender();
  }

  hide(): void {
    this.visible = false;
    renderScheduler.scheduleRender();
  }

  isVisible(): boolean {
    return this.visible;
  }
}
```

### Creating a Custom Dialog

```typescript
import { BaseDialog } from './base-dialog.ts';

class MyDialog extends BaseDialog {
  private value: string = '';
  private onConfirm: ((value: string) => void) | null = null;

  show(onConfirm: (value: string) => void): void {
    this.onConfirm = onConfirm;
    this.value = '';
    super.show();
  }

  handleKey(event: KeyEvent): boolean {
    if (event.key === 'Escape') {
      this.hide();
      return true;
    }

    if (event.key === 'Enter') {
      this.onConfirm?.(this.value);
      this.hide();
      return true;
    }

    if (event.char && !event.ctrl && !event.alt) {
      this.value += event.char;
      renderScheduler.scheduleRender();
      return true;
    }

    return false;
  }

  render(): void {
    if (!this.visible) return;
    // Render dialog box with value
  }
}
```

## Input Dialog

Simple single-line input with prompt:

```typescript
import { InputDialog } from './input-dialog.ts';

const dialog = new InputDialog();

dialog.show({
  title: 'Go to Line',
  prompt: 'Enter line number:',
  placeholder: '1',
  onConfirm: (value) => {
    const line = parseInt(value, 10);
    if (!isNaN(line)) {
      pane.goToLine(line);
    }
  }
});
```

## Searchable Dialog

List with fuzzy search filtering:

```typescript
import { SearchableDialog } from './searchable-dialog.ts';

const dialog = new SearchableDialog<FileItem>();

dialog.show({
  title: 'Quick Open',
  items: files,
  getLabel: (item) => item.name,
  getDetail: (item) => item.path,
  onSelect: (item) => {
    pane.openFile(item.path);
  }
});
```

### Fuzzy Matching

The searchable dialog uses fuzzy matching:

```typescript
// Matches "fb" in "FooBar.ts"
// Matches "cts" in "components.ts"

function fuzzyMatch(query: string, text: string): boolean {
  let qi = 0;
  for (let i = 0; i < text.length && qi < query.length; i++) {
    if (text[i].toLowerCase() === query[qi].toLowerCase()) {
      qi++;
    }
  }
  return qi === query.length;
}
```

## Command Palette

The command palette extends SearchableDialog:

```typescript
// command-palette.ts
class CommandPalette extends SearchableDialog<Command> {
  show(): void {
    const commands = commandRegistry.getAll();

    super.show({
      title: 'Command Palette',
      items: commands,
      getLabel: (cmd) => cmd.title,
      getDetail: (cmd) => cmd.id,
      onSelect: (cmd) => {
        commandRegistry.execute(cmd.id);
      }
    });
  }
}
```

## File Picker

Quick file open with fuzzy search:

```typescript
// file-picker.ts
class FilePicker extends SearchableDialog<string> {
  async show(onSelect: (path: string) => void): Promise<void> {
    const files = await this.scanProjectFiles();

    super.show({
      title: 'Quick Open',
      items: files,
      getLabel: (path) => basename(path),
      getDetail: (path) => path,
      onSelect
    });
  }

  private async scanProjectFiles(): Promise<string[]> {
    // Scan project, respecting .gitignore
  }
}
```

## Commit Dialog

Multi-line text input for git commits:

```typescript
// commit-dialog.ts
class CommitDialog extends BaseDialog {
  private lines: string[] = [''];
  private cursorLine: number = 0;
  private cursorCol: number = 0;

  handleKey(event: KeyEvent): boolean {
    if (event.key === 'Escape') {
      this.hide();
      return true;
    }

    // Ctrl+Enter to submit
    if (event.key === 'Enter' && event.ctrl) {
      const message = this.lines.join('\n');
      this.onConfirm?.(message);
      this.hide();
      return true;
    }

    // Regular Enter for new line
    if (event.key === 'Enter') {
      this.insertNewLine();
      return true;
    }

    // Handle text input
    if (event.char) {
      this.insertChar(event.char);
      return true;
    }

    return false;
  }
}
```

## Pane Manager

Orchestrates multiple editor panes:

```typescript
// pane-manager.ts
class PaneManager {
  private panes: Pane[] = [];
  private activeIndex: number = 0;

  get activePane(): Pane | null {
    return this.panes[this.activeIndex] ?? null;
  }

  createPane(): Pane {
    const pane = new Pane();
    this.panes.push(pane);
    return pane;
  }

  splitVertical(): void {
    const newPane = this.createPane();
    layoutManager.splitVertical(this.activePane, newPane);
  }

  closePane(pane: Pane): void {
    const index = this.panes.indexOf(pane);
    if (index >= 0) {
      this.panes.splice(index, 1);
      layoutManager.removePane(pane);
    }
  }
}
```

## Status Bar

Displays editor state:

```typescript
// status-bar.ts
class StatusBar {
  private message: string = '';
  private messageTimer: Timer | null = null;

  setMessage(message: string, duration: number = 0): void {
    this.message = message;

    if (this.messageTimer) {
      clearTimeout(this.messageTimer);
    }

    if (duration > 0) {
      this.messageTimer = setTimeout(() => {
        this.message = '';
        renderScheduler.scheduleRender();
      }, duration);
    }

    renderScheduler.scheduleRender();
  }

  render(rect: Rect): void {
    // Left: git branch, filename, language
    // Right: line/col, encoding, message
  }
}
```

## File Tree

Sidebar file explorer:

```typescript
// file-tree.ts
class FileTree {
  private root: TreeNode;
  private selectedIndex: number = 0;
  private expanded: Set<string> = new Set();

  handleKey(event: KeyEvent): boolean {
    switch (event.key) {
      case 'ArrowUp':
        this.selectPrevious();
        return true;
      case 'ArrowDown':
        this.selectNext();
        return true;
      case 'ArrowRight':
        this.expandSelected();
        return true;
      case 'ArrowLeft':
        this.collapseSelected();
        return true;
      case 'Enter':
        this.openSelected();
        return true;
    }
    return false;
  }
}
```

## Git Panel

Shows git status:

```typescript
// git-panel.ts
class GitPanel {
  private files: GitFile[] = [];
  private selectedIndex: number = 0;

  handleKey(event: KeyEvent): boolean {
    switch (event.key) {
      case 's':
        this.stageSelected();
        return true;
      case 'u':
        this.unstageSelected();
        return true;
      case 'd':
        this.discardSelected();
        return true;
      case 'c':
        this.showCommitDialog();
        return true;
      case 'S':
        if (event.shift) {
          this.stageAll();
          return true;
        }
        break;
    }
    return false;
  }
}
```

## Component Communication

### Event Pattern

Components communicate via events:

```typescript
// Component emits event
this.emit('fileSelected', { path: '/path/to/file' });

// Other component listens
fileTree.on('fileSelected', ({ path }) => {
  paneManager.openFile(path);
});
```

### Render Scheduling

All components use the render scheduler:

```typescript
// ❌ Bad - direct render
this.render();

// ✅ Good - scheduled render
renderScheduler.scheduleRender();
```

## Best Practices

1. **Extend BaseDialog** for modal interactions
2. **Use SearchableDialog** for selection lists
3. **Return `true`** from handleKey when event is consumed
4. **Schedule renders** instead of direct rendering
5. **Use callbacks** (onConfirm, onSelect) instead of return values
6. **Clean up timers** in hide() method

## Related Modules

- [Rendering](../architecture/rendering.md) - How components render
- [Keybindings](../architecture/keybindings.md) - Key event handling
- [Layout](../architecture/overview.md) - Component positioning
