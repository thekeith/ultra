# Viewer Patterns

This document describes the patterns for building content viewers in Ultra's TUI.

## Overview

Ultra provides two base classes for building content viewers:

1. **BaseViewer** - Simple list/tree viewer with minimal overhead
2. **ContentBrowser** - Full-featured artifact browser with actions, complex metadata

## When to Use Each

### Use BaseViewer When:
- You need a simple scrollable list or tree
- Items don't have multiple actions (just select/activate)
- You want minimal overhead and simple code
- Examples: file picker, simple outline, recent files list

### Use ContentBrowser When:
- Items have multiple actions (stage, discard, open, etc.)
- You need artifact-level metadata and complex node types
- Items require specialized rendering per node type
- Examples: git diff viewer, search results, diagnostics panel

## BaseViewer

### Interface: ViewerItem

```typescript
interface ViewerItem {
  id: string;           // Unique identifier
  label: string;        // Display text
  secondaryLabel?: string;  // Optional right-aligned text
  icon?: string;        // Optional icon character
  depth: number;        // Indentation level (0 = root)
  children: ViewerItem[];  // Child items
  expandable: boolean;  // Can expand/collapse
}
```

### Creating a BaseViewer

```typescript
import { BaseViewer, type ViewerItem } from './elements';
import type { ScreenBuffer } from './rendering/buffer.ts';

interface FileItem extends ViewerItem {
  path: string;
  size: number;
}

class FileListViewer extends BaseViewer<FileItem> {
  protected renderItem(
    buffer: ScreenBuffer,
    item: FileItem,
    x: number,
    y: number,
    width: number,
    isSelected: boolean
  ): void {
    const bg = isSelected
      ? this.ctx.getSelectionBackground('sidebar', this.focused)
      : this.ctx.getBackgroundForFocus('sidebar', this.focused);
    const fg = isSelected
      ? this.ctx.getThemeColor('list.activeSelectionForeground', '#ffffff')
      : this.ctx.getForegroundForFocus('sidebar', this.focused);

    // Render with indentation
    const indent = '  '.repeat(item.depth);
    const icon = item.expandable
      ? (this.collapsedIds.has(item.id) ? '▶' : '▼')
      : '  ';
    const text = `${indent}${icon} ${item.icon ?? ''} ${item.label}`;

    buffer.writeString(x, y, text.padEnd(width, ' '), fg, bg);
  }

  protected getKeyboardHints(): string[] {
    return [' ↑↓:navigate  Enter:open  Space:expand'];
  }
}
```

### BaseViewer Lifecycle

1. Create instance with `new FileListViewer(id, title, ctx, callbacks)`
2. Set items with `viewer.setItems(items)`
3. Viewer handles rendering, scrolling, selection
4. Callbacks fire on selection change and activation

## ContentBrowser

### Interface: ArtifactNode

```typescript
interface ArtifactNode<T extends Artifact> {
  artifact: T;          // The artifact data
  nodeType: NodeType;   // 'file' | 'hunk' | 'line' | 'match' | 'group' | 'item'
  nodeId: string;       // Unique node ID
  depth: number;        // Tree depth
  expanded: boolean;    // Expand state
  children: ArtifactNode<T>[];  // Child nodes
  actions: ArtifactAction[];    // Available actions
  selected: boolean;    // Selection state
  label: string;        // Display label
  secondaryLabel?: string;  // Secondary text
  icon?: string;        // Icon character
  foreground?: string;  // Color override
  metadata?: Record<string, unknown>;  // Custom data
}
```

### Creating a ContentBrowser

```typescript
import { ContentBrowser } from './elements/content-browser.ts';
import type { Artifact, ArtifactNode, ArtifactAction } from './artifacts/types.ts';

interface DiagnosticArtifact extends Artifact {
  type: 'diagnostic';
  severity: 'error' | 'warning' | 'info';
  message: string;
  file: string;
  line: number;
}

class DiagnosticBrowser extends ContentBrowser<DiagnosticArtifact> {
  protected buildNodes(artifacts: DiagnosticArtifact[]): ArtifactNode<DiagnosticArtifact>[] {
    // Group by file, then by severity
    return artifacts.map((artifact, idx) => ({
      artifact,
      nodeType: 'item',
      nodeId: `diag:${idx}`,
      depth: 0,
      expanded: true,
      children: [],
      actions: this.getDiagnosticActions(artifact),
      selected: false,
      label: artifact.message,
      secondaryLabel: `${artifact.file}:${artifact.line}`,
      icon: artifact.severity === 'error' ? '●' : '○',
      foreground: this.getSeverityColor(artifact.severity),
    }));
  }

  protected renderNode(
    buffer: ScreenBuffer,
    node: ArtifactNode<DiagnosticArtifact>,
    x: number,
    y: number,
    width: number,
    isSelected: boolean
  ): void {
    // Custom rendering logic
  }

  protected getNodeActions(node: ArtifactNode<DiagnosticArtifact>): ArtifactAction[] {
    return node.actions;
  }
}
```

## Key Patterns

### 1. Theme Colors

Always use theme colors, never hardcode:

```typescript
// Good
const bg = this.ctx.getThemeColor('editor.background', '#1e1e1e');
const fg = this.ctx.getThemeColor('editor.foreground', '#cccccc');

// Bad
const bg = '#1e1e1e';
```

### 2. Focus-Aware Rendering

Render differently when focused vs unfocused:

```typescript
const bg = this.ctx.getBackgroundForFocus('sidebar', this.focused);
const fg = this.ctx.getForegroundForFocus('sidebar', this.focused);
const selBg = this.ctx.getSelectionBackground('sidebar', this.focused);
```

### 3. Keyboard Hints

Provide context-aware hints:

```typescript
protected getKeyboardHints(): string[] {
  const item = this.getSelectedItem();
  if (item?.type === 'file') {
    return [' Enter:open  s:stage  d:discard'];
  }
  return [' Enter:select'];
}
```

### 4. State Serialization

Support session restore:

```typescript
// Save
const state = viewer.getState();
sessionStorage.setItem('viewer-state', JSON.stringify(state));

// Restore
const saved = sessionStorage.getItem('viewer-state');
if (saved) {
  viewer.setState(JSON.parse(saved));
}
```

### 5. Dirty Tracking

Mark dirty after state changes:

```typescript
setItems(items: T[]): void {
  this.rootItems = items;
  this.rebuildFlatView();
  this.ctx.markDirty();  // Trigger re-render
}
```

## File Structure

```
src/clients/tui/
├── elements/
│   ├── base.ts              # BaseElement (common to all)
│   ├── base-viewer.ts       # BaseViewer (simple list/tree)
│   ├── content-browser.ts   # ContentBrowser (full-featured)
│   ├── git-diff-browser.ts  # GitDiffBrowser extends ContentBrowser
│   └── search-result-browser.ts  # SearchResultBrowser extends ContentBrowser
└── artifacts/
    ├── types.ts             # ViewerItem, Artifact, ArtifactNode
    └── git-diff-artifact.ts # Git diff specific types
```

## Migration Guide

### From Custom Implementation to BaseViewer

1. Define your item interface extending `ViewerItem`
2. Create class extending `BaseViewer<YourItem>`
3. Implement `renderItem()` method
4. Optionally override `getKeyboardHints()`
5. Use `setItems()` to populate, `setCallbacks()` for events

### From BaseViewer to ContentBrowser

When you need:
- Multiple actions per item
- Complex node types with different rendering
- Artifact-level grouping and metadata

1. Define artifact type extending `Artifact`
2. Create class extending `ContentBrowser<YourArtifact>`
3. Implement `buildNodes()`, `renderNode()`, `getNodeActions()`
4. Use `setArtifacts()` instead of `setItems()`

## Examples

- **GitDiffBrowser**: Full-featured with file/hunk/line nodes, stage/discard actions
- **SearchResultBrowser**: File/match grouping with search highlighting
- **OutlinePanel**: Simple tree using symbol hierarchy

## Related Documentation

- [Testing Overview](./testing/overview.md) - Testing viewer components
- [services/](./services/) - Backend services for viewer data
