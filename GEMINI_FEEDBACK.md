# Gemini Feedback

## Overview

I have reviewed the codebase, specifically focusing on the new TUI implementation (`src/clients/tui`) and the migration to the Service/ECP architecture. The project is in a strong transitional state. The new TUI architecture is robust, utilizing a component-based approach that is much cleaner than the legacy implementation. The Service layer is also taking shape nicely.

Below is detailed feedback and a set of recommendations for the next development phase.

## 1. TUI Performance & Rendering

**Current State:**
The `Window.render()` loop currently clears the entire `ScreenBuffer` before delegating to components.

```typescript
// src/clients/tui/window.ts
render(): ScreenBuffer {
  // Clear buffer
  const bg = this.getThemeColor('editor.background', '#1e1e1e');
  this.buffer.clear(bg, '#cccccc'); 
  // ... render components ...
}
```

**Issue:** 
`ScreenBuffer.clear()` resets all cells to empty. If a cell contained text (e.g., 'A'), it changes to ' ' (marking it dirty). The subsequent component render sets it back to 'A' (marking it dirty again). This defeats the purpose of the `ScreenBuffer`'s dirty tracking for static content, causing the entire screen to be re-written to the terminal on every render frame, which can cause flickering or high CPU usage.

**Recommendation:**
- **Remove the blanket `buffer.clear()`** from the main render loop.
- **Paint over**: Components like `PaneContainer` and `StatusBar` cover the entire screen area. Trust them to paint their background.
- **Z-Index clearing**: If `OverlayManager` is the only thing that might leave "stale" pixels when closed, handle clearing specifically for that layer or when the layout invalidates.
- **Optimization**: Implement a `buffer.diff(otherBuffer)` or simply rely on `set()`'s equality check without the intermediate clear step.

## 2. Git Service & Documentation

**Current State:**
`CLAUDE.md` states: *"NOTE: GIT_EDITOR=true should be set but is currently missing from git-integration.ts - this is a known issue to fix."*

**Reality:**
The new service at `src/services/git/cli.ts` **does** implement this:
```typescript
process.env.GIT_EDITOR = 'true';
process.env.GIT_TERMINAL_PROMPT = '0';
```

**Recommendation:**
- **Update `CLAUDE.md`**: Remove the outdated note about `GIT_EDITOR`.
- **Delete Legacy**: The `src/archived/features/git/` directory should be explicitly marked as deprecated or removed if the new service is fully functional (which it appears to be).

## 3. Codebase Cleanup & TODOs

There are several actionable TODOs that should be addressed to polish the 1.0 release:

- **Hardcoded Settings**: `src/core/document.ts` has `const tabSize = 2; // TODO: get from settings`. This needs to be connected to `SessionService`.
- **Keybinding Resolution**: `src/services/session/local.ts` has incomplete keybinding resolution logic.
- **LSP UI**: `src/clients/tui/client/lsp-integration.ts` is missing a references picker.

## 4. Architecture alignment

- **Directory Structure**: The separation between `src/clients/tui` (presentation) and `src/services` (logic) is excellent. Maintain this strict boundary.
- **ECP Pattern**: Ensure all new features in the TUI *only* call methods on the `ECPServer` or specific Services, rather than importing logic files directly.

## 5. Next Steps Plan

1.  **Refactor Render Loop**: Optimize `Window.render` to avoid full clears.
2.  **Connect Settings**: Replace magic numbers in `core/document.ts` with `SessionService` calls.
3.  **Docs Cleanup**: Update `CLAUDE.md` and `GEMINI.md` to reflect the actual state of the Git service.
4.  **Verify Git Service**: Ensure the TUI `GitPanel` is correctly using the new `src/services/git` instead of the archived version.

**Confidence Score:** High. The path forward is clear, and the foundation is solid.
