# Data Flow

This document describes how data flows through Ultra, from user input to screen output.

## Overview

Ultra follows a unidirectional data flow pattern:

```
Input → Parse → Command → State Update → Render
```

## Input Processing

### Keyboard Input Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Terminal Input                               │
│                     (raw bytes from stdin)                          │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Input Parser (input.ts)                         │
│  - Parses escape sequences                                          │
│  - Identifies special keys (arrows, function keys, etc.)            │
│  - Detects modifier keys (ctrl, alt, shift, meta)                   │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Key Event                                    │
│  { key: 's', ctrl: true, shift: false, alt: false, meta: false }    │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Keymap Resolution (keymap.ts)                    │
│  - Converts event to key string: "ctrl+s"                           │
│  - Looks up command binding                                         │
│  - Returns command ID: "ultra.save"                                 │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Command Execution (commands.ts)                    │
│  - Looks up handler for command ID                                  │
│  - Executes handler with current context                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Mouse Input Flow

```
Mouse Event (ANSI escape sequence)
         │
         ▼
┌─────────────────┐
│   Mouse Parser  │
│   (mouse.ts)    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Mouse Event                                   │
│  { x, y, button, action: 'click' | 'drag' | 'scroll' }             │
└────────────────────────────────┬────────────────────────────────────┘
         │
         ├────────────────────────┬────────────────────────┐
         ▼                        ▼                        ▼
┌─────────────┐          ┌─────────────┐          ┌─────────────┐
│  Layout     │          │   Hit Test  │          │  Component  │
│  Manager    │          │  (find pane)│          │  Handler    │
└─────────────┘          └─────────────┘          └─────────────┘
```

## Text Editing Flow

### Character Insertion

```
Key Press ('a')
      │
      ▼
┌─────────────────┐
│ Active Pane     │
│ handleChar('a') │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Cursor Manager  │
│ (get position)  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Document                                     │
│                                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │ insertAt()  │───▶│   Buffer    │───▶│ Undo Stack  │             │
│  │             │    │ (piece tbl) │    │ (snapshot)  │             │
│  └─────────────┘    └─────────────┘    └─────────────┘             │
│                                                                      │
└────────────────────────────────┬────────────────────────────────────┘
         │
         ├──────────────────────────────────────────┐
         ▼                                          ▼
┌─────────────────┐                        ┌─────────────────┐
│ LSP Notification│                        │ Syntax Highlight│
│ (didChange)     │                        │ (invalidate)    │
└─────────────────┘                        └────────┬────────┘
                                                    │
                                                    ▼
                                           ┌─────────────────┐
                                           │ scheduleRender()│
                                           └─────────────────┘
```

### Buffer Operations

The piece table buffer tracks text efficiently:

```
Initial State:
  originalBuffer: "Hello World"
  addBuffer: ""
  pieces: [{ source: 'original', start: 0, length: 11 }]

After Insert " Beautiful" at position 5:
  originalBuffer: "Hello World"
  addBuffer: " Beautiful"
  pieces: [
    { source: 'original', start: 0, length: 5 },   // "Hello"
    { source: 'add', start: 0, length: 10 },       // " Beautiful"
    { source: 'original', start: 5, length: 6 }    // " World"
  ]

Result: "Hello Beautiful World"
```

## File Operations

### File Open Flow

```
Command: open file.ts
         │
         ▼
┌─────────────────┐
│ Pane Manager    │
│ openFile()      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Document.open()                               │
│  1. Read file content (Bun.file().text())                           │
│  2. Create Buffer with content                                       │
│  3. Detect language from extension                                   │
│  4. Initialize undo history                                         │
└────────────────────────────────┬────────────────────────────────────┘
         │
         ├──────────────────────────────────────────┐
         ▼                                          ▼
┌─────────────────┐                        ┌─────────────────┐
│ LSP Manager     │                        │ Syntax Manager  │
│ didOpen()       │                        │ loadLanguage()  │
└─────────────────┘                        └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Tab Bar Update  │
│ Add new tab     │
└─────────────────┘
```

### File Save Flow

```
Command: save
         │
         ▼
┌─────────────────┐
│ Active Pane     │
│ save()          │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Document.save()                               │
│  1. Get buffer content                                              │
│  2. Write to file (Bun.write())                                     │
│  3. Clear dirty flag                                                │
│  4. Update undo checkpoint                                          │
└────────────────────────────────┬────────────────────────────────────┘
         │
         ├──────────────────────────────────────────┐
         ▼                                          ▼
┌─────────────────┐                        ┌─────────────────┐
│ LSP Manager     │                        │ Status Bar      │
│ didSave()       │                        │ "File saved"    │
└─────────────────┘                        └─────────────────┘
```

## LSP Data Flow

### Autocomplete Flow

```
User Types Character
         │
         ▼
┌─────────────────┐
│ LSP Provider    │
│ triggerComplete │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      LSP Client                                      │
│  textDocument/completion request                                     │
│  { uri, position: { line, character } }                             │
└────────────────────────────────┬────────────────────────────────────┘
         │ JSON-RPC over stdio
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Language Server                                   │
│              (tsserver, pyright, etc.)                              │
└────────────────────────────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Completion Response                                │
│  { items: [{ label, kind, insertText, ... }] }                      │
└────────────────────────────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ Autocomplete    │
│ Popup           │
│ (show items)    │
└─────────────────┘
```

### Document Sync

```
Document Modified
         │
         ├──────────────────────────────────────────┐
         ▼                                          │
┌─────────────────────────────────────────────────┐ │
│              LSP didChange                      │ │
│  Full sync: entire document content             │ │
│  Incremental: only changed ranges               │ │
└─────────────────────────────────┬───────────────┘ │
         │                                          │
         ▼                                          │
┌─────────────────────────────────────────────────┐ │
│           Language Server                        │ │
│  - Updates internal document model              │ │
│  - Runs diagnostics                             │ │
│  - Returns publishDiagnostics                   │ │
└─────────────────────────────────┬───────────────┘ │
         │                                          │
         ▼                                          │
┌─────────────────────────────────────────────────┐ │
│         Diagnostics Renderer                     │◀┘
│  - Updates error/warning markers                │
│  - Schedules re-render                          │
└─────────────────────────────────────────────────┘
```

## Git Data Flow

### Status Update Flow

```
File Modified / Timer Tick / Manual Refresh
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Git Integration                                 │
│  await $`git status --porcelain`                                    │
│  await $`git diff --numstat`                                        │
└────────────────────────────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Parse Output                                  │
│  - Staged files (A, M, D, R)                                        │
│  - Modified files (not staged)                                      │
│  - Untracked files                                                  │
└────────────────────────────────┬────────────────────────────────────┘
         │
         ├──────────────────────────────────────────┐
         ▼                                          ▼
┌─────────────────┐                        ┌─────────────────┐
│ Git Panel       │                        │ Pane Gutter     │
│ Update list     │                        │ Show indicators │
└─────────────────┘                        └─────────────────┘
```

## State Management

### Editor State

```typescript
// Centralized state in editor-state.ts
interface EditorState {
  // Pane state
  activePane: Pane | null;
  panes: Pane[];

  // UI state
  sidebarVisible: boolean;
  terminalVisible: boolean;

  // Editor state
  focusedComponent: 'editor' | 'sidebar' | 'terminal' | 'dialog';

  // Search state
  searchQuery: string;
  searchResults: SearchResult[];
}
```

### State Update Pattern

```typescript
// State updates trigger renders
editorState.setActivePane(pane);
// Internally:
//   1. Update state
//   2. Emit 'activePaneChanged' event
//   3. Listeners call scheduleRender()
```

## Render Data Flow

See [Rendering Architecture](rendering.md) for detailed render pipeline.

```
State Change
      │
      ▼
scheduleRender()
      │
      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Render Pass                                       │
│                                                                      │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐        │
│  │ Tab Bar   │  │ Editor    │  │ Sidebar   │  │ Status Bar│        │
│  │ render()  │  │ render()  │  │ render()  │  │ render()  │        │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘        │
│        │              │              │              │                │
│        └──────────────┴──────────────┴──────────────┘                │
│                              │                                       │
│                              ▼                                       │
│                    ┌─────────────────┐                              │
│                    │ ANSI Sequences  │                              │
│                    │ (terminal out)  │                              │
│                    └─────────────────┘                              │
└─────────────────────────────────────────────────────────────────────┘
```

## Event System

### Event Emitter Pattern

```typescript
// Components emit events
document.emit('contentChanged', { range, text });

// Other components listen
lspManager.on('document:contentChanged', (event) => {
  this.sendDidChange(document, event);
});
```

### Common Events

| Event | Source | Listeners |
|-------|--------|-----------|
| `contentChanged` | Document | LSP, Syntax, Git |
| `cursorMoved` | Cursor | LSP Hover, Status Bar |
| `fileSaved` | Document | LSP, Git |
| `focusChanged` | Pane Manager | Status Bar, Keymap |
| `themeChanged` | Settings | All renderers |
