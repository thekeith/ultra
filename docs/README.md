# Ultra Documentation

Ultra is a terminal-native code editor with modern IDE features, built with TypeScript and Bun.

## Quick Links

| Guide | Description |
|-------|-------------|
| [Getting Started](getting-started.md) | Installation, first run, basic usage |
| [Architecture Overview](architecture/overview.md) | High-level system design |
| [Keybindings](architecture/keybindings.md) | Keyboard handling system |
| [Data Flow](architecture/data-flow.md) | How data moves through the app |
| [Rendering](architecture/rendering.md) | Terminal rendering pipeline |

## Module Documentation

| Module | Description |
|--------|-------------|
| [Buffer](modules/buffer.md) | Piece table text buffer implementation |
| [Editor](modules/editor.md) | Main editor state and orchestration |
| [LSP](modules/lsp.md) | Language Server Protocol integration |
| [Syntax](modules/syntax.md) | Syntax highlighting with Shiki |
| [Commands](modules/commands.md) | Command system and registration |
| [UI Components](modules/ui-components.md) | Dialogs, panels, and widgets |

## Developer Guides

| Guide | Description |
|-------|-------------|
| [Contributing](guides/contributing.md) | How to contribute to Ultra |
| [Adding Commands](guides/adding-commands.md) | Creating new editor commands |
| [Adding Languages](guides/adding-languages.md) | Adding language support |

## API Reference

Generated API documentation is available in the [api/](api/) directory after running:

```bash
bun run docs
```

## Project Structure

```
ultra-editor/
├── src/
│   ├── index.ts              # Entry point
│   ├── app.ts                # Main application class
│   ├── constants.ts          # Shared constants
│   ├── debug.ts              # Debug logging utilities
│   ├── core/                 # Core data structures
│   │   ├── buffer.ts         # Piece table buffer
│   │   ├── cursor.ts         # Cursor management
│   │   ├── document.ts       # Document abstraction
│   │   ├── undo.ts           # Undo/redo history
│   │   ├── auto-indent.ts    # Auto-indentation
│   │   ├── auto-pair.ts      # Bracket auto-pairing
│   │   └── bracket-match.ts  # Bracket matching
│   ├── input/                # Input handling
│   │   ├── keymap.ts         # Key parsing and mapping
│   │   ├── keybindings-loader.ts
│   │   └── commands.ts       # Command registry
│   ├── features/             # Editor features
│   │   ├── lsp/              # Language Server Protocol
│   │   ├── git/              # Git integration
│   │   ├── search/           # File and project search
│   │   ├── syntax/           # Syntax highlighting
│   │   └── ai/               # AI assistant panel
│   ├── ui/                   # User interface
│   │   ├── layout.ts         # Layout management
│   │   ├── renderer.ts       # Main renderer
│   │   ├── colors.ts         # Color utilities
│   │   └── components/       # UI components
│   │       ├── pane.ts       # Editor pane
│   │       ├── tab-bar.ts    # Tab bar
│   │       ├── status-bar.ts # Status bar
│   │       ├── file-tree.ts  # File explorer
│   │       ├── git-panel.ts  # Git panel
│   │       └── ...           # Dialogs and widgets
│   ├── terminal/             # Terminal I/O
│   │   ├── ansi.ts           # ANSI escape sequences
│   │   ├── input.ts          # Input parsing
│   │   └── pty.ts            # PTY management
│   ├── config/               # Configuration
│   │   ├── defaults.ts       # Default settings
│   │   ├── settings.ts       # Settings manager
│   │   └── user-config.ts    # User configuration
│   └── state/                # Application state
│       └── editor-state.ts   # Global editor state
├── config/                   # Configuration files
│   ├── BOOT.md               # Welcome screen content
│   ├── default-keybindings.json
│   └── default-settings.json
└── docs/                     # Documentation (you are here)
```

## Key Concepts

### Piece Table Buffer

Ultra uses a [piece table](https://en.wikipedia.org/wiki/Piece_table) data structure for text storage. This provides:
- O(1) insert/delete operations on average
- Efficient undo/redo via snapshots
- Memory efficiency for large files

### Singleton Pattern

Most managers in Ultra are singletons with named + default exports:

```typescript
export class SomeManager { ... }
export const someManager = new SomeManager();
export default someManager;
```

### Layout System

The layout manager handles pane positioning, sidebar, terminal, and AI panel placement. It uses a tree structure for split panes.

### Render Scheduling

Rendering is batched via `renderScheduler.scheduleRender()` to avoid excessive terminal updates. Never write directly to stdout from components.

## Technology Stack

- **Runtime**: [Bun](https://bun.sh/) - Fast JavaScript runtime
- **Language**: TypeScript with strict mode
- **Syntax Highlighting**: [Shiki](https://shiki.style/) - VS Code's syntax engine
- **Terminal**: Raw mode with ANSI escape sequences
- **LSP**: Language Server Protocol for IDE features
