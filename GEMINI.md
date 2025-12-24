# GEMINI.md

This document provides a comprehensive overview of the Ultra project, its structure, and development guidelines to be used as instructional context for future interactions.

## Project Overview

Ultra is a terminal-native code editor built with Bun and TypeScript. It aims to provide a high-performance editing experience with modern IDE features and a user experience inspired by Sublime Text and VS Code.

**Core Vision:**
Ultra is evolving from a monolithic application into a modular **Editor Command Protocol (ECP) Server** architecture. This decoupling enables headless operation, multiple client types (TUI, GUI, AI Agents), and a robust plugin system.

**Key Technologies:**
- **Runtime:** Bun
- **Language:** TypeScript (strict mode)
- **Terminal Integration:** Custom TUI engine (rendering, input) + `bun-pty`/`node-pty` for terminal sessions.
- **Syntax Highlighting:** Shiki
- **Parsing:** Tree-sitter
- **LSP:** VS Code Language Server Protocol

## Architecture

The project is currently transitioning to a Service-Oriented Architecture powered by ECP.

### 1. Editor Command Protocol (ECP)
A JSON-RPC 2.0 protocol that exposes all editor functionality.
- **Server:** Manages state, routes commands, and orchestrates services.
- **Clients:** The TUI is the primary client, but the architecture supports others (e.g., AI agents, remote clients).

### 2. Service Layer
Functionality is encapsulated in distinct services:
- **Document Service:** Manages text buffers (Piece Table), cursors, selections, and undo/redo.
- **File Service:** Abstracts file system operations (local, remote).
- **Git Service:** Handles version control integration.
- **LSP Service:** Manages language servers for intelligence (completion, hover, etc.).
- **Session Service:** Manages user configuration (settings, themes, keybindings) and workspace state.
- **Syntax Service:** Provides syntax highlighting via Shiki.
- **Terminal Service:** Manages PTY sessions.

### 3. TUI Client (`src/clients/tui/`)
The new TUI implementation is component-based and acts as an ECP client.
- **Window:** Manages the overall terminal window.
- **Pane Management:** Supports splitting (vertical/horizontal), tabs, and accordions.
- **Elements:** Reusable UI components (DocumentEditor, FileTree, GitPanel, TerminalSession, etc.).
- **Rendering:** Double-buffered rendering engine with dirty rect tracking for performance.
- **Input:** Unified input handling with support for keyboard (including chords) and mouse.

### 4. Command Protocol (`COMMAND_PROTOCOL.md`)
A unified command registry (`src/commands/`) ensures all actions are discoverable, validatable, and capable of being triggered by any source (User, API, AI).

## Directory Structure

```
ultra/
├── architecture/           # Detailed architectural documentation
├── config/                 # Default configurations (themes, settings)
├── src/
│   ├── index.ts            # Entry point
│   ├── cli.ts              # CLI argument handling
│   ├── clients/
│   │   └── tui/            # New TUI Client implementation
│   │       ├── elements/   # UI Components (Editor, FileTree, etc.)
│   │       ├── layout/     # Pane & Window management
│   │       ├── rendering/  # Render engine
│   │       └── input/      # Input handling
│   ├── commands/           # Command Protocol implementation
│   │   ├── core/           # Built-in commands
│   │   ├── registry.ts     # Command registry
│   │   └── types.ts        # Command types
│   ├── core/               # Core data structures (Buffer, Document, etc.)
│   ├── ecp/                # ECP Server & Protocol definitions
│   ├── features/           # Legacy features (being migrated to services)
│   ├── services/           # New Service Layer
│   │   ├── document/
│   │   ├── file/
│   │   ├── git/
│   │   ├── lsp/
│   │   └── session/
│   └── terminal/           # Legacy terminal handling (being migrated)
└── tests/                  # Unit and Integration tests
```

## Building and Running

### Requirements
*   Bun v1.0+

### Installation
```bash
git clone https://github.com/AgeOfLearning/ultra-editor.git
cd ultra-editor
bun install
```

### Development
*   **Run Development Mode (Legacy TUI):**
    ```bash
    bun run dev [path]
    ```
*   **Run New TUI (Current Focus):**
    ```bash
    bun run dev:new [path]
    ```
    *Use this for all active development unless specified otherwise.*

*   **Debug Mode:**
    ```bash
    bun run dev:new:debug
    ```

### Building
*   **Build Executable:**
    ```bash
    bun run build
    ```

### Testing
*   **Run All Tests:** `bun test`
*   **Watch Mode:** `bun test --watch`
*   **Type Check:** `bun run typecheck`

## Development Conventions

*   **Architecture First:** Always check `architecture/` docs before major changes.
*   **ECP Compliance:** All new features must be exposed via the Command Protocol.
*   **Strict Types:** Use TypeScript strict mode. Avoid `any`.
*   **Error Handling:** Use `Result` types over throwing exceptions where possible.
*   **Testing:** Write tests for new services and commands.
*   **Style:** Follow existing patterns (Prettier/ESLint are not explicitly set up but mimic existing code).

## Current Status & Backlog
Refer to `BACKLOG.md` for the most up-to-date task list.
**Focus Areas:**
1.  Stabilizing the new TUI.
2.  Migrating legacy features to the Service Layer.
3.  Implementing the complete Command Protocol.
4.  Enhancing Git integration and File Tree interactions.