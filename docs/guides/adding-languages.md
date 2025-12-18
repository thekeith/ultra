# Adding Language Support Guide

This guide explains how to add support for new programming languages in Ultra.

## Overview

Language support in Ultra consists of:

1. **Syntax highlighting** - Provided by Shiki
2. **LSP features** - Go-to-definition, autocomplete, etc.
3. **File association** - Mapping extensions to languages

## Syntax Highlighting

Ultra uses [Shiki](https://shiki.style/) for syntax highlighting, which includes support for 100+ languages out of the box.

### Supported Languages

Shiki supports most common languages. Check if your language is already supported:

```typescript
// Check available languages
import { bundledLanguages } from 'shiki';
console.log(Object.keys(bundledLanguages));
```

### Adding Custom Grammar

If your language isn't supported by Shiki:

1. Create a TextMate grammar file (`.tmLanguage.json`)
2. Register it with Shiki:

```typescript
// src/features/syntax/shiki-highlighter.ts
import customGrammar from './grammars/mylang.tmLanguage.json';

const highlighter = await createHighlighter({
  themes: ['one-dark-pro'],
  langs: [
    ...bundledLanguages,
    {
      id: 'mylang',
      scopeName: 'source.mylang',
      grammar: customGrammar,
      aliases: ['ml']
    }
  ]
});
```

### File Extension Mapping

Map file extensions to languages:

```typescript
// src/features/syntax/language-detection.ts
const extensionMap: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.mylang': 'mylang',  // Add your language
  '.ml': 'mylang',      // Alternative extension
};

export function detectLanguage(filename: string): string {
  const ext = path.extname(filename);
  return extensionMap[ext] ?? 'plaintext';
}
```

## LSP Support

### Prerequisites

1. Install the language server globally:

```bash
# TypeScript
npm install -g typescript-language-server typescript

# Python
pip install pyright

# Go
go install golang.org/x/tools/gopls@latest

# Rust
rustup component add rust-analyzer
```

### Configuring a Language Server

Add server configuration in settings:

```json
{
  "lsp.servers": {
    "mylang": {
      "command": "mylang-language-server",
      "args": ["--stdio"],
      "filetypes": ["mylang"],
      "rootPatterns": ["mylang.config", ".mylangrc"]
    }
  }
}
```

### Configuration Options

| Option | Description |
|--------|-------------|
| `command` | Executable name or path |
| `args` | Command-line arguments |
| `filetypes` | File types to activate for |
| `rootPatterns` | Files that identify project root |
| `initializationOptions` | Server-specific options |

### Server Registration

Register the server in LSP manager:

```typescript
// src/features/lsp/manager.ts
const serverConfigs: Record<string, ServerConfig> = {
  typescript: {
    command: 'typescript-language-server',
    args: ['--stdio'],
    filetypes: ['typescript', 'javascript', 'tsx', 'jsx'],
    rootPatterns: ['tsconfig.json', 'package.json']
  },

  // Add your language
  mylang: {
    command: 'mylang-language-server',
    args: ['--stdio'],
    filetypes: ['mylang'],
    rootPatterns: ['mylang.config']
  }
};
```

### Implementing LSP Client

If using a standard LSP server, no additional code is needed. For non-standard servers:

```typescript
// Custom initialization options
const initOptions = {
  mylang: {
    enableFeatureX: true,
    maxComplexity: 100
  }
};

// Pass to server during initialization
await client.initialize({
  rootUri: projectRoot,
  capabilities: clientCapabilities,
  initializationOptions: initOptions.mylang
});
```

## Complete Example: Adding Ruby Support

### 1. Verify Syntax Highlighting

Ruby is supported by Shiki by default. Verify the extension mapping:

```typescript
// src/features/syntax/language-detection.ts
const extensionMap = {
  // ... existing mappings
  '.rb': 'ruby',
  '.rake': 'ruby',
  '.gemspec': 'ruby',
  'Gemfile': 'ruby',
  'Rakefile': 'ruby',
};
```

### 2. Install Language Server

```bash
gem install solargraph
```

### 3. Configure LSP

Add to `~/.config/ultra/settings.json`:

```json
{
  "lsp.servers": {
    "ruby": {
      "command": "solargraph",
      "args": ["stdio"],
      "filetypes": ["ruby"],
      "rootPatterns": ["Gemfile", ".ruby-version"]
    }
  }
}
```

### 4. Add Server Config (Optional)

For built-in support, add to `src/features/lsp/manager.ts`:

```typescript
const serverConfigs = {
  // ... existing configs

  ruby: {
    command: 'solargraph',
    args: ['stdio'],
    filetypes: ['ruby'],
    rootPatterns: ['Gemfile', '.ruby-version'],
    initializationOptions: {
      formatting: true,
      diagnostics: true
    }
  }
};
```

## File-Specific Settings

Some languages need specific editor settings:

```typescript
// src/config/language-settings.ts
const languageSettings: Record<string, EditorSettings> = {
  python: {
    tabSize: 4,
    insertSpaces: true
  },
  go: {
    tabSize: 4,
    insertSpaces: false  // Go uses tabs
  },
  ruby: {
    tabSize: 2,
    insertSpaces: true
  }
};

export function getLanguageSettings(language: string): EditorSettings {
  return languageSettings[language] ?? defaultSettings;
}
```

## Testing Language Support

### 1. Test Syntax Highlighting

```bash
# Create test file
echo 'def hello
  puts "Hello, World!"
end' > test.rb

# Open in Ultra
bun src/index.ts test.rb
```

### 2. Test LSP Features

1. Open a file of your language
2. Try these features:
   - Hover over symbols
   - Trigger autocomplete (`Ctrl+Space`)
   - Go to definition (`F12`)
   - Find references (`Shift+F12`)

### 3. Check Debug Logs

```bash
bun src/index.ts --debug test.rb
cat debug.log | grep LSP
```

## Troubleshooting

### Syntax Highlighting Not Working

1. Check file extension mapping
2. Verify language ID matches Shiki
3. Check for grammar loading errors in debug log

### LSP Not Connecting

1. Verify language server is installed: `which <server>`
2. Check server configuration
3. Look for errors in debug.log
4. Try running server manually: `<server> --stdio`

### LSP Features Missing

1. Some servers don't support all features
2. Check server capabilities in initialize response
3. Verify project has required config files (tsconfig.json, etc.)

## Contributing Language Support

If you add support for a new language:

1. Add extension mapping
2. Add default LSP configuration
3. Add language-specific settings if needed
4. Test thoroughly
5. Update documentation
6. Submit a pull request

## Related Documentation

- [LSP Module](../modules/lsp.md) - LSP implementation details
- [Architecture Overview](../architecture/overview.md) - System architecture
- [Contributing](contributing.md) - Contribution guidelines
