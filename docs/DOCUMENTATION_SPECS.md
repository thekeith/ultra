# Ultra Documentation Specification

This document defines the documentation standards for Ultra, an open-source terminal-based code editor. All contributions should follow these guidelines to maintain consistent, comprehensive documentation.

## Table of Contents

- [Comment Style Guide](#comment-style-guide)
- [What to Document](#what-to-document)
- [TSDoc Reference](#tsdoc-reference)
- [File Header Comments](#file-header-comments)
- [Architecture Documentation](#architecture-documentation)
- [Examples](#examples)
- [TypeDoc Configuration](#typedoc-configuration)

---

## Comment Style Guide

### General Principles

1. **Write for newcomers** - Assume the reader is unfamiliar with the codebase
2. **Explain the "why"** - Code shows what happens; comments explain why
3. **Be concise but complete** - Every public API needs docs; internal code needs context
4. **Use examples liberally** - Show, don't just tell
5. **Keep comments current** - Outdated comments are worse than no comments

### Tone and Voice

- Use present tense ("Returns the buffer" not "Will return the buffer")
- Use third person ("Calculates the offset" not "Calculate the offset")
- Be direct and technical - this is developer documentation
- Avoid filler words and marketing language

---

## What to Document

### Required Documentation (All Exports)

| Element | Required Tags |
|---------|---------------|
| Classes | `@description`, `@example` |
| Interfaces | `@description`, property descriptions |
| Type aliases | `@description` |
| Functions | `@description`, `@param`, `@returns`, `@throws`, `@example` |
| Methods | `@description`, `@param`, `@returns`, `@throws` |
| Properties | Brief description |
| Enums | `@description`, member descriptions |
| Constants | Brief description of purpose |

### Recommended Documentation (Internal Code)

| Element | Guidance |
|---------|----------|
| Private methods | Document if logic is non-obvious |
| Helper functions | Document parameters and return values |
| Complex algorithms | Step-by-step explanation |
| Workarounds/hacks | Explain why and link to issues |
| Magic numbers | Named constants with explanations |

### When to Use Inline Comments

```typescript
// ✅ Good - explains WHY
// Offset by 1 because terminal coordinates are 1-indexed
const terminalRow = bufferRow + 1;

// ✅ Good - explains non-obvious behavior
// Must clone array to avoid mutating during iteration
const snapshot = [...this.listeners];

// ❌ Bad - just restates the code
// Add 1 to the row
const terminalRow = bufferRow + 1;

// ❌ Bad - obvious from context
// Loop through items
for (const item of items) {
```

---

## TSDoc Reference

### Essential Tags

```typescript
/**
 * Brief description (first line, under 80 chars).
 *
 * Detailed description spanning multiple lines if needed.
 * Can include additional context, caveats, or implementation notes.
 *
 * @param name - Description of the parameter
 * @param options - Description with nested properties:
 *   - `property1` - What this does
 *   - `property2` - What this does
 * @returns Description of return value
 * @throws {@link ErrorType} When this error occurs
 * @example
 * ```typescript
 * const result = myFunction('input');
 * console.log(result); // expected output
 * ```
 *
 * @see {@link RelatedClass} for additional context
 * @remarks
 * Additional implementation notes or caveats that don't fit
 * in the main description.
 *
 * @alpha | @beta | @public | @internal
 */
```

### Tag Descriptions

| Tag | Usage |
|-----|-------|
| `@param` | Document each parameter, including optional ones |
| `@returns` | Describe return value; omit for void functions |
| `@throws` | Document each exception that may be thrown |
| `@example` | Runnable code example (can have multiple) |
| `@see` | Reference related code or external resources |
| `@remarks` | Additional notes separate from main description |
| `@deprecated` | Mark deprecated APIs with migration path |
| `@internal` | Mark as internal (excluded from public docs) |
| `@public` | Explicitly mark as public API |
| `@readonly` | Indicate property should not be modified |
| `@defaultValue` | Document default value for optional params |

### Linking

```typescript
/**
 * Link to another symbol: {@link ClassName}
 * Link to method: {@link ClassName.methodName}
 * Link with custom text: {@link ClassName | display text}
 * Link to external URL: {@link https://example.com | Example}
 */
```

---

## File Header Comments

Every source file should begin with a header comment:

```typescript
/**
 * @file Brief description of what this module does
 * @module module-name
 *
 * Longer description explaining:
 * - The purpose of this module
 * - Key classes/functions exported
 * - How it fits into the larger architecture
 *
 * @example
 * ```typescript
 * import { Something } from './this-file';
 * ```
 *
 * @packageDocumentation
 */
```

---

## Architecture Documentation

### Directory Structure

```
docs/
├── README.md              # Documentation home
├── getting-started.md     # Installation and first steps
├── architecture/
│   ├── overview.md        # High-level system design
│   ├── data-flow.md       # How data moves through the app
│   ├── keybindings.md     # Keyboard handling architecture
│   └── rendering.md       # Terminal rendering pipeline
├── modules/
│   ├── editor.md          # Editor module deep-dive
│   ├── buffer.md          # Buffer management
│   ├── lsp.md             # Language Server Protocol integration
│   ├── syntax.md          # Syntax highlighting
│   └── ...                # One file per major module
├── guides/
│   ├── contributing.md    # How to contribute
│   ├── adding-commands.md # Adding new editor commands
│   └── adding-languages.md # Adding language support
└── api/                   # Generated TypeDoc output
```

### Module Documentation Template

```markdown
# Module Name

Brief description of what this module does.

## Overview

Explain the module's responsibility and how it fits into Ultra's architecture.

## Key Concepts

Define important terms, patterns, or abstractions used in this module.

## Architecture

### Components

Describe the main classes/functions and their relationships.

### Data Flow

Explain how data moves through this module.

### Dependencies

List internal and external dependencies.

## Usage Examples

Show common usage patterns.

## Configuration

Document any configuration options.

## Internals

Explain non-obvious implementation details.

## Related Modules

Link to related documentation.
```

---

## Examples

### Class Documentation

```typescript
/**
 * Manages a text buffer with line-based storage and edit operations.
 *
 * Buffer is the core data structure for text editing in Ultra. It provides
 * efficient line-based operations optimized for typical editing patterns
 * like inserting characters, deleting ranges, and navigating by line.
 *
 * @example
 * ```typescript
 * const buffer = new Buffer();
 * buffer.insert({ row: 0, col: 0 }, 'Hello, World!');
 * console.log(buffer.getLine(0)); // 'Hello, World!'
 * ```
 *
 * @see {@link Document} for the higher-level document abstraction
 * @see {@link BufferView} for rendering buffer contents
 */
export class Buffer {
  /**
   * The lines of text in this buffer.
   * @internal
   */
  private lines: string[] = [''];

  /**
   * Creates a new Buffer instance.
   *
   * @param content - Initial content to populate the buffer.
   *   If provided, the content is split by newlines.
   */
  constructor(content?: string) {
    if (content) {
      this.lines = content.split('\n');
    }
  }

  /**
   * Returns the total number of lines in the buffer.
   *
   * @returns Line count (always at least 1, even for empty buffers)
   */
  get lineCount(): number {
    return this.lines.length;
  }

  /**
   * Retrieves a specific line from the buffer.
   *
   * @param row - Zero-indexed line number
   * @returns The line content without trailing newline
   * @throws {@link RangeError} If row is out of bounds
   *
   * @example
   * ```typescript
   * const line = buffer.getLine(0);
   * ```
   */
  getLine(row: number): string {
    if (row < 0 || row >= this.lines.length) {
      throw new RangeError(`Line ${row} out of bounds (0-${this.lines.length - 1})`);
    }
    return this.lines[row];
  }
}
```

### Interface Documentation

```typescript
/**
 * Represents a position within a text buffer.
 *
 * Positions are zero-indexed and represent the space between characters.
 * A position of `{ row: 0, col: 0 }` is at the very beginning of the buffer.
 */
export interface Position {
  /**
   * Zero-indexed line number.
   * Must be non-negative and less than the buffer's line count.
   */
  row: number;

  /**
   * Zero-indexed column (character offset within the line).
   * Must be non-negative and at most equal to the line's length.
   */
  col: number;
}

/**
 * Options for configuring the editor instance.
 */
export interface EditorOptions {
  /**
   * Number of spaces to use for tab indentation.
   * @defaultValue 2
   */
  tabSize?: number;

  /**
   * Whether to insert spaces when Tab is pressed.
   * @defaultValue true
   */
  insertSpaces?: boolean;

  /**
   * Enable line wrapping at viewport boundary.
   * @defaultValue false
   */
  wordWrap?: boolean;

  /**
   * Callback invoked when buffer content changes.
   */
  onChange?: (event: ChangeEvent) => void;
}
```

### Function Documentation

```typescript
/**
 * Calculates the visual width of a string, accounting for tab expansion.
 *
 * This function handles tab characters by expanding them to the next
 * tab stop based on the configured tab size. It correctly handles
 * Unicode characters that may have different display widths.
 *
 * @param text - The string to measure
 * @param tabSize - Number of spaces per tab stop
 * @param startCol - Starting column for tab alignment calculation
 * @returns The visual width in columns
 *
 * @example
 * ```typescript
 * // Simple string
 * getVisualWidth('hello', 4); // 5
 *
 * // String with tab (tab at col 0 expands to 4 spaces)
 * getVisualWidth('\thello', 4); // 9
 *
 * // Tab alignment (tab at col 2 expands to col 4)
 * getVisualWidth('ab\tc', 4); // 5
 * ```
 */
export function getVisualWidth(
  text: string,
  tabSize: number,
  startCol: number = 0
): number {
  // Implementation
}
```

### Enum Documentation

```typescript
/**
 * Modes for cursor movement behavior.
 *
 * These modes affect how cursor navigation commands interpret
 * their movement distance and what constitutes a "word" or "line".
 */
export enum CursorMoveMode {
  /**
   * Move by single characters.
   * Cursor moves one character at a time.
   */
  Character = 'character',

  /**
   * Move by words (continuous non-whitespace).
   * Uses Sublime Text's word boundary definition.
   */
  Word = 'word',

  /**
   * Move by subwords (camelCase and snake_case boundaries).
   * Useful for navigating within identifiers.
   */
  Subword = 'subword',

  /**
   * Move to line boundaries.
   * Moves to beginning or end of current line.
   */
  Line = 'line',
}
```

---

## TypeDoc Configuration

Create `typedoc.json` in the project root:

```json
{
  "$schema": "https://typedoc.org/schema.json",
  "entryPoints": ["src/index.ts"],
  "entryPointStrategy": "expand",
  "out": "docs/api",
  "name": "Ultra",
  "readme": "README.md",
  "includeVersion": true,
  "categorizeByGroup": true,
  "defaultCategory": "Other",
  "categoryOrder": [
    "Core",
    "Editor",
    "Buffer",
    "Commands",
    "LSP",
    "Rendering",
    "Utilities",
    "*"
  ],
  "sort": ["source-order", "alphabetical"],
  "visibilityFilters": {
    "protected": true,
    "private": false,
    "@internal": false
  },
  "navigation": {
    "includeCategories": true,
    "includeGroups": true
  },
  "plugin": ["typedoc-plugin-mdn-links"],
  "exclude": [
    "**/node_modules/**",
    "**/*.test.ts",
    "**/*.spec.ts"
  ],
  "externalPattern": ["**/node_modules/**"],
  "excludeExternals": true,
  "excludePrivate": true,
  "excludeInternal": true,
  "gitRevision": "main",
  "githubPages": true,
  "hideGenerator": false,
  "searchInComments": true,
  "cleanOutputDir": true
}
```

### Package.json Scripts

```json
{
  "scripts": {
    "docs": "typedoc",
    "docs:watch": "typedoc --watch",
    "docs:serve": "typedoc && npx serve docs/api"
  }
}
```

### Recommended Plugins

```bash
npm i -D typedoc typedoc-plugin-mdn-links typedoc-plugin-missing-exports
```

| Plugin | Purpose |
|--------|---------|
| `typedoc-plugin-mdn-links` | Links standard types (Array, Map, etc.) to MDN docs |
| `typedoc-plugin-missing-exports` | Documents internal types referenced by public API |

---

## Documentation Workflow

### For Claude Code

When documenting Ultra's codebase, follow this process:

1. **Read this spec first** - Understand the standards before documenting
2. **Start with core modules** - Document foundational code before dependent code
3. **Work in batches** - Process 3-5 related files together for consistency
4. **Include file headers** - Every file needs the `@file` and `@module` tags
5. **Add usage examples** - Real, runnable examples for all public APIs
6. **Link related code** - Use `@see` to connect related concepts
7. **Explain the why** - Don't just describe what code does, explain why

### Priority Order

1. `src/index.ts` - Main entry point and exports
2. Core data structures (Buffer, Document, Position, Range)
3. Editor class and configuration
4. Command system
5. Keybinding handling
6. LSP integration
7. Syntax highlighting
8. Rendering/View layer
9. Utilities and helpers

### Checklist Template

```markdown
## File: src/path/to/file.ts

- [ ] File header comment with @file and @module
- [ ] All exports documented with TSDoc
- [ ] @param for all parameters
- [ ] @returns for all non-void functions
- [ ] @throws for functions that throw
- [ ] @example for public APIs
- [ ] @internal for non-public helpers
- [ ] Inline comments for complex logic
- [ ] Links to related code via @see
```

---

## Quality Checklist

Before considering documentation complete, verify:

- [ ] All exported symbols have TSDoc comments
- [ ] All public methods have `@param`, `@returns`, and `@example`
- [ ] All interfaces have property descriptions
- [ ] Complex algorithms have step-by-step explanations
- [ ] Magic numbers are replaced with named constants
- [ ] Workarounds reference issue numbers
- [ ] TypeDoc generates without warnings
- [ ] Generated docs are navigable and searchable
- [ ] README has quick start instructions
- [ ] Architecture docs explain high-level design
- [ ] Module docs cover all major components