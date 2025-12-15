/**
 * Diagnostics Renderer
 * 
 * Manages and renders LSP diagnostics (errors, warnings, hints, info)
 * as squiggly underlines in the editor and gutter icons.
 */

import type { RenderContext } from '../../ui/renderer.ts';
import type { LSPDiagnostic } from './client.ts';
import { themeLoader } from '../../ui/themes/theme-loader.ts';

// Diagnostic severity constants (from LSP spec)
export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4
}

// Diagnostic for a specific document
interface DocumentDiagnostics {
  uri: string;
  diagnostics: LSPDiagnostic[];
  version: number;
}

// Gutter icon info
interface GutterIcon {
  line: number;
  severity: number;
  count: number;
}

export class DiagnosticsRenderer {
  private documentDiagnostics: Map<string, DocumentDiagnostics> = new Map();
  private onChangeCallbacks: Set<(uri: string) => void> = new Set();

  /**
   * Set diagnostics for a document
   */
  setDiagnostics(uri: string, diagnostics: LSPDiagnostic[]): void {
    const existing = this.documentDiagnostics.get(uri);
    this.documentDiagnostics.set(uri, {
      uri,
      diagnostics,
      version: (existing?.version || 0) + 1
    });

    // Notify listeners
    for (const callback of this.onChangeCallbacks) {
      callback(uri);
    }
  }

  /**
   * Clear diagnostics for a document
   */
  clearDiagnostics(uri: string): void {
    if (this.documentDiagnostics.has(uri)) {
      this.documentDiagnostics.delete(uri);
      for (const callback of this.onChangeCallbacks) {
        callback(uri);
      }
    }
  }

  /**
   * Get diagnostics for a document
   */
  getDiagnostics(uri: string): LSPDiagnostic[] {
    return this.documentDiagnostics.get(uri)?.diagnostics || [];
  }

  /**
   * Get diagnostics for a specific line
   */
  getDiagnosticsForLine(uri: string, line: number): LSPDiagnostic[] {
    const diagnostics = this.getDiagnostics(uri);
    return diagnostics.filter(d => d.range.start.line === line);
  }

  /**
   * Get diagnostics that overlap a position
   */
  getDiagnosticsAtPosition(uri: string, line: number, column: number): LSPDiagnostic[] {
    const diagnostics = this.getDiagnostics(uri);
    return diagnostics.filter(d => {
      const { start, end } = d.range;
      // Single-line diagnostic
      if (start.line === end.line && start.line === line) {
        return column >= start.character && column <= end.character;
      }
      // Multi-line diagnostic
      if (line > start.line && line < end.line) return true;
      if (line === start.line && column >= start.character) return true;
      if (line === end.line && column <= end.character) return true;
      return false;
    });
  }

  /**
   * Get gutter icons for visible lines
   */
  getGutterIcons(uri: string, startLine: number, endLine: number): GutterIcon[] {
    const diagnostics = this.getDiagnostics(uri);
    const lineMap = new Map<number, GutterIcon>();

    for (const d of diagnostics) {
      const line = d.range.start.line;
      if (line < startLine || line > endLine) continue;

      const existing = lineMap.get(line);
      if (!existing) {
        lineMap.set(line, { line, severity: d.severity || 1, count: 1 });
      } else {
        existing.count++;
        // Keep highest severity (lowest number)
        if ((d.severity || 1) < existing.severity) {
          existing.severity = d.severity || 1;
        }
      }
    }

    return Array.from(lineMap.values());
  }

  /**
   * Get error/warning counts for a document
   */
  getCounts(uri: string): { errors: number; warnings: number; info: number; hints: number } {
    const diagnostics = this.getDiagnostics(uri);
    const counts = { errors: 0, warnings: 0, info: 0, hints: 0 };

    for (const d of diagnostics) {
      switch (d.severity) {
        case DiagnosticSeverity.Error: counts.errors++; break;
        case DiagnosticSeverity.Warning: counts.warnings++; break;
        case DiagnosticSeverity.Information: counts.info++; break;
        case DiagnosticSeverity.Hint: counts.hints++; break;
        default: counts.errors++;  // Default to error
      }
    }

    return counts;
  }

  /**
   * Get color for diagnostic severity
   */
  getColor(severity: number): string {
    switch (severity) {
      case DiagnosticSeverity.Error:
        return themeLoader.getColor('editorError.foreground') || '#f44747';
      case DiagnosticSeverity.Warning:
        return themeLoader.getColor('editorWarning.foreground') || '#ff9800';
      case DiagnosticSeverity.Information:
        return themeLoader.getColor('editorInfo.foreground') || '#4fc3f7';
      case DiagnosticSeverity.Hint:
        return themeLoader.getColor('editorHint.foreground') || '#aaaaaa';
      default:
        return '#f44747';
    }
  }

  /**
   * Get gutter icon character for severity
   */
  getGutterIcon(severity: number): string {
    switch (severity) {
      case DiagnosticSeverity.Error: return '●';    // Filled circle for error
      case DiagnosticSeverity.Warning: return '▲';  // Triangle for warning
      case DiagnosticSeverity.Information: return 'ℹ';  // Info symbol
      case DiagnosticSeverity.Hint: return '○';     // Empty circle for hint
      default: return '●';
    }
  }

  /**
   * Register callback for diagnostic changes
   */
  onChange(callback: (uri: string) => void): () => void {
    this.onChangeCallbacks.add(callback);
    return () => this.onChangeCallbacks.delete(callback);
  }

  /**
   * Render diagnostic squiggles for a line
   * Returns ANSI codes to render squiggly underlines
   */
  renderLineSquiggles(
    uri: string,
    line: number,
    lineContent: string,
    visibleStartCol: number,
    visibleEndCol: number,
    screenY: number,
    screenX: number,
    ctx: RenderContext
  ): void {
    const diagnostics = this.getDiagnosticsForLine(uri, line);
    if (diagnostics.length === 0) return;

    for (const diag of diagnostics) {
      const { start, end } = diag.range;
      
      // Skip if diagnostic is outside visible range
      if (end.character < visibleStartCol || start.character > visibleEndCol) continue;

      // Calculate visible portion of the diagnostic
      const startCol = Math.max(start.character, visibleStartCol) - visibleStartCol;
      const endCol = Math.min(
        end.line === line ? end.character : lineContent.length,
        visibleEndCol
      ) - visibleStartCol;

      if (startCol >= endCol) continue;

      // Get color based on severity
      const color = this.getColor(diag.severity || DiagnosticSeverity.Error);

      // Draw squiggly underline (using tilde characters as approximation)
      // In a real terminal, we might use Unicode combining characters or
      // a special underline style, but ~ works well for terminal rendering
      const squiggle = '~'.repeat(endCol - startCol);
      
      // Position and draw the squiggle (on the same line, using underline style)
      // We use a combination of underline style and colored text
      ctx.drawStyled(
        screenX + startCol,
        screenY,
        squiggle,
        color,
        undefined,
        { underline: true }
      );
    }
  }

  /**
   * Render gutter icon for a line
   */
  renderGutterIcon(
    uri: string,
    line: number,
    screenY: number,
    gutterX: number,
    ctx: RenderContext
  ): void {
    const diagnostics = this.getDiagnosticsForLine(uri, line);
    if (diagnostics.length === 0) return;

    // Find highest severity on this line
    let highestSeverity = DiagnosticSeverity.Hint;
    for (const d of diagnostics) {
      if ((d.severity || 1) < highestSeverity) {
        highestSeverity = d.severity || 1;
      }
    }

    const icon = this.getGutterIcon(highestSeverity);
    const color = this.getColor(highestSeverity);

    ctx.drawStyled(gutterX, screenY, icon, color);
  }

  /**
   * Get diagnostic message at position (for hover)
   */
  getMessageAtPosition(uri: string, line: number, column: number): string | null {
    const diagnostics = this.getDiagnosticsAtPosition(uri, line, column);
    if (diagnostics.length === 0) return null;

    // Return the highest severity diagnostic message
    diagnostics.sort((a, b) => (a.severity || 1) - (b.severity || 1));
    return diagnostics[0]!.message;
  }

  /**
   * Get all diagnostic messages at position (for multi-diagnostic hover)
   */
  getAllMessagesAtPosition(uri: string, line: number, column: number): { severity: number; message: string }[] {
    const diagnostics = this.getDiagnosticsAtPosition(uri, line, column);
    return diagnostics
      .sort((a, b) => (a.severity || 1) - (b.severity || 1))
      .map(d => ({
        severity: d.severity || 1,
        message: d.message
      }));
  }
}

// Singleton instance
export const diagnosticsRenderer = new DiagnosticsRenderer();

export default diagnosticsRenderer;
