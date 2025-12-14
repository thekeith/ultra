/**
 * User Configuration Manager
 * 
 * Manages user configuration in ~/.ultra directory.
 * Creates default config files if they don't exist and watches for changes.
 */

import * as fs from 'fs';
import * as path from 'path';
import { settings } from './settings.ts';
import { settingsLoader } from './settings-loader.ts';
import { keymap } from '../input/keymap.ts';
import { keybindingsLoader } from '../input/keybindings-loader.ts';
import { themeLoader } from '../ui/themes/theme-loader.ts';
import { defaultKeybindings, defaultSettings, defaultThemes } from './defaults.ts';

export class UserConfigManager {
  private configDir: string;
  private settingsPath: string;
  private keybindingsPath: string;
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private onReloadCallback?: () => void;
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor() {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    this.configDir = path.join(home, '.ultra');
    this.settingsPath = path.join(this.configDir, 'settings.json');
    this.keybindingsPath = path.join(this.configDir, 'keybindings.json');
  }

  /**
   * Set callback for when config is reloaded
   */
  onReload(callback: () => void): void {
    this.onReloadCallback = callback;
  }

  /**
   * Initialize user config directory and files
   */
  async init(): Promise<void> {
    // Ensure config directory exists
    await this.ensureConfigDir();

    // Create default files if they don't exist
    await this.ensureDefaultFiles();

    // Load user config
    await this.loadUserConfig();

    // Start watching for changes
    this.watchConfigFiles();
  }

  /**
   * Ensure ~/.ultra directory exists
   */
  private async ensureConfigDir(): Promise<void> {
    try {
      await fs.promises.mkdir(this.configDir, { recursive: true });
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        console.error('Failed to create config directory:', error);
      }
    }
  }

  /**
   * Create default config files if they don't exist
   */
  private async ensureDefaultFiles(): Promise<void> {
    // Check and create settings.json
    if (!await this.fileExists(this.settingsPath)) {
      const defaultSettingsContent = JSON.stringify(defaultSettings, null, 2);
      await this.writeFile(this.settingsPath, defaultSettingsContent);
    }

    // Check and create keybindings.json
    if (!await this.fileExists(this.keybindingsPath)) {
      const defaultKeybindingsContent = JSON.stringify(defaultKeybindings, null, 2);
      await this.writeFile(this.keybindingsPath, defaultKeybindingsContent);
    }
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Write file with error handling
   */
  private async writeFile(filePath: string, content: string): Promise<void> {
    try {
      await fs.promises.writeFile(filePath, content, 'utf-8');
    } catch (error) {
      console.error(`Failed to write ${filePath}:`, error);
    }
  }

  /**
   * Load user configuration files
   */
  async loadUserConfig(): Promise<void> {
    // Load embedded defaults first
    keymap.loadBindings(defaultKeybindings);
    settings.update(defaultSettings);

    // Load user settings (overrides defaults)
    try {
      const userSettings = await settingsLoader.loadFromFile(this.settingsPath);
      if (userSettings && Object.keys(userSettings).length > 0) {
        settings.update(userSettings);
      }
    } catch {
      // Use defaults if user file fails to load
    }

    // Load user keybindings (overrides defaults)
    try {
      const userBindings = await keybindingsLoader.loadFromFile(this.keybindingsPath);
      if (userBindings.length > 0) {
        keymap.loadBindings(userBindings);
      }
    } catch {
      // Use defaults if user file fails to load
    }

    // Load theme
    await this.loadTheme();
  }

  /**
   * Load theme based on current settings
   */
  private async loadTheme(): Promise<void> {
    const themeName = settings.get('workbench.colorTheme') || 'catppuccin-frappe';
    const embeddedTheme = defaultThemes[themeName];
    
    if (embeddedTheme) {
      themeLoader.parse(JSON.stringify(embeddedTheme));
    } else {
      // Try to load from user themes directory
      const userThemePath = path.join(this.configDir, 'themes', `${themeName}.json`);
      try {
        await themeLoader.loadFromFile(userThemePath);
      } catch {
        // Fall back to embedded catppuccin-frappe
        if (defaultThemes['catppuccin-frappe']) {
          themeLoader.parse(JSON.stringify(defaultThemes['catppuccin-frappe']));
        }
      }
    }
  }

  /**
   * Watch config files for changes
   */
  private watchConfigFiles(): void {
    this.watchFile(this.settingsPath, 'settings');
    this.watchFile(this.keybindingsPath, 'keybindings');
  }

  /**
   * Watch a single file for changes
   */
  private watchFile(filePath: string, type: string): void {
    try {
      const watcher = fs.watch(filePath, { persistent: false }, (eventType) => {
        if (eventType === 'change') {
          // Debounce to avoid multiple rapid reloads
          const existingTimer = this.debounceTimers.get(type);
          if (existingTimer) {
            clearTimeout(existingTimer);
          }
          
          const timer = setTimeout(async () => {
            this.debounceTimers.delete(type);
            await this.reloadConfig(type);
          }, 100);
          
          this.debounceTimers.set(type, timer);
        }
      });

      this.watchers.set(type, watcher);
    } catch (error) {
      console.error(`Failed to watch ${filePath}:`, error);
    }
  }

  /**
   * Reload a specific config type
   */
  private async reloadConfig(type: string): Promise<void> {
    try {
      if (type === 'settings') {
        // Reload settings
        settings.update(defaultSettings);  // Reset to defaults first
        const userSettings = await settingsLoader.loadFromFile(this.settingsPath);
        if (userSettings && Object.keys(userSettings).length > 0) {
          settings.update(userSettings);
        }
        // Reload theme in case it changed
        await this.loadTheme();
      } else if (type === 'keybindings') {
        // Reload keybindings
        keymap.loadBindings(defaultKeybindings);  // Reset to defaults first
        const userBindings = await keybindingsLoader.loadFromFile(this.keybindingsPath);
        if (userBindings.length > 0) {
          keymap.loadBindings(userBindings);
        }
      }

      // Notify app to re-render
      if (this.onReloadCallback) {
        this.onReloadCallback();
      }
    } catch (error) {
      console.error(`Failed to reload ${type}:`, error);
    }
  }

  /**
   * Get the config directory path
   */
  getConfigDir(): string {
    return this.configDir;
  }

  /**
   * Get the settings file path
   */
  getSettingsPath(): string {
    return this.settingsPath;
  }

  /**
   * Get the keybindings file path
   */
  getKeybindingsPath(): string {
    return this.keybindingsPath;
  }

  /**
   * Cleanup watchers
   */
  destroy(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
    
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }
}

export const userConfigManager = new UserConfigManager();
export default userConfigManager;
