# Getting Started with Ultra

This guide covers installation, first-time setup, and basic usage of Ultra.

## Prerequisites

- [Bun](https://bun.sh/) v1.0 or later
- A terminal that supports 24-bit color (most modern terminals)
- Nerd Fonts recommended for icons (optional)

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/your-username/ultra-editor.git
cd ultra-editor

# Install dependencies
bun install

# Run Ultra
bun run src/index.ts
```

### Creating an Alias

Add to your shell configuration (`.bashrc`, `.zshrc`, etc.):

```bash
alias ultra="bun /path/to/ultra-editor/src/index.ts"
```

## First Run

When you first launch Ultra, you'll see the welcome screen with essential keyboard shortcuts. Press `Ctrl+P` to open the command palette and explore available commands.

### Opening Files

```bash
# Open a single file
ultra myfile.ts

# Open a directory
ultra src/

# Open with debug logging enabled
ultra --debug myfile.ts
```

## Basic Navigation

### Essential Shortcuts

| Action | Shortcut |
|--------|----------|
| Command Palette | `Ctrl+P` |
| Quick Open File | `Ctrl+]` |
| Toggle Sidebar | `Ctrl+B` |
| Toggle Terminal | `` Ctrl+` `` |
| Save File | `Ctrl+S` |
| Close Tab | `Ctrl+W` |
| Quit | `Ctrl+Q` |

### Moving Around

| Action | Shortcut |
|--------|----------|
| Go to Line | `Ctrl+G` |
| Go to Definition | `F12` |
| Find References | `Shift+F12` |
| Word Left/Right | `Alt+Left/Right` |
| File Start/End | `Ctrl+Home/End` |

### Editing

| Action | Shortcut |
|--------|----------|
| Find | `Ctrl+F` |
| Find and Replace | `Ctrl+H` |
| Select Line | `Ctrl+L` |
| Undo/Redo | `Ctrl+Z` / `Ctrl+Shift+Z` |
| Indent/Outdent | `Tab` / `Shift+Tab` |

### Multi-Cursor

| Action | Shortcut |
|--------|----------|
| Select Next Occurrence | `Ctrl+D` |
| Select All Occurrences | `Ctrl+D A` |
| Add Cursor Above | `Ctrl+U` |
| Add Cursor Below | `Ctrl+J` |

## Interface Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│ [File Tree]  │  Tab Bar: file1.ts  file2.ts  file3.ts              │
│              │───────────────────────────────────────────────────────│
│  src/        │  1  import { foo } from './bar';                     │
│    index.ts  │  2                                                   │
│    app.ts    │  3  export function main() {                        │
│    utils/    │  4    console.log('Hello');                         │
│              │  5  }                                                │
│              │───────────────────────────────────────────────────────│
│              │  [Terminal Panel]                                    │
│              │  $ bun run build                                     │
├──────────────┴───────────────────────────────────────────────────────┤
│ Status Bar: main | file1.ts | TypeScript | Ln 3, Col 5 | UTF-8      │
└─────────────────────────────────────────────────────────────────────┘
```

### Components

- **File Tree** (`Ctrl+B`): Browse and open files in your project
- **Tab Bar**: Shows open files, click to switch between them
- **Editor Pane**: The main editing area with syntax highlighting
- **Terminal** (`` Ctrl+` ``): Integrated terminal for running commands
- **Status Bar**: Shows file info, cursor position, and messages

## Split Panes

Work with multiple files side by side:

| Action | Shortcut |
|--------|----------|
| Split Vertical | `Ctrl+\` |
| Split Horizontal | `Ctrl+Shift+\` |
| Close Pane | `Ctrl+Shift+W` |
| Next/Prev Pane | `Alt+]` / `Alt+[` |

## Git Integration

Press `Ctrl+Shift+G` to open the git panel:

| Key | Action |
|-----|--------|
| `s` | Stage selected file |
| `Shift+S` | Stage all files |
| `u` | Unstage selected file |
| `d` | Discard changes |
| `c` | Open commit dialog |
| `r` | Refresh status |
| `j/k` | Navigate up/down |
| `Enter` | Open file in editor |

### Commit Dialog

When you press `c` in the git panel:
- Type your commit message (multi-line supported)
- `Enter` for new line
- `Ctrl+Enter` to commit
- `Escape` to cancel

### Inline Diffs

Click the colored markers in the gutter (next to line numbers) to view inline diffs for changed lines.

## LSP Features

Ultra supports Language Server Protocol for intelligent code features:

| Feature | How to Use |
|---------|------------|
| Hover | Move cursor over symbols |
| Autocomplete | Start typing or press `Ctrl+Space` |
| Go to Definition | `F12` |
| Find References | `Shift+F12` |
| Rename Symbol | `F2` |

Supported languages: TypeScript, JavaScript, Python, Go, Rust, and more.

## Configuration

Ultra stores configuration in `~/.config/ultra/`:

| File | Purpose |
|------|---------|
| `settings.json` | Editor settings (tab size, theme, etc.) |
| `keybindings.json` | Custom keybindings |
| `themes/` | VS Code-compatible themes |

### Example Settings

```json
{
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "editor.wordWrap": false,
  "editor.minimap.enabled": true,
  "editor.lineNumbers": true,
  "workbench.colorTheme": "One Dark Pro"
}
```

## Tips

1. **Command Palette**: Press `Ctrl+P` to access any command by name
2. **Quick File Navigation**: Use `Ctrl+]` to fuzzy-find files
3. **Maximize Editor Space**: Toggle sidebar with `Ctrl+B`
4. **Multiple Cursors**: Select text and press `Ctrl+D` to select next occurrence
5. **Minimap**: Toggle with `Ctrl+Shift+M` for code overview

## Troubleshooting

### Debug Logging

Run Ultra with `--debug` flag to enable logging:

```bash
ultra --debug myfile.ts
```

Logs are written to `debug.log` in the current directory.

### Terminal Rendering Issues

If you see rendering artifacts:
1. Try resizing your terminal window
2. Ensure your terminal supports 24-bit color
3. Try a different terminal emulator (Kitty, Alacritty, iTerm2)

### LSP Not Working

1. Ensure the language server is installed globally
2. Check `debug.log` for LSP connection errors
3. Some languages require project configuration (tsconfig.json, etc.)

## Next Steps

- Read the [Architecture Overview](architecture/overview.md) to understand how Ultra works
- Learn about [Adding Commands](guides/adding-commands.md) to extend Ultra
- Check the [API Reference](api/) for detailed code documentation
