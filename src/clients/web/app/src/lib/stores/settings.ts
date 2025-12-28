/**
 * Settings Store
 *
 * Manages application settings via ECP.
 */

import { writable, derived, get } from 'svelte/store';
import { ecpClient } from '../ecp/client';

export interface SettingSchema {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  default: unknown;
  description?: string;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
}

export interface SettingsSchema {
  [key: string]: SettingSchema;
}

function createSettingsStore() {
  const settings = writable<Record<string, unknown>>({});
  const schema = writable<SettingsSchema>({});
  const isLoading = writable<boolean>(false);
  const error = writable<string | null>(null);

  // Subscribe to settings change notifications
  ecpClient.subscribe('config/didChange', (params: unknown) => {
    const { key, value } = params as { key: string; value: unknown };
    settings.update((s) => ({ ...s, [key]: value }));
  });

  return {
    subscribe: settings.subscribe,
    schema,
    isLoading,
    error,

    /**
     * Initialize the settings store.
     */
    async init(): Promise<void> {
      try {
        isLoading.set(true);
        error.set(null);

        // Fetch all settings and schema in parallel
        const [settingsResult, schemaResult] = await Promise.all([
          ecpClient.request<{ settings: Record<string, unknown> }>('config/getAll', {}),
          ecpClient.request<{ schema: { properties?: SettingsSchema } & SettingsSchema }>('config/schema', {}),
        ]);

        // Server returns { settings: {...} }
        settings.set(settingsResult.settings || {});
        // Server returns { schema: { properties: {...} } }, extract properties
        const schemaData = schemaResult.schema?.properties || schemaResult.schema || {};
        schema.set(schemaData);
      } catch (err) {
        error.set(err instanceof Error ? err.message : String(err));
      } finally {
        isLoading.set(false);
      }
    },

    /**
     * Get a setting value.
     */
    get<T>(key: string, defaultValue?: T): T {
      const allSettings = get(settings);
      const value = allSettings[key];
      return (value !== undefined ? value : defaultValue) as T;
    },

    /**
     * Set a setting value.
     */
    async set(key: string, value: unknown): Promise<void> {
      try {
        await ecpClient.request('config/set', { key, value });
        settings.update((s) => ({ ...s, [key]: value }));
      } catch (err) {
        error.set(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },

    /**
     * Reset a setting to its default value.
     */
    async reset(key: string): Promise<void> {
      try {
        const result = await ecpClient.request<{ value: unknown }>('config/reset', { key });
        settings.update((s) => ({ ...s, [key]: result.value }));
      } catch (err) {
        error.set(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },

    /**
     * Get all settings.
     */
    getAll(): Record<string, unknown> {
      return get(settings);
    },
  };
}

export const settingsStore = createSettingsStore();

/**
 * Derived store for editor-specific settings.
 */
export const editorSettings = derived(settingsStore, ($settings) => ({
  fontSize: ($settings['editor.fontSize'] as number) ?? 14,
  tabSize: ($settings['editor.tabSize'] as number) ?? 2,
  insertSpaces: ($settings['editor.insertSpaces'] as boolean) ?? true,
  wordWrap: ($settings['editor.wordWrap'] as string) ?? 'off',
  lineNumbers: ($settings['editor.lineNumbers'] as string) ?? 'on',
  minimap: ($settings['editor.minimap.enabled'] as boolean) ?? true,
  renderWhitespace: ($settings['editor.renderWhitespace'] as string) ?? 'selection',
  cursorBlinking: ($settings['editor.cursorBlinking'] as string) ?? 'smooth',
  smoothScrolling: ($settings['editor.smoothScrolling'] as boolean) ?? true,
  fontFamily: ($settings['editor.fontFamily'] as string) ?? "'JetBrains Mono', 'Fira Code', Menlo, Monaco, monospace",
  fontLigatures: ($settings['editor.fontLigatures'] as boolean) ?? true,
}));

export default settingsStore;
