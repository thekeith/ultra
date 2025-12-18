# Adding Commands Guide

This guide explains how to add new commands to Ultra.

## Overview

Commands in Ultra are named actions that can be:
- Executed from the command palette
- Bound to keyboard shortcuts
- Called programmatically

## Basic Command

### Step 1: Register the Command

In `src/app.ts`, add to the command registration section:

```typescript
commandRegistry.register({
  id: 'ultra.myCommand',
  title: 'My Category: My Command',
  handler: () => {
    // Your command logic here
    statusBar.setMessage('Command executed!', 2000);
  }
});
```

### Command Properties

| Property | Required | Description |
|----------|----------|-------------|
| `id` | Yes | Unique identifier (e.g., `ultra.myCommand`) |
| `title` | Yes | Display name (e.g., `Category: Action`) |
| `handler` | Yes | Function to execute |
| `category` | No | Category for grouping |

### Naming Conventions

**Command ID**: `ultra.<category>.<action>`
```
ultra.file.save
ultra.edit.undo
ultra.view.toggleSidebar
```

**Title**: `Category: Action Name`
```
File: Save
Edit: Undo
View: Toggle Sidebar
```

## Step 2: Add Keybinding (Optional)

Edit `config/default-keybindings.json`:

```json
{
  "keybindings": [
    {
      "key": "ctrl+shift+m",
      "command": "ultra.myCommand"
    }
  ]
}
```

### Key Format

```
[ctrl+][alt+][shift+][meta+]<key>

Examples:
  ctrl+s
  ctrl+shift+p
  alt+ArrowLeft
  F12
```

## Examples

### Simple Command

```typescript
commandRegistry.register({
  id: 'ultra.insertTimestamp',
  title: 'Edit: Insert Timestamp',
  handler: () => {
    const pane = paneManager.activePane;
    if (pane) {
      const timestamp = new Date().toISOString();
      pane.insertText(timestamp);
    }
  }
});
```

### Async Command

```typescript
commandRegistry.register({
  id: 'ultra.formatDocument',
  title: 'Edit: Format Document',
  handler: async () => {
    const pane = paneManager.activePane;
    if (!pane) return;

    statusBar.setMessage('Formatting...', 0);

    try {
      await lspManager.formatDocument(pane.document);
      statusBar.setMessage('Document formatted', 2000);
    } catch (error) {
      statusBar.setMessage(`Format failed: ${error.message}`, 3000);
    }
  }
});
```

### Command with Input

```typescript
commandRegistry.register({
  id: 'ultra.goToLine',
  title: 'Go: Go to Line',
  handler: () => {
    inputDialog.show({
      title: 'Go to Line',
      prompt: 'Enter line number:',
      placeholder: '1',
      onConfirm: (value) => {
        const line = parseInt(value, 10);
        if (!isNaN(line) && line > 0) {
          paneManager.activePane?.goToLine(line - 1);
        }
      }
    });
  }
});
```

### Command with Confirmation

```typescript
commandRegistry.register({
  id: 'ultra.deleteFile',
  title: 'File: Delete Current File',
  handler: () => {
    const pane = paneManager.activePane;
    if (!pane?.document.filePath) return;

    confirmDialog.show({
      title: 'Delete File',
      message: `Delete ${pane.document.filename}?`,
      confirmText: 'Delete',
      onConfirm: async () => {
        await Bun.file(pane.document.filePath).unlink();
        paneManager.closePane(pane);
      }
    });
  }
});
```

### Toggle Command

```typescript
let featureEnabled = false;

commandRegistry.register({
  id: 'ultra.toggleFeature',
  title: 'View: Toggle Feature',
  handler: () => {
    featureEnabled = !featureEnabled;

    const state = featureEnabled ? 'enabled' : 'disabled';
    statusBar.setMessage(`Feature ${state}`, 2000);

    renderScheduler.scheduleRender();
  }
});
```

## Context-Aware Commands

### Check Active Pane

```typescript
commandRegistry.register({
  id: 'ultra.duplicateLine',
  title: 'Edit: Duplicate Line',
  handler: () => {
    const pane = paneManager.activePane;
    if (!pane) {
      statusBar.setMessage('No active editor', 2000);
      return;
    }

    pane.duplicateCurrentLine();
  }
});
```

### Check Selection

```typescript
commandRegistry.register({
  id: 'ultra.uppercase',
  title: 'Edit: Transform to Uppercase',
  handler: () => {
    const pane = paneManager.activePane;
    if (!pane?.hasSelection()) {
      statusBar.setMessage('No text selected', 2000);
      return;
    }

    const selected = pane.getSelectedText();
    pane.replaceSelection(selected.toUpperCase());
  }
});
```

### Check File Type

```typescript
commandRegistry.register({
  id: 'ultra.runTypeScript',
  title: 'Run: Execute TypeScript',
  handler: () => {
    const pane = paneManager.activePane;
    const path = pane?.document.filePath;

    if (!path?.endsWith('.ts')) {
      statusBar.setMessage('Not a TypeScript file', 2000);
      return;
    }

    terminalPane.execute(`bun ${path}`);
  }
});
```

## Command Groups

### Multi-Step Commands (Chords)

For commands that require multiple key presses:

```json
{
  "keybindings": [
    {
      "key": "ctrl+k ctrl+c",
      "command": "ultra.commentLine"
    },
    {
      "key": "ctrl+k ctrl+u",
      "command": "ultra.uncommentLine"
    }
  ]
}
```

### Related Commands

Group related commands with consistent naming:

```typescript
// Selection commands
commandRegistry.register({
  id: 'ultra.selection.expandToWord',
  title: 'Selection: Expand to Word',
  handler: () => { /* ... */ }
});

commandRegistry.register({
  id: 'ultra.selection.expandToLine',
  title: 'Selection: Expand to Line',
  handler: () => { /* ... */ }
});

commandRegistry.register({
  id: 'ultra.selection.expandToBrackets',
  title: 'Selection: Expand to Brackets',
  handler: () => { /* ... */ }
});
```

## Best Practices

### 1. Handle Errors Gracefully

```typescript
handler: async () => {
  try {
    await doSomething();
  } catch (error) {
    statusBar.setMessage(`Error: ${error.message}`, 3000);
    debugLog('Command error:', error);
  }
}
```

### 2. Provide Feedback

```typescript
handler: () => {
  // Show progress for long operations
  statusBar.setMessage('Working...', 0);

  // Show result
  statusBar.setMessage('Done!', 2000);
}
```

### 3. Check Prerequisites

```typescript
handler: () => {
  // Check for required state
  if (!paneManager.activePane) {
    statusBar.setMessage('No active editor', 2000);
    return;
  }

  // Proceed with command
}
```

### 4. Make Commands Idempotent

Commands should be safe to run multiple times:

```typescript
// ✅ Good - toggle state
handler: () => {
  sidebar.toggle();
}

// ❌ Bad - only shows, never hides
handler: () => {
  sidebar.show();
}
```

### 5. Use Async for I/O

```typescript
// ✅ Good - async for file operations
handler: async () => {
  const content = await Bun.file(path).text();
}

// ❌ Bad - blocking I/O
handler: () => {
  const content = require('fs').readFileSync(path);
}
```

## Testing Commands

### Manual Testing

1. Run Ultra with debug mode:
   ```bash
   bun src/index.ts --debug
   ```

2. Open command palette (`Ctrl+P`)

3. Find and execute your command

4. Check `debug.log` for errors

### Automated Testing

```typescript
import { test, expect } from 'bun:test';
import { commandRegistry } from '../src/input/commands.ts';

test('my command is registered', () => {
  expect(commandRegistry.has('ultra.myCommand')).toBe(true);
});

test('my command executes', async () => {
  await commandRegistry.execute('ultra.myCommand');
  // Assert expected state change
});
```

## Troubleshooting

### Command Not Found

- Check the command ID matches exactly
- Ensure the command is registered before use
- Check for typos in keybinding config

### Keybinding Not Working

- Check for conflicts with existing bindings
- Verify the key format is correct
- Test with command palette first

### Command Fails Silently

- Add debug logging
- Check for missing null checks
- Wrap in try/catch

## Related Documentation

- [Commands Module](../modules/commands.md) - Command system details
- [Keybindings](../architecture/keybindings.md) - Key handling
- [Contributing](contributing.md) - Code standards
