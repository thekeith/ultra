<script lang="ts">
  import { onMount } from 'svelte';
  import { layoutStore, sidebar, panel } from '../../lib/stores/layout';
  import { keybindingsStore } from '../../lib/stores/keybindings';
  import Sidebar from '../sidebar/Sidebar.svelte';
  import EditorArea from './EditorArea.svelte';
  import Panel from './Panel.svelte';
  import StatusBar from './StatusBar.svelte';
  import CommandPalette from '../overlays/CommandPalette.svelte';
  import ThemeSelector from '../overlays/ThemeSelector.svelte';
  import SettingsEditor from '../overlays/SettingsEditor.svelte';

  let showCommandPalette = false;
  let commandPaletteMode: 'commands' | 'files' = 'files';
  let showThemeSelector = false;
  let showSettingsEditor = false;
  let sidebarResizing = false;
  let panelResizing = false;

  onMount(() => {
    // Register command handlers for keybindings
    const unsubscribe = keybindingsStore.registerCommands({
      // Command palette (Ctrl+Shift+P) - opens in command mode
      'workbench.commandPalette': () => {
        commandPaletteMode = 'commands';
        showCommandPalette = true;
      },
      // Quick open (Ctrl+P) - opens in file search mode
      'workbench.quickOpen': () => {
        commandPaletteMode = 'files';
        showCommandPalette = true;
      },

      // View commands
      'workbench.toggleSidebar': () => {
        layoutStore.toggleSidebar();
      },
      'workbench.togglePanel': () => {
        layoutStore.togglePanel();
      },
      'workbench.toggleTerminal': () => {
        layoutStore.setPanelTab('terminal');
      },
      'view.focusFileExplorer': () => {
        layoutStore.setSidebarSection('files');
      },
      'view.focusGit': () => {
        layoutStore.setSidebarSection('git');
      },
      'git.focusPanel': () => {
        layoutStore.setSidebarSection('git');
      },

      // Theme
      'workbench.selectTheme': () => {
        showThemeSelector = true;
      },

      // Settings
      'workbench.openSettings': () => {
        showSettingsEditor = true;
      },

      // Terminal
      'terminal.new': () => {
        layoutStore.setPanelTab('terminal');
      },
    });

    return () => {
      unsubscribe();
    };
  });

  // Handle keyboard shortcuts via keybindings store
  function handleKeydown(event: KeyboardEvent) {
    // Let the keybindings store handle the event
    keybindingsStore.handleKeyEvent(event);
  }

  // Function to open theme selector (called from command palette)
  export function openThemeSelector() {
    showThemeSelector = true;
  }

  function handleSidebarResize(event: MouseEvent) {
    if (!sidebarResizing) return;
    layoutStore.setSidebarWidth(event.clientX);
  }

  function handlePanelResize(event: MouseEvent) {
    if (!panelResizing) return;
    const height = window.innerHeight - event.clientY;
    layoutStore.setPanelHeight(height);
  }

  function stopResize() {
    sidebarResizing = false;
    panelResizing = false;
  }
</script>

<svelte:window
  onkeydown={handleKeydown}
  onmousemove={(e) => { handleSidebarResize(e); handlePanelResize(e); }}
  onmouseup={stopResize}
/>

<div class="layout">
  <!-- Sidebar -->
  {#if $sidebar.visible}
    <aside class="sidebar" style="width: {$sidebar.width}px">
      <Sidebar />
      <div
        class="resize-handle vertical"
        onmousedown={() => (sidebarResizing = true)}
        role="separator"
        aria-orientation="vertical"
        tabindex="-1"
      ></div>
    </aside>
  {/if}

  <!-- Main content area -->
  <div class="main-content">
    <!-- Editor area -->
    <div class="editor-area" style="flex: 1">
      <EditorArea />
    </div>

    <!-- Panel (terminal, etc) -->
    {#if $panel.visible}
      <div
        class="resize-handle horizontal"
        onmousedown={() => (panelResizing = true)}
        role="separator"
        aria-orientation="horizontal"
        tabindex="-1"
      ></div>
      <div class="panel" style="height: {$panel.height}px">
        <Panel />
      </div>
    {/if}
  </div>
</div>

<!-- Status bar -->
<StatusBar />

<!-- Overlays -->
{#if showCommandPalette}
  <CommandPalette
    initialMode={commandPaletteMode}
    onclose={() => (showCommandPalette = false)}
    onOpenThemeSelector={() => {
      showCommandPalette = false;
      showThemeSelector = true;
    }}
    onOpenSettings={() => {
      showCommandPalette = false;
      showSettingsEditor = true;
    }}
  />
{/if}

{#if showThemeSelector}
  <ThemeSelector on:close={() => (showThemeSelector = false)} />
{/if}

{#if showSettingsEditor}
  <SettingsEditor on:close={() => (showSettingsEditor = false)} />
{/if}

<style>
  .layout {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .sidebar {
    display: flex;
    position: relative;
    background-color: var(--sidebar-bg, #252526);
    border-right: 1px solid var(--panel-border, #3c3c3c);
    flex-shrink: 0;
  }

  .main-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .editor-area {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .panel {
    background-color: var(--panel-bg, #1e1e1e);
    border-top: 1px solid var(--panel-border, #3c3c3c);
    flex-shrink: 0;
    overflow: hidden;
  }

  .resize-handle {
    position: absolute;
    background: transparent;
    z-index: 10;
  }

  .resize-handle.vertical {
    right: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    cursor: col-resize;
  }

  .resize-handle.horizontal {
    position: relative;
    height: 4px;
    cursor: row-resize;
    margin: -2px 0;
  }

  .resize-handle:hover {
    background-color: var(--focus-border, #007acc);
  }
</style>
