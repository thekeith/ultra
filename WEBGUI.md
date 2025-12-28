# Ultra Web GUI Client

## Overview

The Web GUI is a browser-based client for Ultra that connects to the ECP server via WebSocket. It provides a VS Code-like interface using Svelte, Monaco Editor, and xterm.js.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Svelte App)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Monaco    │  │   xterm.js  │  │   Svelte Stores     │  │
│  │   Editor    │  │  Terminal   │  │  (documents, layout │  │
│  │             │  │             │  │   settings, git)    │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
│                   ┌──────▼──────┐                            │
│                   │  ECP Client │  (WebSocket JSON-RPC)      │
│                   └──────┬──────┘                            │
└──────────────────────────┼───────────────────────────────────┘
                           │
                    WebSocket (ws://localhost:7890)
                           │
┌──────────────────────────┼───────────────────────────────────┐
│                   ┌──────▼──────┐                            │
│                   │  ECP Server │                            │
│                   └──────┬──────┘                            │
│                          │                                   │
│    ┌─────────────────────┼─────────────────────┐             │
│    │         │           │           │         │             │
│    ▼         ▼           ▼           ▼         ▼             │
│ Document   File        Git        LSP      Session           │
│ Service   Service    Service    Service    Service           │
│                                                              │
│                     Bun Server (Ultra)                       │
└──────────────────────────────────────────────────────────────┘
```

## Current State

### What Works

1. **Basic Editor** - Monaco Editor with syntax highlighting, file editing
2. **File Tree** - Navigate and open files from sidebar
3. **Tab Management** - Multiple open documents with tabs
4. **Terminal** - xterm.js terminal connected via PTY
5. **Theme Loading** - CSS variables from Ultra themes applied to UI
6. **Command Palette** - Ctrl+Shift+P with file search, commands
7. **Git Panel** - UI exists, shows status (partially wired)
8. **Settings Editor** - Ctrl+, opens settings with search/categories
9. **Theme Selector** - Ctrl+K Ctrl+T to switch themes
10. **Session Store** - Auto-save/restore of documents and layout
11. **Keybindings** - Keyboard shortcuts with command execution

### Known Issues / Blockers

1. **Theme System Mismatch** - LocalSessionService has hardcoded themes ("One Dark", "One Light") while TUI uses `defaultThemes` from `config/defaults.ts`. Web GUI only sees 2 themes instead of all available themes. See BACKLOG.md for fix options.

2. **Monaco Theme Sync** - Theme changes update CSS variables but Monaco's token colors don't fully sync with Ultra's tokenColors format.

3. **LSP Not Wired** - Document sync with LSP service not implemented. No completions, hover, diagnostics.

4. **Git Panel Partial** - UI renders but stage/unstage/commit actions not fully connected.

## File Structure

```
src/clients/web/
├── server/
│   └── index.ts              # Bun HTTP/WebSocket server
├── app/
│   ├── src/
│   │   ├── main.ts           # App entry point
│   │   ├── App.svelte        # Root component
│   │   ├── components/
│   │   │   ├── editor/
│   │   │   │   └── Editor.svelte         # Monaco wrapper
│   │   │   ├── sidebar/
│   │   │   │   ├── Sidebar.svelte        # Sidebar container
│   │   │   │   ├── FileTree.svelte       # File explorer
│   │   │   │   └── GitPanel.svelte       # Git status/actions
│   │   │   ├── terminal/
│   │   │   │   └── Terminal.svelte       # xterm.js wrapper
│   │   │   ├── layout/
│   │   │   │   ├── MainLayout.svelte     # Main app layout
│   │   │   │   ├── TabBar.svelte         # Editor tabs
│   │   │   │   ├── StatusBar.svelte      # Bottom status bar
│   │   │   │   └── Panel.svelte          # Bottom panel (terminal)
│   │   │   └── overlays/
│   │   │       ├── CommandPalette.svelte # Ctrl+Shift+P
│   │   │       ├── ThemeSelector.svelte  # Theme picker
│   │   │       └── SettingsEditor.svelte # Settings UI
│   │   ├── lib/
│   │   │   ├── ecp/
│   │   │   │   └── client.ts             # WebSocket ECP client
│   │   │   ├── stores/
│   │   │   │   ├── documents.ts          # Open documents state
│   │   │   │   ├── layout.ts             # Panes, sidebar, panels
│   │   │   │   ├── settings.ts           # User settings
│   │   │   │   ├── git.ts                # Git status
│   │   │   │   └── session.ts            # Session persistence
│   │   │   └── theme/
│   │   │       └── loader.ts             # Theme CSS variable loader
│   │   └── styles/
│   │       └── global.css                # Base styles
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
```

## Key Components

### ECP Client (`lib/ecp/client.ts`)

WebSocket client for JSON-RPC 2.0 communication with ECP server.

```typescript
// Request/response
const result = await ecpClient.request('document/open', { uri: 'file:///path' });

// Notifications (server -> client)
ecpClient.onNotification('terminal/data', (params) => { ... });
```

### Documents Store (`lib/stores/documents.ts`)

Manages open documents, active document, cursor positions.

```typescript
// Open a file
const docId = await documentsStore.open(uri);

// Get document content
const doc = documentsStore.get(docId);

// Track cursor for session restore
documentsStore.updateCursor(docId, { line, column, scrollTop });
```

### Layout Store (`lib/stores/layout.ts`)

Tracks sidebar, panels, panes state.

```typescript
layoutStore.toggleSidebar();
layoutStore.setSidebarSection('git');
layoutStore.togglePanel();
layoutStore.addPane({ type: 'editor', documentId, title });
```

### Settings Store (`lib/stores/settings.ts`)

Fetches and updates settings via ECP.

```typescript
await settingsStore.init();
const value = settingsStore.get('editor.fontSize');
await settingsStore.update('editor.tabSize', 4);
```

### Session Store (`lib/stores/session.ts`)

Auto-saves session state (documents, layout) every 30s. Restores on load.

```typescript
await sessionStore.init();  // Restore previous session
await sessionStore.save();  // Manual save
```

### Theme Loader (`lib/theme/loader.ts`)

Fetches current theme from ECP and applies as CSS variables.

```typescript
await loadTheme();
// Sets --editor-background, --editor-foreground, etc.
```

## ECP Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `document/open` | Open file, get content |
| `document/save` | Save document |
| `document/insert` | Insert text |
| `document/delete` | Delete text |
| `file/list` | List directory contents |
| `file/read` | Read file content |
| `git/status` | Get git status |
| `git/stage` | Stage file |
| `git/unstage` | Unstage file |
| `git/commit` | Create commit |
| `theme/current` | Get current theme |
| `theme/list` | List available themes |
| `theme/set` | Change theme |
| `config/getAll` | Get all settings |
| `config/set` | Update setting |
| `config/schema` | Get settings schema |
| `terminal/create` | Create PTY |
| `terminal/write` | Write to PTY |
| `terminal/resize` | Resize PTY |
| `session/save` | Save session state |
| `session/current` | Get current session |

## Keybindings

| Key | Action |
|-----|--------|
| Ctrl+Shift+P | Command Palette |
| Ctrl+P | Quick Open (files) |
| Ctrl+, | Settings |
| Ctrl+K Ctrl+T | Theme Selector |
| Ctrl+S | Save |
| Ctrl+B | Toggle Sidebar |
| Ctrl+` | Toggle Terminal |
| Ctrl+W | Close Tab |

## Running

```bash
# Start with GUI flag
bun src/index.ts --gui

# Or via npm script
bun run dev:gui
```

Opens at http://localhost:7890

## Next Steps (Implementation Plan)

See the plan file at `~/.claude/plans/snuggly-sniffing-narwhal.md` for detailed implementation phases:

1. **Phase 1: LSP Integration** - Document sync, completions, hover, diagnostics
2. **Phase 2: Enhanced Themes** - Fix theme loading, Monaco token sync
3. **Phase 3: Settings** - Apply editor settings to Monaco
4. **Phase 4: Git** - Wire up GitPanel actions
5. **Phase 5: Sessions** - Full session restore
6. **Phase 6: Terminal** - Multiple terminals, tabs
7. **Phase 7: Commands** - More command palette commands

## Dependencies

- **Svelte 5** - UI framework
- **Vite** - Build tool
- **Monaco Editor** - Code editor
- **xterm.js** - Terminal emulator
- **@xterm/addon-fit** - Terminal resize
- **@xterm/addon-webgl** - GPU rendering

## Build

```bash
cd src/clients/web/app
bun install
bun run build  # Outputs to dist/
```

The server serves the built files from `dist/` in production.
