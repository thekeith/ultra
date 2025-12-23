/**
 * Syntax Service Types
 *
 * Type definitions for the Syntax Service.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Highlight Token Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single highlight token within a line.
 */
export interface HighlightToken {
  /** Column start (0-indexed) */
  start: number;

  /** Column end (exclusive) */
  end: number;

  /** TextMate-style scope (for compatibility) */
  scope: string;

  /** Hex color from theme */
  color?: string;
}

/**
 * Result of highlighting content.
 */
export interface HighlightResult {
  /** Tokenized lines */
  lines: HighlightToken[][];

  /** Language used for highlighting */
  languageId: string;

  /** Parse timing in milliseconds */
  timing?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A syntax highlighting session for a document.
 */
export interface SyntaxSession {
  /** Unique session ID */
  sessionId: string;

  /** Associated document ID */
  documentId: string;

  /** Language ID for highlighting */
  languageId: string;

  /** Session version (incremented on updates) */
  version: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Available syntax themes.
 */
export const SYNTAX_THEMES = [
  'catppuccin-frappe',
  'catppuccin-mocha',
  'catppuccin-macchiato',
  'catppuccin-latte',
  'github-dark',
  'github-light',
] as const;

export type SyntaxTheme = (typeof SYNTAX_THEMES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Language Mapping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map VS Code language IDs to Shiki language IDs.
 */
export const LANGUAGE_MAP: Record<string, string> = {
  typescript: 'typescript',
  typescriptreact: 'tsx',
  javascript: 'javascript',
  javascriptreact: 'jsx',
  json: 'json',
  jsonc: 'jsonc',
  python: 'python',
  rust: 'rust',
  go: 'go',
  c: 'c',
  cpp: 'cpp',
  html: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  markdown: 'markdown',
  yaml: 'yaml',
  toml: 'toml',
  shellscript: 'bash',
  bash: 'bash',
  sh: 'bash',
  zsh: 'bash',
  ruby: 'ruby',
  java: 'java',
  kotlin: 'kotlin',
  swift: 'swift',
  php: 'php',
  sql: 'sql',
  graphql: 'graphql',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  lua: 'lua',
  perl: 'perl',
  r: 'r',
  scala: 'scala',
  elixir: 'elixir',
  erlang: 'erlang',
  haskell: 'haskell',
  clojure: 'clojure',
  vim: 'viml',
  xml: 'xml',
  svg: 'xml',
};

/**
 * File extension to language ID mapping.
 */
export const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescriptreact',
  '.js': 'javascript',
  '.jsx': 'javascriptreact',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.json': 'json',
  '.jsonc': 'jsonc',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.md': 'markdown',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'bash',
  '.rb': 'ruby',
  '.java': 'java',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.php': 'php',
  '.sql': 'sql',
  '.graphql': 'graphql',
  '.gql': 'graphql',
  '.lua': 'lua',
  '.pl': 'perl',
  '.r': 'r',
  '.scala': 'scala',
  '.ex': 'elixir',
  '.exs': 'elixir',
  '.erl': 'erlang',
  '.hs': 'haskell',
  '.clj': 'clojure',
  '.vim': 'vim',
  '.xml': 'xml',
  '.svg': 'xml',
};

// ─────────────────────────────────────────────────────────────────────────────
// Metrics Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Syntax service metrics.
 */
export interface SyntaxMetrics {
  /** Number of parse operations */
  parseCount: number;

  /** Cache hit count */
  cacheHits: number;

  /** Cache miss count */
  cacheMisses: number;

  /** Average parse time in milliseconds */
  averageParseTime: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Callback Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unsubscribe function returned by event subscriptions.
 */
export type Unsubscribe = () => void;
