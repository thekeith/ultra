# Keybindings Architecture

This document explains how Ultra handles keyboard input, from raw terminal bytes to command execution.

## Overview

Ultra's keybinding system consists of several layers:

```
Terminal Input (raw bytes)
         │
         ▼
Input Parser (escape sequences → KeyEvent)
         │
         ▼
Keymap (KeyEvent → command string)
         │
         ▼
Command Registry (command string → handler function)
         │
         ▼
Command Execution
```

## Input Parsing

### Raw Input (`terminal/input.ts`)

The terminal is set to raw mode, meaning each keystroke is sent immediately without waiting for Enter. Input arrives as:

- **Printable characters**: Single bytes (ASCII) or multi-byte sequences (UTF-8)
- **Control characters**: `Ctrl+A` = byte 0x01, `Ctrl+Z` = byte 0x1A
- **Escape sequences**: Start with ESC (0x1B), encode special keys

### Escape Sequences

Common escape sequences:

| Key | Sequence |
|-----|----------|
| Arrow Up | `\x1b[A` |
| Arrow Down | `\x1b[B` |
| Arrow Right | `\x1b[C` |
| Arrow Left | `\x1b[D` |
| Home | `\x1b[H` |
| End | `\x1b[F` |
| F1-F4 | `\x1bOP` - `\x1bOS` |
| F5-F12 | `\x1b[15~` - `\x1b[24~` |
| Shift+Arrow | `\x1b[1;2A` (A/B/C/D) |
| Ctrl+Arrow | `\x1b[1;5A` |
| Alt+Arrow | `\x1b[1;3A` |

### Modifier Encoding

Modifiers are encoded in escape sequences:

```
ESC [ 1 ; <modifier> <key>

modifier = 1 + (shift ? 1 : 0) + (alt ? 2 : 0) + (ctrl ? 4 : 0) + (meta ? 8 : 0)

Examples:
  Shift       = 2
  Alt         = 3
  Ctrl        = 5
  Ctrl+Shift  = 6
  Ctrl+Alt    = 7
```

### KeyEvent Structure

```typescript
interface KeyEvent {
  key: string;       // The key name ('a', 'Enter', 'ArrowUp', 'F1')
  char?: string;     // The actual character if printable
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}
```

## Keymap (`input/keymap.ts`)

### Key String Format

Keys are converted to a normalized string format:

```
[ctrl+][alt+][shift+][meta+]<key>

Examples:
  ctrl+s
  ctrl+shift+p
  alt+ArrowLeft
  F12
```

### Binding Resolution

```typescript
// keymap.ts
class Keymap {
  private bindings: Map<string, string>;

  getCommand(event: KeyEvent): string | null {
    const keyStr = this.keyToString(event);
    return this.bindings.get(keyStr) ?? null;
  }

  keyToString(event: KeyEvent): string {
    const parts: string[] = [];
    if (event.ctrl) parts.push('ctrl');
    if (event.alt) parts.push('alt');
    if (event.shift) parts.push('shift');
    if (event.meta) parts.push('meta');
    parts.push(event.key.toLowerCase());
    return parts.join('+');
  }
}
```

### Keybinding Sources

Keybindings are loaded from multiple sources (in priority order):

1. **User keybindings** (`~/.config/ultra/keybindings.json`) - Highest priority
2. **Default keybindings** (`config/default-keybindings.json`)

```typescript
// keybindings-loader.ts
async function loadKeybindings(): Promise<void> {
  // Load defaults first
  const defaults = await loadDefaultKeybindings();

  // Merge user keybindings (override defaults)
  const userPath = getUserKeybindingsPath();
  if (await Bun.file(userPath).exists()) {
    const user = await loadUserKeybindings();
    merge(defaults, user);
  }

  keymap.setBindings(defaults);
}
```

### Keybinding Format

```json
{
  "keybindings": [
    {
      "key": "ctrl+s",
      "command": "ultra.save"
    },
    {
      "key": "ctrl+shift+p",
      "command": "ultra.commandPalette"
    },
    {
      "key": "ctrl+d",
      "command": "ultra.selectNextOccurrence",
      "when": "editorTextFocus"
    }
  ]
}
```

### Context Conditions (`when`)

Some keybindings only apply in certain contexts:

| Context | Description |
|---------|-------------|
| `editorTextFocus` | Editor has focus |
| `sidebarFocus` | Sidebar/file tree has focus |
| `terminalFocus` | Terminal panel has focus |
| `dialogOpen` | A dialog is open |
| `autocompleteVisible` | Autocomplete popup is showing |

## Command Registry (`input/commands.ts`)

### Command Structure

```typescript
interface Command {
  id: string;
  title: string;
  handler: () => void | Promise<void>;
  category?: string;
}

// Registry
class CommandRegistry {
  private commands: Map<string, Command>;

  register(command: Command): void {
    this.commands.set(command.id, command);
  }

  execute(id: string): Promise<void> {
    const command = this.commands.get(id);
    if (command) {
      return Promise.resolve(command.handler());
    }
    throw new Error(`Unknown command: ${id}`);
  }
}
```

### Command Registration

Commands are registered during application startup:

```typescript
// app.ts - command registration
commandRegistry.register({
  id: 'ultra.save',
  title: 'File: Save',
  handler: () => this.save()
});

commandRegistry.register({
  id: 'ultra.commandPalette',
  title: 'View: Command Palette',
  handler: () => this.showCommandPalette()
});
```

### Command Categories

Commands are organized into categories for the command palette:

- **File**: save, saveAs, open, close
- **Edit**: undo, redo, cut, copy, paste
- **Selection**: selectAll, selectLine, selectWord
- **View**: toggleSidebar, toggleTerminal, splitPane
- **Go**: goToLine, goToDefinition, goToFile
- **Search**: find, findInFiles, replace

## Input Handling Flow

### Main Event Loop

```typescript
// app.ts
private async handleKeyEvent(event: KeyEvent): Promise<void> {
  // 1. Check for dialog handlers first
  if (this.activeDialog) {
    this.activeDialog.handleKey(event);
    return;
  }

  // 2. Check for autocomplete
  if (this.autocomplete.isVisible()) {
    if (this.autocomplete.handleKey(event)) {
      return;
    }
  }

  // 3. Try to resolve command
  const commandId = keymap.getCommand(event);

  if (commandId) {
    await commandRegistry.execute(commandId);
    return;
  }

  // 4. If printable character, insert into editor
  if (event.char && !event.ctrl && !event.alt && !event.meta) {
    this.activePane?.insertChar(event.char);
  }
}
```

### Focus-Based Routing

Different components handle input based on focus:

```typescript
switch (editorState.focusedComponent) {
  case 'editor':
    return this.handleEditorKey(event);

  case 'sidebar':
    return this.handleSidebarKey(event);

  case 'terminal':
    return this.handleTerminalKey(event);

  case 'dialog':
    return this.activeDialog.handleKey(event);
}
```

## Multi-Key Sequences

Some commands use multi-key sequences (chords):

```
Ctrl+K, Ctrl+C  → Comment selection
Ctrl+D, A       → Select all occurrences
```

### Chord Implementation

```typescript
class Keymap {
  private pendingChord: string | null = null;

  handleKey(event: KeyEvent): string | null {
    const keyStr = this.keyToString(event);

    if (this.pendingChord) {
      // Check for chord completion
      const chordKey = `${this.pendingChord} ${keyStr}`;
      const command = this.bindings.get(chordKey);
      this.pendingChord = null;

      if (command) return command;
      return null; // Chord didn't match
    }

    // Check if this starts a chord
    if (this.isChordStart(keyStr)) {
      this.pendingChord = keyStr;
      return null; // Wait for next key
    }

    return this.bindings.get(keyStr) ?? null;
  }
}
```

## Default Keybindings Reference

### File Operations

| Key | Command |
|-----|---------|
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save As |
| `Ctrl+N` | New File |
| `Ctrl+O` | Open File |
| `Ctrl+W` | Close Tab |
| `Ctrl+Q` | Quit |

### Navigation

| Key | Command |
|-----|---------|
| `Ctrl+G` | Go to Line |
| `F12` | Go to Definition |
| `Shift+F12` | Find References |
| `Ctrl+]` | Quick Open File |
| `Ctrl+P` | Command Palette |

### Editing

| Key | Command |
|-----|---------|
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+X` | Cut |
| `Ctrl+C` | Copy |
| `Ctrl+V` | Paste |
| `Ctrl+D` | Select Next Occurrence |
| `Ctrl+L` | Select Line |
| `Tab` | Indent |
| `Shift+Tab` | Outdent |

### Multi-Cursor

| Key | Command |
|-----|---------|
| `Ctrl+U` | Add Cursor Above |
| `Ctrl+J` | Add Cursor Below |
| `Ctrl+Shift+L` | Split Selection into Lines |
| `Ctrl+D` | Select Next Occurrence |
| `Ctrl+D A` | Select All Occurrences |

### View

| Key | Command |
|-----|---------|
| `Ctrl+B` | Toggle Sidebar |
| `` Ctrl+` `` | Toggle Terminal |
| `Ctrl+\` | Split Vertical |
| `Ctrl+Shift+\` | Split Horizontal |
| `Ctrl+Shift+G` | Toggle Git Panel |

## Customization

### Adding Custom Keybindings

Create or edit `~/.config/ultra/keybindings.json`:

```json
{
  "keybindings": [
    {
      "key": "ctrl+shift+d",
      "command": "ultra.duplicateLine"
    },
    {
      "key": "ctrl+k ctrl+f",
      "command": "ultra.formatDocument"
    }
  ]
}
```

### Removing Default Keybindings

Set command to empty string to unbind:

```json
{
  "keybindings": [
    {
      "key": "ctrl+d",
      "command": ""
    }
  ]
}
```

### Viewing Active Keybindings

The debug mode shows key events in the status bar:

```bash
ultra --debug myfile.ts
# Status bar shows: Key: C+s | Parsed: ctrl+s -> ultra.save
```
