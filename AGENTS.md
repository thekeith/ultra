# Repository Guidelines

## Project Structure & Module Organization
Ultra is a Bun/TypeScript codebase. Source lives in `src/`, with major areas like `core/` (editor primitives), `ui/` and `clients/` (TUI rendering), `features/` (syntax, LSP, git), and `config/` (settings/keybindings defaults). Tests are in `tests/` with `unit/` and `integration/` suites; the top-level `test/` folder contains fixture files (sample source files used in tests and manual checks). Project docs live in `docs/`.

## Build, Test, and Development Commands
- `bun install`: install dependencies.
- `bun run dev`: run the editor from source.
- `bun run dev:new` / `bun run dev:new:debug`: run the new TUI (optional debug logging).
- `bun run build`: build the native binary via `build.ts`.
- `bun run typecheck`: TypeScript type checking (no emit).
- `bun test` / `bun run test:watch`: run tests (watch for changes).
- `bunx typedoc`: generate API docs into `docs/api`.

## Coding Style & Naming Conventions
TypeScript uses ESNext modules and strict type checking (see `tsconfig.json`). Follow the existing style: 2-space indentation, single quotes, and concise inline documentation. Name classes/types in `PascalCase`, functions/variables in `camelCase`, and test files as `*.test.ts` inside `tests/`. Prefer explicit types when inference is unclear.

## Testing Guidelines
Tests run with Bun’s test runner and are organized by `tests/unit/` and `tests/integration/`. Add new coverage near the feature area and mirror the directory layout. Use fixture files from `test/` or add new fixtures there. Run `bun test` before submitting changes.

## Commit & Pull Request Guidelines
Recent commit messages are short, lowercase, and descriptive (e.g., `fixing LSP keybindings`, `updated docs`). Follow that pattern. PRs should explain the change, list any new commands or config updates, and include screenshots or short clips for UI changes.

## Configuration & Local Setup
Runtime configuration lives under `~/.config/ultra/` (settings, keybindings, themes). The repository defaults are in `config/`. Keep local-only settings out of version control.
