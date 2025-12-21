/**
 * LSP Service
 *
 * Provides Language Server Protocol integration for code intelligence.
 */

// Types
export type {
  LSPPosition,
  LSPRange,
  LSPLocation,
  LSPDiagnostic,
  LSPCompletionItem,
  LSPHover,
  LSPSignatureHelp,
  LSPSignatureInformation,
  LSPParameterInformation,
  LSPDocumentSymbol,
  LSPSymbolInformation,
  ServerConfig,
  ServerStatus,
  ServerStatusState,
  ServerInfo,
  TextEdit,
  TextDocumentEdit,
  WorkspaceEdit,
  DiagnosticsCallback,
  ServerStatusCallback,
  Unsubscribe,
} from './types.ts';

export {
  SymbolKind,
  CompletionItemKind,
  DiagnosticSeverity,
  EXTENSION_TO_LANGUAGE,
  DEFAULT_SERVERS,
} from './types.ts';

// Errors
export { LSPError, LSPErrorCode } from './errors.ts';

// Interface
export type { LSPService } from './interface.ts';

// Implementation
export { LocalLSPService, localLSPService } from './service.ts';

// Adapter
export { LSPServiceAdapter, LSPECPErrorCodes } from './adapter.ts';
