/**
 * File system watcher with event batching.
 * @module vfs/watcher
 */

import type { WatchOptions, WatchListener, FSWatcher } from '../types.js';
import { normalizePath } from './path-utils.js';

interface WatchEntry {
  path: string;
  recursive: boolean;
  listener: WatchListener;
}

/**
 * Manages file watchers and batches change events.
 *
 * @example
 * ```typescript
 * const manager = new WatcherManager();
 * const watcher = manager.watch('/src', { recursive: true }, (event, filename) => {
 *   console.log(event, filename);
 * });
 * manager.notify('/src/index.ts', 'change');
 * ```
 */
export class WatcherManager {
  private watchers: WatchEntry[] = [];
  private pendingEvents: Array<{ path: string; event: 'change' | 'rename' }> = [];
  private flushScheduled = false;

  /**
   * Register a watcher for a path.
   */
  watch(path: string, options: WatchOptions, listener: WatchListener): FSWatcher {
    const normalizedPath = normalizePath(path);
    const entry: WatchEntry = {
      path: normalizedPath,
      recursive: options.recursive ?? false,
      listener,
    };
    this.watchers.push(entry);

    return {
      close: () => {
        const idx = this.watchers.indexOf(entry);
        if (idx !== -1) {
          this.watchers.splice(idx, 1);
        }
      },
    };
  }

  /**
   * Notify watchers of a file change. Events are batched via microtask.
   */
  notify(path: string, event: 'change' | 'rename'): void {
    this.pendingEvents.push({ path: normalizePath(path), event });
    this.scheduleFlush();
  }

  /**
   * Get the number of active watchers.
   */
  get watcherCount(): number {
    return this.watchers.length;
  }

  /**
   * Remove all watchers.
   */
  removeAll(): void {
    this.watchers = [];
    this.pendingEvents = [];
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    queueMicrotask(() => this.flush());
  }

  private flush(): void {
    this.flushScheduled = false;
    const events = this.pendingEvents;
    this.pendingEvents = [];

    // Deduplicate events for the same path
    const seen = new Map<string, 'change' | 'rename'>();
    for (const e of events) {
      // 'rename' takes priority over 'change'
      const existing = seen.get(e.path);
      if (!existing || e.event === 'rename') {
        seen.set(e.path, e.event);
      }
    }

    for (const [eventPath, eventType] of seen) {
      for (const watcher of this.watchers) {
        if (this.matches(watcher, eventPath)) {
          try {
            watcher.listener(eventType, eventPath);
          } catch {
            // Watcher errors are silently ignored (Node.js behavior)
          }
        }
      }
    }
  }

  private matches(watcher: WatchEntry, eventPath: string): boolean {
    if (eventPath === watcher.path) return true;

    // Handle root path specially
    const prefix = watcher.path === '/' ? '/' : watcher.path + '/';
    if (watcher.recursive && eventPath.startsWith(prefix)) return true;

    // Non-recursive: only immediate children
    if (!watcher.recursive) {
      const parent = eventPath.slice(0, eventPath.lastIndexOf('/')) || '/';
      return parent === watcher.path;
    }
    return false;
  }
}
