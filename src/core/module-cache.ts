/**
 * Module cache for CJS and ESM modules.
 * @module core/module-cache
 */

/**
 * A cached CJS module entry.
 */
export interface CachedModule {
  exports: any;
  id: string;
  loaded: boolean;
}

/**
 * CJS module cache keyed by resolved absolute path.
 *
 * @example
 * ```typescript
 * const cache = new ModuleCache();
 * cache.set('/app/index.js', { exports: {}, id: '/app/index.js', loaded: false });
 * cache.get('/app/index.js'); // { exports: {}, ... }
 * ```
 */
export class ModuleCache {
  private cache = new Map<string, CachedModule>();

  /**
   * Get a cached module by resolved path.
   */
  get(id: string): CachedModule | undefined {
    return this.cache.get(id);
  }

  /**
   * Set a module in the cache.
   */
  set(id: string, mod: CachedModule): void {
    this.cache.set(id, mod);
  }

  /**
   * Check if a module is cached.
   */
  has(id: string): boolean {
    return this.cache.has(id);
  }

  /**
   * Remove a module from cache.
   */
  delete(id: string): boolean {
    return this.cache.delete(id);
  }

  /**
   * Clear all cached modules.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the number of cached modules.
   */
  get size(): number {
    return this.cache.size;
  }
}
