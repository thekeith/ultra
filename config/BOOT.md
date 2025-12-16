# Welcome to Ultra

Ultra is a terminal-based code editor built with TypeScript and Bun.

## Getting Started

### Basic Navigation

- **Ctrl+P** - Quick open file (fuzzy search)
- **Ctrl+B** - Toggle sidebar
- **Ctrl+\`** - Toggle terminal
- **Ctrl+Shift+G** - Toggle git panel

### File Operations

- **Ctrl+S** - Save file
- **Ctrl+W** - Close tab
- **Ctrl+N** - New file
- **Ctrl+O** - Open file (with browser)

### Editing

- **Ctrl+F** - Find in file
- **Ctrl+H** - Find and replace
- **Ctrl+/** - Toggle line comment
- **Ctrl+D** - Select next occurrence (multi-cursor)
- **Tab** - Indent / Accept autocomplete
- **Shift+Tab** - Outdent

### Git Integration

- **Ctrl+Shift+G** - Open git panel
- Click gutter indicators to view inline diffs
- In git panel:
  - **s** - Stage file
  - **u** - Unstage file
  - **c** - Commit
  - **r** - Revert changes

### Command Palette

Press **Ctrl+Shift+P** to open the command palette and search for any command.

## LSP Support

Ultra includes Language Server Protocol support for:
- TypeScript/JavaScript
- Python
- Go
- Rust
- And more...

Hover over symbols for documentation, use **F12** for "Go to Definition", and **Shift+F12** for "Find References".

## Configuration

Settings and keybindings can be customized in:
- `~/.ultra/settings.json`
- `~/.ultra/keybindings.json`

Themes are located in:
- `~/.ultra/themes/`

## Need Help?

- Press **Ctrl+Shift+P** and type "help" to see available commands
- Visit the documentation at: https://github.com/zorz/ultra

---

**Tip:** You can change what file opens on startup by editing the `workbench.startupEditor` setting.
Set it to `""` or `"none"` to start with an empty editor instead.
