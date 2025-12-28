/**
 * Row Details Panel
 *
 * A side panel for viewing and editing database row details.
 * Features:
 * - View all columns in a selected row
 * - Edit values with type-appropriate editors
 * - Save changes back to database (using UPDATE)
 * - Delete row with confirmation
 * - Special handling for JSON, arrays, and timestamps
 */

import { BaseElement, type ElementContext } from './base.ts';
import type { KeyEvent, MouseEvent, Rect } from '../types.ts';
import type { ScreenBuffer } from '../rendering/buffer.ts';
import { debugLog } from '../../../debug.ts';
import type { FieldInfo, ColumnInfo } from '../../../services/database/types.ts';

// ============================================
// Types
// ============================================

/**
 * Field editor mode.
 */
export type FieldEditorMode = 'text' | 'number' | 'boolean' | 'json' | 'timestamp' | 'null';

/**
 * Primary key information for a table.
 */
export interface PrimaryKeyDef {
  columns: string[];
}

/**
 * Editable field state.
 */
interface EditableField {
  name: string;
  dataType: string;
  originalValue: unknown;
  currentValue: unknown;
  isNull: boolean;
  isPrimaryKey: boolean;
  editorMode: FieldEditorMode;
  isModified: boolean;
  // For text editing
  cursorPos: number;
  scrollLeft: number;
  // For timestamp editing
  timestampPart: number; // 0=year, 1=month, 2=day, 3=hour, 4=minute, 5=second, 6=tz
}

/**
 * Callbacks for row details panel.
 */
export interface RowDetailsPanelCallbacks {
  /** Called to save changes */
  onSave?: (updates: Record<string, unknown>, whereClause: Record<string, unknown>) => Promise<boolean>;
  /** Called to delete the row */
  onDelete?: (whereClause: Record<string, unknown>) => Promise<boolean>;
  /** Called to confirm delete action */
  onConfirmDelete?: (message: string) => Promise<boolean>;
  /** Called when panel is closed */
  onClose?: () => void;
  /** Called when a field is modified */
  onFieldModified?: () => void;
}

/**
 * Row details panel state for serialization.
 */
export interface RowDetailsPanelState {
  selectedField: number;
  scrollTop: number;
}

// ============================================
// Row Details Panel Element
// ============================================

/**
 * Row Details Panel for editing database row values.
 */
export class RowDetailsPanel extends BaseElement {
  // Data
  private fields: EditableField[] = [];
  private primaryKey: PrimaryKeyDef | null = null;
  private tableName: string = '';
  private schemaName: string = 'public';

  // UI state
  private selectedField: number = 0;
  private scrollTop: number = 0;
  private isEditing: boolean = false;
  private editBuffer: string = '';

  // Callbacks
  private callbacks: RowDetailsPanelCallbacks;

  // UI constants
  private readonly HEADER_HEIGHT = 2;
  private readonly FOOTER_HEIGHT = 1;
  private readonly LABEL_WIDTH = 20;
  private readonly FIELD_HEIGHT = 1;
  private readonly JSON_FIELD_HEIGHT = 5;

  constructor(id: string, ctx: ElementContext, callbacks: RowDetailsPanelCallbacks = {}) {
    super('RowDetailsPanel', id, 'Row Details', ctx);
    this.callbacks = callbacks;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set the row data to display.
   */
  setRowData(
    row: Record<string, unknown>,
    fieldInfo: FieldInfo[],
    tableName: string,
    schemaName: string = 'public',
    primaryKey: PrimaryKeyDef | null = null
  ): void {
    this.tableName = tableName;
    this.schemaName = schemaName;
    this.primaryKey = primaryKey;
    this.selectedField = 0;
    this.scrollTop = 0;
    this.isEditing = false;

    const pkColumns = new Set(primaryKey?.columns || []);

    this.fields = fieldInfo.map(field => {
      const value = row[field.name];
      return {
        name: field.name,
        dataType: field.dataType,
        originalValue: value,
        currentValue: value,
        isNull: value === null,
        isPrimaryKey: pkColumns.has(field.name),
        editorMode: this.getEditorMode(field.dataType, value),
        isModified: false,
        cursorPos: 0,
        scrollLeft: 0,
        timestampPart: 0,
      };
    });

    this.setTitle(`Edit: ${tableName}`);
    this.ctx.markDirty();
  }

  /**
   * Check if any field has been modified.
   */
  hasChanges(): boolean {
    return this.fields.some(f => f.isModified);
  }

  /**
   * Get the modified fields.
   */
  getModifiedFields(): Record<string, unknown> {
    const updates: Record<string, unknown> = {};
    for (const field of this.fields) {
      if (field.isModified && !field.isPrimaryKey) {
        updates[field.name] = field.isNull ? null : field.currentValue;
      }
    }
    return updates;
  }

  /**
   * Get the WHERE clause for identifying this row.
   */
  getWhereClause(): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (this.primaryKey && this.primaryKey.columns.length > 0) {
      // Use primary key columns
      for (const col of this.primaryKey.columns) {
        const field = this.fields.find(f => f.name === col);
        if (field) {
          where[field.name] = field.originalValue;
        }
      }
    } else {
      // Fallback: use all original values
      for (const field of this.fields) {
        where[field.name] = field.originalValue;
      }
    }

    return where;
  }

  /**
   * Save changes to the database.
   */
  async save(): Promise<boolean> {
    if (!this.hasChanges()) {
      return true;
    }

    if (!this.callbacks.onSave) {
      debugLog('[RowDetailsPanel] No save callback configured');
      return false;
    }

    const updates = this.getModifiedFields();
    const where = this.getWhereClause();

    try {
      const success = await this.callbacks.onSave(updates, where);
      if (success) {
        // Update original values to current
        for (const field of this.fields) {
          if (field.isModified) {
            field.originalValue = field.currentValue;
            field.isModified = false;
          }
        }
        this.ctx.markDirty();
      }
      return success;
    } catch (error) {
      debugLog(`[RowDetailsPanel] Save error: ${error}`);
      return false;
    }
  }

  /**
   * Delete this row from the database.
   */
  async delete(): Promise<boolean> {
    if (!this.callbacks.onDelete) {
      debugLog('[RowDetailsPanel] No delete callback configured');
      return false;
    }

    // Confirm deletion
    if (this.callbacks.onConfirmDelete) {
      const confirmed = await this.callbacks.onConfirmDelete(
        `Delete row from ${this.schemaName}.${this.tableName}?`
      );
      if (!confirmed) {
        return false;
      }
    }

    const where = this.getWhereClause();

    try {
      return await this.callbacks.onDelete(where);
    } catch (error) {
      debugLog(`[RowDetailsPanel] Delete error: ${error}`);
      return false;
    }
  }

  /**
   * Close the panel.
   */
  close(): void {
    this.callbacks.onClose?.();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────────────────

  render(buffer: ScreenBuffer): void {
    const { x, y, width, height } = this.bounds;

    // Colors
    const bg = this.ctx.getThemeColor('editor.background', '#1e1e1e');
    const fg = this.ctx.getThemeColor('editor.foreground', '#d4d4d4');
    const headerBg = this.ctx.getThemeColor('titleBar.activeBackground', '#3c3c3c');
    const headerFg = this.ctx.getThemeColor('titleBar.activeForeground', '#ffffff');
    const borderColor = this.ctx.getThemeColor('editorGroup.border', '#444444');

    // Clear background
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        buffer.set(x + col, y + row, { char: ' ', fg, bg });
      }
    }

    // Header
    this.renderHeader(buffer, x, y, width, headerBg, headerFg);

    // Left border
    for (let row = 0; row < height; row++) {
      buffer.set(x, y + row, { char: '│', fg: borderColor, bg });
    }

    // Fields
    const contentY = y + this.HEADER_HEIGHT;
    const contentHeight = height - this.HEADER_HEIGHT - this.FOOTER_HEIGHT;
    this.renderFields(buffer, x + 1, contentY, width - 1, contentHeight);

    // Footer
    this.renderFooter(buffer, x, y + height - 1, width);
  }

  private renderHeader(
    buffer: ScreenBuffer,
    x: number,
    y: number,
    width: number,
    bg: string,
    fg: string
  ): void {
    // First line: title
    for (let col = 0; col < width; col++) {
      buffer.set(x + col, y, { char: col === 0 ? '┌' : '─', fg, bg });
    }

    const title = ` ${this.tableName} `;
    const titleStart = Math.floor((width - title.length) / 2);
    for (let i = 0; i < title.length && titleStart + i < width; i++) {
      buffer.set(x + titleStart + i, y, { char: title[i] ?? ' ', fg, bg });
    }

    // Second line: column headers
    for (let col = 0; col < width; col++) {
      buffer.set(x + col, y + 1, { char: ' ', fg, bg });
    }

    const fieldLabel = 'Field';
    const valueLabel = 'Value';
    buffer.set(x, y + 1, { char: '│', fg, bg });
    for (let i = 0; i < fieldLabel.length && i + 2 < width; i++) {
      buffer.set(x + 2 + i, y + 1, { char: fieldLabel[i] ?? ' ', fg, bg });
    }
    for (let i = 0; i < valueLabel.length && this.LABEL_WIDTH + 2 + i < width; i++) {
      buffer.set(x + this.LABEL_WIDTH + 2 + i, y + 1, { char: valueLabel[i] ?? ' ', fg, bg });
    }
  }

  private renderFields(
    buffer: ScreenBuffer,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const bg = this.ctx.getThemeColor('editor.background', '#1e1e1e');
    const fg = this.ctx.getThemeColor('editor.foreground', '#d4d4d4');
    const selectedBg = this.ctx.getThemeColor('list.activeSelectionBackground', '#094771');
    const selectedFg = this.ctx.getThemeColor('list.activeSelectionForeground', '#ffffff');
    const modifiedFg = this.ctx.getThemeColor('editorGutter.modifiedBackground', '#0c7d9d');
    const pkFg = this.ctx.getThemeColor('symbolIcon.keyForeground', '#d7ba7d');
    const nullFg = this.ctx.getThemeColor('descriptionForeground', '#858585');

    let renderY = y;
    let fieldIdx = 0;

    for (let i = this.scrollTop; i < this.fields.length && renderY < y + height; i++) {
      const field = this.fields[i];
      if (!field) continue;

      const isSelected = i === this.selectedField;
      const fieldHeight = this.getFieldHeight(field);

      // Render field
      const rowBg = isSelected && this.focused ? selectedBg : bg;
      const rowFg = isSelected && this.focused ? selectedFg : fg;

      // Clear row
      for (let h = 0; h < fieldHeight && renderY + h < y + height; h++) {
        for (let col = 0; col < width; col++) {
          buffer.set(x + col, renderY + h, { char: ' ', fg: rowFg, bg: rowBg });
        }
      }

      // Field name
      let nameColor = rowFg;
      if (field.isPrimaryKey) nameColor = pkFg;
      if (field.isModified) nameColor = modifiedFg;

      const namePrefix = field.isPrimaryKey ? '🔑' : '  ';
      const displayName = `${namePrefix}${field.name}`.slice(0, this.LABEL_WIDTH - 1);
      for (let i = 0; i < displayName.length; i++) {
        buffer.set(x + i, renderY, { char: displayName[i] ?? ' ', fg: nameColor, bg: rowBg });
      }

      // Data type indicator
      const typeStr = field.dataType.slice(0, 10);
      for (let i = 0; i < typeStr.length && i < width - this.LABEL_WIDTH; i++) {
        buffer.set(x + i, renderY, {
          char: displayName[i] ?? ' ',
          fg: nameColor,
          bg: rowBg,
        });
      }

      // Value
      const valueX = x + this.LABEL_WIDTH;
      const valueWidth = width - this.LABEL_WIDTH;

      if (field.isNull) {
        const nullText = 'NULL';
        for (let i = 0; i < nullText.length && i < valueWidth; i++) {
          buffer.set(valueX + i, renderY, { char: nullText[i] ?? ' ', fg: nullFg, bg: rowBg });
        }
      } else {
        // When editing, show the edit buffer; otherwise show the current value
        const isEditingThisField = isSelected && this.isEditing && this.focused;
        const valueStr = isEditingThisField
          ? this.editBuffer
          : this.formatValueForDisplay(field.currentValue, valueWidth);

        for (let i = 0; i < valueWidth; i++) {
          const charIdx = i + (isEditingThisField ? field.scrollLeft : 0);
          const char = charIdx < valueStr.length ? (valueStr[charIdx] ?? ' ') : ' ';
          buffer.set(valueX + i, renderY, { char, fg: rowFg, bg: rowBg });
        }

        // Cursor for editing
        if (isEditingThisField) {
          const cursorX = valueX + field.cursorPos - field.scrollLeft;
          if (cursorX >= valueX && cursorX < valueX + valueWidth) {
            const cursorBg = this.ctx.getThemeColor('editorCursor.foreground', '#ffffff');
            buffer.set(cursorX, renderY, {
              char: this.editBuffer[field.cursorPos] ?? ' ',
              fg: rowBg,
              bg: cursorBg,
            });
          }
        }
      }

      // For JSON/array fields, render additional lines
      if (fieldHeight > 1 && !field.isNull && this.isJsonOrArray(field)) {
        const jsonStr = JSON.stringify(field.currentValue, null, 2);
        const jsonLines = jsonStr.split('\n');

        for (let h = 1; h < fieldHeight && renderY + h < y + height; h++) {
          const lineIdx = h - 1;
          const line = jsonLines[lineIdx] || '';
          for (let i = 0; i < line.length && valueX + i < x + width; i++) {
            buffer.set(valueX + i, renderY + h, { char: line[i] ?? ' ', fg: rowFg, bg: rowBg });
          }
        }
      }

      renderY += fieldHeight;
      fieldIdx++;
    }
  }

  private renderFooter(buffer: ScreenBuffer, x: number, y: number, width: number): void {
    const bg = this.ctx.getThemeColor('statusBar.background', '#007acc');
    const fg = this.ctx.getThemeColor('statusBar.foreground', '#ffffff');

    // Clear footer
    for (let col = 0; col < width; col++) {
      buffer.set(x + col, y, { char: ' ', fg, bg });
    }

    // Status/hints
    const hints = this.hasChanges()
      ? 'Ctrl+S: Save  Esc: Cancel  Del: Delete Row'
      : 'Enter: Edit  Tab: Next  Del: Delete Row  Esc: Close';

    for (let i = 0; i < hints.length && i < width; i++) {
      buffer.set(x + i, y, { char: hints[i] ?? ' ', fg, bg });
    }

    // Modified indicator
    if (this.hasChanges()) {
      const modText = ' [Modified]';
      const modStart = width - modText.length;
      for (let i = 0; i < modText.length && modStart + i < width; i++) {
        buffer.set(x + modStart + i, y, {
          char: modText[i] ?? ' ',
          fg: this.ctx.getThemeColor('editorGutter.modifiedBackground', '#0c7d9d'),
          bg,
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Input Handling
  // ─────────────────────────────────────────────────────────────────────────

  override handleKey(event: KeyEvent): boolean {
    // Save: Ctrl+S or Ctrl+Enter
    if (event.ctrl && (event.key === 's' || event.key === 'Enter')) {
      this.save();
      return true;
    }

    // Close: Escape (when not editing)
    if (event.key === 'Escape') {
      if (this.isEditing) {
        this.cancelEdit();
      } else {
        this.close();
      }
      return true;
    }

    // Delete row: Delete key
    if (event.key === 'Delete' && !this.isEditing) {
      this.delete();
      return true;
    }

    // Toggle null: Ctrl+N
    if (event.ctrl && event.key === 'n') {
      this.toggleNull();
      return true;
    }

    if (this.isEditing) {
      return this.handleEditKey(event);
    }

    // Navigation
    if (event.key === 'ArrowUp') {
      this.selectedField = Math.max(0, this.selectedField - 1);
      this.ensureFieldVisible();
      this.ctx.markDirty();
      return true;
    }
    if (event.key === 'ArrowDown' || event.key === 'Tab') {
      this.selectedField = Math.min(this.fields.length - 1, this.selectedField + 1);
      this.ensureFieldVisible();
      this.ctx.markDirty();
      return true;
    }
    if (event.key === 'Enter') {
      this.startEdit();
      return true;
    }

    // Start typing to edit
    if (event.key.length === 1 && !event.ctrl && !event.alt) {
      this.startEdit();
      // Insert the typed character
      this.editBuffer = event.key;
      const field = this.fields[this.selectedField];
      if (field) {
        field.cursorPos = 1;
      }
      this.ctx.markDirty();
      return true;
    }

    return false;
  }

  private handleEditKey(event: KeyEvent): boolean {
    const field = this.fields[this.selectedField];
    if (!field) return false;

    if (event.key === 'Enter') {
      this.commitEdit();
      return true;
    }

    if (event.key === 'ArrowLeft') {
      field.cursorPos = Math.max(0, field.cursorPos - 1);
      this.ctx.markDirty();
      return true;
    }
    if (event.key === 'ArrowRight') {
      field.cursorPos = Math.min(this.editBuffer.length, field.cursorPos + 1);
      this.ctx.markDirty();
      return true;
    }
    if (event.key === 'Home') {
      field.cursorPos = 0;
      this.ctx.markDirty();
      return true;
    }
    if (event.key === 'End') {
      field.cursorPos = this.editBuffer.length;
      this.ctx.markDirty();
      return true;
    }
    if (event.key === 'Backspace') {
      if (field.cursorPos > 0) {
        this.editBuffer =
          this.editBuffer.slice(0, field.cursorPos - 1) +
          this.editBuffer.slice(field.cursorPos);
        field.cursorPos--;
        this.ctx.markDirty();
      }
      return true;
    }
    if (event.key === 'Delete') {
      if (field.cursorPos < this.editBuffer.length) {
        this.editBuffer =
          this.editBuffer.slice(0, field.cursorPos) +
          this.editBuffer.slice(field.cursorPos + 1);
        this.ctx.markDirty();
      }
      return true;
    }

    // Character input
    if (event.key.length === 1 && !event.ctrl && !event.alt) {
      this.editBuffer =
        this.editBuffer.slice(0, field.cursorPos) +
        event.key +
        this.editBuffer.slice(field.cursorPos);
      field.cursorPos++;
      this.ctx.markDirty();
      return true;
    }

    return false;
  }

  override handleMouse(event: MouseEvent): boolean {
    if (event.type === 'press') {
      const relY = event.y - this.bounds.y - this.HEADER_HEIGHT;
      if (relY >= 0) {
        // Find which field was clicked
        let fieldY = 0;
        for (let i = this.scrollTop; i < this.fields.length; i++) {
          const field = this.fields[i];
          if (!field) continue;
          const height = this.getFieldHeight(field);
          if (relY >= fieldY && relY < fieldY + height) {
            this.selectedField = i;
            this.ctx.markDirty();
            break;
          }
          fieldY += height;
        }
      }
      return true;
    }

    if (event.type === 'scroll') {
      const delta = event.scrollDirection === -1 ? -1 : 1;
      this.scrollTop = Math.max(0, Math.min(this.fields.length - 1, this.scrollTop + delta));
      this.ctx.markDirty();
      return true;
    }

    return false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Editing Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private startEdit(): void {
    const field = this.fields[this.selectedField];
    if (!field || field.isPrimaryKey) return; // Can't edit primary keys

    this.isEditing = true;
    this.editBuffer = field.isNull ? '' : this.formatValueForEdit(field.currentValue);
    field.cursorPos = this.editBuffer.length;
    this.ctx.markDirty();
  }

  private commitEdit(): void {
    const field = this.fields[this.selectedField];
    if (!field) return;

    // Parse the edited value
    const newValue = this.parseEditedValue(this.editBuffer, field);
    const changed = this.editBuffer !== this.formatValueForEdit(field.originalValue);

    field.currentValue = newValue;
    field.isNull = this.editBuffer.trim().toLowerCase() === 'null' || this.editBuffer === '';
    field.isModified = changed || field.isNull !== (field.originalValue === null);

    this.isEditing = false;
    this.ctx.markDirty();

    if (field.isModified) {
      this.callbacks.onFieldModified?.();
    }
  }

  private cancelEdit(): void {
    this.isEditing = false;
    this.ctx.markDirty();
  }

  private toggleNull(): void {
    const field = this.fields[this.selectedField];
    if (!field || field.isPrimaryKey) return;

    field.isNull = !field.isNull;
    field.isModified = field.isNull !== (field.originalValue === null);
    this.ctx.markDirty();

    if (field.isModified) {
      this.callbacks.onFieldModified?.();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────────────────

  private getEditorMode(dataType: string, value: unknown): FieldEditorMode {
    const type = dataType.toLowerCase();

    if (value === null) return 'null';
    if (type.includes('json') || type.includes('array') || Array.isArray(value)) return 'json';
    if (type.includes('timestamp') || type.includes('date') || type.includes('time')) return 'timestamp';
    if (type.includes('bool')) return 'boolean';
    if (type.includes('int') || type.includes('float') || type.includes('numeric') || type.includes('decimal')) return 'number';

    return 'text';
  }

  private getFieldHeight(field: EditableField): number {
    if (field.isNull) return this.FIELD_HEIGHT;
    if (this.isJsonOrArray(field)) return this.JSON_FIELD_HEIGHT;
    return this.FIELD_HEIGHT;
  }

  private isJsonOrArray(field: EditableField): boolean {
    return field.editorMode === 'json' || Array.isArray(field.currentValue);
  }

  private formatValueForDisplay(value: unknown, maxWidth: number): string {
    if (value === null || value === undefined) return 'NULL';

    let str: string;
    if (typeof value === 'object') {
      str = JSON.stringify(value);
    } else if (typeof value === 'boolean') {
      str = value ? 'true' : 'false';
    } else {
      str = String(value);
    }

    if (str.length > maxWidth) {
      return str.slice(0, maxWidth - 1) + '…';
    }

    return str;
  }

  private formatValueForEdit(value: unknown): string {
    if (value === null || value === undefined) return '';

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  private parseEditedValue(str: string, field: EditableField): unknown {
    const trimmed = str.trim();

    if (trimmed === '' || trimmed.toLowerCase() === 'null') {
      return null;
    }

    switch (field.editorMode) {
      case 'number':
        const num = parseFloat(trimmed);
        return isNaN(num) ? str : num;

      case 'boolean':
        if (trimmed.toLowerCase() === 'true' || trimmed === '1') return true;
        if (trimmed.toLowerCase() === 'false' || trimmed === '0') return false;
        return str;

      case 'json':
        try {
          return JSON.parse(trimmed);
        } catch {
          return str;
        }

      default:
        return str;
    }
  }

  private ensureFieldVisible(): void {
    // Simple scroll to ensure selected field is visible
    if (this.selectedField < this.scrollTop) {
      this.scrollTop = this.selectedField;
    }

    const contentHeight = this.bounds.height - this.HEADER_HEIGHT - this.FOOTER_HEIGHT;
    let visibleFields = 0;
    let y = 0;

    for (let i = this.scrollTop; i < this.fields.length && y < contentHeight; i++) {
      const field = this.fields[i];
      if (field) {
        y += this.getFieldHeight(field);
        visibleFields++;
      }
    }

    if (this.selectedField >= this.scrollTop + visibleFields) {
      this.scrollTop = Math.max(0, this.selectedField - visibleFields + 1);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // State Serialization
  // ─────────────────────────────────────────────────────────────────────────

  override getState(): RowDetailsPanelState {
    return {
      selectedField: this.selectedField,
      scrollTop: this.scrollTop,
    };
  }

  override setState(state: unknown): void {
    const s = state as RowDetailsPanelState;
    if (s.selectedField !== undefined) this.selectedField = s.selectedField;
    if (s.scrollTop !== undefined) this.scrollTop = s.scrollTop;
  }
}

export default RowDetailsPanel;
