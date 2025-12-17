/**
 * Cache Manager
 *
 * Centralized cache management with TTL, dependency tracking, and coordinated invalidation.
 * Replaces ad-hoc caching scattered throughout the codebase with a unified approach.
 *
 * Features:
 * - Time-to-live (TTL) based expiration
 * - Dependency tracking for cascading invalidation
 * - Pattern-based invalidation (string or regex)
 * - Statistics for monitoring cache performance
 * - Generic type support
 *
 * @example
 * // Basic usage
 * const gitStatus = await cache.getOrCompute('git:status', async () => {
 *   return await gitIntegration.getStatus();
 * }, { ttl: 5000 });
 *
 * @example
 * // With dependencies
 * const lineChanges = await cache.getOrCompute(`git:lineChanges:${filePath}`, async () => {
 *   return await gitIntegration.getLineChanges(filePath);
 * }, {
 *   ttl: 5000,
 *   dependencies: ['git:status']
 * });
 *
 * // Invalidate all git caches
 * cache.invalidate(/^git:/);
 */

import { CACHE } from '../constants.ts';

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  /** Cached value */
  value: T;
  /** Timestamp when cached */
  timestamp: number;
  /** TTL in milliseconds */
  ttl: number;
  /** Keys this entry depends on */
  dependencies: string[];
  /** Tags for group invalidation */
  tags: string[];
}

/**
 * Options for cache operations
 */
export interface CacheOptions {
  /** Time-to-live in milliseconds (default: 60000) */
  ttl?: number;
  /** Keys this entry depends on (invalidated when dependencies change) */
  dependencies?: string[];
  /** Tags for group invalidation */
  tags?: string[];
  /** Force recompute even if cached */
  force?: boolean;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total number of entries */
  size: number;
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
  /** Hit rate (0-1) */
  hitRate: number;
  /** Number of entries by tag */
  byTag: Map<string, number>;
}

/**
 * Default TTL values for common cache types
 */
export const CacheTTL = {
  /** Git status cache (5 seconds) */
  GIT_STATUS: CACHE.GIT_STATUS_TTL,
  /** Line changes cache (5 seconds) */
  LINE_CHANGES: CACHE.GIT_LINE_CHANGES_TTL,
  /** Theme colors cache (60 seconds) */
  THEME: CACHE.THEME_TTL,
  /** Syntax highlighting cache (30 seconds) */
  SYNTAX: 30000,
  /** File content cache (10 seconds) */
  FILE_CONTENT: 10000,
  /** LSP response cache (5 seconds) */
  LSP: 5000,
  /** Infinite (never expires automatically) */
  INFINITE: Infinity,
} as const;

/**
 * Centralized cache manager with dependency tracking
 */
export class CacheManager {
  private entries = new Map<string, CacheEntry<unknown>>();
  private hits = 0;
  private misses = 0;

  /**
   * Get a cached value or compute and cache it
   *
   * @param key - Unique cache key
   * @param compute - Function to compute value if not cached
   * @param options - Cache options
   * @returns Cached or computed value
   */
  async getOrCompute<T>(
    key: string,
    compute: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const {
      ttl = 60000,
      dependencies = [],
      tags = [],
      force = false,
    } = options;

    // Check existing cache
    if (!force) {
      const cached = this.get<T>(key);
      if (cached !== undefined) {
        this.hits++;
        return cached;
      }
    }

    this.misses++;

    // Compute new value
    const value = await compute();

    // Store in cache
    this.set(key, value, { ttl, dependencies, tags });

    return value;
  }

  /**
   * Get a cached value synchronously or compute it
   *
   * @param key - Unique cache key
   * @param compute - Function to compute value if not cached
   * @param options - Cache options
   * @returns Cached or computed value
   */
  getOrComputeSync<T>(
    key: string,
    compute: () => T,
    options: CacheOptions = {}
  ): T {
    const {
      ttl = 60000,
      dependencies = [],
      tags = [],
      force = false,
    } = options;

    // Check existing cache
    if (!force) {
      const cached = this.get<T>(key);
      if (cached !== undefined) {
        this.hits++;
        return cached;
      }
    }

    this.misses++;

    // Compute new value
    const value = compute();

    // Store in cache
    this.set(key, value, { ttl, dependencies, tags });

    return value;
  }

  /**
   * Get a cached value if present and not expired
   *
   * @param key - Cache key
   * @returns Cached value or undefined
   */
  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);

    if (!entry) {
      return undefined;
    }

    // Check expiration
    if (this.isExpired(entry)) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  /**
   * Set a cache value directly
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param options - Cache options
   */
  set<T>(key: string, value: T, options: CacheOptions = {}): void {
    const {
      ttl = 60000,
      dependencies = [],
      tags = [],
    } = options;

    this.entries.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
      dependencies,
      tags,
    });
  }

  /**
   * Check if a key exists and is not expired
   *
   * @param key - Cache key
   * @returns true if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;

    if (this.isExpired(entry)) {
      this.entries.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a specific cache entry
   *
   * @param key - Cache key to delete
   * @returns true if entry was deleted
   */
  delete(key: string): boolean {
    return this.entries.delete(key);
  }

  /**
   * Invalidate cache entries matching a pattern
   *
   * Supports:
   * - Exact key match (string)
   * - Regex pattern
   * - Dependency invalidation (cascade)
   *
   * @param pattern - Key pattern to match
   * @param cascade - Also invalidate entries depending on matched keys (default: true)
   * @returns Number of entries invalidated
   */
  invalidate(pattern: string | RegExp, cascade: boolean = true): number {
    const toDelete = new Set<string>();

    // Find matching entries
    for (const [key, entry] of this.entries) {
      const matches = typeof pattern === 'string'
        ? key === pattern
        : pattern.test(key);

      if (matches) {
        toDelete.add(key);
      }
    }

    // If cascading, find dependent entries
    if (cascade && toDelete.size > 0) {
      this.findDependents(toDelete);
    }

    // Delete all matched entries
    for (const key of toDelete) {
      this.entries.delete(key);
    }

    return toDelete.size;
  }

  /**
   * Invalidate cache entries by tag
   *
   * @param tag - Tag to match
   * @returns Number of entries invalidated
   */
  invalidateByTag(tag: string): number {
    const toDelete: string[] = [];

    for (const [key, entry] of this.entries) {
      if (entry.tags.includes(tag)) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      this.entries.delete(key);
    }

    return toDelete.length;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.entries.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const byTag = new Map<string, number>();

    for (const entry of this.entries.values()) {
      for (const tag of entry.tags) {
        byTag.set(tag, (byTag.get(tag) ?? 0) + 1);
      }
    }

    const total = this.hits + this.misses;
    return {
      size: this.entries.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      byTag,
    };
  }

  /**
   * Clean up expired entries
   *
   * Called automatically during get operations,
   * but can be called manually for maintenance.
   *
   * @returns Number of entries cleaned
   */
  cleanup(): number {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.entries) {
      if (this.isExpired(entry, now)) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      this.entries.delete(key);
    }

    return toDelete.length;
  }

  /**
   * Check if an entry is expired
   */
  private isExpired(entry: CacheEntry<unknown>, now: number = Date.now()): boolean {
    if (entry.ttl === Infinity) return false;
    return now - entry.timestamp >= entry.ttl;
  }

  /**
   * Find all entries that depend on the given keys (recursively)
   */
  private findDependents(keys: Set<string>): void {
    let foundNew = true;

    while (foundNew) {
      foundNew = false;

      for (const [key, entry] of this.entries) {
        if (keys.has(key)) continue;

        // Check if any dependency is in the invalidation set
        for (const dep of entry.dependencies) {
          if (keys.has(dep)) {
            keys.add(key);
            foundNew = true;
            break;
          }
        }
      }
    }
  }
}

/**
 * Singleton cache instance for the application
 */
export const cache = new CacheManager();

export default cache;
