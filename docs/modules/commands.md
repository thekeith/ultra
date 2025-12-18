# Commands Module

The Commands module provides Ultra's command registration and execution system.

## Overview

Commands are named actions that can be:
- Bound to keyboard shortcuts
- Executed from the command palette
- Called programmatically

## Location

```
src/input/commands.ts
```

## Key Concepts

### Command Structure

```typescript
interface Command {
  id: string;           // Unique identifier, e.g., "ultra.save"
  title: string;        // Display name, e.g., "File: Save"
  handler: () => void | Promise<void>;
  category?: string;    // For grouping in palette
}
```

### Command IDs

Command IDs follow the pattern `ultra.<action>`:

```
ultra.save
ultra.saveAs
ultra.undo
ultra.redo
ultra.toggleSidebar
ultra.goToLine
```

## API Reference

### CommandRegistry

```typescript
import { commandRegistry } from './input/commands.ts';

// Register a command
commandRegistry.register({
  id: 'ultra.myCommand',
  title: 'My Command',
  handler: () => {
    console.log('Command executed!');
  }
});

// Execute a command by ID
await commandRegistry.execute('ultra.myCommand');

// Get all registered commands
const commands = commandRegistry.getAll();

// Check if command exists
const exists = commandRegistry.has('ultra.myCommand');

// Get command by ID
const command = commandRegistry.get('ultra.myCommand');
```

## Registering Commands

### Basic Registration

```typescript
commandRegistry.register({
  id: 'ultra.duplicateLine',
  title: 'Edit: Duplicate Line',
  handler: () => {
    const pane = app.getActivePane();
    pane?.duplicateCurrentLine();
  }
});
```

### Async Commands

```typescript
commandRegistry.register({
  id: 'ultra.formatDocument',
  title: 'Edit: Format Document',
  handler: async () => {
    const pane = app.getActivePane();
    await lspManager.formatDocument(pane.document);
  }
});
```

### With Category

```typescript
commandRegistry.register({
  id: 'ultra.newFile',
  title: 'New File',
  category: 'File',
  handler: () => app.newFile()
});
```

## Built-in Commands

### File Commands

| ID | Title | Description |
|----|-------|-------------|
| `ultra.save` | File: Save | Save current file |
| `ultra.saveAs` | File: Save As | Save with new name |
| `ultra.newFile` | File: New File | Create new file |
| `ultra.openFile` | File: Open File | Open file picker |
| `ultra.closeTab` | File: Close Tab | Close current tab |
| `ultra.quit` | File: Quit | Exit Ultra |

### Edit Commands

| ID | Title | Description |
|----|-------|-------------|
| `ultra.undo` | Edit: Undo | Undo last change |
| `ultra.redo` | Edit: Redo | Redo last undo |
| `ultra.cut` | Edit: Cut | Cut selection |
| `ultra.copy` | Edit: Copy | Copy selection |
| `ultra.paste` | Edit: Paste | Paste clipboard |
| `ultra.selectAll` | Edit: Select All | Select all text |
| `ultra.selectLine` | Edit: Select Line | Select current line |

### View Commands

| ID | Title | Description |
|----|-------|-------------|
| `ultra.toggleSidebar` | View: Toggle Sidebar | Show/hide file tree |
| `ultra.toggleTerminal` | View: Toggle Terminal | Show/hide terminal |
| `ultra.toggleGitPanel` | View: Toggle Git Panel | Show/hide git panel |
| `ultra.commandPalette` | View: Command Palette | Open command palette |
| `ultra.splitVertical` | View: Split Vertical | Split pane vertically |
| `ultra.splitHorizontal` | View: Split Horizontal | Split pane horizontally |

### Navigation Commands

| ID | Title | Description |
|----|-------|-------------|
| `ultra.goToLine` | Go: Go to Line | Jump to line number |
| `ultra.goToFile` | Go: Quick Open | Fuzzy file finder |
| `ultra.goToDefinition` | Go: Go to Definition | LSP definition |
| `ultra.findReferences` | Go: Find References | LSP references |

### Search Commands

| ID | Title | Description |
|----|-------|-------------|
| `ultra.find` | Search: Find | Find in file |
| `ultra.findInFiles` | Search: Find in Files | Project-wide search |
| `ultra.replace` | Search: Replace | Find and replace |

### Multi-Cursor Commands

| ID | Title | Description |
|----|-------|-------------|
| `ultra.addCursorAbove` | Selection: Add Cursor Above | Add cursor on line above |
| `ultra.addCursorBelow` | Selection: Add Cursor Below | Add cursor on line below |
| `ultra.selectNextOccurrence` | Selection: Select Next | Select next match |
| `ultra.selectAllOccurrences` | Selection: Select All | Select all matches |

## Command Palette Integration

Commands appear in the command palette (`Ctrl+P`):

```typescript
// In command-palette.ts
const items = commandRegistry.getAll()
  .map(cmd => ({
    label: cmd.title,
    id: cmd.id,
    category: cmd.category
  }))
  .sort((a, b) => a.label.localeCompare(b.label));
```

### Filtering

The palette filters commands by:
1. Title text match
2. Category prefix
3. Command ID (partial match)

## Keybinding Integration

Commands are bound to keys in keybindings:

```json
{
  "keybindings": [
    {
      "key": "ctrl+s",
      "command": "ultra.save"
    }
  ]
}
```

When a key is pressed, the keymap resolves it to a command ID, which is then executed:

```typescript
// In keymap.ts
const commandId = keymap.getCommand(keyEvent);
if (commandId) {
  await commandRegistry.execute(commandId);
}
```

## Creating Custom Commands

### In a Plugin/Extension

```typescript
// my-extension.ts
import { commandRegistry } from './input/commands.ts';

export function activate() {
  commandRegistry.register({
    id: 'ultra.myExtension.doThing',
    title: 'My Extension: Do Thing',
    category: 'My Extension',
    handler: () => {
      // Extension logic
    }
  });
}
```

### With Keybinding

Add to `~/.config/ultra/keybindings.json`:

```json
{
  "keybindings": [
    {
      "key": "ctrl+shift+t",
      "command": "ultra.myExtension.doThing"
    }
  ]
}
```

## Error Handling

```typescript
// Commands should handle their own errors
commandRegistry.register({
  id: 'ultra.riskyOperation',
  title: 'Risky Operation',
  handler: async () => {
    try {
      await doRiskyThing();
    } catch (error) {
      statusBar.setMessage(`Error: ${error.message}`, 5000);
    }
  }
});
```

## Best Practices

1. **Use descriptive IDs** - `ultra.category.action` format
2. **Provide clear titles** - "Category: Action" format
3. **Handle errors gracefully** - Don't let errors bubble up
4. **Make commands idempotent** - Safe to run multiple times
5. **Use async when needed** - For I/O operations

## Related Modules

- [Keymap](architecture/keybindings.md) - Keyboard shortcut resolution
- [Command Palette](src/ui/components/command-palette.ts) - UI for command discovery
