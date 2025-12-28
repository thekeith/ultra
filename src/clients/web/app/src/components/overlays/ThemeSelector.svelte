<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { ecpClient } from '../../lib/ecp/client';
  import { loadTheme } from '../../lib/theme/loader';

  const dispatch = createEventDispatcher();

  interface ThemeInfo {
    id: string;
    name: string;
    type: 'dark' | 'light';
  }

  let themes: ThemeInfo[] = [];
  let currentTheme: string = '';
  let selectedIndex = 0;
  let searchQuery = '';
  let inputElement: HTMLInputElement;

  $: filteredThemes = themes.filter((theme) =>
    theme.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  onMount(async () => {
    // Focus input
    inputElement?.focus();

    // Load themes
    try {
      const [listResult, currentResult] = await Promise.all([
        ecpClient.request<{ themes: ThemeInfo[] }>('theme/list', {}),
        ecpClient.request<{ theme: { id: string } }>('theme/current', {}),
      ]);

      themes = listResult.themes || [];
      currentTheme = currentResult.theme?.id || '';

      // Select current theme
      const currentIndex = filteredThemes.findIndex((t) => t.id === currentTheme);
      if (currentIndex >= 0) {
        selectedIndex = currentIndex;
      }
    } catch (error) {
      console.error('Failed to load themes:', error);
    }
  });

  function handleKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, filteredThemes.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        break;
      case 'Enter':
        event.preventDefault();
        if (filteredThemes[selectedIndex]) {
          selectTheme(filteredThemes[selectedIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        close();
        break;
    }
  }

  async function selectTheme(theme: ThemeInfo) {
    try {
      await ecpClient.request('theme/set', { themeId: theme.id });
      currentTheme = theme.id;
      // Reload theme to apply changes
      await loadTheme();
      close();
    } catch (error) {
      console.error('Failed to set theme:', error);
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
</script>

<div
  class="overlay-backdrop"
  onclick={handleBackdropClick}
  onkeydown={handleKeydown}
  role="dialog"
  aria-modal="true"
  aria-label="Select Theme"
  tabindex="-1"
>
  <div class="theme-selector">
    <div class="search-container">
      <input
        type="text"
        class="search-input"
        placeholder="Select Color Theme"
        bind:value={searchQuery}
        bind:this={inputElement}
      />
    </div>

    <div class="theme-list">
      {#each filteredThemes as theme, index}
        <div
          class="theme-item"
          class:selected={index === selectedIndex}
          class:current={theme.id === currentTheme}
          onclick={() => selectTheme(theme)}
          onmouseenter={() => (selectedIndex = index)}
          role="option"
          aria-selected={index === selectedIndex}
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && selectTheme(theme)}
        >
          <span class="theme-icon">{theme.type === 'dark' ? '🌙' : '☀️'}</span>
          <span class="theme-name">{theme.name}</span>
          {#if theme.id === currentTheme}
            <span class="current-badge">current</span>
          {/if}
        </div>
      {/each}

      {#if filteredThemes.length === 0}
        <div class="no-results">No themes found</div>
      {/if}
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
    padding-top: 15vh;
    z-index: 1000;
  }

  .theme-selector {
    width: 500px;
    max-width: 90vw;
    max-height: 60vh;
    background-color: var(--dropdown-bg, #252526);
    border: 1px solid var(--dropdown-border, #454545);
    border-radius: 6px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .search-container {
    padding: 8px;
    border-bottom: 1px solid var(--dropdown-border, #454545);
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

  .theme-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px;
  }

  .theme-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    color: var(--dropdown-fg, #cccccc);
  }

  .theme-item:hover,
  .theme-item.selected {
    background-color: var(--list-hover-bg, #04395e);
  }

  .theme-item.current {
    color: var(--list-active-fg, #ffffff);
  }

  .theme-icon {
    font-size: 16px;
    width: 24px;
    text-align: center;
  }

  .theme-name {
    flex: 1;
    font-size: 13px;
  }

  .current-badge {
    font-size: 10px;
    padding: 2px 6px;
    background-color: var(--badge-bg, #007acc);
    color: var(--badge-fg, #ffffff);
    border-radius: 4px;
    text-transform: uppercase;
  }

  .no-results {
    padding: 16px;
    text-align: center;
    color: var(--dropdown-fg, #cccccc);
    opacity: 0.7;
    font-size: 13px;
  }
</style>
