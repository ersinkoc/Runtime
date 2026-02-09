/**
 * Node.js `fs` module shim — delegates to VFS.
 * @module shims/fs
 */

import type { VirtualFS } from '../types.js';

let _vfs: VirtualFS | null = null;

export function _bindVFS(vfs: VirtualFS): void {
  _vfs = vfs;
}

function getVFS(): VirtualFS {
  if (!_vfs) {
    throw new Error('fs shim is not connected to a VFS. Ensure the VFS plugin is loaded.');
  }
  return _vfs;
}

// Sync methods
export function readFileSync(path: string, options?: string | { encoding?: string }): string | Uint8Array {
  const encoding = typeof options === 'string' ? options : options?.encoding;
  return getVFS().readFileSync(path, encoding);
}

export function writeFileSync(path: string, data: string | Uint8Array, _options?: string | { encoding?: string }): void {
  getVFS().writeFileSync(path, data);
}

export function appendFileSync(path: string, data: string | Uint8Array): void {
  getVFS().appendFileSync(path, data);
}

export function mkdirSync(path: string, options?: { recursive?: boolean }): void {
  getVFS().mkdirSync(path, options);
}

export function readdirSync(path: string, options?: { withFileTypes?: boolean }): string[] | Array<{ name: string; isFile(): boolean; isDirectory(): boolean; isSymbolicLink(): boolean }> {
  return getVFS().readdirSync(path, options) as any;
}

export function rmdirSync(path: string, options?: { recursive?: boolean }): void {
  getVFS().rmdirSync(path, options);
}

export function statSync(path: string): { size: number; mode: number; isFile(): boolean; isDirectory(): boolean; isSymbolicLink(): boolean; mtimeMs: number; ctimeMs: number } {
  return getVFS().statSync(path);
}

export function lstatSync(path: string): ReturnType<typeof statSync> {
  return getVFS().lstatSync(path);
}

export function existsSync(path: string): boolean {
  return getVFS().existsSync(path);
}

export function unlinkSync(path: string): void {
  getVFS().unlinkSync(path);
}

export function renameSync(oldPath: string, newPath: string): void {
  getVFS().renameSync(oldPath, newPath);
}

export function copyFileSync(src: string, dest: string): void {
  getVFS().copyFileSync(src, dest);
}

export function chmodSync(path: string, mode: number): void {
  getVFS().chmodSync(path, mode);
}

export function realpathSync(path: string): string {
  return getVFS().realpathSync(path);
}

export function symlinkSync(target: string, path: string): void {
  getVFS().symlinkSync(target, path);
}

export function readlinkSync(path: string): string {
  return getVFS().readlinkSync(path);
}

// Async promise wrappers — deferred via microtask to avoid blocking the caller
function asyncWrap<T>(fn: () => T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queueMicrotask(() => {
      try { resolve(fn()); }
      catch (err) { reject(err); }
    });
  });
}

export const promises = {
  readFile: (path: string, options?: string | { encoding?: string }) =>
    asyncWrap(() => readFileSync(path, options)),
  writeFile: (path: string, data: string | Uint8Array, options?: string | { encoding?: string }) =>
    asyncWrap(() => writeFileSync(path, data, options)),
  appendFile: (path: string, data: string | Uint8Array) =>
    asyncWrap(() => appendFileSync(path, data)),
  mkdir: (path: string, options?: { recursive?: boolean }) =>
    asyncWrap(() => mkdirSync(path, options)),
  readdir: (path: string, options?: { withFileTypes?: boolean }) =>
    asyncWrap(() => readdirSync(path, options)),
  rmdir: (path: string, options?: { recursive?: boolean }) =>
    asyncWrap(() => rmdirSync(path, options)),
  stat: (path: string) => asyncWrap(() => statSync(path)),
  lstat: (path: string) => asyncWrap(() => lstatSync(path)),
  unlink: (path: string) => asyncWrap(() => unlinkSync(path)),
  rename: (oldPath: string, newPath: string) => asyncWrap(() => renameSync(oldPath, newPath)),
  copyFile: (src: string, dest: string) => asyncWrap(() => copyFileSync(src, dest)),
  chmod: (path: string, mode: number) => asyncWrap(() => chmodSync(path, mode)),
  realpath: (path: string) => asyncWrap(() => realpathSync(path)),
  access: (path: string) => asyncWrap(() => {
    if (!existsSync(path)) throw new Error(`ENOENT: no such file or directory, access '${path}'`);
  }),
};

// Callback-style wrappers
function wrapCallback<T>(syncFn: () => T, callback: (err: Error | null, result?: T) => void): void {
  try {
    const result = syncFn();
    queueMicrotask(() => callback(null, result));
  } catch (err) {
    queueMicrotask(() => callback(err instanceof Error ? err : new Error(String(err))));
  }
}

export function readFile(path: string, optionsOrCallback: any, callback?: any): void {
  const cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
  const opts = typeof optionsOrCallback === 'function' ? undefined : optionsOrCallback;
  wrapCallback(() => readFileSync(path, opts), cb);
}

export function writeFile(path: string, data: string | Uint8Array, optionsOrCallback: any, callback?: any): void {
  const cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
  const opts = typeof optionsOrCallback === 'function' ? undefined : optionsOrCallback;
  wrapCallback(() => writeFileSync(path, data, opts), cb);
}

export function mkdir(path: string, optionsOrCallback: any, callback?: any): void {
  const cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
  const opts = typeof optionsOrCallback === 'function' ? undefined : optionsOrCallback;
  wrapCallback(() => mkdirSync(path, opts), cb);
}

export function readdir(path: string, optionsOrCallback: any, callback?: any): void {
  const cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
  const opts = typeof optionsOrCallback === 'function' ? undefined : optionsOrCallback;
  wrapCallback(() => readdirSync(path, opts), cb);
}

export function stat(path: string, callback: any): void {
  wrapCallback(() => statSync(path), callback);
}

export function unlink(path: string, callback: any): void {
  wrapCallback(() => unlinkSync(path), callback);
}

export function rename(oldPath: string, newPath: string, callback: any): void {
  wrapCallback(() => renameSync(oldPath, newPath), callback);
}

// Watch
export function watch(path: string, options?: any, listener?: any) {
  return getVFS().watch(path, options, listener);
}

// createReadStream / createWriteStream
const READ_STREAM_CHUNK_SIZE = 16384; // 16 KB chunks

export function createReadStream(path: string, options?: { highWaterMark?: number }): { on: (event: string, cb: (...args: any[]) => void) => any; pipe: (dest: any) => any } {
  const raw = readFileSync(path) as Uint8Array;
  const chunkSize = options?.highWaterMark ?? READ_STREAM_CHUNK_SIZE;
  const listeners: Record<string, Array<(...args: any[]) => void>> = {};

  function emit(event: string, ...args: any[]) {
    const cbs = listeners[event];
    if (cbs) for (const cb of cbs) cb(...args);
  }

  function emitChunks() {
    let offset = 0;
    function next() {
      if (offset < raw.length) {
        const chunk = raw.slice(offset, offset + chunkSize);
        offset += chunkSize;
        emit('data', chunk);
        queueMicrotask(next);
      } else {
        emit('end');
      }
    }
    queueMicrotask(next);
  }

  let started = false;
  function ensureStarted() {
    if (!started) { started = true; emitChunks(); }
  }

  return {
    on(event: string, cb: (...args: any[]) => void) {
      (listeners[event] ??= []).push(cb);
      ensureStarted();
      return this;
    },
    pipe(dest: any) {
      this.on('data', (chunk: any) => dest.write?.(chunk));
      this.on('end', () => dest.end?.());
      return dest;
    },
  };
}

export function createWriteStream(path: string): { write: (data: string | Uint8Array) => boolean; end: (data?: string | Uint8Array) => void; on: (event: string, cb: (...args: any[]) => void) => any } {
  const chunks: (string | Uint8Array)[] = [];
  return {
    write(data: string | Uint8Array) {
      chunks.push(data);
      return true;
    },
    end(data?: string | Uint8Array) {
      if (data) chunks.push(data);
      const combined = chunks.map((c) => typeof c === 'string' ? c : new TextDecoder().decode(c)).join('');
      writeFileSync(path, combined);
    },
    on(_event: string, _cb: (...args: any[]) => void) {
      return this;
    },
  };
}

const fsModule = {
  _bindVFS,
  readFileSync, writeFileSync, appendFileSync, mkdirSync, readdirSync,
  rmdirSync, statSync, lstatSync, existsSync, unlinkSync, renameSync,
  copyFileSync, chmodSync, realpathSync, symlinkSync, readlinkSync,
  promises,
  readFile, writeFile, mkdir, readdir, stat, unlink, rename,
  watch, createReadStream, createWriteStream,
};

export default fsModule;
