/**
 * Outline Parsers
 *
 * Regex-based fallback parsers for generating outline symbols
 * when LSP is not available.
 */

import { SymbolKind } from '../../../services/lsp/index.ts';
import type { OutlineSymbol } from './outline-panel.ts';

// ============================================
// TypeScript/JavaScript Parser
// ============================================

/**
 * Parse TypeScript/JavaScript source for symbols.
 */
export function parseTypeScriptSymbols(content: string, uri: string): OutlineSymbol[] {
  const symbols: OutlineSymbol[] = [];
  const lines = content.split('\n');
  let idCounter = 0;

  // Track brace depth for approximate scope detection
  const scopeStack: OutlineSymbol[] = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx] ?? '';
    const trimmedLine = line.trim();

    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
      continue;
    }

    let symbol: OutlineSymbol | null = null;

    // Class declaration
    const classMatch = /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/.exec(trimmedLine);
    if (classMatch && classMatch[1]) {
      symbol = {
        id: `ts-${idCounter++}`,
        name: classMatch[1],
        kind: SymbolKind.Class,
        startLine: lineIdx,
        startColumn: line.indexOf(classMatch[1]),
        endLine: lineIdx,
        children: [],
      };
    }

    // Interface declaration
    const interfaceMatch = /^(?:export\s+)?interface\s+(\w+)/.exec(trimmedLine);
    if (!symbol && interfaceMatch && interfaceMatch[1]) {
      symbol = {
        id: `ts-${idCounter++}`,
        name: interfaceMatch[1],
        kind: SymbolKind.Interface,
        startLine: lineIdx,
        startColumn: line.indexOf(interfaceMatch[1]),
        endLine: lineIdx,
        children: [],
      };
    }

    // Type alias
    const typeMatch = /^(?:export\s+)?type\s+(\w+)/.exec(trimmedLine);
    if (!symbol && typeMatch && typeMatch[1]) {
      symbol = {
        id: `ts-${idCounter++}`,
        name: typeMatch[1],
        kind: SymbolKind.Interface,
        detail: 'type',
        startLine: lineIdx,
        startColumn: line.indexOf(typeMatch[1]),
        endLine: lineIdx,
        children: [],
      };
    }

    // Enum declaration
    const enumMatch = /^(?:export\s+)?(?:const\s+)?enum\s+(\w+)/.exec(trimmedLine);
    if (!symbol && enumMatch && enumMatch[1]) {
      symbol = {
        id: `ts-${idCounter++}`,
        name: enumMatch[1],
        kind: SymbolKind.Enum,
        startLine: lineIdx,
        startColumn: line.indexOf(enumMatch[1]),
        endLine: lineIdx,
        children: [],
      };
    }

    // Function declaration
    const functionMatch = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/.exec(trimmedLine);
    if (!symbol && functionMatch && functionMatch[1]) {
      symbol = {
        id: `ts-${idCounter++}`,
        name: functionMatch[1],
        kind: SymbolKind.Function,
        startLine: lineIdx,
        startColumn: line.indexOf(functionMatch[1]),
        endLine: lineIdx,
        children: [],
      };
    }

    // Arrow function const (top level)
    const arrowMatch = /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>/.exec(trimmedLine);
    if (!symbol && arrowMatch && arrowMatch[1]) {
      symbol = {
        id: `ts-${idCounter++}`,
        name: arrowMatch[1],
        kind: SymbolKind.Function,
        startLine: lineIdx,
        startColumn: line.indexOf(arrowMatch[1]),
        endLine: lineIdx,
        children: [],
      };
    }

    // Method (inside class - indented)
    const methodMatch = /^\s+(?:async\s+)?(?:static\s+)?(?:private\s+|protected\s+|public\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/.exec(line);
    if (!symbol && methodMatch && methodMatch[1] && scopeStack.length > 0) {
      const methodName = methodMatch[1];
      // Skip constructor, getter/setter keywords
      if (methodName !== 'if' && methodName !== 'for' && methodName !== 'while' && methodName !== 'switch') {
        symbol = {
          id: `ts-${idCounter++}`,
          name: methodName,
          kind: methodName === 'constructor' ? SymbolKind.Constructor : SymbolKind.Method,
          startLine: lineIdx,
          startColumn: line.indexOf(methodName),
          endLine: lineIdx,
          children: [],
        };
      }
    }

    // Property (inside class - indented)
    const propertyMatch = /^\s+(?:private\s+|protected\s+|public\s+)?(?:readonly\s+)?(\w+)\s*[?:]/.exec(line);
    if (!symbol && propertyMatch && propertyMatch[1] && scopeStack.length > 0) {
      const propName = propertyMatch[1];
      if (propName !== 'return' && propName !== 'const' && propName !== 'let' && propName !== 'var') {
        symbol = {
          id: `ts-${idCounter++}`,
          name: propName,
          kind: SymbolKind.Property,
          startLine: lineIdx,
          startColumn: line.indexOf(propName),
          endLine: lineIdx,
          children: [],
        };
      }
    }

    // Top-level const/let/var (only at root level)
    const varMatch = /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*[=:]/.exec(trimmedLine);
    if (!symbol && varMatch && varMatch[1] && scopeStack.length === 0) {
      symbol = {
        id: `ts-${idCounter++}`,
        name: varMatch[1],
        kind: SymbolKind.Variable,
        startLine: lineIdx,
        startColumn: line.indexOf(varMatch[1]),
        endLine: lineIdx,
        children: [],
      };
    }

    // Add symbol to appropriate parent
    if (symbol) {
      if (scopeStack.length > 0) {
        const parent = scopeStack[scopeStack.length - 1]!;
        symbol.parent = parent;
        parent.children = parent.children || [];
        parent.children.push(symbol);
      } else {
        symbols.push(symbol);
      }

      // Push class/interface/enum to scope stack (they can contain members)
      if (symbol.kind === SymbolKind.Class || symbol.kind === SymbolKind.Interface || symbol.kind === SymbolKind.Enum) {
        scopeStack.push(symbol);
      }
    }

    // Track brace depth for scope management (simplified)
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;

    // Pop scope when closing brace at line start (end of class/interface)
    if (closeBraces > openBraces && scopeStack.length > 0 && trimmedLine.startsWith('}')) {
      scopeStack.pop();
    }
  }

  return symbols;
}

// ============================================
// Markdown Parser
// ============================================

/**
 * Parse Markdown for headers as symbols.
 * Creates a nested hierarchy based on header levels.
 */
export function parseMarkdownSymbols(content: string, _uri: string): OutlineSymbol[] {
  const symbols: OutlineSymbol[] = [];
  const lines = content.split('\n');
  let idCounter = 0;

  // Track hierarchy for nesting
  const stack: { level: number; symbol: OutlineSymbol }[] = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx] ?? '';

    // Match ATX-style headers (# Header)
    const headerMatch = /^(#{1,6})\s+(.+)$/.exec(line);

    if (headerMatch) {
      const level = headerMatch[1]!.length;
      const title = headerMatch[2]!.trim();

      const symbol: OutlineSymbol = {
        id: `md-${idCounter++}`,
        name: title,
        kind: SymbolKind.String, // Use String kind for headers
        detail: `H${level}`,
        startLine: lineIdx,
        startColumn: 0,
        endLine: lineIdx,
        children: [],
      };

      // Pop stack until we find a parent with lower level
      while (stack.length > 0 && stack[stack.length - 1]!.level >= level) {
        stack.pop();
      }

      // Add as child to parent or as root
      if (stack.length > 0) {
        const parent = stack[stack.length - 1]!.symbol;
        symbol.parent = parent;
        parent.children = parent.children || [];
        parent.children.push(symbol);
      } else {
        symbols.push(symbol);
      }

      stack.push({ level, symbol });
    }

    // Also match code fence blocks with language identifiers
    const codeFenceMatch = /^```(\w+)/.exec(line);
    if (codeFenceMatch && codeFenceMatch[1]) {
      const lang = codeFenceMatch[1];
      const symbol: OutlineSymbol = {
        id: `md-code-${idCounter++}`,
        name: `Code: ${lang}`,
        kind: SymbolKind.Module,
        detail: 'code block',
        startLine: lineIdx,
        startColumn: 0,
        endLine: lineIdx,
        children: [],
      };

      // Add as child to current header or as root
      if (stack.length > 0) {
        const parent = stack[stack.length - 1]!.symbol;
        symbol.parent = parent;
        parent.children = parent.children || [];
        parent.children.push(symbol);
      } else {
        symbols.push(symbol);
      }
    }
  }

  return symbols;
}

// ============================================
// Parser Registry
// ============================================

type SymbolParser = (content: string, uri: string) => OutlineSymbol[];

const parserRegistry: Record<string, SymbolParser> = {
  ts: parseTypeScriptSymbols,
  tsx: parseTypeScriptSymbols,
  js: parseTypeScriptSymbols,
  jsx: parseTypeScriptSymbols,
  mjs: parseTypeScriptSymbols,
  cjs: parseTypeScriptSymbols,
  md: parseMarkdownSymbols,
  markdown: parseMarkdownSymbols,
};

/**
 * Get parser for a file based on extension.
 * Returns null if no parser is available.
 */
export function getSymbolParser(uri: string): SymbolParser | null {
  const ext = uri.split('.').pop()?.toLowerCase() ?? '';
  return parserRegistry[ext] ?? null;
}

/**
 * Check if a file has a fallback parser available.
 */
export function hasSymbolParser(uri: string): boolean {
  return getSymbolParser(uri) !== null;
}
