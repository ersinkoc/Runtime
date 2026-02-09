/**
 * OPFS (Origin Private File System) persistence backend.
 * Provides persistent storage for VFS using the browser's OPFS API.
 * @module vfs/opfs-backend
 */

import type { PersistencePluginOptions } from '../types.js';

/**
 * OPFS persistence backend for VFS.
 * Debounces writes and batch-flushes to OPFS.
 *
 * @example
 * ```typescript
 * const backend = new OPFSBackend({ debounceMs: 100 });
 * await backend.init();
 * await backend.save('/src/app.ts', content);
 * ```
 */
export class OPFSBackend {
  private dirHandle: FileSystemDirectoryHandle | null = null;
  private pendingWrites = new Map<string, Uint8Array>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceMs: number;
  private paths: string[] | null;

  constructor(options?: PersistencePluginOptions) {
    this.debounceMs = options?.debounceMs ?? 100;
    this.paths = options?.paths ?? null;
  }

  /**
   * Initialize the OPFS backend.
   */
  async init(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) {
      return; // OPFS not available
    }
    this.dirHandle = await navigator.storage.getDirectory();
  }

  /**
   * Check if OPFS is available.
   */
  get isAvailable(): boolean {
    return this.dirHandle !== null;
  }

  /**
   * Schedule a file write to OPFS (debounced).
   */
  save(path: string, content: Uint8Array): void {
    if (!this.dirHandle) return;
    if (this.paths && !this.paths.some((p) => path.startsWith(p))) return;

    this.pendingWrites.set(path, content);
    this.scheduleFlush();
  }

  /**
   * Read a file from OPFS.
   */
  async load(path: string): Promise<Uint8Array | null> {
    if (!this.dirHandle) return null;

    try {
      const parts = path.split('/').filter(Boolean);
      let dir = this.dirHandle;
      for (let i = 0; i < parts.length - 1; i++) {
        dir = await dir.getDirectoryHandle(parts[i]!);
      }
      const fileName = parts[parts.length - 1];
      if (!fileName) return null;
      const fileHandle = await dir.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const buffer = await file.arrayBuffer();
      return new Uint8Array(buffer);
    } catch {
      return null;
    }
  }

  /**
   * Flush all pending writes to OPFS immediately.
   */
  async flush(): Promise<void> {
    if (!this.dirHandle || this.pendingWrites.size === 0) return;

    const writes = new Map(this.pendingWrites);
    this.pendingWrites.clear();

    for (const [path, content] of writes) {
      await this.writeToOPFS(path, content);
    }
  }

  /**
   * Destroy the backend, flushing any remaining writes.
   */
  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
    this.dirHandle = null;
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(async () => {
      this.flushTimer = null;
      await this.flush();
    }, this.debounceMs);
  }

  private async writeToOPFS(path: string, content: Uint8Array): Promise<void> {
    if (!this.dirHandle) return;

    try {
      const parts = path.split('/').filter(Boolean);
      let dir = this.dirHandle;

      // Create intermediate directories
      for (let i = 0; i < parts.length - 1; i++) {
        dir = await dir.getDirectoryHandle(parts[i]!, { create: true });
      }

      const fileName = parts[parts.length - 1];
      if (!fileName) return;
      const fileHandle = await dir.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(new Uint8Array(content.buffer, content.byteOffset, content.byteLength) as unknown as FileSystemWriteChunkType);
      await writable.close();
    } catch {
      // Silently fail on OPFS write errors
    }
  }
}
