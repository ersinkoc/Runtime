import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMetadata,
  createFileNode,
  createDirNode,
  createSymlinkNode,
  isFileNode,
  isDirNode,
  isSymlinkNode,
  resetInodeCounter,
} from '../../../src/vfs/fs-node.js';

describe('fs-node', () => {
  beforeEach(() => {
    resetInodeCounter();
  });

  describe('createMetadata', () => {
    it('should create metadata with correct fields', () => {
      const meta = createMetadata(0o644, 100);
      expect(meta.mode).toBe(0o644);
      expect(meta.size).toBe(100);
      expect(meta.atimeMs).toBeGreaterThan(0);
      expect(meta.mtimeMs).toBeGreaterThan(0);
      expect(meta.ctimeMs).toBeGreaterThan(0);
      expect(meta.birthtimeMs).toBeGreaterThan(0);
      expect(meta.ino).toBe(1);
    });

    it('should auto-increment inodes', () => {
      const m1 = createMetadata(0o644, 0);
      const m2 = createMetadata(0o755, 0);
      expect(m2.ino).toBe(m1.ino + 1);
    });
  });

  describe('createFileNode', () => {
    it('should create a file node', () => {
      const content = new Uint8Array([1, 2, 3]);
      const node = createFileNode(content);
      expect(node.kind).toBe('file');
      expect(node.content).toBe(content);
      expect(node.meta.mode).toBe(0o644);
      expect(node.meta.size).toBe(3);
    });

    it('should accept custom mode', () => {
      const node = createFileNode(new Uint8Array([]), 0o755);
      expect(node.meta.mode).toBe(0o755);
    });
  });

  describe('createDirNode', () => {
    it('should create a directory node', () => {
      const node = createDirNode();
      expect(node.kind).toBe('dir');
      expect(node.children).toBeInstanceOf(Map);
      expect(node.children.size).toBe(0);
      expect(node.meta.mode).toBe(0o755);
    });

    it('should accept custom mode', () => {
      const node = createDirNode(0o700);
      expect(node.meta.mode).toBe(0o700);
    });
  });

  describe('createSymlinkNode', () => {
    it('should create a symlink node', () => {
      const node = createSymlinkNode('/target');
      expect(node.kind).toBe('symlink');
      expect(node.target).toBe('/target');
      expect(node.meta.mode).toBe(0o777);
      expect(node.meta.size).toBe(7); // '/target'.length
    });
  });

  describe('type guards', () => {
    it('should identify file nodes', () => {
      const file = createFileNode(new Uint8Array([]));
      expect(isFileNode(file)).toBe(true);
      expect(isDirNode(file)).toBe(false);
      expect(isSymlinkNode(file)).toBe(false);
    });

    it('should identify dir nodes', () => {
      const dir = createDirNode();
      expect(isFileNode(dir)).toBe(false);
      expect(isDirNode(dir)).toBe(true);
      expect(isSymlinkNode(dir)).toBe(false);
    });

    it('should identify symlink nodes', () => {
      const sym = createSymlinkNode('/target');
      expect(isFileNode(sym)).toBe(false);
      expect(isDirNode(sym)).toBe(false);
      expect(isSymlinkNode(sym)).toBe(true);
    });
  });
});
