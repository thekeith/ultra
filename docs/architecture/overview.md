# Architecture Overview

This document provides a high-level overview of Ultra's architecture, describing the main components and how they interact.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Application                                 │
│                              (app.ts)                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Terminal   │  │    Input     │  │   Renderer   │  │    State     │ │
│  │   (ansi.ts)  │  │  (keymap.ts) │  │(renderer.ts) │  │(editor-state)│ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                 │                 │          │
│         ▼                 ▼                 ▼                 ▼          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                         Layout Manager                            │   │
│  │                         (layout.ts)                               │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│         ┌──────────────────────────┼──────────────────────────┐         │
│         ▼                          ▼                          ▼         │
│  ┌──────────────┐          ┌──────────────┐          ┌──────────────┐   │
│  │  File Tree   │          │  Pane Manager │          │   Terminal   │   │
│  │(file-tree.ts)│          │(pane-manager) │          │(terminal-pane)│  │
│  └──────────────┘          └──────┬───────┘          └──────────────┘   │
│                                   │                                      │
│                    ┌──────────────┼──────────────┐                      │
│                    ▼              ▼              ▼                      │
│             ┌──────────┐   ┌──────────┐   ┌──────────┐                  │
│             │   Pane   │   │   Pane   │   │   Pane   │                  │
│             │  (pane)  │   │  (pane)  │   │  (pane)  │                  │
│             └────┬─────┘   └────┬─────┘   └────┬─────┘                  │
│                  │              │              │                         │
│                  ▼              ▼              ▼                         │
│             ┌──────────────────────────────────────────────┐            │
│             │              Document / Buffer                │            │
│             │           (document.ts / buffer.ts)           │            │
│             └──────────────────────────────────────────────┘            │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                              Features                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   LSP    │  │   Git    │  │  Search  │  │  Syntax  │  │    AI    │  │
│  │(manager) │  │(git-int) │  │(file-src)│  │  (shiki) │  │ (claude) │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### Application (`app.ts`)

The central orchestrator that:
- Initializes all components on startup
- Sets up the event loop
- Handles global keyboard input
- Coordinates between features and UI components
- Manages application lifecycle (start/stop)

```typescript
// Example: Application startup flow
app.start(filePath, { debug: debugMode })
  // 1. Initialize terminal (raw mode, alternate screen)
  // 2. Load configuration
  // 3. Initialize layout manager
  // 4. Create initial pane
  // 5. Start LSP connections
  // 6. Begin render loop
```

### Terminal Layer (`terminal/`)

Provides low-level terminal I/O:
- **ansi.ts**: ANSI escape sequence generation
- **input.ts**: Raw input parsing
- **pty.ts**: Pseudo-terminal management for integrated terminal

### Layout Manager (`ui/layout.ts`)

Manages screen real estate:
- Calculates positions for all UI elements
- Handles sidebar, terminal, AI panel visibility
- Supports pane splits (horizontal/vertical)
- Responds to terminal resize events

### Pane Manager (`ui/components/pane-manager.ts`)

Orchestrates multiple editor panes:
- Creates/destroys panes
- Handles focus switching
- Manages pane splits
- Routes input to active pane

### Editor Pane (`ui/components/pane.ts`)

Individual editing surface:
- Renders document content
- Handles cursor and selection
- Manages tab bar for that pane
- Coordinates with LSP for features

### Document (`core/document.ts`)

Higher-level abstraction over Buffer:
- File I/O operations
- Change tracking (dirty state)
- Integration with undo history

### Buffer (`core/buffer.ts`)

Piece table implementation for text storage:
- Efficient insert/delete operations
- Line-based access with caching
- Position/offset conversion
- Snapshot support for undo

## Singleton Pattern

Most managers in Ultra follow the singleton pattern:

```typescript
// Standard singleton export pattern
export class SomeManager {
  // ... implementation
}

// Named export for when type is needed
export const someManager = new SomeManager();

// Default export for convenient imports
export default someManager;
```

Usage:
```typescript
// Import the singleton instance
import someManager from './some-manager.ts';

// Or import both class and instance
import { SomeManager, someManager } from './some-manager.ts';
```

## Key Singletons

| Module | Instance | Purpose |
|--------|----------|---------|
| `app.ts` | `app` | Main application |
| `layout.ts` | `layoutManager` | Layout calculations |
| `renderer.ts` | `renderer` | Screen rendering |
| `commands.ts` | `commandRegistry` | Command registration |
| `keymap.ts` | `keymap` | Keybinding resolution |
| `settings.ts` | `settings` | Configuration |
| `lsp/manager.ts` | `lspManager` | LSP connections |
| `git-integration.ts` | `gitIntegration` | Git operations |

## Feature Architecture

### LSP Integration

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  LSP Client │────▶│ LSP Manager │────▶│   Providers │
│  (client.ts)│     │ (manager.ts)│     │(providers.ts)│
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │                   ▼                   ▼
       │            ┌─────────────┐     ┌─────────────┐
       │            │ Autocomplete│     │   Tooltip   │
       │            │   Popup     │     │  (hover)    │
       │            └─────────────┘     └─────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│              Language Server Process                 │
│         (tsserver, pyright, gopls, etc.)            │
└─────────────────────────────────────────────────────┘
```

### Git Integration

```
┌─────────────────────────────────────────────────────┐
│                  Git Integration                     │
│               (git-integration.ts)                   │
├─────────────────────────────────────────────────────┤
│  - Status (staged, modified, untracked)             │
│  - Diff (file and line-level)                       │
│  - Commit, push, pull, branch operations            │
│  - Blame information                                │
└─────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────┐
│              Git Panel (git-panel.ts)                │
│         Commit Dialog (commit-dialog.ts)            │
│          Inline Diff (inline-diff.ts)               │
└─────────────────────────────────────────────────────┘
```

## Rendering Pipeline

Ultra uses a scheduled rendering approach:

1. **State Change**: User input or external event modifies state
2. **Schedule Render**: Component calls `renderScheduler.scheduleRender()`
3. **Batch Updates**: Multiple calls within same frame are batched
4. **Render Pass**: Single render pass updates terminal
5. **Flush**: Output is flushed to terminal

See [Rendering Architecture](rendering.md) for details.

## Event Flow

```
User Input (keyboard/mouse)
         │
         ▼
┌─────────────────┐
│  Input Parser   │
│  (terminal)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Keymap       │
│  Resolution     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Command      │
│   Execution     │
└────────┬────────┘
         │
         ├──────────────┐
         ▼              ▼
┌─────────────┐  ┌─────────────┐
│   State     │  │   Feature   │
│   Update    │  │   Action    │
└──────┬──────┘  └──────┬──────┘
       │                │
       └────────┬───────┘
                ▼
┌─────────────────────────────────┐
│       Render Scheduler          │
│   (schedule → batch → render)   │
└─────────────────────────────────┘
```

## Configuration System

```
~/.config/ultra/
├── settings.json          ─┐
├── keybindings.json        │─▶ User Configuration
└── themes/                ─┘

config/
├── default-settings.json  ─┐
├── default-keybindings.json│─▶ Default Configuration
└── BOOT.md                ─┘

src/config/
├── defaults.ts            ─▶ Embedded defaults
├── settings.ts            ─▶ Settings manager
├── settings-loader.ts     ─▶ File loading
└── user-config.ts         ─▶ User config paths
```

## Dependencies

### External Dependencies

| Package | Purpose |
|---------|---------|
| `shiki` | Syntax highlighting engine |
| `vscode-languageserver-protocol` | LSP types |
| `vscode-languageclient` | LSP client implementation |

### Runtime

Ultra runs on [Bun](https://bun.sh/), using:
- Native TypeScript support
- Built-in shell execution (`Bun.$`)
- Built-in file operations (`Bun.file()`)
- Fast startup and execution

## Next Steps

- [Data Flow](data-flow.md): Detailed look at data movement
- [Keybindings](keybindings.md): How keyboard input is processed
- [Rendering](rendering.md): Terminal rendering pipeline
