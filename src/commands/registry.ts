/**
 * Command Registry
 *
 * Central registration and lookup for all commands in Ultra.
 */

import type { Command } from './types.ts';

export class CommandRegistry {
  private commands = new Map<string, Command>();
  private listeners = new Set<() => void>();

  /**
   * Register a command.
   */
  register<TArgs, TResult>(command: Command<TArgs, TResult>): void {
    if (this.commands.has(command.id)) {
      throw new Error(`Command already registered: ${command.id}`);
    }
    this.commands.set(command.id, command as Command);
    this.notifyListeners();
  }

  /**
   * Register multiple commands.
   */
  registerAll(commands: Command[]): void {
    for (const command of commands) {
      if (this.commands.has(command.id)) {
        throw new Error(`Command already registered: ${command.id}`);
      }
      this.commands.set(command.id, command);
    }
    this.notifyListeners();
  }

  /**
   * Unregister a command.
   */
  unregister(id: string): boolean {
    const deleted = this.commands.delete(id);
    if (deleted) {
      this.notifyListeners();
    }
    return deleted;
  }

  /**
   * Get a command by ID.
   */
  get(id: string): Command | undefined {
    return this.commands.get(id);
  }

  /**
   * Get all registered commands.
   */
  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get commands exposed to AI agents.
   */
  getAIExposed(): Command[] {
    return this.getAll().filter((c) => c.aiExposed !== false);
  }

  /**
   * Get commands by category.
   */
  getByCategory(category: string): Command[] {
    return this.getAll().filter((c) => c.category === category);
  }

  /**
   * Fuzzy search commands by title/id/description.
   */
  search(query: string): Command[] {
    const q = query.toLowerCase();
    return this.getAll()
      .filter(
        (c) =>
          c.id.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        // Prioritize exact matches
        const aExact = a.title.toLowerCase().startsWith(q) ? 0 : 1;
        const bExact = b.title.toLowerCase().startsWith(q) ? 0 : 1;
        return aExact - bExact || a.title.localeCompare(b.title);
      });
  }

  /**
   * Check if a command exists.
   */
  has(id: string): boolean {
    return this.commands.has(id);
  }

  /**
   * Get the number of registered commands.
   */
  get size(): number {
    return this.commands.size;
  }

  /**
   * Listen for registry changes.
   */
  onChanged(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Clear all registered commands.
   */
  clear(): void {
    this.commands.clear();
    this.notifyListeners();
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

// Singleton instance for the new command protocol
export const commandRegistry = new CommandRegistry();
export default commandRegistry;
