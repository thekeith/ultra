/**
 * Confirm Dialog
 *
 * Yes/No confirmation dialog with customizable buttons.
 */

import { PromiseDialog, type DialogConfig, type DialogResult } from './promise-dialog.ts';
import type { OverlayManagerCallbacks } from './overlay-manager.ts';
import type { KeyEvent } from '../types.ts';
import type { ScreenBuffer } from '../rendering/buffer.ts';

// ============================================
// Types
// ============================================

/**
 * Options for confirm dialog.
 */
export interface ConfirmDialogOptions extends DialogConfig {
  /** Message to display */
  message: string;
  /** Confirm button text (default: "Yes") */
  confirmText?: string;
  /** Decline button text (default: "No") */
  declineText?: string;
  /** Cancel button text (default: "Cancel") - only shown if showCancel is true */
  cancelText?: string;
  /** Whether to show a Cancel button (Escape) in addition to Yes/No */
  showCancel?: boolean;
  /** Whether destructive action (red confirm button) */
  destructive?: boolean;
  /** Default selection: 'confirm', 'decline', or 'cancel' */
  defaultButton?: 'confirm' | 'decline' | 'cancel';
}

// ============================================
// Confirm Dialog
// ============================================

/** Button focus state */
type FocusedButton = 'confirm' | 'decline' | 'cancel';

export class ConfirmDialog extends PromiseDialog<boolean> {
  /** Message to display */
  private message: string = '';

  /** Confirm button text */
  private confirmText: string = 'Yes';

  /** Decline button text */
  private declineText: string = 'No';

  /** Cancel button text */
  private cancelText: string = 'Cancel';

  /** Whether to show cancel button */
  private showCancel: boolean = false;

  /** Whether destructive action */
  private destructive: boolean = false;

  /** Currently focused button */
  private focusedButton: FocusedButton = 'decline';

  constructor(id: string, callbacks: OverlayManagerCallbacks) {
    super(id, callbacks);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Show the confirm dialog.
   */
  showWithOptions(options: ConfirmDialogOptions): Promise<DialogResult<boolean>> {
    this.message = options.message;
    this.confirmText = options.confirmText ?? 'Yes';
    this.declineText = options.declineText ?? 'No';
    this.cancelText = options.cancelText ?? 'Cancel';
    this.showCancel = options.showCancel ?? false;
    this.destructive = options.destructive ?? false;
    this.focusedButton = options.defaultButton ?? 'decline';

    // Calculate height based on message
    const lines = this.message.split('\n').length;
    const height = Math.max(7, lines + 5);

    return this.showAsync({
      title: options.title ?? 'Confirm',
      width: options.width ?? 50,
      height: options.height ?? height,
      ...options,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Input Handling
  // ─────────────────────────────────────────────────────────────────────────

  protected override handleKeyInput(event: KeyEvent): boolean {
    // Enter - select focused button
    if (event.key === 'Enter') {
      this.selectFocusedButton();
      return true;
    }

    // Tab / Arrow keys - cycle focus
    if (event.key === 'Tab' || event.key === 'ArrowRight') {
      this.cycleFocus(1);
      return true;
    }

    if (event.key === 'ArrowLeft') {
      this.cycleFocus(-1);
      return true;
    }

    // Y key - confirm (Yes)
    if (event.key === 'y' || event.key === 'Y') {
      this.confirm(true);
      return true;
    }

    // N key - decline (No)
    if (event.key === 'n' || event.key === 'N') {
      this.confirm(false);
      return true;
    }

    // C key - cancel (only if showCancel)
    if (this.showCancel && (event.key === 'c' || event.key === 'C')) {
      this.cancel();
      return true;
    }

    return false;
  }

  private cycleFocus(direction: number): void {
    const buttons: FocusedButton[] = this.showCancel
      ? ['confirm', 'decline', 'cancel']
      : ['confirm', 'decline'];

    const currentIndex = buttons.indexOf(this.focusedButton);
    const newIndex = (currentIndex + direction + buttons.length) % buttons.length;
    this.focusedButton = buttons[newIndex]!;
    this.callbacks.onDirty();
  }

  private selectFocusedButton(): void {
    switch (this.focusedButton) {
      case 'confirm':
        this.confirm(true);
        break;
      case 'decline':
        this.confirm(false);
        break;
      case 'cancel':
        this.cancel();
        break;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────────────────

  protected override renderContent(buffer: ScreenBuffer): void {
    const content = this.getContentBounds();
    const bg = this.callbacks.getThemeColor('editorWidget.background', '#252526');
    const fg = this.callbacks.getThemeColor('editorWidget.foreground', '#cccccc');

    // Message
    const lines = this.message.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const maxWidth = content.width;
      const truncated = line.length > maxWidth ? line.slice(0, maxWidth - 1) + '…' : line;
      buffer.writeString(content.x, content.y + i, truncated, fg, bg);
    }

    // Buttons
    const buttonY = content.y + content.height - 2;
    this.renderButtons(buffer, content.x, buttonY, content.width);

    // Keyboard hints
    const hintY = content.y + content.height - 1;
    this.renderHints(buffer, content.x, hintY, content.width, bg);
  }

  private renderButtons(buffer: ScreenBuffer, x: number, y: number, width: number): void {
    const buttonBg = this.callbacks.getThemeColor('button.background', '#3c3c3c');
    const buttonFg = this.callbacks.getThemeColor('button.foreground', '#cccccc');
    const focusBg = this.callbacks.getThemeColor('focusBorder', '#007acc');
    const focusFg = '#ffffff';
    const destructiveBg = this.callbacks.getThemeColor('editorGutter.deletedBackground', '#f44336');

    // Button texts with shortcut key in brackets
    const confirmLabel = `[Y]${this.confirmText}`;
    const declineLabel = `[N]${this.declineText}`;
    const cancelLabel = this.showCancel ? `[Esc]${this.cancelText}` : '';

    // Button dimensions (add padding)
    const confirmWidth = confirmLabel.length + 2;
    const declineWidth = declineLabel.length + 2;
    const cancelWidth = this.showCancel ? cancelLabel.length + 2 : 0;
    const spacing = 2;
    const totalWidth = confirmWidth + declineWidth + (this.showCancel ? cancelWidth + spacing : 0) + spacing;
    const startX = x + Math.floor((width - totalWidth) / 2);

    let currentX = startX;

    // Confirm button (Yes)
    const confirmBgColor = this.destructive && this.focusedButton === 'confirm' ? destructiveBg : focusBg;
    const confirmBg = this.focusedButton === 'confirm' ? confirmBgColor : buttonBg;
    const confirmFg = this.focusedButton === 'confirm' ? focusFg : buttonFg;
    this.renderButton(buffer, currentX, y, confirmLabel, confirmFg, confirmBg);
    currentX += confirmWidth + spacing;

    // Decline button (No)
    const declineBg = this.focusedButton === 'decline' ? focusBg : buttonBg;
    const declineFg = this.focusedButton === 'decline' ? focusFg : buttonFg;
    this.renderButton(buffer, currentX, y, declineLabel, declineFg, declineBg);
    currentX += declineWidth + spacing;

    // Cancel button (optional)
    if (this.showCancel) {
      const cancelBg = this.focusedButton === 'cancel' ? focusBg : buttonBg;
      const cancelFg = this.focusedButton === 'cancel' ? focusFg : buttonFg;
      this.renderButton(buffer, currentX, y, cancelLabel, cancelFg, cancelBg);
    }
  }

  private renderHints(buffer: ScreenBuffer, x: number, y: number, width: number, bg: string): void {
    const hintFg = this.callbacks.getThemeColor('descriptionForeground', '#888888');
    const hint = this.showCancel
      ? 'Tab/Arrow: navigate • Enter: select • Esc: cancel'
      : 'Tab/Arrow: navigate • Enter: select';
    const hintX = x + Math.floor((width - hint.length) / 2);
    buffer.writeString(hintX, y, hint, hintFg, bg);
  }

  private renderButton(
    buffer: ScreenBuffer,
    x: number,
    y: number,
    text: string,
    fg: string,
    bg: string
  ): void {
    const buttonText = ` ${text} `;
    for (let i = 0; i < buttonText.length; i++) {
      buffer.set(x + i, y, { char: buttonText[i]!, fg, bg });
    }
  }
}
