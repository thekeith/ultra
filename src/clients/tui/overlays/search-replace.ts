/**
 * Search/Replace Dialog
 *
 * A dialog for searching and replacing text in the current document.
 */

import { BaseDialog, type OverlayManagerCallbacks } from './overlay-manager.ts';
import type { InputEvent, KeyEvent, MouseEvent, Rect } from '../types.ts';
import type { ScreenBuffer } from '../rendering/buffer.ts';

// ============================================
// Types
// ============================================

/**
 * Search options.
 */
export interface SearchOptions {
  /** Case sensitive search */
  caseSensitive: boolean;
  /** Whole word match */
  wholeWord: boolean;
  /** Use regular expressions */
  useRegex: boolean;
  /** Search in selection only */
  inSelection: boolean;
}

/**
 * Search match information.
 */
export interface SearchMatch {
  /** Line number (0-indexed) */
  line: number;
  /** Column (0-indexed) */
  column: number;
  /** Match length */
  length: number;
  /** Matched text */
  text: string;
}

/**
 * Callbacks for search/replace.
 */
export interface SearchReplaceCallbacks extends OverlayManagerCallbacks {
  /** Called when search query changes */
  onSearch?: (query: string, options: SearchOptions) => void;
  /** Called to find next match */
  onFindNext?: () => void;
  /** Called to find previous match */
  onFindPrevious?: () => void;
  /** Called to replace current match */
  onReplace?: (replacement: string) => void;
  /** Called to replace all matches */
  onReplaceAll?: (replacement: string) => void;
  /** Called when dialog is dismissed */
  onDismiss?: () => void;
}

/**
 * Focusable element in the dialog.
 */
type FocusableElement =
  | 'search'
  | 'replace'
  | 'caseSensitive'
  | 'wholeWord'
  | 'useRegex'
  | 'prevBtn'
  | 'nextBtn'
  | 'replaceBtn'
  | 'replaceAllBtn';

// ============================================
// Search/Replace Dialog
// ============================================

export class SearchReplaceDialog extends BaseDialog {
  /** Search query */
  private searchQuery = '';

  /** Replace text */
  private replaceText = '';

  /** Search options */
  private options: SearchOptions = {
    caseSensitive: false,
    wholeWord: false,
    useRegex: false,
    inSelection: false,
  };

  /** Current matches */
  private matches: SearchMatch[] = [];

  /** Current match index */
  private currentMatchIndex = -1;

  /** Currently focused element */
  private focusedElement: FocusableElement = 'search';

  /** Whether replace mode is enabled */
  private replaceMode = false;

  /** Callbacks */
  private searchCallbacks: SearchReplaceCallbacks;

  constructor(callbacks: SearchReplaceCallbacks) {
    super('search-replace', callbacks);
    this.searchCallbacks = callbacks;
    this.zIndex = 150;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get search query.
   */
  getSearchQuery(): string {
    return this.searchQuery;
  }

  /**
   * Set search query.
   */
  setSearchQuery(query: string): void {
    this.searchQuery = query;
    this.searchCallbacks.onSearch?.(query, this.options);
    this.callbacks.onDirty();
  }

  /**
   * Get replace text.
   */
  getReplaceText(): string {
    return this.replaceText;
  }

  /**
   * Set replace text.
   */
  setReplaceText(text: string): void {
    this.replaceText = text;
    this.callbacks.onDirty();
  }

  /**
   * Get search options.
   */
  getOptions(): SearchOptions {
    return { ...this.options };
  }

  /**
   * Set search options.
   */
  setOptions(options: Partial<SearchOptions>): void {
    this.options = { ...this.options, ...options };
    this.searchCallbacks.onSearch?.(this.searchQuery, this.options);
    this.callbacks.onDirty();
  }

  /**
   * Toggle an option.
   */
  toggleOption(option: keyof SearchOptions): void {
    this.options[option] = !this.options[option];
    this.searchCallbacks.onSearch?.(this.searchQuery, this.options);
    this.callbacks.onDirty();
  }

  /**
   * Set match results.
   */
  setMatches(matches: SearchMatch[], currentIndex: number): void {
    this.matches = matches;
    this.currentMatchIndex = currentIndex;
    this.callbacks.onDirty();
  }

  /**
   * Get match count.
   */
  getMatchCount(): number {
    return this.matches.length;
  }

  /**
   * Get current match index.
   */
  getCurrentMatchIndex(): number {
    return this.currentMatchIndex;
  }

  /**
   * Is replace mode enabled?
   */
  isReplaceEnabled(): boolean {
    return this.replaceMode;
  }

  /**
   * Set replace mode.
   */
  setReplaceMode(enabled: boolean): void {
    this.replaceMode = enabled;
    this.callbacks.onDirty();
  }

  /**
   * Toggle replace mode.
   */
  toggleReplaceMode(): void {
    this.replaceMode = !this.replaceMode;
    this.callbacks.onDirty();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Show/Hide
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Show the search dialog.
   */
  override show(withReplace = false): void {
    this.replaceMode = withReplace;
    this.focusedElement = 'search';
    super.show();
  }

  /**
   * Hide the dialog.
   */
  override hide(): void {
    super.hide();
    this.searchCallbacks.onDismiss?.();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Find next match.
   */
  findNext(): void {
    this.searchCallbacks.onFindNext?.();
  }

  /**
   * Find previous match.
   */
  findPrevious(): void {
    this.searchCallbacks.onFindPrevious?.();
  }

  /**
   * Replace current match.
   */
  replaceCurrent(): void {
    this.searchCallbacks.onReplace?.(this.replaceText);
  }

  /**
   * Replace all matches.
   */
  replaceAll(): void {
    this.searchCallbacks.onReplaceAll?.(this.replaceText);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────────────────

  render(buffer: ScreenBuffer): void {
    const { x, y, width, height } = this.bounds;

    // Colors
    const bg = this.callbacks.getThemeColor('panel.background', '#252526');
    const fg = this.callbacks.getThemeColor('panel.foreground', '#cccccc');
    const inputBg = this.callbacks.getThemeColor('input.background', '#3c3c3c');
    const inputFg = this.callbacks.getThemeColor('input.foreground', '#cccccc');
    const inputBorderActive = this.callbacks.getThemeColor('focusBorder', '#007acc');
    const dimFg = this.callbacks.getThemeColor('descriptionForeground', '#888888');
    const border = this.callbacks.getThemeColor('panel.border', '#404040');
    const buttonBg = this.callbacks.getThemeColor('button.background', '#0e639c');
    const buttonFg = this.callbacks.getThemeColor('button.foreground', '#ffffff');
    const activeOptionBg = this.callbacks.getThemeColor('inputOption.activeBackground', '#007acc');
    const activeOptionFg = this.callbacks.getThemeColor('inputOption.activeForeground', '#ffffff');
    const warningFg = this.callbacks.getThemeColor('editorWarning.foreground', '#cca700');

    // Draw dialog box
    const title = this.replaceMode ? 'Find and Replace' : 'Find';
    this.drawDialogBox(buffer, title);

    const contentX = x + 2;
    let rowY = y + 1;

    // Focus highlight color
    const focusBorder = this.callbacks.getThemeColor('focusBorder', '#007acc');

    // Search field
    const labelWidth = 10;
    buffer.writeString(contentX, rowY, 'Find:', fg, bg);

    const inputWidth = width - labelWidth - 4;
    const searchInputX = contentX + labelWidth;

    // Draw search input background
    const searchFieldBg = this.focusedElement === 'search' ? inputBg : inputBg;
    for (let col = 0; col < inputWidth; col++) {
      buffer.set(searchInputX + col, rowY, { char: ' ', fg: inputFg, bg: searchFieldBg });
    }

    // Search text
    const maxSearchDisplay = inputWidth - 2;
    let searchDisplay = this.searchQuery;
    if (searchDisplay.length > maxSearchDisplay) {
      searchDisplay = searchDisplay.slice(-maxSearchDisplay);
    }
    buffer.writeString(searchInputX + 1, rowY, searchDisplay, inputFg, searchFieldBg);

    // Cursor in search field
    if (this.focusedElement === 'search') {
      const cursorX = searchInputX + 1 + searchDisplay.length;
      if (cursorX < searchInputX + inputWidth - 1) {
        buffer.set(cursorX, rowY, { char: '▏', fg: inputBorderActive, bg: searchFieldBg });
      }
    }

    // Match count
    const matchText = this.matches.length > 0
      ? `${this.currentMatchIndex + 1}/${this.matches.length}`
      : 'No results';
    const matchX = x + width - 2 - matchText.length;
    buffer.writeString(matchX, rowY, matchText, this.matches.length > 0 ? fg : warningFg, bg);

    rowY++;

    // Replace field (if enabled)
    if (this.replaceMode) {
      buffer.writeString(contentX, rowY, 'Replace:', fg, bg);

      const replaceInputX = contentX + labelWidth;
      const replaceFieldBg = this.focusedElement === 'replace' ? inputBg : inputBg;
      for (let col = 0; col < inputWidth; col++) {
        buffer.set(replaceInputX + col, rowY, { char: ' ', fg: inputFg, bg: replaceFieldBg });
      }

      // Replace text
      let replaceDisplay = this.replaceText;
      if (replaceDisplay.length > maxSearchDisplay) {
        replaceDisplay = replaceDisplay.slice(-maxSearchDisplay);
      }
      buffer.writeString(replaceInputX + 1, rowY, replaceDisplay, inputFg, replaceFieldBg);

      // Cursor in replace field
      if (this.focusedElement === 'replace') {
        const cursorX = replaceInputX + 1 + replaceDisplay.length;
        if (cursorX < replaceInputX + inputWidth - 1) {
          buffer.set(cursorX, rowY, { char: '▏', fg: inputBorderActive, bg: replaceFieldBg });
        }
      }

      rowY++;
    }

    // Separator
    for (let col = 1; col < width - 1; col++) {
      buffer.set(x + col, rowY, { char: '─', fg: border, bg });
    }
    rowY++;

    // Options row
    const optionsX = contentX;
    let optX = optionsX;

    // Case sensitive toggle
    const caseLabel = 'Aa';
    const caseFocused = this.focusedElement === 'caseSensitive';
    const caseBg = this.options.caseSensitive ? activeOptionBg : (caseFocused ? focusBorder : inputBg);
    const caseFg = this.options.caseSensitive || caseFocused ? activeOptionFg : dimFg;
    buffer.writeString(optX, rowY, `[${caseLabel}]`, caseFg, caseBg);
    optX += caseLabel.length + 3;

    // Whole word toggle
    const wordLabel = 'W';
    const wordFocused = this.focusedElement === 'wholeWord';
    const wordBg = this.options.wholeWord ? activeOptionBg : (wordFocused ? focusBorder : inputBg);
    const wordFg = this.options.wholeWord || wordFocused ? activeOptionFg : dimFg;
    buffer.writeString(optX, rowY, `[${wordLabel}]`, wordFg, wordBg);
    optX += wordLabel.length + 3;

    // Regex toggle
    const regexLabel = '.*';
    const regexFocused = this.focusedElement === 'useRegex';
    const regexBg = this.options.useRegex ? activeOptionBg : (regexFocused ? focusBorder : inputBg);
    const regexFg = this.options.useRegex || regexFocused ? activeOptionFg : dimFg;
    buffer.writeString(optX, rowY, `[${regexLabel}]`, regexFg, regexBg);

    rowY++;

    // Buttons row
    const buttonsY = rowY;
    let btnX = contentX;

    // Find prev button
    const prevFocused = this.focusedElement === 'prevBtn';
    buffer.writeString(btnX, buttonsY, '[ ↑ ]', buttonFg, prevFocused ? focusBorder : buttonBg);
    btnX += 6;

    // Find next button
    const nextFocused = this.focusedElement === 'nextBtn';
    buffer.writeString(btnX, buttonsY, '[ ↓ ]', buttonFg, nextFocused ? focusBorder : buttonBg);
    btnX += 8;

    if (this.replaceMode) {
      // Replace button
      const replaceFocused = this.focusedElement === 'replaceBtn';
      buffer.writeString(btnX, buttonsY, '[ Replace ]', buttonFg, replaceFocused ? focusBorder : buttonBg);
      btnX += 13;

      // Replace all button
      const replaceAllFocused = this.focusedElement === 'replaceAllBtn';
      buffer.writeString(btnX, buttonsY, '[ All ]', buttonFg, replaceAllFocused ? focusBorder : buttonBg);
    }

    // Help text at bottom
    const helpY = y + height - 1;
    const helpText = 'Tab: Cycle | Enter: Activate | Esc: Close';
    buffer.writeString(x + 2, helpY, helpText, dimFg, bg);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Input Handling
  // ─────────────────────────────────────────────────────────────────────────

  handleInput(event: InputEvent): boolean {
    // Handle mouse events
    if ('type' in event && !('key' in event)) {
      return this.handleMouseInput(event);
    }

    if (!('key' in event)) return false;

    const keyEvent = event as KeyEvent;

    // Tab / Shift+Tab to cycle through focusable elements
    if (keyEvent.key === 'Tab') {
      const elements = this.getFocusableElements();
      const currentIndex = elements.indexOf(this.focusedElement);
      if (keyEvent.shift) {
        // Previous element
        this.focusedElement = elements[(currentIndex - 1 + elements.length) % elements.length]!;
      } else {
        // Next element
        this.focusedElement = elements[(currentIndex + 1) % elements.length]!;
      }
      this.callbacks.onDirty();
      return true;
    }

    // Enter/Space to activate focused button or toggle
    if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
      if (this.activateFocusedElement()) {
        return true;
      }
      // If on text field, Enter finds next/previous
      if (this.focusedElement === 'search' || this.focusedElement === 'replace') {
        if (keyEvent.key === 'Enter') {
          if (keyEvent.shift) {
            this.findPrevious();
          } else {
            this.findNext();
          }
          return true;
        }
      }
    }

    // Escape to close
    if (keyEvent.key === 'Escape') {
      this.hide();
      return true;
    }

    // Option toggles with Alt
    if (keyEvent.alt) {
      if (keyEvent.key === 'c') {
        this.toggleOption('caseSensitive');
        return true;
      }
      if (keyEvent.key === 'w') {
        this.toggleOption('wholeWord');
        return true;
      }
      if (keyEvent.key === 'r') {
        this.toggleOption('useRegex');
        return true;
      }
    }

    // Ctrl+H to toggle replace
    if (keyEvent.ctrl && keyEvent.key === 'h') {
      this.toggleReplaceMode();
      return true;
    }

    // Ctrl+Enter for replace
    if (keyEvent.ctrl && keyEvent.key === 'Enter' && this.replaceMode) {
      this.replaceCurrent();
      return true;
    }

    // Ctrl+Shift+Enter for replace all
    if (keyEvent.ctrl && keyEvent.shift && keyEvent.key === 'Enter' && this.replaceMode) {
      this.replaceAll();
      return true;
    }

    // Text input only for search/replace fields
    if (this.focusedElement === 'search' || this.focusedElement === 'replace') {
      // Backspace
      if (keyEvent.key === 'Backspace') {
        if (this.focusedElement === 'search' && this.searchQuery.length > 0) {
          this.setSearchQuery(this.searchQuery.slice(0, -1));
        } else if (this.focusedElement === 'replace' && this.replaceText.length > 0) {
          this.setReplaceText(this.replaceText.slice(0, -1));
        }
        return true;
      }

      // Clear field
      if (keyEvent.ctrl && keyEvent.key === 'u') {
        if (this.focusedElement === 'search') {
          this.setSearchQuery('');
        } else {
          this.setReplaceText('');
        }
        return true;
      }

      // Character input
      if (keyEvent.key.length === 1 && !keyEvent.ctrl && !keyEvent.alt && !keyEvent.meta) {
        if (this.focusedElement === 'search') {
          this.setSearchQuery(this.searchQuery + keyEvent.key);
        } else {
          this.setReplaceText(this.replaceText + keyEvent.key);
        }
        return true;
      }
    }

    // Consume all other keys to prevent them from reaching the editor
    return true;
  }

  /**
   * Get list of focusable elements based on current mode.
   */
  private getFocusableElements(): FocusableElement[] {
    if (this.replaceMode) {
      return [
        'search',
        'replace',
        'caseSensitive',
        'wholeWord',
        'useRegex',
        'prevBtn',
        'nextBtn',
        'replaceBtn',
        'replaceAllBtn',
      ];
    }
    return [
      'search',
      'caseSensitive',
      'wholeWord',
      'useRegex',
      'prevBtn',
      'nextBtn',
    ];
  }

  /**
   * Activate the currently focused element (button/toggle).
   * Returns true if an action was performed.
   */
  private activateFocusedElement(): boolean {
    switch (this.focusedElement) {
      case 'caseSensitive':
        this.toggleOption('caseSensitive');
        return true;
      case 'wholeWord':
        this.toggleOption('wholeWord');
        return true;
      case 'useRegex':
        this.toggleOption('useRegex');
        return true;
      case 'prevBtn':
        this.findPrevious();
        return true;
      case 'nextBtn':
        this.findNext();
        return true;
      case 'replaceBtn':
        this.replaceCurrent();
        return true;
      case 'replaceAllBtn':
        this.replaceAll();
        return true;
      default:
        return false;
    }
  }

  /**
   * Handle mouse input events.
   */
  private handleMouseInput(event: InputEvent): boolean {
    if (!('x' in event) || !('y' in event)) return true;

    const mouseEvent = event as MouseEvent;
    const { x, y, width } = this.bounds;

    // Only handle clicks
    if (mouseEvent.type !== 'press') return true;

    const relX = mouseEvent.x - x;
    const relY = mouseEvent.y - y;

    // Check if click is within dialog bounds
    if (relX < 0 || relX >= width || relY < 0 || relY >= this.bounds.height) {
      return true;
    }

    const contentX = 2;
    const labelWidth = 10;
    const inputX = contentX + labelWidth;
    const inputWidth = width - labelWidth - 4;

    // Row 1: Search field (relY === 1)
    if (relY === 1 && relX >= inputX && relX < inputX + inputWidth) {
      this.focusedElement = 'search';
      this.callbacks.onDirty();
      return true;
    }

    // Row 2: Replace field (relY === 2, if replaceMode)
    if (this.replaceMode && relY === 2 && relX >= inputX && relX < inputX + inputWidth) {
      this.focusedElement = 'replace';
      this.callbacks.onDirty();
      return true;
    }

    // Options row (relY === 3 in find mode, 4 in replace mode)
    const optionsRow = this.replaceMode ? 4 : 3;
    if (relY === optionsRow) {
      let optX = contentX;

      // Case sensitive toggle [Aa] - 4 chars
      if (relX >= optX && relX < optX + 4) {
        this.toggleOption('caseSensitive');
        return true;
      }
      optX += 5;

      // Whole word toggle [W] - 3 chars
      if (relX >= optX && relX < optX + 3) {
        this.toggleOption('wholeWord');
        return true;
      }
      optX += 4;

      // Regex toggle [.*] - 4 chars
      if (relX >= optX && relX < optX + 4) {
        this.toggleOption('useRegex');
        return true;
      }
    }

    // Buttons row (relY === 4 in find mode, 5 in replace mode)
    const buttonsRow = this.replaceMode ? 5 : 4;
    if (relY === buttonsRow) {
      let btnX = contentX;

      // [ ↑ ] button - 5 chars
      if (relX >= btnX && relX < btnX + 5) {
        this.findPrevious();
        return true;
      }
      btnX += 6;

      // [ ↓ ] button - 5 chars
      if (relX >= btnX && relX < btnX + 5) {
        this.findNext();
        return true;
      }
      btnX += 8;

      if (this.replaceMode) {
        // [ Replace ] button - 11 chars
        if (relX >= btnX && relX < btnX + 11) {
          this.replaceCurrent();
          return true;
        }
        btnX += 13;

        // [ All ] button - 7 chars
        if (relX >= btnX && relX < btnX + 7) {
          this.replaceAll();
          return true;
        }
      }
    }

    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Layout
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Calculate bounds for dialog.
   */
  calculateBounds(screenWidth: number, screenHeight: number): Rect {
    const width = Math.min(60, screenWidth - 4);
    const baseHeight = this.replaceMode ? 8 : 6;
    const height = Math.min(baseHeight, screenHeight - 4);
    const dialogX = Math.floor((screenWidth - width) / 2);
    const dialogY = Math.max(1, Math.floor(screenHeight / 8));

    return { x: dialogX, y: dialogY, width, height };
  }
}

// ============================================
// Factory Function
// ============================================

/**
 * Create a search/replace dialog.
 */
export function createSearchReplaceDialog(callbacks: SearchReplaceCallbacks): SearchReplaceDialog {
  return new SearchReplaceDialog(callbacks);
}
