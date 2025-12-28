<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { settingsStore, type SettingSchema, type SettingsSchema } from '../../lib/stores/settings';
  import { ecpClient } from '../../lib/ecp/client';
  import { loadTheme } from '../../lib/theme/loader';
  import { get } from 'svelte/store';

  const dispatch = createEventDispatcher();

  interface ThemeInfo {
    id: string;
    name: string;
    type: 'dark' | 'light';
  }

  interface SettingItem {
    key: string;
    schema: SettingSchema;
    value: unknown;
    category: string;
  }

  let searchQuery = '';
  let inputElement: HTMLInputElement;
  let settings: SettingItem[] = [];
  let isLoading = true;
  let error: string | null = null;
  let expandedCategories: Set<string> = new Set();
  let modifiedSettings: Set<string> = new Set();
  let availableThemes: ThemeInfo[] = [];

  // Categories in display order
  const categoryOrder = [
    'editor',
    'files',
    'workbench',
    'terminal',
    'git',
    'session',
    'lsp',
    'tui',
    'ultra',
    'ai',
  ];

  const categoryLabels: Record<string, string> = {
    editor: 'Editor',
    files: 'Files',
    workbench: 'Workbench',
    terminal: 'Terminal',
    git: 'Git',
    session: 'Session',
    lsp: 'Language Server',
    tui: 'TUI Settings',
    ultra: 'Ultra',
    ai: 'AI',
  };

  $: filteredSettings = settings.filter((s) => {
    const query = searchQuery.toLowerCase();
    return (
      s.key.toLowerCase().includes(query) ||
      (s.schema.description?.toLowerCase().includes(query) ?? false)
    );
  });

  $: groupedSettings = groupByCategory(filteredSettings);

  // Auto-expand categories with results when searching
  $: if (searchQuery) {
    // Expand all categories that have matching results
    expandedCategories = new Set(groupedSettings.keys());
  }

  function groupByCategory(items: SettingItem[]): Map<string, SettingItem[]> {
    const groups = new Map<string, SettingItem[]>();

    for (const item of items) {
      const existing = groups.get(item.category) || [];
      existing.push(item);
      groups.set(item.category, existing);
    }

    // Sort groups by categoryOrder
    const sorted = new Map<string, SettingItem[]>();
    for (const cat of categoryOrder) {
      if (groups.has(cat)) {
        sorted.set(cat, groups.get(cat)!);
      }
    }
    // Add any remaining categories not in order
    for (const [cat, items] of groups) {
      if (!sorted.has(cat)) {
        sorted.set(cat, items);
      }
    }

    return sorted;
  }

  function extractCategory(key: string): string {
    const firstDot = key.indexOf('.');
    if (firstDot === -1) return 'other';
    return key.substring(0, firstDot);
  }

  onMount(async () => {
    inputElement?.focus();

    try {
      // Initialize settings and fetch themes in parallel
      const [, themesResult] = await Promise.all([
        settingsStore.init(),
        ecpClient.request<{ themes: ThemeInfo[] }>('theme/list', {}),
      ]);

      availableThemes = themesResult.themes || [];

      const schema = get(settingsStore.schema);
      const allSettings = settingsStore.getAll();

      settings = Object.entries(schema).map(([key, schemaDef]) => ({
        key,
        schema: schemaDef,
        value: allSettings[key] ?? schemaDef.default,
        category: extractCategory(key),
      }));

      // Expand first category by default
      if (categoryOrder.length > 0) {
        expandedCategories.add('editor');
      }

      isLoading = false;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      isLoading = false;
    }
  });

  function toggleCategory(category: string) {
    if (expandedCategories.has(category)) {
      expandedCategories.delete(category);
    } else {
      expandedCategories.add(category);
    }
    expandedCategories = expandedCategories; // trigger reactivity
  }

  async function updateSetting(key: string, value: unknown) {
    try {
      // Special handling for theme changes
      if (key === 'workbench.colorTheme') {
        await ecpClient.request('theme/set', { themeId: value });
        await loadTheme();
      }

      await settingsStore.set(key, value);
      // Update local state
      const idx = settings.findIndex((s) => s.key === key);
      if (idx >= 0) {
        settings[idx] = { ...settings[idx], value };
        settings = settings;
      }
      modifiedSettings.add(key);
      modifiedSettings = modifiedSettings;
    } catch (err) {
      console.error(`Failed to update setting ${key}:`, err);
    }
  }

  async function resetSetting(key: string) {
    try {
      await settingsStore.reset(key);
      const schema = get(settingsStore.schema);
      const defaultValue = schema[key]?.default;

      const idx = settings.findIndex((s) => s.key === key);
      if (idx >= 0) {
        settings[idx] = { ...settings[idx], value: defaultValue };
        settings = settings;
      }
      modifiedSettings.delete(key);
      modifiedSettings = modifiedSettings;
    } catch (err) {
      console.error(`Failed to reset setting ${key}:`, err);
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  }

  function close() {
    dispatch('close');
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      close();
    }
  }

  function handleNumberInput(key: string, event: Event, schema: SettingSchema) {
    const target = event.target as HTMLInputElement;
    let value = parseFloat(target.value);

    if (isNaN(value)) return;

    // Clamp to min/max
    if (schema.minimum !== undefined && value < schema.minimum) {
      value = schema.minimum;
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      value = schema.maximum;
    }

    updateSetting(key, value);
  }
</script>

<div
  class="overlay-backdrop"
  onclick={handleBackdropClick}
  onkeydown={handleKeydown}
  role="dialog"
  aria-modal="true"
  aria-label="Settings"
  tabindex="-1"
>
  <div class="settings-editor">
    <div class="header">
      <h2 class="title">Settings</h2>
      <button class="close-button" onclick={close} aria-label="Close">×</button>
    </div>

    <div class="search-container">
      <input
        type="text"
        class="search-input"
        placeholder="Search settings..."
        bind:value={searchQuery}
        bind:this={inputElement}
      />
    </div>

    <div class="settings-content">
      {#if isLoading}
        <div class="loading">Loading settings...</div>
      {:else if error}
        <div class="error">Error: {error}</div>
      {:else if filteredSettings.length === 0}
        <div class="no-results">No settings found</div>
      {:else}
        {#each [...groupedSettings] as [category, categorySettings]}
          <div class="category">
            <button
              class="category-header"
              onclick={() => toggleCategory(category)}
              aria-expanded={expandedCategories.has(category)}
            >
              <span class="category-icon">
                {expandedCategories.has(category) ? '▼' : '▶'}
              </span>
              <span class="category-name">{categoryLabels[category] || category}</span>
              <span class="category-count">{categorySettings.length}</span>
            </button>

            {#if expandedCategories.has(category)}
              <div class="category-settings">
                {#each categorySettings as setting}
                  <div class="setting-item" class:modified={modifiedSettings.has(setting.key)}>
                    <div class="setting-info">
                      <div class="setting-key">{setting.key}</div>
                      {#if setting.schema.description}
                        <div class="setting-description">{setting.schema.description}</div>
                      {/if}
                    </div>

                    <div class="setting-control">
                      {#if setting.key === 'workbench.colorTheme'}
                        <select
                          class="select-input"
                          value={setting.value as string}
                          onchange={(e) => updateSetting(setting.key, (e.target as HTMLSelectElement).value)}
                        >
                          {#each availableThemes as theme}
                            <option value={theme.id}>{theme.name} ({theme.type})</option>
                          {/each}
                        </select>
                      {:else if setting.schema.type === 'boolean'}
                        <label class="toggle">
                          <input
                            type="checkbox"
                            checked={setting.value as boolean}
                            onchange={(e) => updateSetting(setting.key, (e.target as HTMLInputElement).checked)}
                          />
                          <span class="toggle-slider"></span>
                        </label>
                      {:else if setting.schema.enum}
                        <select
                          class="select-input"
                          value={setting.value as string}
                          onchange={(e) => updateSetting(setting.key, (e.target as HTMLSelectElement).value)}
                        >
                          {#each setting.schema.enum as option}
                            <option value={option}>{option}</option>
                          {/each}
                        </select>
                      {:else if setting.schema.type === 'number'}
                        <input
                          type="number"
                          class="number-input"
                          value={setting.value as number}
                          min={setting.schema.minimum}
                          max={setting.schema.maximum}
                          onchange={(e) => handleNumberInput(setting.key, e, setting.schema)}
                        />
                      {:else if setting.schema.type === 'string'}
                        <input
                          type="text"
                          class="text-input"
                          value={setting.value as string}
                          onchange={(e) => updateSetting(setting.key, (e.target as HTMLInputElement).value)}
                        />
                      {:else if setting.schema.type === 'object'}
                        <span class="object-indicator">JSON object</span>
                      {:else}
                        <span class="unsupported">Unsupported type</span>
                      {/if}

                      {#if modifiedSettings.has(setting.key)}
                        <button
                          class="reset-button"
                          onclick={() => resetSetting(setting.key)}
                          title="Reset to default"
                        >
                          ↺
                        </button>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>

    <div class="footer">
      <span class="hint">Changes are saved automatically</span>
    </div>
  </div>
</div>

<style>
  .overlay-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 5vh;
    z-index: 1000;
  }

  .settings-editor {
    width: 700px;
    max-width: 90vw;
    max-height: 85vh;
    background-color: var(--editor-bg, #1e1e1e);
    border: 1px solid var(--panel-border, #454545);
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--panel-border, #454545);
  }

  .title {
    margin: 0;
    font-size: 16px;
    font-weight: 500;
    color: var(--editor-fg, #cccccc);
  }

  .close-button {
    background: none;
    border: none;
    color: var(--editor-fg, #cccccc);
    font-size: 20px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    line-height: 1;
  }

  .close-button:hover {
    background-color: var(--list-hover-bg, #2a2d2e);
  }

  .search-container {
    padding: 12px 16px;
    border-bottom: 1px solid var(--panel-border, #454545);
  }

  .search-input {
    width: 100%;
    padding: 8px 12px;
    font-size: 14px;
    background-color: var(--input-bg, #3c3c3c);
    color: var(--input-fg, #cccccc);
    border: 1px solid var(--input-border, #3c3c3c);
    border-radius: 4px;
    outline: none;
    box-sizing: border-box;
  }

  .search-input:focus {
    border-color: var(--focus-border, #007acc);
  }

  .settings-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  .loading,
  .error,
  .no-results {
    padding: 32px;
    text-align: center;
    color: var(--editor-fg, #cccccc);
    opacity: 0.7;
  }

  .error {
    color: var(--error-fg, #f14c4c);
    opacity: 1;
  }

  .category {
    border-bottom: 1px solid var(--panel-border, #333);
  }

  .category:last-child {
    border-bottom: none;
  }

  .category-header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 16px;
    background: none;
    border: none;
    color: var(--editor-fg, #cccccc);
    font-size: 13px;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
  }

  .category-header:hover {
    background-color: var(--list-hover-bg, #2a2d2e);
  }

  .category-icon {
    font-size: 10px;
    width: 12px;
    color: var(--editor-fg, #888);
  }

  .category-name {
    flex: 1;
  }

  .category-count {
    font-size: 11px;
    color: var(--editor-fg, #888);
    background-color: var(--badge-bg, #333);
    padding: 2px 6px;
    border-radius: 10px;
  }

  .category-settings {
    padding: 0 16px 12px 36px;
  }

  .setting-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 0;
    border-bottom: 1px solid var(--panel-border, #2a2a2a);
  }

  .setting-item:last-child {
    border-bottom: none;
  }

  .setting-item.modified {
    background-color: rgba(0, 122, 204, 0.1);
    margin: 0 -8px;
    padding-left: 8px;
    padding-right: 8px;
    border-radius: 4px;
  }

  .setting-info {
    flex: 1;
    min-width: 0;
  }

  .setting-key {
    font-size: 13px;
    color: var(--editor-fg, #cccccc);
    font-family: monospace;
    word-break: break-word;
  }

  .setting-description {
    font-size: 12px;
    color: var(--editor-fg, #888);
    margin-top: 4px;
    line-height: 1.4;
  }

  .setting-control {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  /* Toggle switch */
  .toggle {
    position: relative;
    display: inline-block;
    width: 40px;
    height: 20px;
  }

  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--input-bg, #3c3c3c);
    border-radius: 20px;
    transition: 0.2s;
  }

  .toggle-slider:before {
    position: absolute;
    content: "";
    height: 14px;
    width: 14px;
    left: 3px;
    bottom: 3px;
    background-color: var(--editor-fg, #cccccc);
    border-radius: 50%;
    transition: 0.2s;
  }

  .toggle input:checked + .toggle-slider {
    background-color: var(--focus-border, #007acc);
  }

  .toggle input:checked + .toggle-slider:before {
    transform: translateX(20px);
  }

  /* Select */
  .select-input {
    min-width: 120px;
    padding: 6px 24px 6px 8px;
    font-size: 12px;
    background-color: var(--input-bg, #3c3c3c);
    color: var(--input-fg, #cccccc);
    border: 1px solid var(--input-border, #3c3c3c);
    border-radius: 4px;
    outline: none;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M3 4l3 3 3-3'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
  }

  .select-input:focus {
    border-color: var(--focus-border, #007acc);
  }

  /* Number input */
  .number-input {
    width: 80px;
    padding: 6px 8px;
    font-size: 12px;
    background-color: var(--input-bg, #3c3c3c);
    color: var(--input-fg, #cccccc);
    border: 1px solid var(--input-border, #3c3c3c);
    border-radius: 4px;
    outline: none;
    text-align: right;
  }

  .number-input:focus {
    border-color: var(--focus-border, #007acc);
  }

  /* Text input */
  .text-input {
    width: 200px;
    padding: 6px 8px;
    font-size: 12px;
    background-color: var(--input-bg, #3c3c3c);
    color: var(--input-fg, #cccccc);
    border: 1px solid var(--input-border, #3c3c3c);
    border-radius: 4px;
    outline: none;
  }

  .text-input:focus {
    border-color: var(--focus-border, #007acc);
  }

  .object-indicator,
  .unsupported {
    font-size: 11px;
    color: var(--editor-fg, #888);
    font-style: italic;
  }

  .reset-button {
    background: none;
    border: none;
    color: var(--editor-fg, #888);
    font-size: 14px;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    line-height: 1;
  }

  .reset-button:hover {
    background-color: var(--list-hover-bg, #2a2d2e);
    color: var(--editor-fg, #cccccc);
  }

  .footer {
    padding: 8px 16px;
    border-top: 1px solid var(--panel-border, #454545);
    text-align: center;
  }

  .hint {
    font-size: 11px;
    color: var(--editor-fg, #888);
  }
</style>
