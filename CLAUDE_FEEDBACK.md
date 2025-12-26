# Claude Code Feedback for Ultra 1.0

## Scope & Context
Reviewed PR #3: "Plan diff viewer framework for Ultra" (merged commit `cdd98a2`).

This PR implemented the diff viewer enhancement plan across 6 sprints:
1. Summary section and Timeline panel integration
2. Side-by-side diff view mode
3. Auto-refresh with file watching
4. LSP Diagnostics for diff viewer
5. Inline editing for diff viewer
6. Viewer abstraction patterns (BaseViewer)

## Summary of Changes

### Files Added
| File | Purpose |
|------|---------|
| `architecture/diff-viewer-plan.md` | Detailed planning document with sprint breakdown |
| `architecture/viewer-patterns.md` | Documentation for viewer component patterns |
| `src/clients/tui/elements/base-viewer.ts` | Abstract base class for simple list/tree viewers |

### Files Modified
| File | Changes |
|------|---------|
| `src/clients/tui/artifacts/types.ts` | Added ViewerItem, ViewerCallbacks, ViewerState, SummaryItem interfaces |
| `src/clients/tui/elements/content-browser.ts` | Added pinned summary section support |
| `src/clients/tui/elements/git-diff-browser.ts` | +1000 lines: side-by-side view, diagnostics, edit mode, auto-refresh |
| `src/clients/tui/client/tui-client.ts` | +210 lines: Timeline integration, git change listener |
| `src/services/git/cli.ts` | Added `diffCommit()` and `getCommitFiles()` methods |
| `src/services/session/schema.ts` | Added 6 diff viewer settings |
| `src/clients/tui/elements/index.ts` | Exported new types and BaseViewer |

### Settings Added
```jsonc
"tui.diffViewer.summaryPinned": true
"tui.diffViewer.defaultViewMode": "unified"  // or "side-by-side"
"tui.diffViewer.autoRefresh": true
"tui.diffViewer.showDiagnostics": true
"tui.diffViewer.editMode": "stage-modified"  // or "direct-write"
"tui.contentBrowser.summaryPinned": true
```

## Key Findings & Issues (Ordered by Severity)

### 1) TypeScript Compilation Fails (Critical) - FIXED
- **Where**: `src/clients/tui/elements/base-viewer.ts`, `src/clients/tui/client/tui-client.ts`
- **What**: 10 TypeScript errors prevented build:
  - `BaseViewer` uses `'BaseViewer'` as ElementType but it's not registered
  - Method name mismatch: `handleMouseEvent` vs `handleMouse` (base class method)
  - Missing `override` modifiers on `getState()` and `setState()`
  - MouseEvent type uses `'mousedown'`/`'wheel'` but actual types are `'press'`/`'scroll'`
  - `'line'` property doesn't exist in `OpenFileOptions` type
  - `dispose()` called on `ContentBrowser` but not defined in base class
- **Status**: FIXED - All type errors resolved:
  - Added 'BaseViewer' to ElementType union in types.ts
  - Renamed `handleMouseEvent` to `handleMouse` in base-viewer.ts
  - Added `override` modifiers to `getState()` and `setState()`
  - Changed `'mousedown'`→`'press'`, `'wheel'`→`'scroll'`, `direction`→`scrollDirection`
  - Added `line` and `column` to `OpenFileOptions` interface
  - Added `dispose()` method to `BaseElement`
  - Added 'BaseViewer' to pane.ts title map

### 2) No Tests Added (Critical) - FIXED
- **Status**: FIXED - Added comprehensive tests:
  - `tests/unit/clients/tui/elements/base-viewer.test.ts` - Navigation, state, mouse handling, rendering
  - `tests/unit/clients/tui/elements/git-diff-browser.test.ts` - View modes, callbacks, diagnostics, edit mode
  - `tests/unit/clients/tui/elements/content-browser.test.ts` - Summary section, pinned state
  - Extended `tests/unit/services/git/git-cli-service.test.ts` with `diffCommit()` and `getCommitFiles()` tests
  - Total: 93+ new tests added

### 2) No Tests Added (Critical) - Original Issue
- **Where**: Entire PR
- **What**: Zero test files added despite CLAUDE.md stating "All new features and bug fixes MUST include corresponding tests."
- **Impact**: 1000+ lines of new functionality with no test coverage. Regressions possible.
- **Recommendation**: Add tests for:
  - `GitDiffBrowser`: view mode toggle, diagnostics rendering, edit mode
  - `BaseViewer`: navigation, expand/collapse, state serialization
  - `ContentBrowser`: summary section rendering
  - `diffCommit()` and `getCommitFiles()` git service methods
  - Integration test for timeline → diff viewer flow

### 3) Edit Mode is Incomplete (High) - FIXED
- **Where**: `src/clients/tui/client/tui-client.ts:5610-5670`
- **What**: `stage-modified` edit mode showed a "coming soon" notification.
- **Status**: FIXED - Implemented `onSaveEdit` to:
  1. Find the GitDiffBrowser and get hunk details
  2. Apply the edited content to the file
  3. Stage the modified file via `gitCliService.stage()`
  4. Trigger refresh of the diff view

### 4) Direct-Write Mode Has Potential Off-by-One Errors (High) - FIXED
- **Where**: `src/clients/tui/elements/git-diff-browser.ts:96-106`, `src/clients/tui/client/tui-client.ts:5671`
- **What**: `onDirectWrite` used wrong line count for splice.
- **Status**: FIXED:
  - Extended `EditCallbacks.onDirectWrite` to accept `originalLineCount` parameter
  - `GitDiffBrowser.saveEdit()` now passes `originalEditLines.length`
  - `onDirectWrite` now uses correct `splice(startIdx, originalLineCount, ...newLines)`

### 5) Diagnostics Cache Not Auto-Refreshed (Medium)
- **Where**: `src/clients/tui/elements/git-diff-browser.ts:320-350`
- **What**: `refreshDiagnosticsCache()` is only called when `setDiagnosticsProvider()` is called. LSP diagnostics update asynchronously, but the diff viewer won't show new diagnostics without manual refresh.
- **Impact**: Stale diagnostic indicators shown on diff lines.
- **Recommendation**: Subscribe to LSP diagnostics change events or call `refreshDiagnosticsCache()` periodically/on focus.

### 6) BaseViewer Registered as Non-Existent ElementType (Medium)
- **Where**: `src/clients/tui/elements/base-viewer.ts:87`
- **What**: Constructor passes `'BaseViewer'` to super, but `ElementType` union doesn't include this value.
- **Impact**: Type error, and if BaseViewer were instantiated directly, factory lookup would fail.
- **Recommendation**: Add 'BaseViewer' to ElementType union in types.ts, or make BaseViewer constructor take elementType as parameter (since it's abstract and subclasses should specify their type).

### 7) MouseEvent Type Mismatch (Medium)
- **Where**: `src/clients/tui/elements/base-viewer.ts:434-445`
- **What**: Code checks for `'mousedown'` and `'wheel'` event types, but the MouseEvent interface defines `'press'`, `'release'`, `'scroll'` etc.
- **Impact**: Mouse handling is completely broken in BaseViewer - clicks and scrolling won't work.
- **Recommendation**: Update to use correct event types: `'press'` instead of `'mousedown'`, `'scroll'` instead of `'wheel'`.

### 8) Missing dispose() in ContentBrowser (Low)
- **Where**: `src/clients/tui/elements/git-diff-browser.ts:289-294`
- **What**: `GitDiffBrowser.dispose()` calls `super.dispose()` but `ContentBrowser` doesn't define a `dispose()` method.
- **Impact**: Runtime error if dispose is called, or no-op if base class has empty default.
- **Recommendation**: Add `dispose()` to ContentBrowser or remove the override modifier.

## Positive Aspects

1. **Well-Structured Plan**: The diff-viewer-plan.md is comprehensive with clear sprint breakdown
2. **Good Documentation**: viewer-patterns.md provides clear guidance for future viewer implementations
3. **Proper Settings Integration**: New settings follow the established schema pattern
4. **Service Layer Usage**: Git operations properly delegated to `gitCliService`
5. **Theme Color Usage**: Rendering uses `ctx.getThemeColor()` consistently

## Code Quality Observations

### Followed CLAUDE.md Patterns
- Used debugLog() instead of console.log
- Settings read via ctx.getSetting() with defaults
- Git commands use .quiet() appropriately
- Singleton pattern with named exports

### Deviated from CLAUDE.md Patterns
- No tests added (mandatory per CLAUDE.md)
- TypeScript errors not caught before PR merge

## Testing Gaps

| Feature | Expected Test | Status |
|---------|--------------|--------|
| Side-by-side rendering | Snapshot test for layout | Missing |
| View mode toggle | Unit test for state change | Missing |
| Auto-refresh | Integration test with mock git changes | Missing |
| Diagnostics display | Unit test with mock provider | Missing |
| Edit mode | Unit tests for cursor, text manipulation | Missing |
| Summary section | Snapshot test for content browser | Missing |
| Timeline integration | Integration test for diff opening | Missing |
| diffCommit() | Unit test with mock git output | Missing |

## Recommended Next Steps

1. **Fix TypeScript Errors (Immediate)**
   - Update MouseEvent type usage in base-viewer.ts
   - Add missing override modifiers
   - Fix OpenFileOptions usage in tui-client.ts
   - Resolve dispose() inheritance

2. **Add Core Tests**
   - GitDiffBrowser view mode and state
   - BaseViewer navigation and serialization
   - Git service diffCommit/getCommitFiles

3. **Complete Edit Mode**
   - Implement stage-modified patch generation
   - Fix direct-write line replacement logic
   - Add proper undo support

4. **Improve Diagnostics Integration**
   - Subscribe to LSP diagnostic change events
   - Auto-refresh cache on document save
