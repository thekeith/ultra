/**
 * References Picker
 *
 * Displays LSP "Find References" results in a searchable dialog.
 * Users can filter and navigate to references.
 */

import {
  SearchableDialog,
  type ItemDisplay,
  type SearchableDialogConfig,
} from './searchable-dialog.ts';
import type { OverlayManagerCallbacks } from './overlay-manager.ts';
import type { LSPLocation } from '../../../services/lsp/types.ts';
import type { DialogResult } from './promise-dialog.ts';

// ============================================
// Types
// ============================================

/**
 * Reference item with file content preview.
 */
export interface ReferenceItem {
  /** Original LSP location */
  location: LSPLocation;
  /** File path (normalized) */
  filePath: string;
  /** File name only */
  fileName: string;
  /** Line number (1-indexed for display) */
  lineNumber: number;
  /** Column number (1-indexed for display) */
  column: number;
  /** Preview of the line content */
  preview: string;
}

/**
 * Callback to load line content for a reference.
 */
export type ReferencePreviewLoader = (
  uri: string,
  line: number
) => Promise<string>;

// ============================================
// References Picker
// ============================================

export class ReferencesPicker extends SearchableDialog<ReferenceItem> {
  constructor(callbacks: OverlayManagerCallbacks) {
    super('references-picker', callbacks);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Show references picker with locations.
   * @param locations LSP locations from find references
   * @param previewLoader Function to load line content for previews
   * @returns Selected reference or cancelled
   */
  async showReferences(
    locations: LSPLocation[],
    previewLoader?: ReferencePreviewLoader
  ): Promise<DialogResult<ReferenceItem>> {
    // Convert locations to reference items
    const items = await this.convertLocations(locations, previewLoader);

    // Group by file for display
    items.sort((a, b) => {
      const fileCompare = a.filePath.localeCompare(b.filePath);
      if (fileCompare !== 0) return fileCompare;
      return a.lineNumber - b.lineNumber;
    });

    return this.showWithItems(
      {
        title: `References (${items.length})`,
        width: 80,
        height: 20,
        placeholder: 'Type to filter references...',
        showSearchInput: true,
        maxResults: 15,
      } as SearchableDialogConfig,
      items
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Abstract Method Implementations
  // ─────────────────────────────────────────────────────────────────────────

  protected scoreItem(item: ReferenceItem, query: string): number {
    // Score based on file name and preview content
    const fileScore = this.combinedScore(item.fileName, query);
    const pathScore = this.combinedScore(item.filePath, query) * 0.5;
    const previewScore = this.fuzzyScore(query, item.preview) * 0.3;

    return Math.max(fileScore, pathScore, previewScore);
  }

  protected getItemDisplay(item: ReferenceItem, isSelected: boolean): ItemDisplay {
    // Format: "fileName:line:col  preview"
    const location = `${item.fileName}:${item.lineNumber}:${item.column}`;
    const preview = item.preview.trim().slice(0, 60);

    return {
      text: location,
      secondary: preview,
      icon: '📍',
    };
  }

  protected getItemId(item: ReferenceItem): string {
    return `${item.filePath}:${item.lineNumber}:${item.column}`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private async convertLocations(
    locations: LSPLocation[],
    previewLoader?: ReferencePreviewLoader
  ): Promise<ReferenceItem[]> {
    const items: ReferenceItem[] = [];

    for (const loc of locations) {
      // Parse URI to file path
      const filePath = this.uriToPath(loc.uri);
      const fileName = this.extractFileName(filePath);
      const lineNumber = loc.range.start.line + 1; // 1-indexed
      const column = loc.range.start.character + 1;

      // Load preview if loader provided
      let preview = '';
      if (previewLoader) {
        try {
          preview = await previewLoader(loc.uri, loc.range.start.line);
        } catch {
          preview = '(unable to load preview)';
        }
      }

      items.push({
        location: loc,
        filePath,
        fileName,
        lineNumber,
        column,
        preview,
      });
    }

    return items;
  }

  private uriToPath(uri: string): string {
    // Convert file:// URI to path
    if (uri.startsWith('file://')) {
      return decodeURIComponent(uri.slice(7));
    }
    return uri;
  }

  private extractFileName(path: string): string {
    const parts = path.split('/');
    return parts[parts.length - 1] ?? path;
  }
}

/**
 * Create a references picker instance.
 */
export function createReferencesPicker(
  callbacks: OverlayManagerCallbacks
): ReferencesPicker {
  return new ReferencesPicker(callbacks);
}
