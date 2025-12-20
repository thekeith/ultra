/**
 * Syntax Service Interface
 *
 * Defines the contract for syntax highlighting services.
 */

import type {
  HighlightToken,
  HighlightResult,
  SyntaxSession,
  SyntaxMetrics,
} from './types.ts';

/**
 * Syntax Service interface.
 *
 * Provides syntax highlighting for source code.
 */
export interface SyntaxService {
  // ─────────────────────────────────────────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check if the service is ready.
   */
  isReady(): boolean;

  /**
   * Wait for the service to be ready.
   *
   * @returns Whether the service is ready
   */
  waitForReady(): Promise<boolean>;

  // ─────────────────────────────────────────────────────────────────────────
  // Highlighting
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Highlight content.
   *
   * @param content The content to highlight
   * @param languageId The language ID
   * @returns Highlight result with tokenized lines
   */
  highlight(content: string, languageId: string): Promise<HighlightResult>;

  /**
   * Highlight a single line.
   *
   * @param content The full content
   * @param languageId The language ID
   * @param lineNumber The line number (0-indexed)
   * @returns Tokens for the line
   */
  highlightLine(
    content: string,
    languageId: string,
    lineNumber: number
  ): Promise<HighlightToken[]>;

  // ─────────────────────────────────────────────────────────────────────────
  // Sessions (for incremental highlighting)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a syntax session for a document.
   *
   * @param documentId The document ID
   * @param languageId The language ID
   * @param content Initial content
   * @returns The created session
   */
  createSession(
    documentId: string,
    languageId: string,
    content: string
  ): Promise<SyntaxSession>;

  /**
   * Update a session with new content.
   *
   * @param sessionId The session ID
   * @param content The new content
   */
  updateSession(sessionId: string, content: string): Promise<void>;

  /**
   * Get tokens for a line in a session.
   *
   * @param sessionId The session ID
   * @param lineNumber The line number
   * @returns Tokens for the line
   */
  getSessionTokens(sessionId: string, lineNumber: number): HighlightToken[];

  /**
   * Get all tokens for a session.
   *
   * @param sessionId The session ID
   * @returns All tokenized lines
   */
  getSessionAllTokens(sessionId: string): HighlightToken[][];

  /**
   * Dispose a session.
   *
   * @param sessionId The session ID
   */
  disposeSession(sessionId: string): void;

  /**
   * Get session info.
   *
   * @param sessionId The session ID
   * @returns Session info or null
   */
  getSession(sessionId: string): SyntaxSession | null;

  // ─────────────────────────────────────────────────────────────────────────
  // Language Support
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get list of supported languages.
   *
   * @returns Array of language IDs
   */
  getSupportedLanguages(): string[];

  /**
   * Check if a language is supported.
   *
   * @param languageId The language ID
   * @returns Whether the language is supported
   */
  isLanguageSupported(languageId: string): boolean;

  /**
   * Detect language from file path.
   *
   * @param filePath The file path
   * @returns Detected language ID or null
   */
  detectLanguage(filePath: string): string | null;

  // ─────────────────────────────────────────────────────────────────────────
  // Themes
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get available themes.
   *
   * @returns Array of theme names
   */
  getAvailableThemes(): string[];

  /**
   * Set the current theme.
   *
   * @param theme The theme name
   */
  setTheme(theme: string): void;

  /**
   * Get the current theme.
   *
   * @returns Current theme name
   */
  getTheme(): string;

  // ─────────────────────────────────────────────────────────────────────────
  // Metrics
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get service metrics.
   *
   * @returns Metrics object
   */
  getMetrics(): SyntaxMetrics;

  /**
   * Reset metrics.
   */
  resetMetrics(): void;
}
