/**
 * Virtual File System — in-memory POSIX filesystem with tree structure.
 * @module vfs/virtual-fs
 */

import type {
  VirtualFS as IVirtualFS,
  FSTreeNode,
  DirNode,
  FileNode,
  SymlinkNode,
  FSStats,
  Dirent,
  WatchOptions,
  WatchListener,
  FSWatcher,
} from '../types.js';
import { RuntimeError } from '../errors.js';
import { encodeUTF8, decodeUTF8 } from '../utils/encoding.js';
import {
  createFileNode,
  createDirNode,
  createSymlinkNode,
  isDirNode,
  isFileNode,
  isSymlinkNode,
} from './fs-node.js';
import { normalizePath, splitPath } from './path-utils.js';
import { WatcherManager } from './watcher.js';
import { serializeSnapshot, deserializeSnapshot } from './snapshot.js';

const MAX_SYMLINK_DEPTH = 40;

/**
 * Create a VirtualFS stats object from a tree node.
 */
function createStats(node: FSTreeNode, followedSymlink: boolean = false): FSStats {
  return {
    size: node.meta.size,
    mode: node.meta.mode,
    atimeMs: node.meta.atimeMs,
    mtimeMs: node.meta.mtimeMs,
    ctimeMs: node.meta.ctimeMs,
    birthtimeMs: node.meta.birthtimeMs,
    ino: node.meta.ino,
    isFile: () => node.kind === 'file',
    isDirectory: () => node.kind === 'dir',
    isSymbolicLink: () => !followedSymlink && node.kind === 'symlink',
  };
}

/**
 * Create a Dirent from a tree node name.
 */
function createDirent(name: string, node: FSTreeNode): Dirent {
  return {
    name,
    isFile: () => node.kind === 'file',
    isDirectory: () => node.kind === 'dir',
    isSymbolicLink: () => node.kind === 'symlink',
  };
}

/**
 * In-memory POSIX virtual file system.
 *
 * @example
 * ```typescript
 * const vfs = new VirtualFS();
 * vfs.mkdirSync('/src', { recursive: true });
 * vfs.writeFileSync('/src/index.ts', 'export const x = 42;');
 * const content = vfs.readFileSync('/src/index.ts', 'utf8'); // 'export const x = 42;'
 * ```
 */
export class VirtualFS implements IVirtualFS {
  private root: DirNode;
  private watcherManager: WatcherManager;

  constructor() {
    this.root = createDirNode();
    this.watcherManager = new WatcherManager();
  }

  // ─── File Operations ────────────────────────────────────────

  readFileSync(path: string, encoding?: string): string | Uint8Array {
    const normalized = normalizePath(path);
    const node = this.resolveNode(normalized, true);

    if (!node) {
      throw new RuntimeError(
        `ENOENT: no such file or directory, open '${normalized}'`,
        'FS_ERROR',
        normalized,
      );
    }

    if (!isFileNode(node)) {
      throw new RuntimeError(
        `EISDIR: illegal operation on a directory, read '${normalized}'`,
        'FS_ERROR',
        normalized,
      );
    }

    node.meta.atimeMs = Date.now();

    if (encoding === 'utf8' || encoding === 'utf-8') {
      return decodeUTF8(node.content);
    }
    return node.content;
  }

  writeFileSync(path: string, content: string | Uint8Array): void {
    const normalized = normalizePath(path);

    // Resolve full path through symlinks first
    const resolved = this.resolveWritePath(normalized);
    const { parent: parentPath, name } = splitPath(resolved);

    if (!name) {
      throw new RuntimeError(
        `EISDIR: illegal operation on a directory, write '${normalized}'`,
        'FS_ERROR',
        normalized,
      );
    }

    const parentNode = this.resolveNode(parentPath, true);
    if (!parentNode || !isDirNode(parentNode)) {
      throw new RuntimeError(
        `ENOENT: no such file or directory, open '${normalized}'`,
        'FS_ERROR',
        normalized,
      );
    }

    const bytes = typeof content === 'string' ? encodeUTF8(content) : content;
    const existing = parentNode.children.get(name);

    if (existing && isFileNode(existing)) {
      // Update existing file
      existing.content = bytes;
      existing.meta.size = bytes.byteLength;
      existing.meta.mtimeMs = Date.now();
      existing.meta.ctimeMs = Date.now();
      this.watcherManager.notify(normalized, 'change');
    } else if (existing && isDirNode(existing)) {
      throw new RuntimeError(
        `EISDIR: illegal operation on a directory, write '${normalized}'`,
        'FS_ERROR',
        normalized,
      );
    } else {
      // Create new file
      parentNode.children.set(name, createFileNode(bytes));
      this.watcherManager.notify(normalized, 'rename');
    }
  }

  appendFileSync(path: string, content: string | Uint8Array): void {
    const normalized = normalizePath(path);
    const node = this.resolveNode(normalized, true);

    if (!node) {
      // If file doesn't exist, create it
      this.writeFileSync(path, content);
      return;
    }

    if (!isFileNode(node)) {
      throw new RuntimeError(
        `EISDIR: illegal operation on a directory, append '${normalized}'`,
        'FS_ERROR',
        normalized,
      );
    }

    const appendBytes = typeof content === 'string' ? encodeUTF8(content) : content;
    const newContent = new Uint8Array(node.content.byteLength + appendBytes.byteLength);
    newContent.set(node.content, 0);
    newContent.set(appendBytes, node.content.byteLength);
    node.content = newContent;
    node.meta.size = newContent.byteLength;
    node.meta.mtimeMs = Date.now();
    node.meta.ctimeMs = Date.now();
    this.watcherManager.notify(normalized, 'change');
  }

  copyFileSync(src: string, dest: string): void {
    const content = this.readFileSync(src);
    const bytes = content as Uint8Array;
    this.writeFileSync(dest, bytes);
  }

  // ─── Directory Operations ───────────────────────────────────

  mkdirSync(path: string, options?: { recursive?: boolean }): void {
    const normalized = normalizePath(path);
    if (normalized === '/') return; // root always exists

    const { parent: parentPath, name } = splitPath(normalized);

    if (options?.recursive) {
      this.mkdirRecursive(normalized);
      return;
    }

    const parentNode = this.resolveNode(parentPath, true);
    if (!parentNode || !isDirNode(parentNode)) {
      throw new RuntimeError(
        `ENOENT: no such file or directory, mkdir '${normalized}'`,
        'FS_ERROR',
        normalized,
      );
    }

    if (parentNode.children.has(name)) {
      throw new RuntimeError(
        `EEXIST: file already exists, mkdir '${normalized}'`,
        'FS_ERROR',
        normalized,
      );
    }

    parentNode.children.set(name, createDirNode());
    this.watcherManager.notify(normalized, 'rename');
  }

  readdirSync(path: string, options?: { withFileTypes?: boolean }): string[] | Dirent[] {
    const normalized = normalizePath(path);
    const node = this.resolveNode(normalized, true);

    if (!node) {
      throw new RuntimeError(
        `ENOENT: no such file or directory, scandir '${normalized}'`,
        'FS_ERROR',
        normalized,
      );
    }

    if (!isDirNode(node)) {
      throw new RuntimeError(
        `ENOTDIR: not a directory, scandir '${normalized}'`,
        'FS_ERROR',
        normalized,
      );
    }

    if (options?.withFileTypes) {
      const entries: Dirent[] = [];
      for (const [name, child] of node.children) {
        entries.push(createDirent(name, child));
      }
      return entries;
    }

    return Array.from(node.children.keys());
  }

  rmdirSync(path: string, options?: { recursive?: boolean }): void {
    const normalized = normalizePath(path);
    if (normalized === '/') {
      if (options?.recursive) {
        this.root.children.clear();
        return;
      }
      throw new RuntimeError(
        `EPERM: operation not permitted, rmdir '/'`,
        'FS_ERROR',
        '/',
      );
    }

    const { parent: parentPath, name } = splitPath(normalized);
    const parentNode = this.resolveNode(parentPath, true);

    if (!parentNode || !isDirNode(parentNode)) {
      throw new RuntimeError(
        `ENOENT: no such file or directory, rmdir '${normalized}'`,
        'FS_ERROR',
        normalized,
      );
    }

    const node = parentNode.children.get(name);
    if (!node) {
      throw new RuntimeError(
        `ENOENT: no such file or directory, rmdir '${normalized}'`,
        'FS_ERROR',
        normalized,
      );
    }

    if (!isDirNode(node)) {
      throw new RuntimeError(
        `ENOTDIR: not a directory, rmdir '${normalized}'`,
        'FS_ERROR',
        normalized,
      );
    }

    if (!options?.recursive && node.children.size > 0) {
      throw new RuntimeError(
        `ENOTEMPTY: directory not empty, rmdir '${normalized}'`,
        'FS_ERROR',
        normalized,
      );
    }

    parentNode.children.delete(name);
    this.watcherManager.notify(normalized, 'rename');
  }

  // ─── Metadata ───────────────────────────────────────────────

  statSync(path: string): FSStats {
    const normalized = normalizePath(path);
    const node = this.resolveNode(normalized, true);

    if (!node) {
      throw new RuntimeError(
        `ENOENT: no such file or directory, stat '${normalized}'`,
        'FS_ERROR',
        normalized,
      );
    }

    return createStats(node, true);
  }

  lstatSync(path: string): FSStats {
    const normalized = normalizePath(path);
    const node = this.resolveNode(normalized, false);

    if (!node) {
      throw new RuntimeError(
        `ENOENT: no such file or directory, lstat '${normalized}'`,
        'FS_ERROR',
        normalized,
      );
    }

    return createStats(node, false);
  }

  existsSync(path: string): boolean {
    const normalized = normalizePath(path);
    return this.resolveNode(normalized, true) !== null;
  }

  chmodSync(path: string, mode: number): void {
    const normalized = normalizePath(path);
    const node = this.resolveNode(normalized, true);

    if (!node) {
      throw new RuntimeError(
        `ENOENT: no such file or directory, chmod '${normalized}'`,
        'FS_ERROR',
        normalized,
      );
    }

    node.meta.mode = mode;
    node.meta.ctimeMs = Date.now();
  }

  realpathSync(path: string): string {
    const normalized = normalizePath(path);
    const resolved = this.resolveSymlinks(normalized, 0);
    // Verify it exists
    const node = this.getNodeAt(resolved);
    if (!node) {
      throw new RuntimeError(
        `ENOENT: no such file or directory, realpath '${normalized}'`,
        'FS_ERROR',
        normalized,
      );
    }
    return resolved;
  }

  // ─── Manipulation ───────────────────────────────────────────

  unlinkSync(path: string): void {
    const normalized = normalizePath(path);
    const { parent: parentPath, name } = splitPath(normalized);

    const parentNode = this.resolveNode(parentPath, true);
    if (!parentNode || !isDirNode(parentNode)) {
      throw new RuntimeError(
        `ENOENT: no such file or directory, unlink '${normalized}'`,
        'FS_ERROR',
        normalized,
      );
    }

    const node = parentNode.children.get(name);
    if (!node) {
      throw new RuntimeError(
        `ENOENT: no such file or directory, unlink '${normalized}'`,
        'FS_ERROR',
        normalized,
      );
    }

    if (isDirNode(node)) {
      throw new RuntimeError(
        `EPERM: operation not permitted, unlink '${normalized}'`,
        'FS_ERROR',
        normalized,
      );
    }

    parentNode.children.delete(name);
    this.watcherManager.notify(normalized, 'rename');
  }

  renameSync(oldPath: string, newPath: string): void {
    const normalizedOld = normalizePath(oldPath);
    const normalizedNew = normalizePath(newPath);

    const { parent: oldParentPath, name: oldName } = splitPath(normalizedOld);
    const { parent: newParentPath, name: newName } = splitPath(normalizedNew);

    const oldParent = this.resolveNode(oldParentPath, true);
    if (!oldParent || !isDirNode(oldParent)) {
      throw new RuntimeError(
        `ENOENT: no such file or directory, rename '${normalizedOld}'`,
        'FS_ERROR',
        normalizedOld,
      );
    }

    const node = oldParent.children.get(oldName);
    if (!node) {
      throw new RuntimeError(
        `ENOENT: no such file or directory, rename '${normalizedOld}'`,
        'FS_ERROR',
        normalizedOld,
      );
    }

    const newParent = this.resolveNode(newParentPath, true);
    if (!newParent || !isDirNode(newParent)) {
      throw new RuntimeError(
        `ENOENT: no such file or directory, rename '${normalizedNew}'`,
        'FS_ERROR',
        normalizedNew,
      );
    }

    oldParent.children.delete(oldName);
    newParent.children.set(newName, node);
    node.meta.ctimeMs = Date.now();

    this.watcherManager.notify(normalizedOld, 'rename');
    this.watcherManager.notify(normalizedNew, 'rename');
  }

  // ─── Symlinks ───────────────────────────────────────────────

  symlinkSync(target: string, path: string): void {
    const normalized = normalizePath(path);
    const { parent: parentPath, name } = splitPath(normalized);

    const parentNode = this.resolveNode(parentPath, true);
    if (!parentNode || !isDirNode(parentNode)) {
      throw new RuntimeError(
        `ENOENT: no such file or directory, symlink '${normalized}'`,
        'FS_ERROR',
        normalized,
      );
    }

    if (parentNode.children.has(name)) {
      throw new RuntimeError(
        `EEXIST: file already exists, symlink '${normalized}'`,
        'FS_ERROR',
        normalized,
      );
    }

    parentNode.children.set(name, createSymlinkNode(target));
    this.watcherManager.notify(normalized, 'rename');
  }

  readlinkSync(path: string): string {
    const normalized = normalizePath(path);
    const node = this.resolveNode(normalized, false);

    if (!node) {
      throw new RuntimeError(
        `ENOENT: no such file or directory, readlink '${normalized}'`,
        'FS_ERROR',
        normalized,
      );
    }

    if (!isSymlinkNode(node)) {
      throw new RuntimeError(
        `EINVAL: invalid argument, readlink '${normalized}'`,
        'FS_ERROR',
        normalized,
      );
    }

    return node.target;
  }

  // ─── Watch ──────────────────────────────────────────────────

  watch(path: string, options: WatchOptions, listener: WatchListener): FSWatcher {
    return this.watcherManager.watch(path, options, listener);
  }

  // ─── Serialization ─────────────────────────────────────────

  toSnapshot(): Uint8Array {
    return serializeSnapshot(this.root);
  }

  static fromSnapshot(data: Uint8Array): VirtualFS {
    const vfs = new VirtualFS();
    vfs.root = deserializeSnapshot(data);
    return vfs;
  }

  // ─── Internal Helpers ───────────────────────────────────────

  /**
   * Resolve a node at a path, optionally following symlinks.
   */
  private resolveNode(path: string, followSymlinks: boolean): FSTreeNode | null {
    if (path === '/') return this.root;

    const resolvedPath = followSymlinks ? this.resolveSymlinks(path, 0) : path;
    return this.getNodeAt(resolvedPath);
  }

  /**
   * Get a node at an exact path (no symlink resolution).
   */
  private getNodeAt(path: string): FSTreeNode | null {
    const parts = path.split('/').filter(Boolean);
    let current: FSTreeNode = this.root;

    for (const part of parts) {
      if (!isDirNode(current)) return null;
      const child = current.children.get(part);
      if (!child) return null;
      current = child;
    }

    return current;
  }

  /**
   * Resolve a write path: follow symlinks if the final component is a symlink to a file.
   * This allows `writeFileSync('/link', data)` to write through to the symlink target.
   */
  private resolveWritePath(path: string): string {
    const parts = path.split('/').filter(Boolean);
    let resolved = '';

    for (const part of parts) {
      const current = resolved + '/' + part;
      const node = this.getNodeAt(current);

      if (node && isSymlinkNode(node)) {
        const target = node.target.startsWith('/')
          ? node.target
          : resolved + '/' + node.target;
        resolved = normalizePath(target);
        // Recursively resolve in case of chained symlinks
        const resolvedNode = this.getNodeAt(resolved);
        if (resolvedNode && isSymlinkNode(resolvedNode)) {
          resolved = this.resolveSymlinks(resolved, 0);
        }
      } else {
        resolved = current;
      }
    }

    return resolved || '/';
  }

  /**
   * Resolve all symlinks in a path.
   */
  private resolveSymlinks(path: string, depth: number): string {
    if (depth > MAX_SYMLINK_DEPTH) {
      throw new RuntimeError(
        `ELOOP: too many levels of symbolic links, '${path}'`,
        'FS_ERROR',
        path,
      );
    }

    const parts = path.split('/').filter(Boolean);
    let resolved = '';

    for (const part of parts) {
      const current = resolved + '/' + part;
      const node = this.getNodeAt(current);

      if (node && isSymlinkNode(node)) {
        const target = node.target.startsWith('/')
          ? node.target
          : resolved + '/' + node.target;
        resolved = this.resolveSymlinks(normalizePath(target), depth + 1);
      } else {
        resolved = current;
      }
    }

    return resolved || '/';
  }

  /**
   * Recursively create directories along a path.
   */
  private mkdirRecursive(path: string): void {
    const parts = path.split('/').filter(Boolean);
    let current = this.root;

    for (const part of parts) {
      let child = current.children.get(part);
      if (!child) {
        child = createDirNode();
        current.children.set(part, child);
      } else if (!isDirNode(child)) {
        throw new RuntimeError(
          `ENOTDIR: not a directory, mkdir '${path}'`,
          'FS_ERROR',
          path,
        );
      }
      current = child;
    }
  }
}
