# CODEX Feedback for Ultra 1.0

## Scope & Approach
Reviewed the current codebase excluding `src/archived/` as requested. Focus areas: runtime configuration, build pipeline, ECP/services layer, TUI client wiring, tests, and documentation alignment. No automated tests were executed.

## High-Impact Issues & Risks

### 1) Typecheck breakage from stale paths in generated defaults
- **Where**: `src/config/defaults.ts` imports types from `../ui/themes/theme-loader.ts` and `../input/keymap.ts` (paths no longer exist in the new TUI layout).
- **Why it’s a concern**: `tsc --noEmit` (and editor diagnostics) will fail due to missing modules. This blocks type checking and creates confusion for contributors.
- **Potential impact**: CI or local typecheck failures; IDE type info is broken for default settings/types.
- **Next steps**:
  - Update the type-only imports to the current locations (likely `src/services/session/types.ts` for `Theme` and `KeyBinding`).
  - Re-run `bun run build` to regenerate defaults once types are corrected.

### 2) Dual configuration systems with divergent defaults and paths
- **Where**:
  - TUI: `src/clients/tui/config/config-manager.ts` uses `~/.ultra/` and `config/default-settings.jsonc`.
  - Services/ECP: `src/config/settings.ts` + `src/services/session/schema.ts` uses `~/.config/ultra/` and different defaults.
- **Why it’s a concern**: two different sources of truth for settings and schema. Keys differ (`tui.sidebar.width` vs `ultra.sidebar.width`, `ai.defaultProvider` vs `ultra.ai.*`) and defaults conflict (`workbench.colorTheme`).
- **Potential impact**: TUI and ECP clients observe different settings; invalid setting validation; user changes not applied where expected.
- **Next steps**:
  - Choose a single configuration root (`~/.ultra` or `~/.config/ultra`) and migrate all loaders to it.
  - Unify the settings schema with the JSONC defaults; split core vs. TUI-only settings if needed, but keep an explicit mapping.
  - Align key names (`tui.*` vs `ultra.*`) and update all call sites.

### 3) Settings schema and defaults are out of sync
- **Where**: `config/default-settings.jsonc` includes keys not present in `EditorSettings` or `settingsSchema` (e.g., `files.watchFiles`, `tui.*`, `editor.undoHistoryLimit`, `ai.defaultProvider`).
- **Why it’s a concern**: schema validation can reject or ignore valid user settings; editor behavior can silently diverge from config files.
- **Potential impact**: user settings not applied; ECP API callers get confusing validation failures.
- **Next steps**:
  - Expand `EditorSettings` and `settingsSchema` to cover all defaults used by the TUI.
  - Add a lint/CI step to detect drift between schema and JSONC defaults.

### 4) Platform-specific build assumptions
- **Where**: `build.ts` hardcodes `--target=bun-darwin-arm64`, and `pty-loader.ts` fixes permissions under `darwin-${process.arch}`.
- **Why it’s a concern**: builds on Linux/Windows or Intel macOS will fail or produce incorrect binaries.
- **Potential impact**: blocked builds for non-Apple ARM; broken terminal support on other platforms.
- **Next steps**:
  - Detect `process.platform` and `process.arch` to choose a target and prebuild path.
  - Document supported build targets (or introduce a build matrix).

## Medium-Impact Issues & Gaps

### 5) Documentation drift vs. current code layout
- **Where**: `README.md`, `architecture/overview.md`, and `architecture/testing/overview.md`.
- **Symptoms**:
  - Old paths referenced (`src/ui`, `src/features/*`) vs. current `src/clients/tui` and `src/services`.
  - Version mismatch: README shows `v0.8.1`, runtime prints `v1.0.0`, package.json is `0.1.0`.
  - Testing docs reference `tests/e2e/` which does not exist.
- **Impact**: onboarding friction; misleading docs and versioning confusion.
- **Next steps**:
  - Update docs to match the new directory structure and actual test layout.
  - Decide on a canonical version source and keep README/runtime/package.json aligned.

### 6) Bun test resolver alias points to a missing directory
- **Where**: `bunfig.toml` defines `@fixtures/*` → `./tests/fixtures/*`, but there is no `tests/fixtures/`.
- **Impact**: future tests using `@fixtures` will fail; documentation references a non-existent path.
- **Next steps**: remove/adjust the alias or create the directory and move relevant fixtures.

## Implementation TODOs That Affect Behavior

### 7) Editor outdent uses a hardcoded tab size
- **Where**: `src/core/document.ts` uses `const tabSize = 2`.
- **Impact**: outdent ignores user configuration and behaves incorrectly in projects with different tab sizes.
- **Next steps**: inject `tabSize` via settings into `Document` or supply it as an operation parameter.

### 8) Keybinding `when` clauses are ignored
- **Where**: `src/services/session/local.ts` TODO in `resolveKeybinding`.
- **Impact**: conditional keybindings won’t work; potential command conflicts.
- **Next steps**: parse and evaluate `when` conditions using current editor state.

### 9) Incremental document change tracking missing
- **Where**: `src/services/document/local.ts` TODO.
- **Impact**: LSP updates may be less efficient or incorrect for large files (full content refresh instead of incremental diffs).
- **Next steps**: implement incremental change tracking and ensure LSP adapters use it.

### 10) LSP references picker not implemented
- **Where**: `src/clients/tui/client/lsp-integration.ts`.
- **Impact**: “Find references” UX is incomplete or inconsistent.
- **Next steps**: add a UI overlay (similar to file picker/searchable dialog) to present references.

## Additional Observations & Insights
- The new TUI already uses the JSONC-based config defaults (`config/default-settings.jsonc`) and `TUIConfigManager`. The session service still uses the older `Settings`/schema stack. This duplication is the largest architectural divergence and should be resolved early.
- `docs/api/` appears to be checked in (generated output). If it’s meant to be source-of-truth, ensure it’s regenerated with each release; otherwise consider removing from git and generating in CI.

## Recommended Next Steps (Actionable)
1. **Unify settings**: pick one config root and one schema; update `Settings`, `settingsSchema`, and TUI config manager to share the same definitions.
2. **Fix type imports in `src/config/defaults.ts`**: point to real type definitions and re-run `bun run build`.
3. **Resolve doc drift**: update `README.md` and `architecture/*.md` to match actual directories and versions.
4. **Add config/schema consistency checks**: a simple script or test that verifies JSONC defaults against the schema.
5. **Make build portable**: detect platform/arch in `build.ts` and PTY install code.
6. **Close TODOs affecting user behavior**: keybinding `when` clauses, incremental changes, tab size.
