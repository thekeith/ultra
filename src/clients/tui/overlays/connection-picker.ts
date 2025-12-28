/**
 * Connection Picker Dialog
 *
 * Overlay for selecting a database connection.
 * Features:
 * - List of available connections with status
 * - Quick filter by name
 * - Option to create new connection
 * - Shows connection status (connected/disconnected/error)
 * - Edit and delete connections (e/Delete keys)
 */

import { SearchableDialog, type ItemDisplay } from './searchable-dialog.ts';
import type { OverlayManagerCallbacks } from './overlay-manager.ts';
import type { KeyEvent } from '../types.ts';
import type { ConnectionInfo } from '../../../services/database/types.ts';

// ============================================
// Types
// ============================================

/**
 * Action type for connection picker.
 */
export type ConnectionPickerAction = 'select' | 'new' | 'edit' | 'delete';

/**
 * Connection picker result.
 */
export interface ConnectionPickerResult {
  action: ConnectionPickerAction;
  connection?: ConnectionInfo;
}

// ============================================
// Connection Picker Dialog
// ============================================

/**
 * Promise-based connection picker with search.
 */
export class ConnectionPickerDialog extends SearchableDialog<ConnectionInfo | 'new'> {
  /** Currently selected connection ID (for highlighting) */
  private currentConnectionId: string | null = null;

  /** Pending action (set by keyboard shortcuts) */
  private pendingAction: ConnectionPickerAction = 'select';

  /** Connections list (for resolving by index) */
  private connectionsList: ConnectionInfo[] = [];

  constructor(id: string, callbacks: OverlayManagerCallbacks) {
    super(id, callbacks);
    this.zIndex = 200;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Show the picker with available connections.
   */
  showWithConnections(
    connections: ConnectionInfo[],
    currentConnectionId?: string | null
  ): Promise<ConnectionPickerResult | null> {
    this.currentConnectionId = currentConnectionId ?? null;
    this.pendingAction = 'select';
    this.connectionsList = connections;

    // Add "New Connection" option at the end
    const items: (ConnectionInfo | 'new')[] = [...connections, 'new'];

    return this.showWithItems(
      {
        title: 'Select Connection',
        placeholder: 'Type to filter connections...',
        showSearchInput: true,
        maxResults: 15,
        hints: 'Enter: Select  e: Edit  Del: Delete  n: New',
      },
      items,
      currentConnectionId ?? undefined
    ).then(result => {
      if (result.cancelled) return null;

      const item = result.value;
      if (!item) return null;

      if (item === 'new') {
        return { action: 'new' as ConnectionPickerAction };
      }

      return {
        action: this.pendingAction,
        connection: item,
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Input Handling
  // ─────────────────────────────────────────────────────────────────────────

  protected override handleKeyInput(event: KeyEvent): boolean {
    const { key } = event;

    // Get current selected item
    const selectedItem = this.getSelectedItem();

    // Edit: 'e' key (only for connections, not 'new')
    if (key === 'e' && selectedItem && selectedItem !== 'new') {
      this.pendingAction = 'edit';
      this.confirm(selectedItem);
      return true;
    }

    // Delete: Delete or Backspace key (only for connections, not 'new')
    if ((key === 'Delete' || (key === 'Backspace' && !this.hasSearchQuery())) && selectedItem && selectedItem !== 'new') {
      this.pendingAction = 'delete';
      this.confirm(selectedItem);
      return true;
    }

    // New: 'n' key
    if (key === 'n') {
      this.confirm('new');
      return true;
    }

    return super.handleKeyInput(event);
  }

  /**
   * Check if there's a search query (to avoid delete when backspacing search).
   */
  private hasSearchQuery(): boolean {
    return this.getQuery().length > 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Abstract Implementation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Score a connection against the query.
   */
  protected override scoreItem(item: ConnectionInfo | 'new', query: string): number {
    if (item === 'new') {
      // Match "new" with relevant queries
      if ('new'.includes(query) || 'create'.includes(query) || 'add'.includes(query)) {
        return 10;
      }
      return 0;
    }

    // Score against connection name (primary)
    const nameScore = this.combinedScore(item.name, query);

    // Score against host (secondary)
    const hostScore = this.combinedScore(item.host, query) * 0.5;

    // Score against database (secondary)
    const dbScore = this.combinedScore(item.database, query) * 0.5;

    // Bonus for connected connections
    const connectedBonus = item.status === 'connected' ? 5 : 0;

    // Bonus for current connection
    const currentBonus = item.id === this.currentConnectionId ? 10 : 0;

    return Math.max(nameScore, hostScore, dbScore) + connectedBonus + currentBonus;
  }

  /**
   * Get display for a connection.
   */
  protected override getItemDisplay(
    item: ConnectionInfo | 'new',
    isSelected: boolean
  ): ItemDisplay {
    if (item === 'new') {
      return {
        text: 'New Connection...',
        secondary: 'Create a new database connection',
        icon: '+',
        isCurrent: false,
      };
    }

    // Status indicator
    let statusIcon = '○'; // disconnected
    if (item.status === 'connected') {
      statusIcon = '●'; // connected (green)
    } else if (item.status === 'connecting') {
      statusIcon = '◌'; // connecting
    } else if (item.status === 'error') {
      statusIcon = '✗'; // error
    }

    // Connection type badge
    const typeBadge = item.type === 'supabase' ? '[SB]' : '[PG]';

    return {
      text: `${statusIcon} ${item.name}`,
      secondary: `${typeBadge} ${item.host}/${item.database}`,
      icon: this.getConnectionIcon(item),
      isCurrent: item.id === this.currentConnectionId,
    };
  }

  /**
   * Get unique ID for a connection.
   */
  protected override getItemId(item: ConnectionInfo | 'new'): string {
    if (item === 'new') return '__new__';
    return item.id;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private getConnectionIcon(conn: ConnectionInfo): string {
    if (conn.status === 'connected') return '🟢';
    if (conn.status === 'error') return '🔴';
    if (conn.status === 'connecting') return '🟡';
    return '⚪';
  }
}

/**
 * Create a connection picker instance.
 */
export function createConnectionPicker(
  callbacks: OverlayManagerCallbacks
): ConnectionPickerDialog {
  return new ConnectionPickerDialog('connection-picker', callbacks);
}

export default ConnectionPickerDialog;
