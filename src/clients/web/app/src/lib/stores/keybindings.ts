/**
 * Keybindings Store for Web GUI
 *
 * Loads keybindings from the ECP server and handles keyboard events.
 */

import { writable, get } from 'svelte/store';
import { ecpClient } from '../ecp/client';

// ============================================
// Types
// ============================================

export interface KeyBinding {
  key: string;
  command: string;
  when?: string;
  args?: unknown;
}

interface ParsedKey {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

export type CommandHandler = () => void | Promise<void>;

// ============================================
// Keybindings Store
// ============================================

function createKeybindingsStore() {
  const { subscribe, set } = writable<KeyBinding[]>([]);

  // Command handlers registry
  const commandHandlers = new Map<string, CommandHandler>();

  // Pending chord state (for multi-key bindings like ctrl+k ctrl+c)
  let pendingChord: string | null = null;
  let chordTimeout: ReturnType<typeof setTimeout> | null = null;

  return {
    subscribe,

    /**
     * Initialize keybindings from ECP server.
     */
    async init(): Promise<void> {
      try {
        const result = await ecpClient.request<{ bindings: KeyBinding[] }>('keybindings/get', {});
        if (result.bindings && Array.isArray(result.bindings)) {
          set(result.bindings);
        }
      } catch (error) {
        console.error('Failed to load keybindings:', error);
        // Load default keybindings as fallback
        set(DEFAULT_KEYBINDINGS);
      }
    },

    /**
     * Register a command handler.
     */
    registerCommand(commandId: string, handler: CommandHandler): () => void {
      commandHandlers.set(commandId, handler);
      return () => {
        commandHandlers.delete(commandId);
      };
    },

    /**
     * Register multiple command handlers at once.
     */
    registerCommands(commands: Record<string, CommandHandler>): () => void {
      const unsubscribes: (() => void)[] = [];
      for (const [commandId, handler] of Object.entries(commands)) {
        unsubscribes.push(this.registerCommand(commandId, handler));
      }
      return () => {
        for (const unsub of unsubscribes) {
          unsub();
        }
      };
    },

    /**
     * Handle a DOM keyboard event.
     * Returns true if a command was executed.
     */
    handleKeyEvent(event: KeyboardEvent): boolean {
      const parsedKey = eventToParsedKey(event);
      const keyString = keyToString(parsedKey);

      // Get current bindings
      const bindings = get({ subscribe });

      // If we have a pending chord, try to match the full chord
      if (pendingChord) {
        if (chordTimeout) {
          clearTimeout(chordTimeout);
          chordTimeout = null;
        }

        const fullChord = `${pendingChord} ${keyString}`;
        pendingChord = null;

        for (const binding of bindings) {
          if (parseKeyString(binding.key) === fullChord) {
            const handler = commandHandlers.get(binding.command);
            if (handler) {
              event.preventDefault();
              event.stopPropagation();
              try {
                const result = handler();
                if (result instanceof Promise) {
                  result.catch((err) => console.error(`Error executing command ${binding.command}:`, err));
                }
              } catch (err) {
                console.error(`Error executing command ${binding.command}:`, err);
              }
              return true;
            }
          }
        }

        // No chord match found, fall through to single key matching
      }

      // Check for chord start (bindings like "ctrl+k ctrl+c")
      for (const binding of bindings) {
        const parts = binding.key.toLowerCase().split(/\s+/);
        if (parts.length > 1) {
          const firstPart = parseKeyStringPart(parts[0]);
          if (firstPart === keyString) {
            // This is the start of a chord
            pendingChord = keyString;
            chordTimeout = setTimeout(() => {
              pendingChord = null;
            }, 1500); // 1.5 second timeout for chord
            event.preventDefault();
            return true;
          }
        }
      }

      // Try to match single key binding
      for (const binding of bindings) {
        // Skip chord bindings for single key matching
        if (binding.key.includes(' ')) continue;

        if (parseKeyString(binding.key) === keyString) {
          const handler = commandHandlers.get(binding.command);
          if (handler) {
            event.preventDefault();
            event.stopPropagation();
            try {
              const result = handler();
              if (result instanceof Promise) {
                result.catch((err) => console.error(`Error executing command ${binding.command}:`, err));
              }
            } catch (err) {
              console.error(`Error executing command ${binding.command}:`, err);
            }
            return true;
          }
        }
      }

      return false;
    },

    /**
     * Get the key binding string for a command.
     */
    getBindingForCommand(commandId: string): string | null {
      const bindings = get({ subscribe });
      const binding = bindings.find((b) => b.command === commandId);
      return binding?.key ?? null;
    },

    /**
     * Format a key binding for display.
     */
    formatKeyBinding(key: string): string {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

      return key
        .split(/\s+/)
        .map((part) =>
          part
            .split('+')
            .map((k) => {
              const trimmed = k.trim().toLowerCase();
              switch (trimmed) {
                case 'ctrl':
                case 'control':
                  return isMac ? '⌃' : 'Ctrl';
                case 'cmd':
                case 'meta':
                  return isMac ? '⌘' : 'Meta';
                case 'shift':
                  return isMac ? '⇧' : 'Shift';
                case 'alt':
                case 'option':
                  return isMac ? '⌥' : 'Alt';
                case 'enter':
                  return '↵';
                case 'escape':
                  return 'Esc';
                case 'backspace':
                  return '⌫';
                case 'delete':
                  return 'Del';
                case 'tab':
                  return '⇥';
                case 'arrowup':
                  return '↑';
                case 'arrowdown':
                  return '↓';
                case 'arrowleft':
                  return '←';
                case 'arrowright':
                  return '→';
                case 'space':
                  return 'Space';
                default:
                  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
              }
            })
            .join(isMac ? '' : '+')
        )
        .join(' ');
    },
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Convert a DOM KeyboardEvent to a ParsedKey.
 */
function eventToParsedKey(event: KeyboardEvent): ParsedKey {
  return {
    key: normalizeKey(event.key),
    ctrl: event.ctrlKey,
    shift: event.shiftKey,
    alt: event.altKey,
    meta: event.metaKey,
  };
}

/**
 * Normalize key names for consistent matching.
 */
function normalizeKey(key: string): string {
  // Handle special key names
  switch (key) {
    case ' ':
      return 'space';
    case 'Control':
      return 'ctrl';
    case 'Meta':
      return 'meta';
    case 'Alt':
      return 'alt';
    case 'Shift':
      return 'shift';
    default:
      return key.toLowerCase();
  }
}

/**
 * Convert a ParsedKey to a normalized string for comparison.
 */
function keyToString(key: ParsedKey): string {
  // Don't create a binding string for modifier-only key presses
  if (['ctrl', 'shift', 'alt', 'meta', 'control'].includes(key.key)) {
    return '';
  }

  const modifiers: string[] = [];
  if (key.ctrl || key.meta) modifiers.push('ctrl'); // Treat meta (Cmd) same as ctrl for cross-platform
  if (key.shift) modifiers.push('shift');
  if (key.alt) modifiers.push('alt');

  // Sort modifiers for consistent comparison
  modifiers.sort();
  modifiers.push(key.key);
  return modifiers.join('+');
}

/**
 * Parse a key binding string to a normalized string.
 * Handles both single keys and chord sequences.
 */
function parseKeyString(keyString: string): string {
  // Handle chord sequences (space-separated)
  const parts = keyString.toLowerCase().split(/\s+/);
  return parts.map(parseKeyStringPart).join(' ');
}

/**
 * Parse a single key part (not a chord) to normalized form.
 */
function parseKeyStringPart(part: string): string {
  const segments = part.toLowerCase().split('+');
  const modifiers: string[] = [];
  let key = '';

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (['ctrl', 'cmd', 'control', 'meta'].includes(trimmed)) {
      modifiers.push('ctrl');
    } else if (trimmed === 'shift') {
      modifiers.push('shift');
    } else if (['alt', 'option'].includes(trimmed)) {
      modifiers.push('alt');
    } else {
      key = trimmed;
    }
  }

  // Sort modifiers for consistent comparison
  modifiers.sort();
  modifiers.push(key);
  return modifiers.join('+');
}

// ============================================
// Default Keybindings (fallback)
// ============================================

const DEFAULT_KEYBINDINGS: KeyBinding[] = [
  // File operations
  { key: 'ctrl+s', command: 'file.save' },
  { key: 'ctrl+shift+s', command: 'file.saveAs' },
  { key: 'ctrl+o', command: 'file.open' },
  { key: 'ctrl+w', command: 'file.close' },
  { key: 'ctrl+n', command: 'file.new' },

  // Navigation
  { key: 'ctrl+p', command: 'workbench.quickOpen' },
  { key: 'ctrl+shift+p', command: 'workbench.commandPalette' },

  // View
  { key: 'ctrl+b', command: 'workbench.toggleSidebar' },
  { key: 'ctrl+j', command: 'workbench.togglePanel' },
  { key: 'ctrl+`', command: 'workbench.toggleTerminal' },
  { key: 'ctrl+shift+e', command: 'view.focusFileExplorer' },
  { key: 'ctrl+shift+g', command: 'view.focusGit' },

  // Theme
  { key: 'ctrl+k ctrl+t', command: 'workbench.selectTheme' },

  // Editor
  { key: 'ctrl+/', command: 'editor.toggleComment' },
  { key: 'ctrl+shift+k', command: 'editor.deleteLine' },

  // Search
  { key: 'ctrl+f', command: 'editor.find' },
  { key: 'ctrl+h', command: 'editor.findAndReplace' },
  { key: 'ctrl+shift+f', command: 'search.inFiles' },

  // Git
  { key: 'ctrl+shift+g', command: 'git.focusPanel' },
];

// ============================================
// Export
// ============================================

export const keybindingsStore = createKeybindingsStore();
export default keybindingsStore;
