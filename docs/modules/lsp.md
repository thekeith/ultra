# LSP Module

The LSP (Language Server Protocol) module provides IDE features like autocomplete, go-to-definition, and diagnostics.

## Overview

Ultra implements an LSP client that communicates with language servers for:

- **Autocomplete** - Intelligent code suggestions
- **Hover** - Documentation on hover
- **Go to Definition** - Jump to symbol definition
- **Find References** - Find all usages
- **Diagnostics** - Errors and warnings
- **Rename** - Symbol renaming
- **Signature Help** - Function parameter hints

## Location

```
src/features/lsp/
├── index.ts           # Module exports
├── manager.ts         # LSP connection manager
├── client.ts          # Language server client
├── providers.ts       # LSP feature providers
├── autocomplete-popup.ts
├── hover-tooltip.ts
├── signature-help.ts
└── diagnostics-renderer.ts
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        LSP Manager                                   │
│  - Manages connections to multiple language servers                 │
│  - Routes requests to appropriate server                            │
│  - Handles server lifecycle                                         │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
          ┌─────────────────┐       ┌─────────────────┐
          │   LSP Client    │       │   LSP Client    │
          │  (TypeScript)   │       │    (Python)     │
          └────────┬────────┘       └────────┬────────┘
                   │                         │
                   ▼                         ▼
          ┌─────────────────┐       ┌─────────────────┐
          │    tsserver     │       │    pyright      │
          │   (process)     │       │   (process)     │
          └─────────────────┘       └─────────────────┘
```

## LSP Manager

### Initialization

```typescript
import lspManager from './features/lsp/manager.ts';

// Start LSP for a language
await lspManager.startServer('typescript');

// Or auto-detect from file
await lspManager.ensureServerForFile('/path/to/file.ts');
```

### Supported Languages

| Language | Server | Command |
|----------|--------|---------|
| TypeScript/JavaScript | tsserver | `typescript-language-server --stdio` |
| Python | pyright | `pyright-langserver --stdio` |
| Go | gopls | `gopls serve` |
| Rust | rust-analyzer | `rust-analyzer` |
| C/C++ | clangd | `clangd` |

### Configuration

Language servers are configured in settings:

```json
{
  "lsp.servers": {
    "typescript": {
      "command": "typescript-language-server",
      "args": ["--stdio"],
      "rootPatterns": ["tsconfig.json", "package.json"]
    },
    "python": {
      "command": "pyright-langserver",
      "args": ["--stdio"],
      "rootPatterns": ["pyproject.toml", "setup.py"]
    }
  }
}
```

## LSP Client

### Document Synchronization

```typescript
// Open document
await client.didOpen({
  textDocument: {
    uri: `file://${filePath}`,
    languageId: 'typescript',
    version: 1,
    text: content
  }
});

// Document changed
await client.didChange({
  textDocument: { uri, version: 2 },
  contentChanges: [{ text: newContent }]
});

// Document saved
await client.didSave({
  textDocument: { uri }
});

// Document closed
await client.didClose({
  textDocument: { uri }
});
```

### Request/Response

```typescript
// Completion request
const completions = await client.completion({
  textDocument: { uri },
  position: { line: 10, character: 5 }
});

// Hover request
const hover = await client.hover({
  textDocument: { uri },
  position: { line: 10, character: 5 }
});

// Definition request
const definition = await client.definition({
  textDocument: { uri },
  position: { line: 10, character: 5 }
});

// References request
const references = await client.references({
  textDocument: { uri },
  position: { line: 10, character: 5 },
  context: { includeDeclaration: true }
});
```

## Feature Providers

### Autocomplete

```typescript
// providers.ts
class CompletionProvider {
  async provideCompletions(
    document: Document,
    position: Position
  ): Promise<CompletionItem[]> {
    const client = lspManager.getClientForDocument(document);
    if (!client) return [];

    const result = await client.completion({
      textDocument: { uri: document.uri },
      position
    });

    return result.items.map(item => ({
      label: item.label,
      kind: item.kind,
      detail: item.detail,
      insertText: item.insertText || item.label
    }));
  }
}
```

### Hover Tooltip

```typescript
class HoverProvider {
  async provideHover(
    document: Document,
    position: Position
  ): Promise<Hover | null> {
    const client = lspManager.getClientForDocument(document);
    if (!client) return null;

    const hover = await client.hover({
      textDocument: { uri: document.uri },
      position
    });

    return hover ? {
      contents: this.parseMarkdown(hover.contents),
      range: hover.range
    } : null;
  }
}
```

### Diagnostics

```typescript
// Diagnostics are pushed from the server
client.on('textDocument/publishDiagnostics', (params) => {
  const { uri, diagnostics } = params;

  diagnosticsRenderer.setDiagnostics(uri, diagnostics.map(d => ({
    range: d.range,
    severity: d.severity,  // 1=Error, 2=Warning, 3=Info, 4=Hint
    message: d.message,
    source: d.source
  })));

  renderScheduler.scheduleRender();
});
```

## UI Components

### Autocomplete Popup

```typescript
// autocomplete-popup.ts
class AutocompletePopup {
  private items: CompletionItem[] = [];
  private selectedIndex: number = 0;

  show(items: CompletionItem[], position: Position): void {
    this.items = items;
    this.selectedIndex = 0;
    this.visible = true;
    renderScheduler.scheduleRender();
  }

  handleKey(event: KeyEvent): boolean {
    switch (event.key) {
      case 'ArrowDown':
        this.selectedIndex = Math.min(
          this.selectedIndex + 1,
          this.items.length - 1
        );
        return true;
      case 'ArrowUp':
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        return true;
      case 'Enter':
      case 'Tab':
        this.acceptSelected();
        return true;
      case 'Escape':
        this.hide();
        return true;
    }
    return false;
  }
}
```

### Hover Tooltip

```typescript
// hover-tooltip.ts
class HoverTooltip {
  async showAtPosition(document: Document, position: Position): Promise<void> {
    const hover = await hoverProvider.provideHover(document, position);
    if (hover) {
      this.content = hover.contents;
      this.visible = true;
      renderScheduler.scheduleRender();
    }
  }

  render(rect: Rect): void {
    if (!this.visible) return;

    // Draw tooltip box
    // Render markdown content
  }
}
```

### Diagnostics Renderer

```typescript
// diagnostics-renderer.ts
class DiagnosticsRenderer {
  renderGutterMarkers(lineNumber: number): void {
    const diagnostics = this.getDiagnosticsForLine(lineNumber);
    if (diagnostics.length === 0) return;

    // Show error/warning icon in gutter
    const severity = Math.min(...diagnostics.map(d => d.severity));
    const icon = severity === 1 ? '●' : severity === 2 ? '▲' : 'ℹ';
    const color = severity === 1 ? '#ff5555' : severity === 2 ? '#ffaa00' : '#5555ff';

    process.stdout.write(fgHex(color) + icon + RESET);
  }

  renderUnderlines(line: string, lineNumber: number): void {
    const diagnostics = this.getDiagnosticsForLine(lineNumber);
    for (const d of diagnostics) {
      // Draw squiggly underline under the error range
    }
  }
}
```

## Error Handling

```typescript
// Handle server crashes
client.on('error', (error) => {
  debugLog(`LSP error: ${error.message}`);
  statusBar.setMessage(`Language server error: ${error.message}`, 5000);
});

// Handle server exit
client.on('exit', (code) => {
  debugLog(`LSP server exited with code ${code}`);
  // Attempt restart
  setTimeout(() => lspManager.restartServer(languageId), 1000);
});
```

## Performance

### Request Debouncing

```typescript
// Debounce completion requests while typing
private completionTimer: Timer | null = null;

triggerCompletion(document: Document, position: Position): void {
  if (this.completionTimer) {
    clearTimeout(this.completionTimer);
  }

  this.completionTimer = setTimeout(async () => {
    const items = await this.provideCompletions(document, position);
    this.autocompletePopup.show(items, position);
  }, 100);  // 100ms debounce
}
```

### Incremental Sync

For large files, use incremental document sync:

```typescript
// Only send changed ranges, not full document
await client.didChange({
  textDocument: { uri, version },
  contentChanges: [{
    range: {
      start: { line: 5, character: 0 },
      end: { line: 5, character: 10 }
    },
    text: 'new text'
  }]
});
```

## Debugging

Enable LSP debug logging:

```bash
ultra --debug myfile.ts
# LSP messages logged to debug.log
```

Log format:
```
[LSP] -> initialize {...}
[LSP] <- initialize result {...}
[LSP] -> textDocument/didOpen {...}
[LSP] <- textDocument/publishDiagnostics {...}
```

## Related Modules

- [Commands](commands.md) - LSP commands (goToDefinition, findReferences)
- [Rendering](../architecture/rendering.md) - Diagnostic rendering
