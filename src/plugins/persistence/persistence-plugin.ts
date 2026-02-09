/**
 * Persistence Plugin — OPFS-backed VFS persistence.
 * Saves/restores VFS state to Origin Private File System.
 * @module plugins/persistence/persistence-plugin
 */

import type { RuntimePlugin, RuntimeKernel, VirtualFS } from '../../types.js';

export interface PersistencePluginOptions {
  /** OPFS directory name for storage */
  storageName?: string;
  /** Auto-save interval in ms (0 = disabled) */
  autoSaveInterval?: number;
  /** Debounce writes by this many ms */
  debounceMs?: number;
}

/**
 * Create an OPFS-backed persistence plugin for VFS state.
 *
 * @example
 * ```typescript
 * const runtime = createRuntime({
 *   plugins: [vfsPlugin(), persistencePlugin({ autoSaveInterval: 5000 })],
 * });
 * ```
 */
export function persistencePlugin(options?: PersistencePluginOptions): RuntimePlugin {
  const storageName = options?.storageName ?? '@oxog-runtime';
  const autoSaveInterval = options?.autoSaveInterval ?? 0;
  const debounceMs = options?.debounceMs ?? 1000;

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

  return {
    name: 'persistence',
    version: '1.0.0',

    install(kernel: RuntimeKernel): void {
      const vfs = kernel.vfs;

      const persistence = {
        async save(): Promise<void> {
          try {
            const root = await navigator.storage.getDirectory();
            const dirHandle = await root.getDirectoryHandle(storageName, { create: true });
            const fileHandle = await dirHandle.getFileHandle('vfs-snapshot.bin', { create: true });
            const writable = await (fileHandle as any).createWritable();
            const snapshot = vfs.toSnapshot();
            await writable.write(snapshot);
            await writable.close();
          } catch (err) {
            // OPFS may not be available in all contexts
            console.warn('Persistence save failed:', err);
          }
        },

        async restore(): Promise<boolean> {
          try {
            const root = await navigator.storage.getDirectory();
            const dirHandle = await root.getDirectoryHandle(storageName);
            const fileHandle = await dirHandle.getFileHandle('vfs-snapshot.bin');
            const file = await fileHandle.getFile();
            const buffer = await file.arrayBuffer();
            const snapshot = new Uint8Array(buffer);
            vfs.fromSnapshot?.(snapshot);
            return true;
          } catch {
            return false;
          }
        },

        async clear(): Promise<void> {
          try {
            const root = await navigator.storage.getDirectory();
            await root.removeEntry(storageName, { recursive: true });
          } catch {
            // Already cleared or not available
          }
        },

        scheduleSave(): void {
          if (saveTimer) clearTimeout(saveTimer);
          saveTimer = setTimeout(() => {
            persistence.save();
            saveTimer = null;
          }, debounceMs);
        },
      };

      (kernel as any)._persistence = persistence;

      // Set up auto-save if configured
      if (autoSaveInterval > 0) {
        autoSaveTimer = setInterval(() => {
          persistence.save();
        }, autoSaveInterval);
      }
    },

    async onDestroy(): Promise<void> {
      if (saveTimer) clearTimeout(saveTimer);
      if (autoSaveTimer) clearInterval(autoSaveTimer);
    },
  };
}
