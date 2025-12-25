# CODEX Feedback for Ultra 1.0

## Scope & Approach
Reviewed the current codebase with emphasis on Claude’s recent additions (AI terminal chat integration, session persistence updates, pane/container work, and test fixes). Focused on settings/configuration flow, session restore, TUI wiring, and remaining TODOs. No automated tests were executed.

## What’s Working Well
- AI terminal chat plumbing is in place (Claude/Codex/Gemini) with PTY integration and session persistence hooks.
- Session serialization now covers panes, terminals, and AI chats; restoration logic is reasonably complete.
- Test suite was updated to match API changes and is reportedly green in the latest Claude commit.

## High-Impact Issues & Risks

### 1) Settings/config drift between TUI config and session settings
- **Where**: `config/default-settings.jsonc`, `src/config/settings.ts`, `src/services/session/schema.ts`, `src/clients/tui/config/config-manager.ts`.
- **What**: TUI uses JSONC defaults embedded in `src/config/defaults.ts`, while session settings use `Settings` + `settingsSchema`. Defaults and keys diverge:
  - `ai.panel.openOnStartup` false (JSONC) vs true (schema + settings).
  - `terminal.integrated.openOnStartup`/`spawnOnStartup` false (JSONC) vs true (schema + settings).
  - `workbench.startupEditor` empty (JSONC) vs `~/.ultra/BOOT.md` (schema + settings).
  - `ai.defaultProvider` and `terminal.integrated.scrollback` exist in JSONC/TUI but not in schema/settings.
- **Impact**: Different defaults and validation behavior between TUI and session services; some settings silently ignored or never validated.
- **Next steps**:
  - Consolidate defaults/schema into a single source of truth (prefer the JSONC + generated defaults, or generate schema from it).
  - Add missing keys (`ai.defaultProvider`, `terminal.integrated.scrollback`) to `EditorSettings` + schema or remove them from JSONC.
  - Align defaults across JSONC, schema, and `Settings`.

### 2) AI settings are partially ignored
- **Where**: `src/clients/tui/elements/ai-terminal-chat.ts`, `src/clients/tui/client/tui-client.ts`, `src/services/session/types.ts`.
- **What**:
  - `ai.panel.*` settings are defined but not used anywhere in the TUI layout logic.
  - `aiPanelVisible`/`aiPanelWidth` exist in session UI state but are never serialized/deserialized.
  - `AITerminalChat` pulls `ai.panel.initialPrompt` from the global `settings` singleton, not from the TUI config manager, so user config in `~/.ultra/settings.jsonc` won’t apply.
- **Impact**: User-configured AI panel behavior and prompt are ignored; session restore doesn’t capture AI panel UI state.
- **Next steps**:
  - Wire `ai.panel.*` into layout logic (panel width, open-on-startup, max width).
  - Save/restore `aiPanelVisible`/`aiPanelWidth` in session UI state.
  - Pass config manager settings into `AITerminalChat` instead of the global `settings` singleton.

### 3) AI provider handling is incomplete and failure feedback is weak
- **Where**: `src/services/session/types.ts`, `src/clients/tui/elements/ai-terminal-chat.ts`.
- **What**:
  - `AIProvider` includes `'custom'` but there is no implementation path; it defaults to Claude.
  - Missing CLI binaries (e.g., `claude`, `codex`, `gemini`) fail silently aside from debug logs.
- **Impact**: Inconsistent provider behavior and confusing UX when tools aren’t installed.
- **Next steps**:
  - Either remove `'custom'` or add a configurable command/args path.
  - Surface missing-binary errors via notifications.

## Medium-Impact Gaps

### 4) Remaining TODOs in core functionality
- **Where**:
  - `src/clients/tui/client/lsp-integration.ts` (references picker).
  - `src/services/document/local.ts` (incremental change tracking for LSP).
- **Impact**: LSP reference UX is incomplete; document updates may be less efficient.

### 5) Terminal scrollback setting unused
- **Where**: `config/default-settings.jsonc`, `src/clients/tui/elements/terminal-session.ts`, `src/clients/tui/elements/ai-terminal-chat.ts`.
- **What**: `terminal.integrated.scrollback` exists but scrollback is hardcoded to `1000` in terminal elements.
- **Impact**: Setting has no effect; user expectations won’t match behavior.

## Recommended Next Steps (Actionable)
1. **Unify configuration**: reconcile JSONC defaults, schema, and `Settings` into one source of truth and remove/merge duplicate keys.
2. **Finish AI settings wiring**: use `ai.panel.*` in layout logic, persist UI state, and feed TUI config into `AITerminalChat`.
3. **Harden AI provider UX**: add error notifications and either implement or drop `'custom'`.
4. **Close LSP TODOs**: references picker + incremental change tracking.
5. **Apply scrollback settings**: wire `terminal.integrated.scrollback` into terminal/AI buffer sizing.
