/**
 * Binary snapshot serialization/deserialization for VFS transfer.
 * @module vfs/snapshot
 */

import type { DirNode, FSTreeNode } from '../types.js';
import { encodeUTF8, decodeUTF8 } from '../utils/encoding.js';
import { createFileNode, createDirNode, createSymlinkNode } from './fs-node.js';

/**
 * Kind byte values in snapshot format.
 */
const KIND_FILE = 0;
const KIND_DIR = 1;
const KIND_SYMLINK = 2;

/**
 * Serialize a VFS tree to a transferable binary format.
 *
 * Format:
 * ```
 * [entry_count: uint32]
 * For each entry:
 *   [path_length: uint16] [path_bytes: utf8]
 *   [kind: uint8] (0=file, 1=dir, 2=symlink)
 *   [mode: uint16]
 *   If file: [content_length: uint32] [content_bytes]
 *   If symlink: [target_length: uint16] [target_bytes]
 * ```
 *
 * @example
 * ```typescript
 * const data = serializeSnapshot(rootNode);
 * // Transfer via postMessage (zero-copy Uint8Array)
 * ```
 */
export function serializeSnapshot(root: DirNode): Uint8Array {
  const entries: Array<{ path: string; node: FSTreeNode }> = [];
  collectEntries(root, '', entries);

  // Calculate total size
  let totalSize = 4; // entry_count
  for (const entry of entries) {
    const pathBytes = encodeUTF8(entry.path);
    totalSize += 2 + pathBytes.byteLength; // path_length + path_bytes
    totalSize += 1; // kind
    totalSize += 2; // mode
    if (entry.node.kind === 'file') {
      totalSize += 4 + entry.node.content.byteLength; // content_length + content_bytes
    } else if (entry.node.kind === 'symlink') {
      const targetBytes = encodeUTF8(entry.node.target);
      totalSize += 2 + targetBytes.byteLength; // target_length + target_bytes
    }
  }

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let offset = 0;

  // Entry count
  view.setUint32(offset, entries.length, true);
  offset += 4;

  for (const entry of entries) {
    const pathBytes = encodeUTF8(entry.path);

    // Path
    view.setUint16(offset, pathBytes.byteLength, true);
    offset += 2;
    bytes.set(pathBytes, offset);
    offset += pathBytes.byteLength;

    // Kind
    const kindByte = entry.node.kind === 'file' ? KIND_FILE : entry.node.kind === 'dir' ? KIND_DIR : KIND_SYMLINK;
    view.setUint8(offset, kindByte);
    offset += 1;

    // Mode
    view.setUint16(offset, entry.node.meta.mode, true);
    offset += 2;

    // Content/Target
    if (entry.node.kind === 'file') {
      view.setUint32(offset, entry.node.content.byteLength, true);
      offset += 4;
      bytes.set(entry.node.content, offset);
      offset += entry.node.content.byteLength;
    } else if (entry.node.kind === 'symlink') {
      const targetBytes = encodeUTF8(entry.node.target);
      view.setUint16(offset, targetBytes.byteLength, true);
      offset += 2;
      bytes.set(targetBytes, offset);
      offset += targetBytes.byteLength;
    }
  }

  return bytes;
}

/**
 * Deserialize a binary snapshot back into a VFS tree.
 *
 * @example
 * ```typescript
 * const root = deserializeSnapshot(data);
 * ```
 */
export function deserializeSnapshot(data: Uint8Array): DirNode {
  const root = createDirNode();
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;

  const entryCount = view.getUint32(offset, true);
  offset += 4;

  for (let i = 0; i < entryCount; i++) {
    // Path
    const pathLength = view.getUint16(offset, true);
    offset += 2;
    const pathStr = decodeUTF8(data.subarray(offset, offset + pathLength));
    offset += pathLength;

    // Kind
    const kindByte = view.getUint8(offset);
    offset += 1;

    // Mode
    const mode = view.getUint16(offset, true);
    offset += 2;

    if (kindByte === KIND_FILE) {
      const contentLength = view.getUint32(offset, true);
      offset += 4;
      const content = data.slice(offset, offset + contentLength);
      offset += contentLength;

      insertNode(root, pathStr, createFileNode(content, mode));
    } else if (kindByte === KIND_DIR) {
      insertNode(root, pathStr, createDirNode(mode));
    } else if (kindByte === KIND_SYMLINK) {
      const targetLength = view.getUint16(offset, true);
      offset += 2;
      const target = decodeUTF8(data.subarray(offset, offset + targetLength));
      offset += targetLength;

      insertNode(root, pathStr, createSymlinkNode(target, mode));
    }
  }

  return root;
}

/**
 * Recursively collect all entries from the tree.
 */
function collectEntries(node: DirNode, basePath: string, out: Array<{ path: string; node: FSTreeNode }>): void {
  for (const [name, child] of node.children) {
    const fullPath = basePath ? basePath + '/' + name : '/' + name;
    out.push({ path: fullPath, node: child });
    if (child.kind === 'dir') {
      collectEntries(child, fullPath, out);
    }
  }
}

/**
 * Insert a node at a path in the tree, creating intermediate directories as needed.
 */
function insertNode(root: DirNode, path: string, node: FSTreeNode): void {
  const parts = path.split('/').filter(Boolean);
  let current = root;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    let child = current.children.get(part);
    if (!child || child.kind !== 'dir') {
      child = createDirNode();
      current.children.set(part, child);
    }
    current = child;
  }

  const lastName = parts[parts.length - 1];
  if (lastName) {
    current.children.set(lastName, node);
  }
}
