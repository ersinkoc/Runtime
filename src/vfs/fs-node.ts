/**
 * File system node types and factories for the virtual filesystem tree.
 * @module vfs/fs-node
 */

import type { FileNode, DirNode, SymlinkNode, FSTreeNode, FSMetadata } from '../types.js';

let nextIno = 1;

/**
 * Reset inode counter (for testing).
 * @internal
 */
export function resetInodeCounter(): void {
  nextIno = 1;
}

/**
 * Create file system metadata with current timestamps.
 *
 * @example
 * ```typescript
 * const meta = createMetadata(0o644, 100);
 * ```
 */
export function createMetadata(mode: number, size: number): FSMetadata {
  const now = Date.now();
  return {
    mode,
    size,
    atimeMs: now,
    mtimeMs: now,
    ctimeMs: now,
    birthtimeMs: now,
    ino: nextIno++,
  };
}

/**
 * Create a file node.
 *
 * @example
 * ```typescript
 * const file = createFileNode(new Uint8Array([72, 101, 108, 108, 111]));
 * ```
 */
export function createFileNode(content: Uint8Array, mode: number = 0o644): FileNode {
  return {
    kind: 'file',
    content,
    meta: createMetadata(mode, content.byteLength),
  };
}

/**
 * Create a directory node.
 *
 * @example
 * ```typescript
 * const dir = createDirNode();
 * ```
 */
export function createDirNode(mode: number = 0o755): DirNode {
  return {
    kind: 'dir',
    children: new Map(),
    meta: createMetadata(mode, 0),
  };
}

/**
 * Create a symlink node.
 *
 * @example
 * ```typescript
 * const link = createSymlinkNode('/target/path');
 * ```
 */
export function createSymlinkNode(target: string, mode: number = 0o777): SymlinkNode {
  return {
    kind: 'symlink',
    target,
    meta: createMetadata(mode, target.length),
  };
}

/**
 * Check if a node is a file.
 */
export function isFileNode(node: FSTreeNode): node is FileNode {
  return node.kind === 'file';
}

/**
 * Check if a node is a directory.
 */
export function isDirNode(node: FSTreeNode): node is DirNode {
  return node.kind === 'dir';
}

/**
 * Check if a node is a symlink.
 */
export function isSymlinkNode(node: FSTreeNode): node is SymlinkNode {
  return node.kind === 'symlink';
}
