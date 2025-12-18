# Rendering Architecture

This document describes Ultra's terminal rendering pipeline, from state changes to screen output.

## Overview

Ultra renders to the terminal using ANSI escape sequences. The rendering system is designed to:

- Batch multiple state changes into single render passes
- Minimize terminal output for efficiency
- Support 24-bit color (true color)
- Handle resize events gracefully

## Render Pipeline

```
State Change
      │
      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    scheduleRender()                                  │
│  - Debounces multiple rapid changes                                 │
│  - Schedules render on next frame                                   │
└────────────────────────────────┬────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Render Pass                                       │
│  1. Calculate layout rectangles                                     │
│  2. Render each component to buffer                                 │
│  3. Diff with previous frame (optional)                             │
│  4. Output ANSI sequences                                           │
└────────────────────────────────┬────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Terminal Output                                   │
│  - Write to stdout                                                  │
│  - Flush immediately                                                │
└─────────────────────────────────────────────────────────────────────┘
```

## Render Scheduler

### Purpose

The render scheduler prevents excessive rendering by batching state changes:

```typescript
// Multiple rapid state changes
cursor.moveTo(5, 10);
document.insert(5, 10, 'a');
statusBar.setMessage('Typing...');

// Without scheduling: 3 separate renders
// With scheduling: 1 batched render
```

### Implementation

```typescript
// ui/render-scheduler.ts
class RenderScheduler {
  private pending: boolean = false;
  private renderCallback: (() => void) | null = null;

  scheduleRender(): void {
    if (this.pending) return;

    this.pending = true;
    setImmediate(() => {
      this.pending = false;
      this.renderCallback?.();
    });
  }

  setRenderCallback(callback: () => void): void {
    this.renderCallback = callback;
  }
}
```

### Usage

Components should never render directly:

```typescript
// ❌ Bad - direct render
this.render();

// ✅ Good - scheduled render
renderScheduler.scheduleRender();
```

## ANSI Escape Sequences

### Terminal Setup (`terminal/ansi.ts`)

```typescript
// Enter alternate screen buffer
const ENTER_ALT_SCREEN = '\x1b[?1049h';

// Enable mouse reporting
const ENABLE_MOUSE = '\x1b[?1000h\x1b[?1002h\x1b[?1006h';

// Hide cursor
const HIDE_CURSOR = '\x1b[?25l';

// Show cursor
const SHOW_CURSOR = '\x1b[?25h';
```

### Cursor Movement

```typescript
// Move cursor to (row, col) - 1-indexed
function moveTo(row: number, col: number): string {
  return `\x1b[${row};${col}H`;
}

// Move cursor relative
const CURSOR_UP = (n: number) => `\x1b[${n}A`;
const CURSOR_DOWN = (n: number) => `\x1b[${n}B`;
const CURSOR_RIGHT = (n: number) => `\x1b[${n}C`;
const CURSOR_LEFT = (n: number) => `\x1b[${n}D`;
```

### Colors

Ultra uses 24-bit (true color) ANSI sequences:

```typescript
// Foreground color
function fg(r: number, g: number, b: number): string {
  return `\x1b[38;2;${r};${g};${b}m`;
}

// Background color
function bg(r: number, g: number, b: number): string {
  return `\x1b[48;2;${r};${g};${b}m`;
}

// Reset attributes
const RESET = '\x1b[0m';

// Example: Red text on blue background
`${fg(255, 0, 0)}${bg(0, 0, 255)}Hello${RESET}`
```

### Text Attributes

```typescript
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const ITALIC = '\x1b[3m';
const UNDERLINE = '\x1b[4m';
const REVERSE = '\x1b[7m';
```

## Layout System

### Layout Manager

The layout manager calculates rectangles for all UI components:

```typescript
interface Rect {
  x: number;      // 1-indexed column
  y: number;      // 1-indexed row
  width: number;
  height: number;
}

// Get component rectangles
const editorRect = layoutManager.getEditorAreaRect();
const sidebarRect = layoutManager.getSidebarRect();
const terminalRect = layoutManager.getTerminalRect();
const statusBarRect = layoutManager.getStatusBarRect();
```

### Screen Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ y=1  [Sidebar]      │  [Editor Area / Panes]                     │
│                     │                                            │
│                     │                                            │
│                     │                                            │
│      (width=30)     │           (remaining width)                │
│                     │                                            │
│                     │                                            │
│                     ├────────────────────────────────────────────│
│                     │  [Terminal] (if visible)                   │
│                     │           (height=12)                      │
├─────────────────────┴────────────────────────────────────────────│
│ y=height  [Status Bar]              (full width, height=1)       │
└──────────────────────────────────────────────────────────────────┘
```

### Pane Layout

Panes use a tree structure for splits:

```typescript
interface LayoutNode {
  type: 'leaf' | 'horizontal' | 'vertical';
  rect: Rect;
  children?: LayoutNode[];
  ratio?: number[];  // Split ratios
  id?: string;       // Pane ID for leaf nodes
}

// Example: Two panes side by side (horizontal split)
{
  type: 'horizontal',
  rect: { x: 31, y: 1, width: 80, height: 30 },
  ratio: [0.5, 0.5],
  children: [
    { type: 'leaf', id: 'pane1', rect: { x: 31, y: 1, width: 40, height: 30 } },
    { type: 'leaf', id: 'pane2', rect: { x: 71, y: 1, width: 40, height: 30 } }
  ]
}
```

## Component Rendering

### Render Interface

Each UI component implements rendering:

```typescript
interface Renderable {
  render(rect: Rect): void;
}
```

### Editor Pane Rendering

```typescript
// ui/components/pane.ts
class Pane {
  render(rect: Rect): void {
    const { x, y, width, height } = rect;

    // Reserve space for tab bar
    const tabBarHeight = 1;

    // Render tab bar
    this.tabBar.render({ x, y, width, height: tabBarHeight });

    // Render editor content
    const editorRect = {
      x,
      y: y + tabBarHeight,
      width,
      height: height - tabBarHeight
    };
    this.renderContent(editorRect);
  }

  private renderContent(rect: Rect): void {
    const { x, y, width, height } = rect;

    for (let row = 0; row < height; row++) {
      const lineNumber = this.scrollTop + row;
      const line = this.document.getLine(lineNumber);
      const highlighted = this.highlighter.getLine(lineNumber);

      // Move cursor to start of row
      process.stdout.write(moveTo(y + row, x));

      // Render gutter (line numbers)
      this.renderGutter(lineNumber, y + row, x);

      // Render line content with syntax highlighting
      this.renderLine(highlighted, width - gutterWidth);
    }
  }
}
```

### Syntax Highlighting

Shiki provides tokenized output for rendering:

```typescript
// Shiki returns tokens with scopes
interface Token {
  content: string;
  color?: string;  // Hex color from theme
}

// Render a highlighted line
function renderHighlightedLine(tokens: Token[]): void {
  for (const token of tokens) {
    if (token.color) {
      const { r, g, b } = hexToRgb(token.color);
      process.stdout.write(fg(r, g, b));
    }
    process.stdout.write(token.content);
    process.stdout.write(RESET);
  }
}
```

### Status Bar Rendering

```typescript
// ui/components/status-bar.ts
class StatusBar {
  render(rect: Rect): void {
    const { x, y, width } = rect;

    // Move to status bar position
    process.stdout.write(moveTo(y, x));

    // Set status bar colors
    process.stdout.write(bg(40, 44, 52));  // Dark background
    process.stdout.write(fg(171, 178, 191)); // Light text

    // Build status bar content
    const left = ` ${this.branch} | ${this.filename} | ${this.language}`;
    const right = `Ln ${this.line}, Col ${this.col} | ${this.encoding} `;
    const padding = width - left.length - right.length;

    process.stdout.write(left);
    process.stdout.write(' '.repeat(Math.max(0, padding)));
    process.stdout.write(right);

    process.stdout.write(RESET);
  }
}
```

## Color Utilities

### Color Conversion (`ui/colors.ts`)

```typescript
// Convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

// Apply foreground color from hex
function fgHex(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return fg(r, g, b);
}

// Apply background color from hex
function bgHex(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return bg(r, g, b);
}
```

### Theme Colors

Theme colors are loaded from VS Code compatible themes:

```typescript
interface Theme {
  colors: {
    'editor.background': string;
    'editor.foreground': string;
    'editor.lineHighlightBackground': string;
    'editorLineNumber.foreground': string;
    // ... more colors
  };
  tokenColors: TokenColor[];
}
```

## Performance Considerations

### Avoiding Flicker

1. **Hide cursor during render**
   ```typescript
   process.stdout.write(HIDE_CURSOR);
   // ... render ...
   process.stdout.write(SHOW_CURSOR);
   ```

2. **Buffer output**
   ```typescript
   let buffer = '';
   // Build all output in buffer
   buffer += moveTo(1, 1);
   buffer += content;
   // Write once
   process.stdout.write(buffer);
   ```

### Partial Updates

For small changes, update only affected regions:

```typescript
// Only re-render changed lines
function renderLine(lineNumber: number): void {
  const rect = this.getLineRect(lineNumber);
  // Clear and re-render just this line
}
```

### Dirty Region Tracking

```typescript
class DirtyTracker {
  private dirtyLines: Set<number> = new Set();

  markDirty(line: number): void {
    this.dirtyLines.add(line);
  }

  markRangeDirty(start: number, end: number): void {
    for (let i = start; i <= end; i++) {
      this.dirtyLines.add(i);
    }
  }

  getDirtyLines(): number[] {
    const lines = Array.from(this.dirtyLines);
    this.dirtyLines.clear();
    return lines.sort((a, b) => a - b);
  }
}
```

## Resize Handling

When the terminal resizes:

```typescript
process.stdout.on('resize', () => {
  const { columns, rows } = process.stdout;

  // Update layout manager
  layoutManager.updateDimensions(columns, rows);

  // Force full re-render
  renderScheduler.scheduleRender();
});
```

## Debug Rendering

Enable render debugging with `--debug` flag:

```typescript
function debugRender(component: string, rect: Rect): void {
  if (debugMode) {
    debugLog(`Render ${component}: ${JSON.stringify(rect)}`);
  }
}
```

## Best Practices

1. **Always use the render scheduler** - Never render directly
2. **Batch ANSI sequences** - Minimize write() calls
3. **Hide cursor during updates** - Prevents flicker
4. **Use hex colors from theme** - Don't hardcode colors
5. **Clear before render** - Prevent artifacts from previous content
6. **Handle edge cases** - Empty lines, overflow, unicode width
