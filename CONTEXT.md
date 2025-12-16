# Ultra Editor Development Context

## Project Overview
Ultra is a terminal-based code editor written in TypeScript, compiled to a single binary using Bun. It features syntax highlighting (Shiki), LSP support, git integration, and a VS Code-inspired UI.

## Architecture

### Core Structure
- **Entry**: `src/index.ts` → `src/app.ts` (App class)
- **Bundler**: `build.ts` compiles everything to `./ultra` binary
- **Config**: JSON files in `config/` are embedded at build time via `src/config/defaults.ts`

### Key Components
- **Renderer** (`src/ui/renderer.ts`): Terminal rendering with ANSI escape codes, buffered output
- **Pane/PaneManager** (`src/ui/components/pane.ts`, `pane-manager.ts`): Editor panes with tabs, splits
- **Document** (`src/core/document.ts`): Text buffer, cursor management, undo/redo
- **Input** (`src/terminal/input.ts`): Raw terminal input parsing (keys, mouse, CSI u protocol)
- **Keymap** (`src/input/keymap.ts`): Keybinding system with chord support

### UI Components
- `file-tree.ts`: Sidebar file browser
- `git-panel.ts`: Source control panel
- `command-palette.ts`: Command palette (Ctrl+P style)
- `input-dialog.ts`: Modal input dialogs
- `status-bar.ts`: Bottom status bar
- `tab-bar.ts`: Tab management
- `minimap.ts`: Code minimap

### Features
- `src/features/lsp/`: Language Server Protocol client
- `src/features/git/`: Git integration (status, diff, stage, commit)
- `src/features/syntax/`: Shiki syntax highlighting
- `src/features/search/`: File and project search

## Recent Session Work (December 2024)

### Git Gutter Indicators
- Implemented line-level change indicators in editor gutter
- Colors: green (added), blue (modified), red triangle (deleted)
- Compares buffer content against HEAD (not disk)
- Uses `git diff --no-index` for buffer-to-HEAD comparison

### Inline Diff Viewer
- Click gutter indicator to show inline diff
- Displays within editor, pushes text down
- Theme-aware colors using `blendColor()` utility (15% blend)
- Keyboard: `s` stage, `r` revert, `c`/`Esc` close, `j/k` scroll
- Mouse: Stage, Revert, Close buttons in header
- Shows only the relevant hunk for clicked line

### Git Panel Improvements
- Keyboard shortcuts wrap to fit narrow sidebar
- Commit flow uses centered modal dialog (InputDialog)
- Press `c` in focused git panel to open commit dialog
- `ultra.focusGitPanel` no longer hides file tree

### Key Bug Fixes
- `themeLoader.getTheme()` → `themeLoader.getCurrentTheme()`
- `ctx.drawText()` → `ctx.drawStyled()`
- `handleMouseEvent()` → `onMouseEvent()`
- `doc.reloadFromDisk()` → `doc.reload()`
- Keys are UPPERCASE from terminal input (e.g., `'S'` not `'s'`)
- Git commands need relative paths when using `-C workspaceRoot`
- `renderer.width`/`renderer.height` are getters, not `getSize()`

## Important Patterns

### Terminal Key Events
```typescript
// Keys come as uppercase from terminal/input.ts
event.key = 'S'  // not 's'
event.ctrl = true/false
event.char = 's' // original character
```

### Theme Colors
```typescript
const colors = themeLoader.getCurrentTheme()?.colors || {};
const color = colors['editorGutter.addedBackground'] || '#4ec994';
```

### Git Integration
```typescript
// Always convert absolute to relative paths for git commands
const relativePath = filePath.startsWith(this.workspaceRoot)
  ? filePath.substring(this.workspaceRoot.length + 1)
  : filePath;
await $`git -C ${this.workspaceRoot} checkout -- ${relativePath}`.quiet();
```

### Renderer API
```typescript
renderer.width      // getter, not method
renderer.height     // getter, not method
renderer.scheduleRender()
ctx.drawStyled(x, y, text, fg, bg)
ctx.buffer(output)  // for raw ANSI strings
```

### Callbacks Pattern
Components use callback setters:
```typescript
gitPanel.onCommitRequest(() => { ... });
paneManager.onInlineDiffStage(async (filePath, line) => { ... });
```

## Settings (config/default-settings.json)
- `git.diffContextLines`: Lines of context in diff (default: 3)
- `ultra.sidebar.width`: Sidebar width
- `terminal.integrated.defaultHeight`: Terminal height

## Keybindings (config/default-keybindings.json)
- `ctrl+shift+g`: Toggle git panel
- `ctrl+alt+d`: Show git diff at cursor
- Standard VS Code-like bindings for most operations

## File Locations

### When Adding Features
1. **New component**: `src/ui/components/`
2. **New command**: Register in `App.registerCommands()` in `app.ts`
3. **New keybinding**: Add to `config/default-keybindings.json`
4. **New setting**: Add to `config/default-settings.json`

### Key Files to Know
- `src/app.ts`: Main orchestrator, command registration, event handlers
- `src/ui/components/pane.ts`: Editor pane (rendering, git gutter, inline diff)
- `src/features/git/git-integration.ts`: All git CLI operations
- `src/terminal/input.ts`: Keyboard/mouse input parsing
- `src/ui/renderer.ts`: Terminal output management

## Build & Run
```bash
bun run build.ts    # Compile to ./ultra
./ultra [file]      # Run editor
```

## Debug
- Debug log writes to `debug.log` in working directory
- Use `this.debugLog()` in App class
- Crash logs show in `debug.log` with stack traces

## Current State
- Git integration fully working (status, stage, unstage, revert, commit)
- Inline diff viewer complete with keyboard and mouse support
- File tree and git panel can coexist in sidebar
- Commit uses modal dialog instead of inline input

## Known Quirks
- Git gutter compares to HEAD, so staged changes still show as "changed"
- Revert now handles both staged and unstaged (reset + checkout)
- Must rebuild after any TypeScript changes (`bun run build.ts`)
