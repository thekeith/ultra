<script lang="ts">
  import { onMount } from 'svelte';
  import { documentsStore } from '../../lib/stores/documents';
  import { layoutStore } from '../../lib/stores/layout';
  import { ecpClient } from '../../lib/ecp/client';
  import { gitStore } from '../../lib/stores/git';

  export let onclose: () => void;
  export let onOpenThemeSelector: (() => void) | undefined = undefined;
  export let initialMode: 'commands' | 'files' = 'files';

  interface CommandItem {
    id: string;
    label: string;
    description?: string;
    category?: string;
    action: () => void | Promise<void>;
  }

  interface FileItem {
    path: string;
    name: string;
    uri: string;
  }

  let inputElement: HTMLInputElement;
  let query = '';
  let selectedIndex = 0;
  let mode: 'commands' | 'files' = 'files';
  let items: (CommandItem | FileItem)[] = [];
  let isLoading = false;

  // Commands list
  const commands: CommandItem[] = [
    // File commands
    {
      id: 'file.new',
      label: 'New File',
      category: 'File',
      action: () => {
        console.log('New file');
      },
    },
    {
      id: 'file.save',
      label: 'Save',
      category: 'File',
      action: async () => {
        const activeDoc = documentsStore.activeDocumentId;
        if (activeDoc) {
          await documentsStore.save(activeDoc.toString());
        }
      },
    },
    {
      id: 'file.saveAll',
      label: 'Save All',
      category: 'File',
      action: async () => {
        const docs = documentsStore.getAll();
        for (const doc of docs) {
          if (doc.isDirty) {
            await documentsStore.save(doc.id);
          }
        }
      },
    },

    // View commands
    {
      id: 'view.toggleSidebar',
      label: 'Toggle Sidebar',
      category: 'View',
      action: () => layoutStore.toggleSidebar(),
    },
    {
      id: 'view.togglePanel',
      label: 'Toggle Panel',
      category: 'View',
      action: () => layoutStore.togglePanel(),
    },
    {
      id: 'view.focusExplorer',
      label: 'Focus on Explorer',
      category: 'View',
      action: () => {
        layoutStore.setSidebarSection('files');
      },
    },
    {
      id: 'view.focusGit',
      label: 'Focus on Source Control',
      category: 'View',
      action: () => {
        layoutStore.setSidebarSection('git');
      },
    },

    // Theme commands
    {
      id: 'preferences.colorTheme',
      label: 'Color Theme',
      description: 'Change the editor color theme',
      category: 'Preferences',
      action: () => {
        if (onOpenThemeSelector) {
          onOpenThemeSelector();
        }
      },
    },

    // Terminal commands
    {
      id: 'terminal.new',
      label: 'New Terminal',
      category: 'Terminal',
      action: () => {
        layoutStore.setPanelTab('terminal');
      },
    },
    {
      id: 'terminal.focus',
      label: 'Focus Terminal',
      category: 'Terminal',
      action: () => {
        layoutStore.setPanelTab('terminal');
      },
    },

    // Git commands
    {
      id: 'git.stageAll',
      label: 'Stage All Changes',
      category: 'Git',
      action: async () => {
        await gitStore.stageAll();
      },
    },
    {
      id: 'git.commit',
      label: 'Commit...',
      category: 'Git',
      action: () => {
        layoutStore.setSidebarSection('git');
      },
    },
    {
      id: 'git.pull',
      label: 'Pull',
      category: 'Git',
      action: async () => {
        await gitStore.pull();
      },
    },
    {
      id: 'git.push',
      label: 'Push',
      category: 'Git',
      action: async () => {
        await gitStore.push();
      },
    },
    {
      id: 'git.refresh',
      label: 'Refresh',
      category: 'Git',
      action: async () => {
        await gitStore.refresh();
      },
    },

    // Editor commands
    {
      id: 'editor.formatDocument',
      label: 'Format Document',
      category: 'Editor',
      action: () => {
        console.log('Format document');
      },
    },
    {
      id: 'editor.wordWrap',
      label: 'Toggle Word Wrap',
      category: 'Editor',
      action: async () => {
        const { settingsStore } = await import('../../lib/stores/settings');
        const current = settingsStore.get('editor.wordWrap', 'off');
        await settingsStore.set('editor.wordWrap', current === 'off' ? 'on' : 'off');
      },
    },
    {
      id: 'editor.minimap',
      label: 'Toggle Minimap',
      category: 'Editor',
      action: async () => {
        const { settingsStore } = await import('../../lib/stores/settings');
        const current = settingsStore.get('editor.minimap.enabled', true);
        await settingsStore.set('editor.minimap.enabled', !current);
      },
    },
  ];

  onMount(() => {
    inputElement?.focus();

    // Use the initialMode prop
    mode = initialMode;
    if (mode === 'commands') {
      query = '>';
      filterCommands('');
    } else {
      query = '';
      // Don't search for empty string - wait for user input
    }
  });

  function handleInput() {
    selectedIndex = 0;

    if (query.startsWith('>')) {
      mode = 'commands';
      filterCommands(query.slice(1).trim());
    } else {
      mode = 'files';
      searchFiles(query);
    }
  }

  function filterCommands(search: string) {
    const searchLower = search.toLowerCase();
    items = commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(searchLower) ||
        (cmd.category?.toLowerCase().includes(searchLower) ?? false)
    );
  }

  async function searchFiles(search: string) {
    if (!search) {
      items = [];
      return;
    }

    isLoading = true;
    try {
      // Use file/glob for simple pattern matching
      const result = await ecpClient.request<{ uris: string[] }>(
        'file/glob',
        { pattern: `**/*${search}*`, maxResults: 50 }
      );

      // file/glob returns an array of file URIs
      const uris = result.uris || [];
      const searchLower = search.toLowerCase();

      // Map and score results for better sorting
      const scored = uris.map((uri: string) => {
        const filePath = uri.startsWith('file://') ? uri.slice(7) : uri;
        const name = filePath.split('/').pop() || filePath;
        const nameLower = name.toLowerCase();

        // Score: lower is better
        let score = 100;
        if (nameLower === searchLower) {
          score = 0; // Exact match
        } else if (nameLower.startsWith(searchLower)) {
          score = 10; // Starts with
        } else if (nameLower.includes(searchLower)) {
          score = 20; // Contains in name
        } else {
          score = 50; // Match in path only
        }

        return { path: filePath, name, uri, score };
      });

      // Sort by score, then by name length (prefer shorter names)
      scored.sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        return a.name.length - b.name.length;
      });

      // Take top 20 results
      items = scored.slice(0, 20).map(({ path, name, uri }) => ({ path, name, uri }));
    } catch (error) {
      console.error('File search failed:', error);
      items = [];
    } finally {
      isLoading = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        onclose();
        break;

      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
        break;

      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        break;

      case 'Enter':
        event.preventDefault();
        selectItem(selectedIndex);
        break;
    }
  }

  async function selectItem(index: number) {
    const item = items[index];
    if (!item) return;

    if ('action' in item) {
      // Command
      await item.action();
    } else {
      // File
      try {
        const documentId = await documentsStore.open(item.uri);
        layoutStore.addPane({
          type: 'editor',
          documentId,
          title: item.name,
        });
      } catch (error) {
        console.error('Failed to open file:', error);
      }
    }

    onclose();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onclose();
    }
  }

  function isCommand(item: CommandItem | FileItem): item is CommandItem {
    return 'action' in item;
  }
</script>

<div
  class="command-palette-backdrop"
  onclick={handleBackdropClick}
  onkeydown={(e) => e.key === 'Escape' && onclose()}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <div class="command-palette">
    <div class="input-container">
      <input
        type="text"
        class="search-input"
        placeholder={mode === 'commands' ? 'Type a command...' : 'Search files by name...'}
        bind:this={inputElement}
        bind:value={query}
        oninput={handleInput}
        onkeydown={handleKeydown}
      />
      {#if isLoading}
        <span class="loading-indicator">...</span>
      {/if}
    </div>

    <div class="results-list">
      {#if items.length === 0}
        <div class="no-results">
          {#if mode === 'files' && !query}
            Type to search for files
          {:else if mode === 'files'}
            No files found
          {:else}
            No commands found
          {/if}
        </div>
      {:else}
        {#each items as item, index}
          <div
            class="result-item"
            class:selected={index === selectedIndex}
            onclick={() => selectItem(index)}
            onmouseenter={() => (selectedIndex = index)}
            role="option"
            aria-selected={index === selectedIndex}
          >
            {#if isCommand(item)}
              <span class="item-icon">⚡</span>
              <span class="item-label">{item.label}</span>
              {#if item.category}
                <span class="item-category">{item.category}</span>
              {/if}
            {:else}
              <span class="item-icon">📄</span>
              <span class="item-label">{item.name}</span>
              <span class="item-path">{item.path}</span>
            {/if}
          </div>
        {/each}
      {/if}
    </div>

    <div class="hints">
      <span><kbd>↑↓</kbd> Navigate</span>
      <span><kbd>Enter</kbd> Select</span>
      <span><kbd>Esc</kbd> Close</span>
      <span><kbd>{'>'}</kbd> Commands</span>
    </div>
  </div>
</div>

<style>
  .command-palette-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.4);
    display: flex;
    justify-content: center;
    padding-top: 15vh;
    z-index: 1000;
  }

  .command-palette {
    width: 600px;
    max-width: 90vw;
    max-height: 400px;
    background-color: var(--editor-bg, #1e1e1e);
    border: 1px solid var(--panel-border, #454545);
    border-radius: 6px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .input-container {
    display: flex;
    align-items: center;
    padding: 12px;
    border-bottom: 1px solid var(--panel-border, #454545);
  }

  .search-input {
    flex: 1;
    padding: 8px 12px;
    font-size: 14px;
    font-family: inherit;
    background-color: var(--input-bg, #3c3c3c);
    color: var(--input-fg, #cccccc);
    border: 1px solid var(--input-border, #3c3c3c);
    border-radius: 4px;
    outline: none;
  }

  .search-input:focus {
    border-color: var(--focus-border, #007acc);
  }

  .loading-indicator {
    margin-left: 8px;
    color: var(--editor-fg, #cccccc);
    opacity: 0.5;
  }

  .results-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px;
  }

  .no-results {
    padding: 16px;
    text-align: center;
    color: var(--editor-fg, #cccccc);
    opacity: 0.5;
  }

  .result-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
  }

  .result-item:hover,
  .result-item.selected {
    background-color: var(--list-active-bg, #094771);
  }

  .item-icon {
    flex-shrink: 0;
    font-size: 14px;
  }

  .item-label {
    flex-shrink: 0;
    color: var(--editor-fg, #cccccc);
  }

  .item-category,
  .item-path {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--editor-fg, #cccccc);
    opacity: 0.5;
    font-size: 12px;
    text-align: right;
  }

  .hints {
    display: flex;
    gap: 16px;
    padding: 8px 12px;
    border-top: 1px solid var(--panel-border, #454545);
    font-size: 11px;
    color: var(--editor-fg, #cccccc);
    opacity: 0.6;
  }

  .hints kbd {
    display: inline-block;
    padding: 1px 4px;
    margin-right: 4px;
    font-family: inherit;
    font-size: 10px;
    background-color: var(--input-bg, #3c3c3c);
    border: 1px solid var(--input-border, #555);
    border-radius: 2px;
  }
</style>
