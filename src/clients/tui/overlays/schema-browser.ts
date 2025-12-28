/**
 * Schema Browser Overlay
 *
 * Tree view for browsing database objects (schemas, tables, views, etc.)
 */

import { PromiseDialog, type DialogConfig, type DialogResult } from './promise-dialog.ts';
import type { OverlayManagerCallbacks } from './overlay-manager.ts';
import type { KeyEvent, InputEvent } from '../types.ts';
import type { ScreenBuffer } from '../rendering/buffer.ts';
import type {
  DatabaseService,
  SchemaInfo,
  TableInfo,
  FunctionInfo,
  TriggerInfo,
  IndexInfo,
  PolicyInfo,
} from '../../../services/database/index.ts';

// ============================================
// Types
// ============================================

/**
 * Node types in the schema tree.
 */
type NodeType =
  | 'connection'
  | 'schema'
  | 'tables_folder'
  | 'views_folder'
  | 'functions_folder'
  | 'triggers_folder'
  | 'indexes_folder'
  | 'policies_folder'
  | 'table'
  | 'view'
  | 'function'
  | 'trigger'
  | 'index'
  | 'policy';

/**
 * A node in the schema tree.
 */
interface TreeNode {
  id: string;
  type: NodeType;
  name: string;
  icon: string;
  depth: number;
  expanded: boolean;
  children: TreeNode[];
  data?: {
    connectionId?: string;
    schema?: string;
    table?: string;
  };
}

/**
 * Result from schema browser selection.
 */
export interface SchemaBrowserResult {
  action: 'select' | 'cancel';
  nodeType?: NodeType;
  connectionId?: string;
  schema?: string;
  tableName?: string;
}

/**
 * Configuration for schema browser.
 */
export interface SchemaBrowserConfig extends DialogConfig {
  /** Pre-selected connection ID */
  connectionId?: string;
}

// ============================================
// Icons
// ============================================

const ICONS: Record<NodeType | 'expanded' | 'collapsed', string> = {
  connection: '',
  schema: '',
  tables_folder: '',
  views_folder: '',
  functions_folder: 'ƒ',
  triggers_folder: '⚡',
  indexes_folder: '',
  policies_folder: '',
  table: '',
  view: '',
  function: 'ƒ',
  trigger: '⚡',
  index: '',
  policy: '',
  expanded: '',
  collapsed: '',
};

// ============================================
// Schema Browser
// ============================================

/**
 * Schema Browser dialog for exploring database objects.
 */
export class SchemaBrowser extends PromiseDialog<SchemaBrowserResult> {
  /** Database service for schema queries */
  private databaseService: DatabaseService | null = null;

  /** Current connection ID */
  private connectionId: string | null = null;

  /** Root tree nodes */
  private rootNodes: TreeNode[] = [];

  /** Flattened visible nodes */
  private visibleNodes: TreeNode[] = [];

  /** Selected index in visible nodes */
  private selectedIndex: number = 0;

  /** Scroll offset */
  private scrollOffset: number = 0;

  /** Loading state */
  private loading: boolean = false;

  constructor(id: string, callbacks: OverlayManagerCallbacks) {
    super(id, callbacks);
    this.zIndex = 200;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set the database service.
   */
  setDatabaseService(service: DatabaseService): void {
    this.databaseService = service;
  }

  /**
   * Show schema browser for a connection.
   */
  async showBrowser(config: SchemaBrowserConfig): Promise<DialogResult<SchemaBrowserResult>> {
    this.connectionId = config.connectionId ?? null;
    this.selectedIndex = 0;
    this.scrollOffset = 0;
    this.loading = true;

    // Start loading asynchronously
    this.loadTree();

    return this.showAsync({
      title: config.title ?? 'Schema Browser',
      width: config.width ?? 60,
      height: config.height ?? 25,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Data Loading
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Load the schema tree.
   */
  private async loadTree(): Promise<void> {
    this.rootNodes = [];
    this.loading = true;
    this.callbacks.onDirty();

    if (!this.databaseService || !this.connectionId) {
      this.loading = false;
      this.rebuildVisibleNodes();
      return;
    }

    try {
      // Get connection info
      const connection = this.databaseService.getConnection(this.connectionId);
      if (!connection) {
        this.loading = false;
        this.rebuildVisibleNodes();
        return;
      }

      // Create connection node
      const connNode: TreeNode = {
        id: this.connectionId,
        type: 'connection',
        name: connection.name,
        icon: ICONS.connection,
        depth: 0,
        expanded: true,
        children: [],
        data: { connectionId: this.connectionId },
      };

      // Load schemas
      const schemas = await this.databaseService.listSchemas(this.connectionId);

      for (const schema of schemas) {
        const schemaNode = await this.createSchemaNode(schema, 1);
        connNode.children.push(schemaNode);
      }

      this.rootNodes = [connNode];
    } catch (error) {
      // Show error in tree
      this.rootNodes = [{
        id: 'error',
        type: 'connection',
        name: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        icon: '!',
        depth: 0,
        expanded: false,
        children: [],
      }];
    }

    this.loading = false;
    this.rebuildVisibleNodes();
    this.callbacks.onDirty();
  }

  /**
   * Create a schema node with folder children.
   */
  private async createSchemaNode(schema: SchemaInfo, depth: number): Promise<TreeNode> {
    const schemaNode: TreeNode = {
      id: `schema:${schema.name}`,
      type: 'schema',
      name: schema.name,
      icon: ICONS.schema,
      depth,
      expanded: schema.name === 'public',
      children: [],
      data: { connectionId: this.connectionId ?? undefined, schema: schema.name },
    };

    // Create category folders
    const tablesFolder: TreeNode = {
      id: `tables:${schema.name}`,
      type: 'tables_folder',
      name: 'Tables',
      icon: ICONS.tables_folder,
      depth: depth + 1,
      expanded: schema.name === 'public',
      children: [],
      data: { connectionId: this.connectionId ?? undefined, schema: schema.name },
    };

    const viewsFolder: TreeNode = {
      id: `views:${schema.name}`,
      type: 'views_folder',
      name: 'Views',
      icon: ICONS.views_folder,
      depth: depth + 1,
      expanded: false,
      children: [],
      data: { connectionId: this.connectionId ?? undefined, schema: schema.name },
    };

    const functionsFolder: TreeNode = {
      id: `functions:${schema.name}`,
      type: 'functions_folder',
      name: 'Functions',
      icon: ICONS.functions_folder,
      depth: depth + 1,
      expanded: false,
      children: [],
      data: { connectionId: this.connectionId ?? undefined, schema: schema.name },
    };

    const triggersFolder: TreeNode = {
      id: `triggers:${schema.name}`,
      type: 'triggers_folder',
      name: 'Triggers',
      icon: ICONS.triggers_folder,
      depth: depth + 1,
      expanded: false,
      children: [],
      data: { connectionId: this.connectionId ?? undefined, schema: schema.name },
    };

    const indexesFolder: TreeNode = {
      id: `indexes:${schema.name}`,
      type: 'indexes_folder',
      name: 'Indexes',
      icon: ICONS.indexes_folder,
      depth: depth + 1,
      expanded: false,
      children: [],
      data: { connectionId: this.connectionId ?? undefined, schema: schema.name },
    };

    const policiesFolder: TreeNode = {
      id: `policies:${schema.name}`,
      type: 'policies_folder',
      name: 'RLS Policies',
      icon: ICONS.policies_folder,
      depth: depth + 1,
      expanded: false,
      children: [],
      data: { connectionId: this.connectionId ?? undefined, schema: schema.name },
    };

    // Load all schema objects
    if (this.connectionId && this.databaseService) {
      // Load tables and views
      try {
        const tables = await this.databaseService.listTables(this.connectionId, schema.name);
        for (const table of tables) {
          const nodeType: NodeType = table.type === 'view' || table.type === 'materialized_view' ? 'view' : 'table';
          const folder = nodeType === 'view' ? viewsFolder : tablesFolder;

          folder.children.push({
            id: `${nodeType}:${schema.name}.${table.name}`,
            type: nodeType,
            name: table.name,
            icon: ICONS[nodeType],
            depth: depth + 2,
            expanded: false,
            children: [],
            data: {
              connectionId: this.connectionId ?? undefined,
              schema: schema.name,
              table: table.name,
            },
          });
        }
      } catch (err) {
        tablesFolder.children.push(this.createErrorNode(schema.name, 'tables', err, depth + 2));
      }

      // Load functions
      try {
        const functions = await this.databaseService.listFunctions(this.connectionId, schema.name);
        for (const func of functions) {
          const displayName = func.arguments ? `${func.name}(${func.arguments})` : `${func.name}()`;
          functionsFolder.children.push({
            id: `function:${schema.name}.${func.name}(${func.arguments})`,
            type: 'function',
            name: displayName,
            icon: ICONS.function,
            depth: depth + 2,
            expanded: false,
            children: [],
            data: {
              connectionId: this.connectionId ?? undefined,
              schema: schema.name,
            },
          });
        }
      } catch (err) {
        functionsFolder.children.push(this.createErrorNode(schema.name, 'functions', err, depth + 2));
      }

      // Load triggers
      try {
        const triggers = await this.databaseService.listTriggers(this.connectionId, schema.name);
        for (const trigger of triggers) {
          const displayName = `${trigger.name} (${trigger.table})`;
          triggersFolder.children.push({
            id: `trigger:${schema.name}.${trigger.table}.${trigger.name}`,
            type: 'trigger',
            name: displayName,
            icon: ICONS.trigger,
            depth: depth + 2,
            expanded: false,
            children: [],
            data: {
              connectionId: this.connectionId ?? undefined,
              schema: schema.name,
              table: trigger.table,
            },
          });
        }
      } catch (err) {
        triggersFolder.children.push(this.createErrorNode(schema.name, 'triggers', err, depth + 2));
      }

      // Load indexes
      try {
        const indexes = await this.databaseService.listIndexes(this.connectionId, schema.name);
        for (const idx of indexes) {
          const displayName = `${idx.name} (${idx.table})`;
          indexesFolder.children.push({
            id: `index:${schema.name}.${idx.table}.${idx.name}`,
            type: 'index',
            name: displayName,
            icon: ICONS.index,
            depth: depth + 2,
            expanded: false,
            children: [],
            data: {
              connectionId: this.connectionId ?? undefined,
              schema: schema.name,
              table: idx.table,
            },
          });
        }
      } catch (err) {
        indexesFolder.children.push(this.createErrorNode(schema.name, 'indexes', err, depth + 2));
      }

      // Load RLS policies
      try {
        const policies = await this.databaseService.listPolicies(this.connectionId, schema.name);
        for (const policy of policies) {
          const displayName = `${policy.name} (${policy.table})`;
          policiesFolder.children.push({
            id: `policy:${schema.name}.${policy.table}.${policy.name}`,
            type: 'policy',
            name: displayName,
            icon: ICONS.policy,
            depth: depth + 2,
            expanded: false,
            children: [],
            data: {
              connectionId: this.connectionId ?? undefined,
              schema: schema.name,
              table: policy.table,
            },
          });
        }
      } catch (err) {
        policiesFolder.children.push(this.createErrorNode(schema.name, 'policies', err, depth + 2));
      }
    }

    // Add folders (show all, even if empty, to indicate capability)
    schemaNode.children.push(tablesFolder);
    if (viewsFolder.children.length > 0) {
      schemaNode.children.push(viewsFolder);
    }
    if (functionsFolder.children.length > 0) {
      schemaNode.children.push(functionsFolder);
    }
    if (triggersFolder.children.length > 0) {
      schemaNode.children.push(triggersFolder);
    }
    if (indexesFolder.children.length > 0) {
      schemaNode.children.push(indexesFolder);
    }
    if (policiesFolder.children.length > 0) {
      schemaNode.children.push(policiesFolder);
    }

    return schemaNode;
  }

  /**
   * Create an error node for display.
   */
  private createErrorNode(schema: string, type: string, err: unknown, depth: number): TreeNode {
    return {
      id: `error:${schema}:${type}`,
      type: 'table',
      name: `Error: ${err instanceof Error ? err.message : 'Unknown'}`,
      icon: '!',
      depth,
      expanded: false,
      children: [],
    };
  }

  /**
   * Rebuild the flattened visible nodes list.
   */
  private rebuildVisibleNodes(): void {
    this.visibleNodes = [];
    this.flattenNodes(this.rootNodes);
  }

  /**
   * Flatten tree nodes into visible list.
   */
  private flattenNodes(nodes: TreeNode[]): void {
    for (const node of nodes) {
      this.visibleNodes.push(node);
      if (node.expanded && node.children.length > 0) {
        this.flattenNodes(node.children);
      }
    }
  }

  /**
   * Toggle node expansion.
   */
  private toggleNode(node: TreeNode): void {
    node.expanded = !node.expanded;
    this.rebuildVisibleNodes();
    this.callbacks.onDirty();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Input Handling
  // ─────────────────────────────────────────────────────────────────────────

  protected override handleKeyInput(event: KeyEvent): boolean {
    const { key, ctrl } = event;

    switch (key) {
      case 'ArrowUp':
        this.moveSelection(-1);
        return true;

      case 'ArrowDown':
        this.moveSelection(1);
        return true;

      case 'ArrowLeft': {
        // Collapse current node or move to parent
        const currentNode = this.visibleNodes[this.selectedIndex];
        if (currentNode?.expanded) {
          this.toggleNode(currentNode);
        }
        return true;
      }

      case 'ArrowRight': {
        // Expand current node
        const currentNode = this.visibleNodes[this.selectedIndex];
        if (currentNode && !currentNode.expanded && currentNode.children.length > 0) {
          this.toggleNode(currentNode);
        }
        return true;
      }

      case 'Enter':
      case ' ':
        this.handleSelect();
        return true;

      case 'PageUp':
        this.moveSelection(-this.getVisibleRowCount());
        return true;

      case 'PageDown':
        this.moveSelection(this.getVisibleRowCount());
        return true;

      case 'Home':
        if (ctrl) {
          this.selectedIndex = 0;
          this.ensureVisible();
          this.callbacks.onDirty();
        }
        return true;

      case 'End':
        if (ctrl) {
          this.selectedIndex = this.visibleNodes.length - 1;
          this.ensureVisible();
          this.callbacks.onDirty();
        }
        return true;
    }

    return false;
  }

  protected override handleMouseInput(event: InputEvent): boolean {
    if (!('x' in event && 'y' in event)) return true;

    const mouseEvent = event as { x: number; y: number; type?: string; scrollDirection?: number };
    const { x, y } = this.bounds;
    const { width, height } = this.bounds;

    // Check if click is in content area
    const contentX = mouseEvent.x - x - 1;
    const contentY = mouseEvent.y - y - 2; // Account for border and title
    const contentHeight = height - 4;

    if (contentX < 0 || contentX >= width - 2 || contentY < 0 || contentY >= contentHeight) {
      return true;
    }

    if (mouseEvent.type === 'press') {
      const clickedIndex = this.scrollOffset + contentY;
      if (clickedIndex >= 0 && clickedIndex < this.visibleNodes.length) {
        if (this.selectedIndex === clickedIndex) {
          // Double-click behavior: toggle or select
          this.handleSelect();
        } else {
          this.selectedIndex = clickedIndex;
          this.callbacks.onDirty();
        }
      }
      return true;
    }

    if (mouseEvent.type === 'scroll') {
      const scrollDir = mouseEvent.scrollDirection ?? 0;
      if (scrollDir < 0) {
        this.moveSelection(-3);
      } else if (scrollDir > 0) {
        this.moveSelection(3);
      }
      return true;
    }

    return true;
  }

  /**
   * Move selection by delta.
   */
  private moveSelection(delta: number): void {
    const newIndex = Math.max(0, Math.min(this.visibleNodes.length - 1, this.selectedIndex + delta));
    if (newIndex !== this.selectedIndex) {
      this.selectedIndex = newIndex;
      this.ensureVisible();
      this.callbacks.onDirty();
    }
  }

  /**
   * Handle selection (Enter or double-click).
   */
  private handleSelect(): void {
    const node = this.visibleNodes[this.selectedIndex];
    if (!node) return;

    // For containers (folders, schemas), toggle expansion
    if (node.children.length > 0 || node.type.endsWith('_folder') || node.type === 'schema' || node.type === 'connection') {
      this.toggleNode(node);
      return;
    }

    // For leaf nodes (tables, views, functions), resolve with selection
    this.confirm({
      action: 'select',
      nodeType: node.type,
      connectionId: node.data?.connectionId,
      schema: node.data?.schema,
      tableName: node.data?.table,
    });
  }

  /**
   * Ensure selected row is visible.
   */
  private ensureVisible(): void {
    const visibleRows = this.getVisibleRowCount();
    if (this.selectedIndex < this.scrollOffset) {
      this.scrollOffset = this.selectedIndex;
    } else if (this.selectedIndex >= this.scrollOffset + visibleRows) {
      this.scrollOffset = this.selectedIndex - visibleRows + 1;
    }
  }

  /**
   * Get number of visible rows in the dialog.
   */
  private getVisibleRowCount(): number {
    return this.bounds.height - 5; // Account for border, title, and hints
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────────────────

  protected renderContent(buffer: ScreenBuffer): void {
    const { x, y, width, height } = this.bounds;

    // Get theme colors
    const bgColor = this.callbacks.getThemeColor('editorWidget.background', '#252526');
    const fgColor = this.callbacks.getThemeColor('editorWidget.foreground', '#cccccc');
    const selectedBg = this.callbacks.getThemeColor('list.activeSelectionBackground', '#094771');
    const selectedFg = this.callbacks.getThemeColor('list.activeSelectionForeground', '#ffffff');
    const dimColor = this.callbacks.getThemeColor('descriptionForeground', '#858585');

    // Draw content
    const contentX = x + 1;
    const contentY = y + 2;
    const contentWidth = width - 2;
    const contentHeight = height - 4;

    if (this.loading) {
      // Draw loading message
      const loadingMsg = 'Loading...';
      const loadX = x + Math.floor((width - loadingMsg.length) / 2);
      const loadY = y + Math.floor(height / 2);
      for (let i = 0; i < loadingMsg.length; i++) {
        buffer.set(loadX + i, loadY, { char: loadingMsg[i] ?? ' ', fg: dimColor, bg: bgColor });
      }
    } else if (this.visibleNodes.length === 0) {
      // No nodes message
      const emptyMsg = 'No database objects found';
      const emptyX = x + Math.floor((width - emptyMsg.length) / 2);
      const emptyY = y + Math.floor(height / 2);
      for (let i = 0; i < emptyMsg.length; i++) {
        buffer.set(emptyX + i, emptyY, { char: emptyMsg[i] ?? ' ', fg: dimColor, bg: bgColor });
      }
    } else {
      // Draw visible nodes
      for (let i = 0; i < contentHeight - 1; i++) {
        const nodeIndex = this.scrollOffset + i;
        const rowY = contentY + i;

        // Clear row
        for (let cx = 0; cx < contentWidth; cx++) {
          buffer.set(contentX + cx, rowY, { char: ' ', fg: fgColor, bg: bgColor });
        }

        if (nodeIndex >= this.visibleNodes.length) continue;

        const node = this.visibleNodes[nodeIndex];
        if (!node) continue;

        const isSelected = nodeIndex === this.selectedIndex;
        const rowBg = isSelected ? selectedBg : bgColor;
        const rowFg = isSelected ? selectedFg : fgColor;

        // Fill selected row background
        if (isSelected) {
          for (let cx = 0; cx < contentWidth; cx++) {
            buffer.set(contentX + cx, rowY, { char: ' ', fg: rowFg, bg: rowBg });
          }
        }

        // Build display string: indent + expand icon + icon + name
        let displayX = contentX;

        // Indent based on depth
        for (let d = 0; d < node.depth * 2; d++) {
          buffer.set(displayX++, rowY, { char: ' ', fg: rowFg, bg: rowBg });
        }

        // Expansion indicator for expandable nodes
        if (node.children.length > 0 || node.type.endsWith('_folder') || node.type === 'schema' || node.type === 'connection') {
          const expandIcon = node.expanded ? ICONS.expanded : ICONS.collapsed;
          buffer.set(displayX++, rowY, { char: expandIcon, fg: dimColor, bg: rowBg });
        } else {
          buffer.set(displayX++, rowY, { char: ' ', fg: rowFg, bg: rowBg });
        }

        // Space
        buffer.set(displayX++, rowY, { char: ' ', fg: rowFg, bg: rowBg });

        // Node icon
        buffer.set(displayX++, rowY, { char: node.icon, fg: this.getIconColor(node.type), bg: rowBg });

        // Space
        buffer.set(displayX++, rowY, { char: ' ', fg: rowFg, bg: rowBg });

        // Node name
        const maxNameLen = contentWidth - (displayX - contentX) - 1;
        const displayName = node.name.length > maxNameLen
          ? node.name.slice(0, maxNameLen - 1) + '…'
          : node.name;

        for (let ci = 0; ci < displayName.length; ci++) {
          buffer.set(displayX + ci, rowY, { char: displayName[ci] ?? ' ', fg: rowFg, bg: rowBg });
        }
      }
    }

    // Draw hints at bottom
    const hintsY = y + height - 2;
    const hints = 'Enter: Select  ←→: Expand/Collapse  Esc: Cancel';
    const hintsX = x + Math.floor((width - hints.length) / 2);
    for (let i = 0; i < hints.length; i++) {
      buffer.set(hintsX + i, hintsY, { char: hints[i] ?? ' ', fg: dimColor, bg: bgColor });
    }
  }

  /**
   * Get icon color based on node type.
   */
  private getIconColor(type: NodeType): string {
    switch (type) {
      case 'connection':
        return this.callbacks.getThemeColor('terminal.ansiGreen', '#89b4fa');
      case 'schema':
        return this.callbacks.getThemeColor('terminal.ansiYellow', '#f9e2af');
      case 'tables_folder':
      case 'table':
        return this.callbacks.getThemeColor('terminal.ansiBlue', '#89b4fa');
      case 'views_folder':
      case 'view':
        return this.callbacks.getThemeColor('terminal.ansiCyan', '#94e2d5');
      case 'functions_folder':
      case 'function':
        return this.callbacks.getThemeColor('terminal.ansiMagenta', '#cba6f7');
      case 'triggers_folder':
      case 'trigger':
        return this.callbacks.getThemeColor('terminal.ansiYellow', '#f9e2af');
      case 'indexes_folder':
      case 'index':
        return this.callbacks.getThemeColor('terminal.ansiGreen', '#a6e3a1');
      case 'policies_folder':
      case 'policy':
        return this.callbacks.getThemeColor('terminal.ansiRed', '#f38ba8');
      default:
        return this.callbacks.getThemeColor('editorWidget.foreground', '#cccccc');
    }
  }
}

// ============================================
// Factory Function
// ============================================

/**
 * Create a new schema browser instance.
 */
export function createSchemaBrowser(
  id: string,
  callbacks: OverlayManagerCallbacks
): SchemaBrowser {
  return new SchemaBrowser(id, callbacks);
}

export default SchemaBrowser;
