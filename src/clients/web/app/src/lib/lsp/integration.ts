/**
 * Monaco LSP Integration
 *
 * Integrates Monaco editor with Ultra's LSP service via ECP.
 */

// IMPORTANT: Monaco environment must be configured before monaco import
import '../monaco-env';

import * as monaco from 'monaco-editor';
import { ecpClient } from '../ecp/client';

// LSP types from server
interface LSPPosition {
  line: number;
  character: number;
}

interface LSPRange {
  start: LSPPosition;
  end: LSPPosition;
}

interface LSPLocation {
  uri: string;
  range: LSPRange;
}

interface LSPCompletionItem {
  label: string;
  kind?: number;
  detail?: string;
  documentation?: string | { kind: string; value: string };
  insertText?: string;
  insertTextFormat?: number;
  textEdit?: {
    range: LSPRange;
    newText: string;
  };
  additionalTextEdits?: Array<{
    range: LSPRange;
    newText: string;
  }>;
  sortText?: string;
  filterText?: string;
}

interface LSPHover {
  contents: string | { kind: string; value: string } | Array<string | { kind: string; value: string }>;
  range?: LSPRange;
}

interface LSPSignatureHelp {
  signatures: Array<{
    label: string;
    documentation?: string | { kind: string; value: string };
    parameters?: Array<{
      label: string | [number, number];
      documentation?: string | { kind: string; value: string };
    }>;
  }>;
  activeSignature?: number;
  activeParameter?: number;
}

interface LSPDiagnostic {
  range: LSPRange;
  severity?: number;
  code?: string | number;
  source?: string;
  message: string;
}

// Monaco completion item kinds mapping
const LSP_TO_MONACO_COMPLETION_KIND: Record<number, monaco.languages.CompletionItemKind> = {
  1: monaco.languages.CompletionItemKind.Text,
  2: monaco.languages.CompletionItemKind.Method,
  3: monaco.languages.CompletionItemKind.Function,
  4: monaco.languages.CompletionItemKind.Constructor,
  5: monaco.languages.CompletionItemKind.Field,
  6: monaco.languages.CompletionItemKind.Variable,
  7: monaco.languages.CompletionItemKind.Class,
  8: monaco.languages.CompletionItemKind.Interface,
  9: monaco.languages.CompletionItemKind.Module,
  10: monaco.languages.CompletionItemKind.Property,
  11: monaco.languages.CompletionItemKind.Unit,
  12: monaco.languages.CompletionItemKind.Value,
  13: monaco.languages.CompletionItemKind.Enum,
  14: monaco.languages.CompletionItemKind.Keyword,
  15: monaco.languages.CompletionItemKind.Snippet,
  16: monaco.languages.CompletionItemKind.Color,
  17: monaco.languages.CompletionItemKind.File,
  18: monaco.languages.CompletionItemKind.Reference,
  19: monaco.languages.CompletionItemKind.Folder,
  20: monaco.languages.CompletionItemKind.EnumMember,
  21: monaco.languages.CompletionItemKind.Constant,
  22: monaco.languages.CompletionItemKind.Struct,
  23: monaco.languages.CompletionItemKind.Event,
  24: monaco.languages.CompletionItemKind.Operator,
  25: monaco.languages.CompletionItemKind.TypeParameter,
};

// Monaco severity mapping
const LSP_TO_MONACO_SEVERITY: Record<number, monaco.MarkerSeverity> = {
  1: monaco.MarkerSeverity.Error,
  2: monaco.MarkerSeverity.Warning,
  3: monaco.MarkerSeverity.Info,
  4: monaco.MarkerSeverity.Hint,
};

/**
 * Convert Monaco position to LSP position.
 */
function toPosition(pos: monaco.Position): LSPPosition {
  return {
    line: pos.lineNumber - 1, // Monaco is 1-based, LSP is 0-based
    character: pos.column - 1,
  };
}

/**
 * Convert LSP range to Monaco range.
 */
function toMonacoRange(range: LSPRange): monaco.IRange {
  return {
    startLineNumber: range.start.line + 1,
    startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.character + 1,
  };
}

/**
 * Extract markdown content from LSP hover/documentation.
 */
function extractMarkdown(
  content: string | { kind: string; value: string } | Array<string | { kind: string; value: string }>
): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map(extractMarkdown).join('\n\n');
  }
  if (content && typeof content === 'object') {
    return content.value;
  }
  return '';
}

/**
 * LSP Integration class.
 * Manages Monaco provider registration and diagnostics.
 */
class LSPIntegration {
  private disposables: monaco.IDisposable[] = [];
  private registeredLanguages = new Set<string>();
  private workspaceUri: string = '';

  /**
   * Initialize LSP integration.
   */
  async init(workspaceRoot: string): Promise<void> {
    this.workspaceUri = workspaceRoot.startsWith('file://')
      ? workspaceRoot
      : `file://${workspaceRoot}`;

    // Subscribe to diagnostics notifications
    ecpClient.subscribe('lsp/didPublishDiagnostics', (params: unknown) => {
      const { uri, diagnostics } = params as { uri: string; diagnostics: LSPDiagnostic[] };
      this.applyDiagnostics(uri, diagnostics);
    });
  }

  /**
   * Register LSP providers for a language.
   */
  registerLanguage(languageId: string): void {
    if (this.registeredLanguages.has(languageId)) {
      return;
    }

    this.registeredLanguages.add(languageId);

    // Register completion provider
    this.disposables.push(
      monaco.languages.registerCompletionItemProvider(languageId, {
        triggerCharacters: ['.', ':', '<', '"', "'", '/', '@', '#'],
        provideCompletionItems: async (model, position, _context, _token) => {
          return this.provideCompletions(model, position);
        },
      })
    );

    // Register hover provider
    this.disposables.push(
      monaco.languages.registerHoverProvider(languageId, {
        provideHover: async (model, position, _token) => {
          return this.provideHover(model, position);
        },
      })
    );

    // Register signature help provider
    this.disposables.push(
      monaco.languages.registerSignatureHelpProvider(languageId, {
        signatureHelpTriggerCharacters: ['(', ','],
        signatureHelpRetriggerCharacters: [','],
        provideSignatureHelp: async (model, position, _token, _context) => {
          return this.provideSignatureHelp(model, position);
        },
      })
    );

    // Register definition provider
    this.disposables.push(
      monaco.languages.registerDefinitionProvider(languageId, {
        provideDefinition: async (model, position, _token) => {
          return this.provideDefinition(model, position);
        },
      })
    );

    // Register references provider
    this.disposables.push(
      monaco.languages.registerReferenceProvider(languageId, {
        provideReferences: async (model, position, _context, _token) => {
          return this.provideReferences(model, position);
        },
      })
    );
  }

  /**
   * Notify LSP server that a document was opened.
   */
  async documentOpened(uri: string, languageId: string, content: string): Promise<void> {
    try {
      // Start LSP server for this language if not already running
      const { available } = await ecpClient.request<{ available: boolean }>('lsp/hasServerFor', {
        languageId,
      });

      if (available) {
        // Try to start server (may already be running)
        try {
          await ecpClient.request('lsp/start', {
            languageId,
            workspaceUri: this.workspaceUri,
          });
        } catch {
          // Server might already be running, ignore
        }

        // Register providers for this language
        this.registerLanguage(languageId);

        // Notify document opened
        await ecpClient.request('lsp/documentOpen', {
          uri,
          languageId,
          content,
        });
      }
    } catch (error) {
      console.error('LSP document open failed:', error);
    }
  }

  /**
   * Notify LSP server that a document changed.
   */
  async documentChanged(uri: string, content: string, version: number): Promise<void> {
    try {
      await ecpClient.request('lsp/documentChange', {
        uri,
        content,
        version,
      });
    } catch {
      // Ignore errors (document might not be tracked by LSP)
    }
  }

  /**
   * Notify LSP server that a document was saved.
   */
  async documentSaved(uri: string): Promise<void> {
    try {
      await ecpClient.request('lsp/documentSave', { uri });
    } catch {
      // Ignore errors
    }
  }

  /**
   * Notify LSP server that a document was closed.
   */
  async documentClosed(uri: string): Promise<void> {
    try {
      await ecpClient.request('lsp/documentClose', { uri });
    } catch {
      // Ignore errors
    }
  }

  /**
   * Provide completions.
   */
  private async provideCompletions(
    model: monaco.editor.ITextModel,
    position: monaco.Position
  ): Promise<monaco.languages.CompletionList | null> {
    try {
      const result = await ecpClient.request<{ items: LSPCompletionItem[] }>('lsp/completion', {
        uri: model.uri.toString(),
        position: toPosition(position),
      });

      if (!result.items || result.items.length === 0) {
        return null;
      }

      const word = model.getWordUntilPosition(position);
      const range: monaco.IRange = {
        startLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endLineNumber: position.lineNumber,
        endColumn: word.endColumn,
      };

      const suggestions: monaco.languages.CompletionItem[] = result.items.map((item) => {
        const insertText = item.insertText || item.label;
        const insertTextRules =
          item.insertTextFormat === 2
            ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            : undefined;

        return {
          label: item.label,
          kind: item.kind ? LSP_TO_MONACO_COMPLETION_KIND[item.kind] : monaco.languages.CompletionItemKind.Text,
          detail: item.detail,
          documentation: item.documentation ? { value: extractMarkdown(item.documentation) } : undefined,
          insertText,
          insertTextRules,
          range: item.textEdit ? toMonacoRange(item.textEdit.range) : range,
          sortText: item.sortText,
          filterText: item.filterText,
        };
      });

      return { suggestions };
    } catch {
      return null;
    }
  }

  /**
   * Provide hover information.
   */
  private async provideHover(
    model: monaco.editor.ITextModel,
    position: monaco.Position
  ): Promise<monaco.languages.Hover | null> {
    try {
      const result = await ecpClient.request<LSPHover | null>('lsp/hover', {
        uri: model.uri.toString(),
        position: toPosition(position),
      });

      if (!result || !result.contents) {
        return null;
      }

      const contents: monaco.IMarkdownString[] = [
        { value: extractMarkdown(result.contents) },
      ];

      return {
        contents,
        range: result.range ? toMonacoRange(result.range) : undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Provide signature help.
   */
  private async provideSignatureHelp(
    model: monaco.editor.ITextModel,
    position: monaco.Position
  ): Promise<monaco.languages.SignatureHelpResult | null> {
    try {
      const result = await ecpClient.request<LSPSignatureHelp | null>('lsp/signatureHelp', {
        uri: model.uri.toString(),
        position: toPosition(position),
      });

      if (!result || !result.signatures || result.signatures.length === 0) {
        return null;
      }

      const signatures: monaco.languages.SignatureInformation[] = result.signatures.map((sig) => ({
        label: sig.label,
        documentation: sig.documentation
          ? { value: extractMarkdown(sig.documentation) }
          : undefined,
        parameters: (sig.parameters || []).map((param) => ({
          label: typeof param.label === 'string' ? param.label : param.label,
          documentation: param.documentation
            ? { value: extractMarkdown(param.documentation) }
            : undefined,
        })),
      }));

      return {
        value: {
          signatures,
          activeSignature: result.activeSignature ?? 0,
          activeParameter: result.activeParameter ?? 0,
        },
        dispose: () => {},
      };
    } catch {
      return null;
    }
  }

  /**
   * Provide definition locations.
   */
  private async provideDefinition(
    model: monaco.editor.ITextModel,
    position: monaco.Position
  ): Promise<monaco.languages.Definition | null> {
    try {
      const result = await ecpClient.request<{ locations: LSPLocation[] }>('lsp/definition', {
        uri: model.uri.toString(),
        position: toPosition(position),
      });

      if (!result.locations || result.locations.length === 0) {
        return null;
      }

      return result.locations.map((loc) => ({
        uri: monaco.Uri.parse(loc.uri),
        range: toMonacoRange(loc.range),
      }));
    } catch {
      return null;
    }
  }

  /**
   * Provide references.
   */
  private async provideReferences(
    model: monaco.editor.ITextModel,
    position: monaco.Position
  ): Promise<monaco.languages.Location[] | null> {
    try {
      const result = await ecpClient.request<{ locations: LSPLocation[] }>('lsp/references', {
        uri: model.uri.toString(),
        position: toPosition(position),
        includeDeclaration: true,
      });

      if (!result.locations || result.locations.length === 0) {
        return null;
      }

      return result.locations.map((loc) => ({
        uri: monaco.Uri.parse(loc.uri),
        range: toMonacoRange(loc.range),
      }));
    } catch {
      return null;
    }
  }

  /**
   * Apply diagnostics to a document.
   */
  private applyDiagnostics(uri: string, diagnostics: LSPDiagnostic[]): void {
    const model = monaco.editor.getModels().find((m) => m.uri.toString() === uri);
    if (!model) {
      return;
    }

    const markers: monaco.editor.IMarkerData[] = diagnostics.map((diag) => {
      const severity = diag.severity
        ? (LSP_TO_MONACO_SEVERITY[diag.severity] ?? monaco.MarkerSeverity.Error)
        : monaco.MarkerSeverity.Error;

      return {
        severity,
        message: diag.message,
        startLineNumber: diag.range.start.line + 1,
        startColumn: diag.range.start.character + 1,
        endLineNumber: diag.range.end.line + 1,
        endColumn: diag.range.end.character + 1,
        source: diag.source,
        code: diag.code?.toString(),
      };
    });

    monaco.editor.setModelMarkers(model, 'lsp', markers);
  }

  /**
   * Dispose all resources.
   */
  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.registeredLanguages.clear();
  }
}

// Singleton instance
export const lspIntegration = new LSPIntegration();
export default lspIntegration;
