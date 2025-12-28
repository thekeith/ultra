/**
 * Session Store for Web GUI
 *
 * Handles auto-save and restore of session state.
 */

import { writable, get } from 'svelte/store';
import { ecpClient } from '../ecp/client';
import { documentsStore } from './documents';
import { layoutStore, sidebar, panel } from './layout';
import { settingsStore } from './settings';

// ============================================
// Types
// ============================================

export interface WebSessionState {
  version: number;
  timestamp: string;
  documents: WebDocumentState[];
  activeDocumentId: string | null;
  layout: {
    sidebarVisible: boolean;
    sidebarWidth: number;
    sidebarSection: string;
    panelVisible: boolean;
    panelHeight: number;
    panelTab: string;
  };
}

export interface WebDocumentState {
  uri: string;
  scrollTop: number;
  cursorLine: number;
  cursorColumn: number;
  isActive: boolean;
}

interface SessionStoreState {
  isLoading: boolean;
  lastSaved: Date | null;
  autoSaveEnabled: boolean;
  autoSaveInterval: number;
  error: string | null;
}

// ============================================
// Session Store
// ============================================

function createSessionStore() {
  const { subscribe, set, update } = writable<SessionStoreState>({
    isLoading: false,
    lastSaved: null,
    autoSaveEnabled: true,
    autoSaveInterval: 30000,
    error: null,
  });

  let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Capture current session state.
   */
  function captureState(): WebSessionState {
    const allDocs = documentsStore.getAll();
    const activeDocId = documentsStore.activeDocumentId;
    const sidebarState = get(sidebar);
    const panelState = get(panel);

    const documents: WebDocumentState[] = allDocs.map((doc) => ({
      uri: doc.uri,
      scrollTop: doc.scrollTop || 0,
      cursorLine: doc.cursorLine || 0,
      cursorColumn: doc.cursorColumn || 0,
      isActive: doc.id === activeDocId,
    }));

    return {
      version: 1,
      timestamp: new Date().toISOString(),
      documents,
      activeDocumentId: activeDocId,
      layout: {
        sidebarVisible: sidebarState.visible,
        sidebarWidth: sidebarState.width,
        sidebarSection: sidebarState.activeSection,
        panelVisible: panelState.visible,
        panelHeight: panelState.height,
        panelTab: panelState.activeTab,
      },
    };
  }

  /**
   * Store session in localStorage (fallback) and optionally server.
   */
  async function saveToStorage(state: WebSessionState): Promise<void> {
    // Save to localStorage for quick restore
    try {
      localStorage.setItem('ultra-session', JSON.stringify(state));
    } catch (err) {
      console.warn('[Session] Failed to save to localStorage:', err);
    }

    // Also try to save to server
    try {
      await ecpClient.request('session/save', { state });
    } catch (err) {
      console.debug('[Session] Server save failed (non-critical):', err);
    }
  }

  /**
   * Load session from localStorage or server.
   */
  async function loadFromStorage(): Promise<WebSessionState | null> {
    // Try localStorage first (faster)
    try {
      const stored = localStorage.getItem('ultra-session');
      if (stored) {
        const state = JSON.parse(stored) as WebSessionState;
        if (state.version && state.documents) {
          return state;
        }
      }
    } catch (err) {
      console.warn('[Session] Failed to load from localStorage:', err);
    }

    // Fallback to server
    try {
      const result = await ecpClient.request<WebSessionState>('session/current', {});
      if (result?.documents) {
        return result;
      }
    } catch (err) {
      console.debug('[Session] Server load failed:', err);
    }

    return null;
  }

  return {
    subscribe,

    /**
     * Initialize session store and restore previous session.
     */
    async init(): Promise<void> {
      update((s) => ({ ...s, isLoading: true, error: null }));

      try {
        // Check if session restore is enabled
        const restoreEnabled = settingsStore.get('session.restoreOnStartup', true);
        const autoSaveEnabled = settingsStore.get('session.autoSave', true);
        const autoSaveInterval = settingsStore.get('session.autoSaveInterval', 30000);

        update((s) => ({ ...s, autoSaveEnabled, autoSaveInterval }));

        if (restoreEnabled) {
          await this.restore();
        }

        if (autoSaveEnabled) {
          this.startAutoSave();
        }
      } catch (err) {
        console.error('[Session] Init failed:', err);
        update((s) => ({ ...s, error: err instanceof Error ? err.message : String(err) }));
      } finally {
        update((s) => ({ ...s, isLoading: false }));
      }
    },

    /**
     * Save current session state.
     */
    async save(): Promise<void> {
      try {
        const state = captureState();
        await saveToStorage(state);
        update((s) => ({ ...s, lastSaved: new Date(), error: null }));
        console.debug('[Session] Saved session with', state.documents.length, 'documents');
      } catch (err) {
        console.error('[Session] Save failed:', err);
        update((s) => ({ ...s, error: err instanceof Error ? err.message : String(err) }));
      }
    },

    /**
     * Restore session from storage.
     */
    async restore(): Promise<boolean> {
      try {
        const state = await loadFromStorage();
        if (!state) {
          console.debug('[Session] No session to restore');
          return false;
        }

        console.debug('[Session] Restoring session with', state.documents.length, 'documents');

        // Restore layout first
        if (state.layout) {
          // Use direct layout update for sidebar/panel visibility
          // since layoutStore uses toggleSidebar/togglePanel
          if (state.layout.sidebarWidth) {
            layoutStore.setSidebarWidth(state.layout.sidebarWidth);
          }
          if (state.layout.sidebarSection) {
            layoutStore.setSidebarSection(state.layout.sidebarSection as 'files' | 'git' | 'search');
          }
          if (state.layout.panelHeight) {
            layoutStore.setPanelHeight(state.layout.panelHeight);
          }
          if (state.layout.panelTab) {
            layoutStore.setPanelTab(state.layout.panelTab);
          }
        }

        // Restore documents
        let activeDocId: string | null = null;
        for (const doc of state.documents) {
          try {
            const docId = await documentsStore.open(doc.uri);
            if (doc.isActive) {
              activeDocId = docId;
            }

            // Restore cursor and scroll positions
            if (doc.cursorLine !== undefined || doc.scrollTop !== undefined) {
              documentsStore.updateCursor(docId, {
                line: doc.cursorLine || 0,
                column: doc.cursorColumn || 0,
                scrollTop: doc.scrollTop || 0,
              });
            }

            // Add to layout
            const name = doc.uri.split('/').pop() || 'Untitled';
            layoutStore.addPane({
              type: 'editor',
              documentId: docId,
              title: name,
            });
          } catch (err) {
            console.warn('[Session] Failed to restore document:', doc.uri, err);
          }
        }

        // Set active document
        if (activeDocId) {
          documentsStore.setActive(activeDocId);
        }

        return true;
      } catch (err) {
        console.error('[Session] Restore failed:', err);
        update((s) => ({ ...s, error: err instanceof Error ? err.message : String(err) }));
        return false;
      }
    },

    /**
     * Start auto-save timer.
     */
    startAutoSave(): void {
      const state = get({ subscribe });

      if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
      }

      autoSaveTimer = setInterval(() => {
        this.save();
      }, state.autoSaveInterval);

      console.debug('[Session] Auto-save started, interval:', state.autoSaveInterval, 'ms');
    },

    /**
     * Stop auto-save timer.
     */
    stopAutoSave(): void {
      if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
        autoSaveTimer = null;
        console.debug('[Session] Auto-save stopped');
      }
    },

    /**
     * Clear session storage.
     */
    clear(): void {
      try {
        localStorage.removeItem('ultra-session');
      } catch (err) {
        console.warn('[Session] Failed to clear localStorage:', err);
      }
    },

    /**
     * Handle before unload - save session.
     */
    handleBeforeUnload(): void {
      // Synchronous save to localStorage for beforeunload
      try {
        const state = captureState();
        localStorage.setItem('ultra-session', JSON.stringify(state));
      } catch (err) {
        console.warn('[Session] Failed to save on unload:', err);
      }
    },
  };
}

export const sessionStore = createSessionStore();
export default sessionStore;
