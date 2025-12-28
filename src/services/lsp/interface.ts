/**
 * LSP Service Interface
 *
 * Defines the contract for LSP (Language Server Protocol) services.
 */

import type {
  LSPPosition,
  LSPLocation,
  LSPDiagnostic,
  LSPCompletionItem,
  LSPHover,
  LSPSignatureHelp,
  LSPDocumentSymbol,
  LSPSymbolInformation,
  ServerConfig,
  ServerStatus,
  ServerInfo,
  WorkspaceEdit,
  DiagnosticsCallback,
  ServerStatusCallback,
  Unsubscribe,
} from './types.ts';

/**
 * LSP Service interface.
 *
 * Provides language server protocol features for code intelligence.
 */
export interface LSPService {
  // ─────────────────────────────────────────────────────────────────────────
  // Server Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Start a language server.
   *
   * @param languageId The language ID (e.g., 'typescript', 'rust')
   * @param workspaceUri The workspace root URI
   * @returns Server info if started successfully
   */
  startServer(languageId: string, workspaceUri: string): Promise<ServerInfo>;

  /**
   * Stop a language server.
   *
   * @param languageId The language ID
   */
  stopServer(languageId: string): Promise<void>;

  /**
   * Get status of language servers.
   *
   * @param languageId Optional language ID to filter by
   * @returns Array of server statuses
   */
  getServerStatus(languageId?: string): ServerStatus[];

  /**
   * Check if LSP is enabled.
   */
  isEnabled(): boolean;

  /**
   * Enable or disable LSP.
   */
  setEnabled(enabled: boolean): void;

  // ─────────────────────────────────────────────────────────────────────────
  // Document Sync
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Notify that a document was opened.
   *
   * @param uri Document URI
   * @param languageId Language ID
   * @param content Document content
   */
  documentOpened(uri: string, languageId: string, content: string): Promise<void>;

  /**
   * Notify that a document changed.
   *
   * @param uri Document URI
   * @param content New document content
   * @param version Document version
   */
  documentChanged(uri: string, content: string, version: number): Promise<void>;

  /**
   * Notify that a document was saved.
   *
   * @param uri Document URI
   * @param content Optional document content
   */
  documentSaved(uri: string, content?: string): Promise<void>;

  /**
   * Notify that a document was closed.
   *
   * @param uri Document URI
   */
  documentClosed(uri: string): Promise<void>;

  // ─────────────────────────────────────────────────────────────────────────
  // Code Intelligence
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get completion items at position.
   *
   * @param uri Document URI
   * @param position Cursor position
   * @returns Array of completion items
   */
  getCompletions(uri: string, position: LSPPosition): Promise<LSPCompletionItem[]>;

  /**
   * Get hover information at position.
   *
   * @param uri Document URI
   * @param position Cursor position
   * @returns Hover info or null
   */
  getHover(uri: string, position: LSPPosition): Promise<LSPHover | null>;

  /**
   * Get signature help at position.
   *
   * @param uri Document URI
   * @param position Cursor position
   * @returns Signature help or null
   */
  getSignatureHelp(uri: string, position: LSPPosition): Promise<LSPSignatureHelp | null>;

  /**
   * Get definition locations.
   *
   * @param uri Document URI
   * @param position Cursor position
   * @returns Array of locations
   */
  getDefinition(uri: string, position: LSPPosition): Promise<LSPLocation[]>;

  /**
   * Get reference locations.
   *
   * @param uri Document URI
   * @param position Cursor position
   * @param includeDeclaration Whether to include the declaration
   * @returns Array of locations
   */
  getReferences(
    uri: string,
    position: LSPPosition,
    includeDeclaration?: boolean
  ): Promise<LSPLocation[]>;

  /**
   * Get document symbols.
   *
   * @param uri Document URI
   * @returns Array of symbols
   */
  getDocumentSymbols(uri: string): Promise<LSPDocumentSymbol[] | LSPSymbolInformation[]>;

  /**
   * Rename a symbol.
   *
   * @param uri Document URI
   * @param position Symbol position
   * @param newName New name for the symbol
   * @returns Workspace edit to apply
   */
  rename(uri: string, position: LSPPosition, newName: string): Promise<WorkspaceEdit | null>;

  // ─────────────────────────────────────────────────────────────────────────
  // Diagnostics
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get diagnostics for a document.
   *
   * @param uri Document URI
   * @returns Array of diagnostics
   */
  getDiagnostics(uri: string): LSPDiagnostic[];

  /**
   * Get all diagnostics.
   *
   * @returns Map of URI to diagnostics
   */
  getAllDiagnostics(): Map<string, LSPDiagnostic[]>;

  /**
   * Get diagnostics summary.
   *
   * @returns Error and warning counts
   */
  getDiagnosticsSummary(): { errors: number; warnings: number };

  /**
   * Subscribe to diagnostics updates.
   *
   * @param callback Callback for diagnostics updates
   * @returns Unsubscribe function
   */
  onDiagnostics(callback: DiagnosticsCallback): Unsubscribe;

  // ─────────────────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set custom server configuration.
   *
   * @param languageId Language ID
   * @param config Server configuration
   */
  setServerConfig(languageId: string, config: ServerConfig): void;

  /**
   * Get server configuration.
   *
   * @param languageId Language ID
   * @returns Server configuration or null
   */
  getServerConfig(languageId: string): ServerConfig | null;

  /**
   * Get language ID from file path.
   *
   * @param filePath File path
   * @returns Language ID or null
   */
  getLanguageId(filePath: string): string | null;

  /**
   * Check if a server is available for a language.
   *
   * @param languageId Language ID
   * @returns Whether a server is available
   */
  hasServerFor(languageId: string): boolean;

  /**
   * Configure the SQL language server with database connection settings.
   * This allows the postgres-language-server to provide schema-aware completions and hover.
   *
   * @param config Database connection configuration
   */
  configureSQLServer(config: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  }): void;

  // ─────────────────────────────────────────────────────────────────────────
  // Events
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Subscribe to server status changes.
   *
   * @param callback Callback for status changes
   * @returns Unsubscribe function
   */
  onServerStatusChange(callback: ServerStatusCallback): Unsubscribe;

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set the workspace root.
   *
   * @param root Workspace root path
   */
  setWorkspaceRoot(root: string): void;

  /**
   * Get the workspace root.
   */
  getWorkspaceRoot(): string;

  /**
   * Shutdown all language servers.
   */
  shutdown(): Promise<void>;
}
