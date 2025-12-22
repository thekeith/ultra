/**
 * TUI Configuration
 *
 * Configuration management for the new TUI client.
 */

export {
  TUIConfigManager,
  createTUIConfigManager,
  type TUISettings,
  type ConfigPaths,
  type ConfigReloadType,
  type ConfigReloadCallback,
  type FileWatchMode,
} from './config-manager.ts';
