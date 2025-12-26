/**
 * Git Diff Browser Element
 *
 * A content browser specialized for viewing and managing git diffs.
 * Displays file changes organized by file, with expandable hunks.
 */

import { ContentBrowser } from './content-browser.ts';
import type { ElementContext } from './base.ts';
import type { KeyEvent } from '../types.ts';
import type { ScreenBuffer } from '../rendering/buffer.ts';
import type { ArtifactNode, ArtifactAction, ContentBrowserCallbacks, SummaryItem } from '../artifacts/types.ts';
import type { GitDiffHunk, DiffLine, GitChangeType } from '../../../services/git/types.ts';
import type { LSPDiagnostic } from '../../../services/lsp/client.ts';
import { TIMEOUTS } from '../../../constants.ts';
import {
  type GitDiffArtifact,
  type GitDiffFileNode,
  type GitDiffHunkNode,
  type GitDiffLineNode,
  isFileNode,
  isHunkNode,
  isLineNode,
  getChangeTypeIcon,
  getChangeTypeColorKey,
  formatHunkHeader,
} from '../artifacts/git-diff-artifact.ts';

// ============================================
// Types
// ============================================

/**
 * Provider interface for getting LSP diagnostics for files.
 */
export interface DiagnosticsProvider {
  /**
   * Get diagnostics for a file.
   * @param uri File URI (e.g., file:///path/to/file.ts)
   * @returns Array of diagnostics for the file
   */
  getDiagnostics(uri: string): LSPDiagnostic[];
}

/**
 * Diagnostic severity levels (from LSP spec).
 */
export const DiagnosticSeverity = {
  Error: 1,
  Warning: 2,
  Information: 3,
  Hint: 4,
} as const;

/**
 * Callbacks for git diff browser.
 */
export interface GitDiffBrowserCallbacks extends ContentBrowserCallbacks<GitDiffArtifact> {
  /** Stage a file */
  onStageFile?: (filePath: string) => void;
  /** Unstage a file */
  onUnstageFile?: (filePath: string) => void;
  /** Stage a specific hunk */
  onStageHunk?: (filePath: string, hunkIndex: number) => void;
  /** Unstage a specific hunk */
  onUnstageHunk?: (filePath: string, hunkIndex: number) => void;
  /** Discard a file's changes */
  onDiscardFile?: (filePath: string) => void;
  /** Discard a specific hunk */
  onDiscardHunk?: (filePath: string, hunkIndex: number) => void;
}

/**
 * Diff view mode for rendering.
 */
export type DiffViewMode = 'unified' | 'side-by-side';

/**
 * Edit mode for saving changes.
 */
export type EditSaveMode = 'stage-modified' | 'direct-write';

/**
 * Cursor position for edit mode.
 */
interface EditCursor {
  /** Line index in edit buffer (0-based) */
  line: number;
  /** Column index in line (0-based) */
  col: number;
}

/**
 * Callbacks for edit operations.
 */
export interface EditCallbacks {
  /** Called when edit is saved with modified content */
  onSaveEdit?: (filePath: string, hunkIndex: number, newLines: string[]) => Promise<void>;
  /**
   * Called when edit is saved in direct-write mode.
   * @param filePath File path relative to repo root
   * @param startLine Starting line number (1-based)
   * @param newLines New content lines
   * @param originalLineCount Number of lines being replaced
   */
  onDirectWrite?: (filePath: string, startLine: number, newLines: string[], originalLineCount: number) => Promise<void>;
}

// ============================================
// Git Diff Browser
// ============================================

export class GitDiffBrowser extends ContentBrowser<GitDiffArtifact> {
  /** Whether showing staged or unstaged diffs */
  private staged = false;

  /** Diff view mode (unified or side-by-side) */
  private diffViewMode: DiffViewMode = 'unified';

  /** Whether auto-refresh is enabled */
  private autoRefresh = true;

  /** Debounce timer for refresh */
  private refreshDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  /** Whether this is a historical diff (commit diff vs working tree) */
  private isHistoricalDiff = false;

  /** Diagnostics provider for LSP integration */
  private diagnosticsProvider: DiagnosticsProvider | null = null;

  /** Whether to show diagnostics on added lines */
  private showDiagnostics = true;

  /** Cached diagnostics per file path */
  private diagnosticsCache = new Map<string, LSPDiagnostic[]>();

  // ─────────────────────────────────────────────────────────────────────────
  // Edit Mode State
  // ─────────────────────────────────────────────────────────────────────────

  /** Node currently being edited (hunk node) */
  private editingNode: GitDiffHunkNode | null = null;

  /** Edit buffer - lines of text being edited */
  private editBuffer: string[] = [];

  /** Cursor position in edit buffer */
  private editCursor: EditCursor = { line: 0, col: 0 };

  /** Edit save mode (from settings) */
  private editSaveMode: EditSaveMode = 'stage-modified';

  /** Original lines before editing (for comparison) */
  private originalEditLines: string[] = [];

  /** Undo stack - stores previous states */
  private editUndoStack: Array<{ lines: string[]; cursor: EditCursor }> = [];

  /** Redo stack - stores undone states */
  private editRedoStack: Array<{ lines: string[]; cursor: EditCursor }> = [];

  /** Maximum undo history size */
  private readonly maxUndoSize = 100;

  /** Edit callbacks */
  private editCallbacks: EditCallbacks = {};

  /** Git-specific callbacks */
  private gitCallbacks: GitDiffBrowserCallbacks;

  constructor(
    id: string,
    title: string,
    ctx: ElementContext,
    callbacks: GitDiffBrowserCallbacks = {}
  ) {
    super(id, title, ctx, callbacks);
    this.gitCallbacks = callbacks;
    this.browserTitle = title;
    this.hintBarHeight = 2;

    // Read settings
    this.autoRefresh = this.ctx.getSetting('tui.diffViewer.autoRefresh', true);
    this.showDiagnostics = this.ctx.getSetting('tui.diffViewer.showDiagnostics', true);
    this.editSaveMode = this.ctx.getSetting('tui.diffViewer.editMode', 'stage-modified') as EditSaveMode;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Refresh diagnostics cache when gaining focus.
   * LSP diagnostics may have changed since last focus.
   */
  override onFocus(): void {
    super.onFocus();
    // Refresh diagnostics cache to pick up any LSP changes
    if (this.diagnosticsProvider && this.showDiagnostics) {
      this.refreshDiagnosticsCache();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set whether showing staged diffs.
   */
  setStaged(staged: boolean): void {
    this.staged = staged;
    this.browserSubtitle = staged ? 'Staged Changes' : 'Unstaged Changes';
    this.ctx.markDirty();
  }

  /**
   * Get whether showing staged diffs.
   */
  isStaged(): boolean {
    return this.staged;
  }

  /**
   * Set diff view mode.
   */
  setDiffViewMode(mode: DiffViewMode): void {
    if (this.diffViewMode !== mode) {
      this.diffViewMode = mode;
      this.ctx.markDirty();
    }
  }

  /**
   * Get diff view mode.
   */
  getDiffViewMode(): DiffViewMode {
    return this.diffViewMode;
  }

  /**
   * Toggle between unified and side-by-side view.
   */
  toggleDiffViewMode(): void {
    this.setDiffViewMode(this.diffViewMode === 'unified' ? 'side-by-side' : 'unified');
  }

  /**
   * Set git-specific callbacks.
   */
  setGitCallbacks(callbacks: GitDiffBrowserCallbacks): void {
    this.gitCallbacks = { ...this.gitCallbacks, ...callbacks };
    this.setCallbacks(callbacks);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Auto-Refresh
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set whether this is a historical (commit) diff.
   * Historical diffs don't auto-refresh since commits are immutable.
   */
  setHistoricalDiff(isHistorical: boolean): void {
    this.isHistoricalDiff = isHistorical;
  }

  /**
   * Get whether this is a historical diff.
   */
  isHistorical(): boolean {
    return this.isHistoricalDiff;
  }

  /**
   * Set whether auto-refresh is enabled.
   */
  setAutoRefresh(enabled: boolean): void {
    this.autoRefresh = enabled;
  }

  /**
   * Get whether auto-refresh is enabled.
   */
  isAutoRefreshEnabled(): boolean {
    return this.autoRefresh && !this.isHistoricalDiff;
  }

  /**
   * Notify that a git change occurred.
   * If auto-refresh is enabled, schedules a debounced refresh.
   * @param changeType The type of git change that occurred
   */
  notifyGitChange(changeType: GitChangeType): void {
    // Only refresh for status changes on non-historical diffs
    if (!this.isAutoRefreshEnabled()) {
      return;
    }

    // Only respond to status changes (file modifications)
    if (changeType !== 'status') {
      return;
    }

    // Debounce the refresh
    if (this.refreshDebounceTimer) {
      clearTimeout(this.refreshDebounceTimer);
    }

    this.refreshDebounceTimer = setTimeout(() => {
      this.refreshDebounceTimer = null;
      this.callbacks.onRefresh?.();
    }, TIMEOUTS.FILE_WATCH_DEBOUNCE);
  }

  /**
   * Clean up timers when disposing.
   */
  override dispose(): void {
    if (this.refreshDebounceTimer) {
      clearTimeout(this.refreshDebounceTimer);
      this.refreshDebounceTimer = null;
    }
    super.dispose();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Diagnostics
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set the diagnostics provider for LSP integration.
   * @param provider The diagnostics provider, or null to disable
   */
  setDiagnosticsProvider(provider: DiagnosticsProvider | null): void {
    this.diagnosticsProvider = provider;
    this.refreshDiagnosticsCache();
    this.ctx.markDirty();
  }

  /**
   * Set whether to show diagnostics on added lines.
   */
  setShowDiagnostics(show: boolean): void {
    if (this.showDiagnostics !== show) {
      this.showDiagnostics = show;
      this.ctx.markDirty();
    }
  }

  /**
   * Get whether diagnostics are shown.
   */
  isShowingDiagnostics(): boolean {
    return this.showDiagnostics && this.diagnosticsProvider !== null;
  }

  /**
   * Refresh the diagnostics cache for all files in the diff.
   */
  refreshDiagnosticsCache(): void {
    this.diagnosticsCache.clear();

    if (!this.diagnosticsProvider || !this.showDiagnostics) {
      return;
    }

    // Get diagnostics for each file in the diff
    const artifacts = this.getArtifacts();
    for (const artifact of artifacts) {
      const uri = `file://${artifact.filePath}`;
      const diagnostics = this.diagnosticsProvider.getDiagnostics(uri);
      if (diagnostics.length > 0) {
        this.diagnosticsCache.set(artifact.filePath, diagnostics);
      }
    }
  }

  /**
   * Get diagnostics for a specific line in a file.
   * Only returns diagnostics for added lines (new code).
   * @param filePath File path
   * @param lineNum Line number in the new file (1-based)
   * @returns Array of diagnostics on this line
   */
  private getDiagnosticsForLine(filePath: string, lineNum: number): LSPDiagnostic[] {
    if (!this.showDiagnostics || !this.diagnosticsProvider) {
      return [];
    }

    const diagnostics = this.diagnosticsCache.get(filePath);
    if (!diagnostics) {
      return [];
    }

    // Filter diagnostics that include this line (LSP lines are 0-based)
    return diagnostics.filter((d) => {
      const startLine = d.range.start.line + 1; // Convert to 1-based
      const endLine = d.range.end.line + 1;
      return lineNum >= startLine && lineNum <= endLine;
    });
  }

  /**
   * Get the highest severity diagnostic for a line.
   * @returns Severity (1=Error, 2=Warning, 3=Info, 4=Hint) or null if none
   */
  private getHighestSeverityForLine(filePath: string, lineNum: number): number | null {
    const diagnostics = this.getDiagnosticsForLine(filePath, lineNum);
    if (diagnostics.length === 0) {
      return null;
    }

    // Lower number = higher severity (Error=1 is highest)
    let highest = Infinity;
    for (const d of diagnostics) {
      const severity = d.severity ?? DiagnosticSeverity.Error;
      if (severity < highest) {
        highest = severity;
      }
    }
    return highest === Infinity ? null : highest;
  }

  /**
   * Get the icon and color for a diagnostic severity.
   */
  private getDiagnosticIconAndColor(severity: number): { icon: string; color: string } {
    switch (severity) {
      case DiagnosticSeverity.Error:
        return {
          icon: '●',
          color: this.ctx.getThemeColor('editorError.foreground', '#f14c4c'),
        };
      case DiagnosticSeverity.Warning:
        return {
          icon: '●',
          color: this.ctx.getThemeColor('editorWarning.foreground', '#cca700'),
        };
      case DiagnosticSeverity.Information:
        return {
          icon: '●',
          color: this.ctx.getThemeColor('editorInfo.foreground', '#3794ff'),
        };
      case DiagnosticSeverity.Hint:
        return {
          icon: '○',
          color: this.ctx.getThemeColor('editorHint.foreground', '#75beff'),
        };
      default:
        return {
          icon: '●',
          color: this.ctx.getThemeColor('editorError.foreground', '#f14c4c'),
        };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Edit Mode
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set edit callbacks for save operations.
   */
  setEditCallbacks(callbacks: EditCallbacks): void {
    this.editCallbacks = { ...this.editCallbacks, ...callbacks };
  }

  /**
   * Check if currently in edit mode.
   */
  isEditing(): boolean {
    return this.editingNode !== null;
  }

  /**
   * Get the currently editing node.
   */
  getEditingNode(): GitDiffHunkNode | null {
    return this.editingNode;
  }

  /**
   * Start editing a hunk.
   * Extracts added/modified lines from the hunk for editing.
   */
  startEdit(node: ArtifactNode<GitDiffArtifact>): boolean {
    // Can only edit hunk nodes for unstaged diffs
    if (!isHunkNode(node) || this.staged || this.isHistoricalDiff) {
      return false;
    }

    // Extract lines that can be edited (added lines only)
    // We edit the "new" content that would be staged
    const editableLines: string[] = [];
    for (const line of node.hunk.lines) {
      if (line.type === 'added' || line.type === 'context') {
        editableLines.push(line.content);
      }
      // Deleted lines are not included in the edit buffer
      // They represent content being removed
    }

    if (editableLines.length === 0) {
      return false; // Nothing to edit
    }

    this.editingNode = node;
    this.editBuffer = editableLines;
    this.originalEditLines = [...editableLines];
    this.editCursor = { line: 0, col: 0 };
    this.editUndoStack = [];
    this.editRedoStack = [];
    this.ctx.markDirty();
    return true;
  }

  /**
   * Cancel edit mode without saving.
   */
  cancelEdit(): void {
    if (!this.editingNode) return;

    this.editingNode = null;
    this.editBuffer = [];
    this.originalEditLines = [];
    this.editCursor = { line: 0, col: 0 };
    this.editUndoStack = [];
    this.editRedoStack = [];
    this.ctx.markDirty();
  }

  /**
   * Save edit and apply changes.
   * Behavior depends on editSaveMode setting.
   */
  async saveEdit(): Promise<void> {
    if (!this.editingNode) return;

    const filePath = this.editingNode.artifact.filePath;
    const hunkIndex = this.editingNode.hunkIndex;
    const newLines = [...this.editBuffer];

    // Check if content actually changed
    const hasChanges = !this.arraysEqual(newLines, this.originalEditLines);

    if (hasChanges) {
      if (this.editSaveMode === 'direct-write') {
        // Direct write mode: modify the file directly
        const startLine = this.editingNode.hunk.newStart;
        const originalLineCount = this.originalEditLines.length;
        await this.editCallbacks.onDirectWrite?.(filePath, startLine, newLines, originalLineCount);
      } else {
        // Stage-modified mode: create modified hunk for staging
        await this.editCallbacks.onSaveEdit?.(filePath, hunkIndex, newLines);
      }
    }

    // Exit edit mode
    this.cancelEdit();
  }

  /**
   * Check if two string arrays are equal.
   */
  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Edit Mode - Text Manipulation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Insert a character at cursor position.
   */
  private editInsertChar(char: string): void {
    if (!this.editingNode) return;

    this.pushUndoState();
    const line = this.editBuffer[this.editCursor.line] ?? '';
    const before = line.slice(0, this.editCursor.col);
    const after = line.slice(this.editCursor.col);
    this.editBuffer[this.editCursor.line] = before + char + after;
    this.editCursor.col += char.length;
    this.ctx.markDirty();
  }

  /**
   * Insert a newline at cursor position.
   */
  private editInsertNewline(): void {
    if (!this.editingNode) return;

    this.pushUndoState();
    const line = this.editBuffer[this.editCursor.line] ?? '';
    const before = line.slice(0, this.editCursor.col);
    const after = line.slice(this.editCursor.col);

    this.editBuffer[this.editCursor.line] = before;
    this.editBuffer.splice(this.editCursor.line + 1, 0, after);
    this.editCursor.line++;
    this.editCursor.col = 0;
    this.ctx.markDirty();
  }

  /**
   * Delete character before cursor (backspace).
   */
  private editDeleteBackward(): void {
    if (!this.editingNode) return;

    // Only push undo state if there's something to delete
    if (this.editCursor.col > 0 || this.editCursor.line > 0) {
      this.pushUndoState();
    }

    if (this.editCursor.col > 0) {
      // Delete character before cursor
      const line = this.editBuffer[this.editCursor.line] ?? '';
      const before = line.slice(0, this.editCursor.col - 1);
      const after = line.slice(this.editCursor.col);
      this.editBuffer[this.editCursor.line] = before + after;
      this.editCursor.col--;
    } else if (this.editCursor.line > 0) {
      // Join with previous line
      const currentLine = this.editBuffer[this.editCursor.line] ?? '';
      const prevLine = this.editBuffer[this.editCursor.line - 1] ?? '';
      this.editCursor.col = prevLine.length;
      this.editBuffer[this.editCursor.line - 1] = prevLine + currentLine;
      this.editBuffer.splice(this.editCursor.line, 1);
      this.editCursor.line--;
    }
    this.ctx.markDirty();
  }

  /**
   * Delete character at cursor (delete key).
   */
  private editDeleteForward(): void {
    if (!this.editingNode) return;

    const line = this.editBuffer[this.editCursor.line] ?? '';

    // Only push undo state if there's something to delete
    if (this.editCursor.col < line.length || this.editCursor.line < this.editBuffer.length - 1) {
      this.pushUndoState();
    }

    if (this.editCursor.col < line.length) {
      // Delete character at cursor
      const before = line.slice(0, this.editCursor.col);
      const after = line.slice(this.editCursor.col + 1);
      this.editBuffer[this.editCursor.line] = before + after;
    } else if (this.editCursor.line < this.editBuffer.length - 1) {
      // Join with next line
      const nextLine = this.editBuffer[this.editCursor.line + 1] ?? '';
      this.editBuffer[this.editCursor.line] = line + nextLine;
      this.editBuffer.splice(this.editCursor.line + 1, 1);
    }
    this.ctx.markDirty();
  }

  /**
   * Move cursor left.
   */
  private editCursorLeft(): void {
    if (!this.editingNode) return;

    if (this.editCursor.col > 0) {
      this.editCursor.col--;
    } else if (this.editCursor.line > 0) {
      this.editCursor.line--;
      this.editCursor.col = (this.editBuffer[this.editCursor.line] ?? '').length;
    }
    this.ctx.markDirty();
  }

  /**
   * Move cursor right.
   */
  private editCursorRight(): void {
    if (!this.editingNode) return;

    const line = this.editBuffer[this.editCursor.line] ?? '';
    if (this.editCursor.col < line.length) {
      this.editCursor.col++;
    } else if (this.editCursor.line < this.editBuffer.length - 1) {
      this.editCursor.line++;
      this.editCursor.col = 0;
    }
    this.ctx.markDirty();
  }

  /**
   * Move cursor up.
   */
  private editCursorUp(): void {
    if (!this.editingNode) return;

    if (this.editCursor.line > 0) {
      this.editCursor.line--;
      const line = this.editBuffer[this.editCursor.line] ?? '';
      this.editCursor.col = Math.min(this.editCursor.col, line.length);
    }
    this.ctx.markDirty();
  }

  /**
   * Move cursor down.
   */
  private editCursorDown(): void {
    if (!this.editingNode) return;

    if (this.editCursor.line < this.editBuffer.length - 1) {
      this.editCursor.line++;
      const line = this.editBuffer[this.editCursor.line] ?? '';
      this.editCursor.col = Math.min(this.editCursor.col, line.length);
    }
    this.ctx.markDirty();
  }

  /**
   * Move cursor to start of line.
   */
  private editCursorHome(): void {
    if (!this.editingNode) return;
    this.editCursor.col = 0;
    this.ctx.markDirty();
  }

  /**
   * Move cursor to end of line.
   */
  private editCursorEnd(): void {
    if (!this.editingNode) return;
    const line = this.editBuffer[this.editCursor.line] ?? '';
    this.editCursor.col = line.length;
    this.ctx.markDirty();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Edit Mode - Undo/Redo
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Push current state to undo stack before a modification.
   * Clears redo stack since we're making a new edit.
   */
  private pushUndoState(): void {
    if (!this.editingNode) return;

    // Save current state
    this.editUndoStack.push({
      lines: [...this.editBuffer],
      cursor: { ...this.editCursor },
    });

    // Limit undo stack size
    if (this.editUndoStack.length > this.maxUndoSize) {
      this.editUndoStack.shift();
    }

    // Clear redo stack on new edit
    this.editRedoStack = [];
  }

  /**
   * Undo the last edit operation.
   */
  private editUndo(): void {
    if (!this.editingNode || this.editUndoStack.length === 0) return;

    // Save current state to redo stack
    this.editRedoStack.push({
      lines: [...this.editBuffer],
      cursor: { ...this.editCursor },
    });

    // Restore previous state
    const state = this.editUndoStack.pop()!;
    this.editBuffer = state.lines;
    this.editCursor = state.cursor;
    this.ctx.markDirty();
  }

  /**
   * Redo a previously undone edit operation.
   */
  private editRedo(): void {
    if (!this.editingNode || this.editRedoStack.length === 0) return;

    // Save current state to undo stack
    this.editUndoStack.push({
      lines: [...this.editBuffer],
      cursor: { ...this.editCursor },
    });

    // Restore next state
    const state = this.editRedoStack.pop()!;
    this.editBuffer = state.lines;
    this.editCursor = state.cursor;
    this.ctx.markDirty();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Build summary showing file count and total additions/deletions.
   */
  protected override buildSummary(): SummaryItem[] {
    const artifacts = this.getArtifacts();
    if (artifacts.length === 0) {
      return [];
    }

    let totalAdditions = 0;
    let totalDeletions = 0;

    for (const artifact of artifacts) {
      totalAdditions += artifact.additions;
      totalDeletions += artifact.deletions;
    }

    const addedFg = this.ctx.getThemeColor('gitDecoration.addedResourceForeground', '#81b88b');
    const deletedFg = this.ctx.getThemeColor('gitDecoration.deletedResourceForeground', '#c74e39');

    return [
      { label: 'Files', value: artifacts.length },
      { label: '+', value: totalAdditions, color: addedFg },
      { label: '-', value: totalDeletions, color: deletedFg },
    ];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Node Building
  // ─────────────────────────────────────────────────────────────────────────

  protected override buildNodes(artifacts: GitDiffArtifact[]): ArtifactNode<GitDiffArtifact>[] {
    return artifacts.map((artifact) => this.buildFileNode(artifact));
  }

  private buildFileNode(artifact: GitDiffArtifact): GitDiffFileNode {
    return {
      artifact,
      nodeType: 'file',
      nodeId: `file:${artifact.filePath}`,
      depth: 0,
      expanded: true,
      children: artifact.hunks.map((hunk, idx) => this.buildHunkNode(artifact, hunk, idx)),
      actions: this.getFileActions(artifact),
      selected: false,
      label: artifact.filePath.split('/').pop() ?? artifact.filePath,
      secondaryLabel: `+${artifact.additions} -${artifact.deletions}`,
      icon: getChangeTypeIcon(artifact.changeType),
      foreground: undefined,
      metadata: {
        fullPath: artifact.filePath,
        changeType: artifact.changeType,
      },
    };
  }

  private buildHunkNode(
    artifact: GitDiffArtifact,
    hunk: GitDiffHunk,
    hunkIndex: number
  ): GitDiffHunkNode {
    return {
      artifact,
      nodeType: 'hunk',
      nodeId: `hunk:${artifact.filePath}:${hunkIndex}`,
      depth: 1,
      expanded: true,
      hunkIndex,
      hunk,
      children: hunk.lines.map((line, idx) => this.buildLineNode(artifact, hunk, hunkIndex, line, idx)),
      actions: this.getHunkActions(artifact, hunkIndex),
      selected: false,
      label: formatHunkHeader(hunk),
      secondaryLabel: `${hunk.lines.length} lines`,
      icon: '@@',
      foreground: '#888888',
      metadata: { hunkIndex },
    };
  }

  private buildLineNode(
    artifact: GitDiffArtifact,
    _hunk: GitDiffHunk,
    hunkIndex: number,
    line: DiffLine,
    lineIndex: number
  ): GitDiffLineNode {
    const prefix = line.type === 'added' ? '+' : line.type === 'deleted' ? '-' : ' ';
    return {
      artifact,
      nodeType: 'line',
      nodeId: `line:${artifact.filePath}:${hunkIndex}:${lineIndex}`,
      depth: 2,
      expanded: false,
      hunkIndex,
      lineIndex,
      line,
      children: [],
      actions: [], // Lines don't have individual actions
      selected: false,
      label: `${prefix}${line.content}`,
      icon: prefix,
      foreground: undefined,
      metadata: {
        lineType: line.type,
        oldLineNum: line.oldLineNum,
        newLineNum: line.newLineNum,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  private getFileActions(artifact: GitDiffArtifact): ArtifactAction[] {
    const actions: ArtifactAction[] = [];

    if (this.staged) {
      actions.push({
        id: 'unstage-file',
        label: 'Unstage File',
        shortcut: 'u',
        icon: '-',
        enabled: true,
        execute: () => this.gitCallbacks.onUnstageFile?.(artifact.filePath),
      });
    } else {
      actions.push({
        id: 'stage-file',
        label: 'Stage File',
        shortcut: 's',
        icon: '+',
        enabled: true,
        execute: () => this.gitCallbacks.onStageFile?.(artifact.filePath),
      });
      actions.push({
        id: 'discard-file',
        label: 'Discard Changes',
        shortcut: 'd',
        icon: 'x',
        enabled: true,
        execute: () => this.gitCallbacks.onDiscardFile?.(artifact.filePath),
      });
    }

    actions.push({
      id: 'open-file',
      label: 'Open File',
      shortcut: 'o',
      icon: '→',
      enabled: true,
      execute: () => this.callbacks.onOpenFile?.(artifact.filePath),
    });

    return actions;
  }

  private getHunkActions(artifact: GitDiffArtifact, hunkIndex: number): ArtifactAction[] {
    const actions: ArtifactAction[] = [];

    if (this.staged) {
      actions.push({
        id: 'unstage-hunk',
        label: 'Unstage Hunk',
        shortcut: 'u',
        icon: '-',
        enabled: true,
        execute: () => this.gitCallbacks.onUnstageHunk?.(artifact.filePath, hunkIndex),
      });
    } else {
      actions.push({
        id: 'stage-hunk',
        label: 'Stage Hunk',
        shortcut: 's',
        icon: '+',
        enabled: true,
        execute: () => this.gitCallbacks.onStageHunk?.(artifact.filePath, hunkIndex),
      });
      actions.push({
        id: 'discard-hunk',
        label: 'Discard Hunk',
        shortcut: 'd',
        icon: 'x',
        enabled: true,
        execute: () => this.gitCallbacks.onDiscardHunk?.(artifact.filePath, hunkIndex),
      });
    }

    return actions;
  }

  protected override getNodeActions(node: ArtifactNode<GitDiffArtifact>): ArtifactAction[] {
    return node.actions;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────────────────

  protected override renderNode(
    buffer: ScreenBuffer,
    node: ArtifactNode<GitDiffArtifact>,
    x: number,
    y: number,
    width: number,
    isSelected: boolean
  ): void {
    // Colors
    const bg = this.ctx.getBackgroundForFocus('sidebar', this.focused);
    const fg = this.ctx.getForegroundForFocus('sidebar', this.focused);
    const selectedBg = this.ctx.getSelectionBackground('sidebar', this.focused);
    const selectedFg = this.ctx.getThemeColor('list.activeSelectionForeground', '#ffffff');
    const addedFg = this.ctx.getThemeColor('gitDecoration.addedResourceForeground', '#81b88b');
    const deletedFg = this.ctx.getThemeColor('gitDecoration.deletedResourceForeground', '#c74e39');
    const modifiedFg = this.ctx.getThemeColor('gitDecoration.modifiedResourceForeground', '#e2c08d');
    const headerFg = this.ctx.getThemeColor('sideBarSectionHeader.foreground', '#cccccc');
    const dimFg = '#888888';

    // Background for this row
    const rowBg = isSelected ? selectedBg : bg;
    buffer.writeString(x, y, ' '.repeat(width), fg, rowBg);

    if (isFileNode(node)) {
      this.renderFileNode(buffer, node, x, y, width, isSelected, {
        selectedFg,
        fg,
        addedFg,
        deletedFg,
        modifiedFg,
        dimFg,
        rowBg,
      });
    } else if (isHunkNode(node)) {
      this.renderHunkNode(buffer, node, x, y, width, isSelected, {
        selectedFg,
        headerFg,
        dimFg,
        rowBg,
      });
    } else if (isLineNode(node)) {
      this.renderLineNode(buffer, node, x, y, width, isSelected, {
        selectedFg,
        fg,
        addedFg,
        deletedFg,
        rowBg,
      });
    }
  }

  private renderFileNode(
    buffer: ScreenBuffer,
    node: GitDiffFileNode,
    x: number,
    y: number,
    width: number,
    isSelected: boolean,
    colors: {
      selectedFg: string;
      fg: string;
      addedFg: string;
      deletedFg: string;
      modifiedFg: string;
      dimFg: string;
      rowBg: string;
    }
  ): void {
    const indent = '  ';
    const collapsed = this.collapsedNodeIds.has(node.nodeId);
    const expander = node.children.length > 0 ? (collapsed ? '▶' : '▼') : ' ';
    const icon = node.icon ?? ' ';

    // Determine file color based on change type
    let fileColor = colors.fg;
    if (!isSelected || !this.focused) {
      const colorKey = getChangeTypeColorKey(node.artifact.changeType);
      fileColor = this.ctx.getThemeColor(colorKey, colors.fg);
    }

    // Build line: "  ▼ M filename.ts  +10 -5"
    let line = `${indent}${expander} ${icon} ${node.label}`;

    // Add stats at end
    const stats = ` +${node.artifact.additions} -${node.artifact.deletions}`;

    if (line.length + stats.length > width) {
      line = line.slice(0, width - stats.length - 1) + '…';
    }

    const padding = width - line.length - stats.length;
    if (padding > 0) {
      line += ' '.repeat(padding);
    }
    line += stats;

    // Write line
    const lineFg = isSelected && this.focused ? colors.selectedFg : fileColor;
    buffer.writeString(x, y, line.slice(0, width), lineFg, colors.rowBg);

    // Write stats in dim color if not selected
    if (!isSelected || !this.focused) {
      const statsX = x + width - stats.length;
      buffer.writeString(statsX, y, stats, colors.dimFg, colors.rowBg);
    }
  }

  private renderHunkNode(
    buffer: ScreenBuffer,
    node: GitDiffHunkNode,
    x: number,
    y: number,
    width: number,
    isSelected: boolean,
    colors: {
      selectedFg: string;
      headerFg: string;
      dimFg: string;
      rowBg: string;
    }
  ): void {
    const indent = '    ';
    const collapsed = this.collapsedNodeIds.has(node.nodeId);
    const expander = node.children.length > 0 ? (collapsed ? '▶' : '▼') : ' ';

    // Build line: "    ▼ @@ -10,5 +12,8 @@"
    let line = `${indent}${expander} ${node.label}`;

    if (line.length > width) {
      line = line.slice(0, width - 1) + '…';
    }
    line = line.padEnd(width, ' ').slice(0, width);

    const lineFg = isSelected && this.focused ? colors.selectedFg : colors.dimFg;
    buffer.writeString(x, y, line, lineFg, colors.rowBg);
  }

  private renderLineNode(
    buffer: ScreenBuffer,
    node: GitDiffLineNode,
    x: number,
    y: number,
    width: number,
    isSelected: boolean,
    colors: {
      selectedFg: string;
      fg: string;
      addedFg: string;
      deletedFg: string;
      rowBg: string;
    }
  ): void {
    if (this.diffViewMode === 'side-by-side') {
      this.renderLineNodeSideBySide(buffer, node, x, y, width, isSelected, colors);
      return;
    }

    // Unified view rendering
    const line = node.line;
    const prefix = line.type === 'added' ? '+' : line.type === 'deleted' ? '-' : ' ';

    // Check for diagnostics on added lines
    let diagnosticIcon = ' ';
    let diagnosticColor = colors.fg;
    if (line.type === 'added' && line.newLineNum !== undefined) {
      const severity = this.getHighestSeverityForLine(node.artifact.filePath, line.newLineNum);
      if (severity !== null) {
        const { icon, color } = this.getDiagnosticIconAndColor(severity);
        diagnosticIcon = icon;
        diagnosticColor = color;
      }
    }

    // Layout: "D     1234 5678 +content" where D is diagnostic icon
    const indent = '     '; // 5 spaces (1 for diagnostic icon)
    const oldNum = line.oldLineNum?.toString().padStart(4, ' ') ?? '    ';
    const newNum = line.newLineNum?.toString().padStart(4, ' ') ?? '    ';

    // Build line: " D    1234 5678 +content"
    let displayLine = ` ${diagnosticIcon}${indent}${oldNum} ${newNum} ${prefix}${line.content}`;

    if (displayLine.length > width) {
      displayLine = displayLine.slice(0, width - 1) + '…';
    }
    displayLine = displayLine.padEnd(width, ' ').slice(0, width);

    // Determine color
    let lineFg = colors.fg;
    if (isSelected && this.focused) {
      lineFg = colors.selectedFg;
    } else if (line.type === 'added') {
      lineFg = colors.addedFg;
    } else if (line.type === 'deleted') {
      lineFg = colors.deletedFg;
    }

    // Background highlight for diff lines
    let lineBg = colors.rowBg;
    if (!isSelected) {
      if (line.type === 'added') {
        lineBg = this.ctx.getThemeColor('diffEditor.insertedLineBackground', '#1e3a21');
      } else if (line.type === 'deleted') {
        lineBg = this.ctx.getThemeColor('diffEditor.removedLineBackground', '#3a1e1e');
      }
    }

    // Write the line
    buffer.writeString(x, y, displayLine, lineFg, lineBg);

    // Overwrite the diagnostic icon with its specific color
    if (diagnosticIcon !== ' ') {
      buffer.set(x + 1, y, { char: diagnosticIcon, fg: diagnosticColor, bg: lineBg });
    }
  }

  /**
   * Render a line node in side-by-side mode.
   * Layout: │ lineNum │ old content │ lineNum │ new content │
   */
  private renderLineNodeSideBySide(
    buffer: ScreenBuffer,
    node: GitDiffLineNode,
    x: number,
    y: number,
    width: number,
    isSelected: boolean,
    colors: {
      selectedFg: string;
      fg: string;
      addedFg: string;
      deletedFg: string;
      rowBg: string;
    }
  ): void {
    const line = node.line;
    const indent = '      '; // Match hunk node indent

    // Calculate panel widths (50/50 split after indent)
    const contentWidth = width - indent.length;
    const halfWidth = Math.floor(contentWidth / 2);
    const leftWidth = halfWidth;
    const rightWidth = contentWidth - halfWidth;

    // Line number widths
    const numWidth = 4;
    const leftContentWidth = leftWidth - numWidth - 2; // -2 for separator
    const rightContentWidth = rightWidth - numWidth - 1;

    // Get background colors
    const insertedBg = this.ctx.getThemeColor('diffEditor.insertedLineBackground', '#1e3a21');
    const removedBg = this.ctx.getThemeColor('diffEditor.removedLineBackground', '#3a1e1e');
    const dividerFg = '#555555';

    // Write indent
    buffer.writeString(x, y, indent, colors.fg, colors.rowBg);
    let col = x + indent.length;

    // Determine what to show on each side
    if (line.type === 'context') {
      // Context: show on both sides
      const lineNum = (line.oldLineNum ?? line.newLineNum)?.toString().padStart(numWidth, ' ') ?? '    ';
      const content = line.content;

      // Left side
      const leftContent = content.length > leftContentWidth
        ? content.slice(0, leftContentWidth - 1) + '…'
        : content.padEnd(leftContentWidth, ' ');
      const leftFg = isSelected && this.focused ? colors.selectedFg : colors.fg;
      const leftBg = isSelected ? colors.rowBg : colors.rowBg;

      buffer.writeString(col, y, lineNum, leftFg, leftBg);
      col += numWidth;
      buffer.writeString(col, y, ' ', leftFg, leftBg);
      col++;
      buffer.writeString(col, y, leftContent, leftFg, leftBg);
      col += leftContentWidth;

      // Divider
      buffer.writeString(col, y, '│', dividerFg, colors.rowBg);
      col++;

      // Right side
      const rightContent = content.length > rightContentWidth
        ? content.slice(0, rightContentWidth - 1) + '…'
        : content.padEnd(rightContentWidth, ' ');

      buffer.writeString(col, y, lineNum, leftFg, leftBg);
      col += numWidth;
      buffer.writeString(col, y, ' ', leftFg, leftBg);
      col++;
      buffer.writeString(col, y, rightContent, leftFg, leftBg);

    } else if (line.type === 'deleted') {
      // Deleted: show on left side only, right side empty
      const lineNum = line.oldLineNum?.toString().padStart(numWidth, ' ') ?? '    ';
      const content = line.content;

      // Left side (deleted)
      const leftContent = content.length > leftContentWidth
        ? content.slice(0, leftContentWidth - 1) + '…'
        : content.padEnd(leftContentWidth, ' ');
      const leftFg = isSelected && this.focused ? colors.selectedFg : colors.deletedFg;
      const leftBg = isSelected ? colors.rowBg : removedBg;

      buffer.writeString(col, y, lineNum, leftFg, leftBg);
      col += numWidth;
      buffer.writeString(col, y, '-', leftFg, leftBg);
      col++;
      buffer.writeString(col, y, leftContent, leftFg, leftBg);
      col += leftContentWidth;

      // Divider
      buffer.writeString(col, y, '│', dividerFg, colors.rowBg);
      col++;

      // Right side (empty)
      const emptyRight = ' '.repeat(rightWidth - 1);
      buffer.writeString(col, y, emptyRight, colors.fg, colors.rowBg);

    } else if (line.type === 'added') {
      // Added: show on right side only, left side empty
      const lineNum = line.newLineNum?.toString().padStart(numWidth, ' ') ?? '    ';
      const content = line.content;

      // Check for diagnostics on added lines
      let diagnosticIcon = ' ';
      let diagnosticColor = colors.fg;
      if (line.newLineNum !== undefined) {
        const severity = this.getHighestSeverityForLine(node.artifact.filePath, line.newLineNum);
        if (severity !== null) {
          const { icon, color } = this.getDiagnosticIconAndColor(severity);
          diagnosticIcon = icon;
          diagnosticColor = color;
        }
      }

      // Left side (empty, but reserve 1 char for diagnostic alignment)
      const emptyLeft = ' '.repeat(leftWidth);
      buffer.writeString(col, y, emptyLeft, colors.fg, colors.rowBg);
      col += leftWidth;

      // Divider
      buffer.writeString(col, y, '│', dividerFg, colors.rowBg);
      col++;

      // Right side (added) - show diagnostic icon before line number
      const rightFg = isSelected && this.focused ? colors.selectedFg : colors.addedFg;
      const rightBg = isSelected ? colors.rowBg : insertedBg;

      // Write diagnostic icon
      buffer.set(col, y, { char: diagnosticIcon, fg: diagnosticColor, bg: rightBg });
      col++;

      // Adjust content width for diagnostic icon
      const adjustedRightContentWidth = rightContentWidth - 1;
      const rightContent = content.length > adjustedRightContentWidth
        ? content.slice(0, adjustedRightContentWidth - 1) + '…'
        : content.padEnd(adjustedRightContentWidth, ' ');

      buffer.writeString(col, y, lineNum, rightFg, rightBg);
      col += numWidth;
      buffer.writeString(col, y, '+', rightFg, rightBg);
      col++;
      buffer.writeString(col, y, rightContent, rightFg, rightBg);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Edit Mode Rendering
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Override render to add edit mode overlay.
   */
  override render(buffer: ScreenBuffer): void {
    // If in edit mode, render the edit overlay instead of normal content
    if (this.editingNode) {
      this.renderEditMode(buffer);
      return;
    }

    // Normal rendering
    super.render(buffer);
  }

  /**
   * Render the edit mode interface.
   * Shows a full-screen editor for the hunk content.
   */
  private renderEditMode(buffer: ScreenBuffer): void {
    const { x, y, width, height } = this.bounds;
    if (height === 0 || width === 0 || !this.editingNode) return;

    // Colors
    const bg = this.ctx.getBackgroundForFocus('sidebar', this.focused);
    const fg = this.ctx.getForegroundForFocus('sidebar', this.focused);
    const headerBg = this.ctx.getThemeColor('sideBarSectionHeader.background', '#383838');
    const headerFg = this.ctx.getThemeColor('sideBarSectionHeader.foreground', '#cccccc');
    const cursorBg = this.ctx.getThemeColor('terminalCursor.foreground', '#ffffff');
    const hintBg = this.ctx.getThemeColor('editorWidget.background', '#2d2d2d');
    const hintFg = this.ctx.getThemeColor('editorWidget.foreground', '#cccccc');
    const addedFg = this.ctx.getThemeColor('gitDecoration.addedResourceForeground', '#81b88b');
    const lineNumFg = '#888888';

    // Clear background
    for (let row = 0; row < height; row++) {
      buffer.writeString(x, y + row, ' '.repeat(width), fg, bg);
    }

    let currentY = y;

    // Header: "Editing: filename.ts @@ hunk @@"
    const filePath = this.editingNode.artifact.filePath.split('/').pop() ?? 'file';
    const hunkHeader = formatHunkHeader(this.editingNode.hunk);
    let headerText = ` Editing: ${filePath} ${hunkHeader}`;
    if (headerText.length > width) {
      headerText = headerText.slice(0, width - 1) + '…';
    }
    buffer.writeString(x, currentY, headerText.padEnd(width, ' '), headerFg, headerBg);
    currentY++;

    // Mode indicator
    const modeText = ` Mode: ${this.editSaveMode === 'direct-write' ? 'Direct Write' : 'Stage Modified'}`;
    buffer.writeString(x, currentY, modeText.padEnd(width, ' '), lineNumFg, bg);
    currentY++;

    // Content area (leave room for hints bar)
    const hintsHeight = 2;
    const contentHeight = height - 3 - hintsHeight; // -3 for header + mode + bottom border

    // Calculate scroll offset for edit buffer
    const editScrollTop = Math.max(0, this.editCursor.line - Math.floor(contentHeight / 2));

    // Line number gutter width
    const gutterWidth = 5;
    const contentWidth = width - gutterWidth;

    // Render edit buffer lines
    for (let row = 0; row < contentHeight; row++) {
      const bufferLine = editScrollTop + row;
      const screenY = currentY + row;

      if (bufferLine < this.editBuffer.length) {
        const lineContent = this.editBuffer[bufferLine] ?? '';
        const lineNum = (bufferLine + 1).toString().padStart(gutterWidth - 1, ' ');

        // Write line number
        buffer.writeString(x, screenY, lineNum + ' ', lineNumFg, bg);

        // Write content
        const displayContent = lineContent.length > contentWidth - 1
          ? lineContent.slice(0, contentWidth - 2) + '…'
          : lineContent.padEnd(contentWidth - 1, ' ');
        buffer.writeString(x + gutterWidth, screenY, displayContent, addedFg, bg);

        // Render cursor if on this line
        if (bufferLine === this.editCursor.line && this.focused) {
          const cursorX = x + gutterWidth + this.editCursor.col;
          if (cursorX < x + width) {
            const cursorChar = buffer.get(cursorX, screenY)?.char ?? ' ';
            buffer.set(cursorX, screenY, { char: cursorChar, fg: bg, bg: cursorBg });
          }
        }
      } else {
        // Empty line indicator
        buffer.writeString(x, screenY, '~'.padEnd(width, ' '), lineNumFg, bg);
      }
    }

    // Bottom border
    const bottomY = y + height - hintsHeight - 1;
    buffer.writeString(x, bottomY, '─'.repeat(width), lineNumFg, bg);

    // Hints bar
    const hints = [
      ' Esc:cancel  Ctrl+S:save  Ctrl+Z:undo  Ctrl+Y:redo',
      ' ↑↓←→:move  Enter:newline  Backspace:delete  Home/End:start/end',
    ];
    for (let i = 0; i < hintsHeight; i++) {
      const hint = hints[i] ?? '';
      const displayHint = hint.length > width ? hint.slice(0, width) : hint.padEnd(width, ' ');
      buffer.writeString(x, y + height - hintsHeight + i, displayHint, hintFg, hintBg);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Keyboard Hints
  // ─────────────────────────────────────────────────────────────────────────

  protected override getKeyboardHints(): string[] {
    const node = this.getSelectedNode();
    const viewLabel = this.diffViewMode === 'unified' ? 'unified' : 'split';

    if (this.staged) {
      return [
        ` ↑↓:navigate  Enter:toggle  v:${viewLabel}  o:open`,
        ' u:unstage  p:pin  r:refresh',
      ];
    } else {
      if (node && isFileNode(node)) {
        return [
          ` ↑↓:navigate  Enter:toggle  v:${viewLabel}  o:open`,
          ' s:stage  d:discard  p:pin  r:refresh',
        ];
      } else if (node && isHunkNode(node)) {
        return [
          ` ↑↓:navigate  Enter:toggle  v:${viewLabel}  o:open  e:edit`,
          ' s:stage-hunk  d:discard-hunk  p:pin  r:refresh',
        ];
      }
      return [
        ` ↑↓:navigate  Enter:toggle  v:${viewLabel}  o:open`,
        ' s:stage  d:discard  p:pin  r:refresh',
      ];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Key Handling
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Override handleKey to intercept edit mode keys.
   */
  override handleKey(event: KeyEvent): boolean {
    // Handle edit mode keys first
    if (this.editingNode) {
      return this.handleEditKey(event);
    }

    // Normal key handling
    return super.handleKey(event);
  }

  /**
   * Handle keyboard input in edit mode.
   */
  private handleEditKey(event: KeyEvent): boolean {
    // Escape - cancel edit
    if (event.key === 'Escape') {
      this.cancelEdit();
      return true;
    }

    // Ctrl+S - save edit
    if (event.key === 's' && event.ctrl && !event.alt && !event.shift) {
      void this.saveEdit();
      return true;
    }

    // Ctrl+Z - undo
    if (event.key === 'z' && event.ctrl && !event.alt && !event.shift) {
      this.editUndo();
      return true;
    }

    // Ctrl+Y or Ctrl+Shift+Z - redo
    if ((event.key === 'y' && event.ctrl && !event.alt && !event.shift) ||
        (event.key === 'z' && event.ctrl && !event.alt && event.shift)) {
      this.editRedo();
      return true;
    }

    // Arrow keys - cursor movement
    if (event.key === 'ArrowLeft') {
      this.editCursorLeft();
      return true;
    }
    if (event.key === 'ArrowRight') {
      this.editCursorRight();
      return true;
    }
    if (event.key === 'ArrowUp') {
      this.editCursorUp();
      return true;
    }
    if (event.key === 'ArrowDown') {
      this.editCursorDown();
      return true;
    }

    // Home/End - line navigation
    if (event.key === 'Home') {
      this.editCursorHome();
      return true;
    }
    if (event.key === 'End') {
      this.editCursorEnd();
      return true;
    }

    // Backspace - delete backward
    if (event.key === 'Backspace') {
      this.editDeleteBackward();
      return true;
    }

    // Delete - delete forward
    if (event.key === 'Delete') {
      this.editDeleteForward();
      return true;
    }

    // Enter - insert newline
    if (event.key === 'Enter') {
      this.editInsertNewline();
      return true;
    }

    // Tab - insert spaces (using editor.tabSize setting)
    if (event.key === 'Tab' && !event.ctrl && !event.alt) {
      const tabSize = this.ctx.getSetting('editor.tabSize', 2);
      const spaces = ' '.repeat(tabSize);
      this.editInsertChar(spaces);
      return true;
    }

    // Regular character input
    if (event.key.length === 1 && !event.ctrl && !event.alt && !event.meta) {
      this.editInsertChar(event.key);
      return true;
    }

    // Don't propagate other keys in edit mode
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Action Key Handling
  // ─────────────────────────────────────────────────────────────────────────

  protected override handleActionKey(event: KeyEvent): boolean {
    const node = this.getSelectedNode();
    if (!node) return false;

    // Stage (s)
    if (event.key === 's' && !event.ctrl && !event.alt && !event.shift) {
      if (!this.staged) {
        if (isFileNode(node)) {
          this.gitCallbacks.onStageFile?.(node.artifact.filePath);
          return true;
        } else if (isHunkNode(node)) {
          this.gitCallbacks.onStageHunk?.(node.artifact.filePath, node.hunkIndex);
          return true;
        }
      }
    }

    // Unstage (u)
    if (event.key === 'u' && !event.ctrl && !event.alt && !event.shift) {
      if (this.staged) {
        if (isFileNode(node)) {
          this.gitCallbacks.onUnstageFile?.(node.artifact.filePath);
          return true;
        } else if (isHunkNode(node)) {
          this.gitCallbacks.onUnstageHunk?.(node.artifact.filePath, node.hunkIndex);
          return true;
        }
      }
    }

    // Discard (d)
    if (event.key === 'd' && !event.ctrl && !event.alt && !event.shift) {
      if (!this.staged) {
        if (isFileNode(node)) {
          this.gitCallbacks.onDiscardFile?.(node.artifact.filePath);
          return true;
        } else if (isHunkNode(node)) {
          this.gitCallbacks.onDiscardHunk?.(node.artifact.filePath, node.hunkIndex);
          return true;
        }
      }
    }

    // Toggle diff view mode (v)
    if (event.key === 'v' && !event.ctrl && !event.alt && !event.shift) {
      this.toggleDiffViewMode();
      return true;
    }

    // Edit hunk (e) - only for unstaged, non-historical diffs
    if (event.key === 'e' && !event.ctrl && !event.alt && !event.shift) {
      if (!this.staged && !this.isHistoricalDiff && isHunkNode(node)) {
        this.startEdit(node);
        return true;
      }
    }

    return false;
  }

  protected override handleNodeActivation(node: ArtifactNode<GitDiffArtifact> | null): void {
    if (!node) return;

    // For line nodes, open file at that line
    if (isLineNode(node)) {
      const lineNum = node.line.newLineNum ?? node.line.oldLineNum ?? 1;
      this.callbacks.onOpenFile?.(node.artifact.filePath, lineNum);
    } else {
      // For file/hunk nodes, open the file
      this.callbacks.onOpenFile?.(node.artifact.filePath);
    }
  }
}

// ============================================
// Factory Function
// ============================================

/**
 * Create a git diff browser element.
 */
export function createGitDiffBrowser(
  id: string,
  title: string,
  ctx: ElementContext,
  callbacks?: GitDiffBrowserCallbacks
): GitDiffBrowser {
  return new GitDiffBrowser(id, title, ctx, callbacks);
}
