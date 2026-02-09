import { describe, it, expect, beforeEach } from 'vitest';
import { serializeSnapshot, deserializeSnapshot } from '../../../src/vfs/snapshot.js';
import { createDirNode, createFileNode, createSymlinkNode, resetInodeCounter } from '../../../src/vfs/fs-node.js';
import { encodeUTF8 } from '../../../src/utils/encoding.js';

describe('snapshot', () => {
  beforeEach(() => {
    resetInodeCounter();
  });

  describe('serializeSnapshot / deserializeSnapshot', () => {
    it('should roundtrip an empty root', () => {
      const root = createDirNode();
      const data = serializeSnapshot(root);
      const restored = deserializeSnapshot(data);
      expect(restored.children.size).toBe(0);
    });

    it('should roundtrip files', () => {
      const root = createDirNode();
      root.children.set('hello.txt', createFileNode(encodeUTF8('world')));
      root.children.set('binary', createFileNode(new Uint8Array([0, 255, 128])));

      const data = serializeSnapshot(root);
      const restored = deserializeSnapshot(data);

      const hello = restored.children.get('hello.txt');
      expect(hello?.kind).toBe('file');
      if (hello?.kind === 'file') {
        expect(new TextDecoder().decode(hello.content)).toBe('world');
      }

      const binary = restored.children.get('binary');
      expect(binary?.kind).toBe('file');
      if (binary?.kind === 'file') {
        expect(Array.from(binary.content)).toEqual([0, 255, 128]);
      }
    });

    it('should roundtrip nested directories', () => {
      const root = createDirNode();
      const src = createDirNode();
      src.children.set('index.ts', createFileNode(encodeUTF8('code')));
      root.children.set('src', src);

      const data = serializeSnapshot(root);
      const restored = deserializeSnapshot(data);

      const restoredSrc = restored.children.get('src');
      expect(restoredSrc?.kind).toBe('dir');
      if (restoredSrc?.kind === 'dir') {
        const index = restoredSrc.children.get('index.ts');
        expect(index?.kind).toBe('file');
      }
    });

    it('should roundtrip symlinks', () => {
      const root = createDirNode();
      root.children.set('target.txt', createFileNode(encodeUTF8('data')));
      root.children.set('link', createSymlinkNode('/target.txt'));

      const data = serializeSnapshot(root);
      const restored = deserializeSnapshot(data);

      const link = restored.children.get('link');
      expect(link?.kind).toBe('symlink');
      if (link?.kind === 'symlink') {
        expect(link.target).toBe('/target.txt');
      }
    });

    it('should preserve file modes', () => {
      const root = createDirNode();
      root.children.set('exec', createFileNode(encodeUTF8('#!/bin/sh'), 0o755));

      const data = serializeSnapshot(root);
      const restored = deserializeSnapshot(data);

      const exec = restored.children.get('exec');
      expect(exec?.meta.mode).toBe(0o755);
    });

    it('should handle large files', () => {
      const root = createDirNode();
      const largeContent = new Uint8Array(100000);
      for (let i = 0; i < largeContent.length; i++) {
        largeContent[i] = i % 256;
      }
      root.children.set('large', createFileNode(largeContent));

      const data = serializeSnapshot(root);
      const restored = deserializeSnapshot(data);

      const large = restored.children.get('large');
      if (large?.kind === 'file') {
        expect(large.content.length).toBe(100000);
        expect(large.content[0]).toBe(0);
        expect(large.content[255]).toBe(255);
        expect(large.content[256]).toBe(0);
      }
    });

    it('should create intermediate directories when deserializing nested file without parent dirs', () => {
      // Craft raw binary snapshot with one file at /a/b/file.txt
      // but without explicit /a or /a/b dir entries
      const pathStr = '/a/b/file.txt';
      const content = new TextEncoder().encode('hello');
      const pathBytes = new TextEncoder().encode(pathStr);

      const totalSize = 4 + 2 + pathBytes.length + 1 + 2 + 4 + content.length;
      const buffer = new ArrayBuffer(totalSize);
      const view = new DataView(buffer);
      const bytes = new Uint8Array(buffer);
      let offset = 0;

      // Entry count: 1
      view.setUint32(offset, 1, true); offset += 4;

      // Path
      view.setUint16(offset, pathBytes.length, true); offset += 2;
      bytes.set(pathBytes, offset); offset += pathBytes.length;

      // Kind: file (0)
      view.setUint8(offset, 0); offset += 1;

      // Mode: 0o644 = 420
      view.setUint16(offset, 420, true); offset += 2;

      // Content length
      view.setUint32(offset, content.length, true); offset += 4;

      // Content
      bytes.set(content, offset);

      const root = deserializeSnapshot(bytes);
      // Should have auto-created intermediate dirs /a and /a/b
      const aNode = root.children.get('a');
      expect(aNode).toBeDefined();
      expect(aNode!.kind).toBe('dir');
      if (aNode!.kind === 'dir') {
        const bNode = aNode!.children.get('b');
        expect(bNode).toBeDefined();
        expect(bNode!.kind).toBe('dir');
        if (bNode!.kind === 'dir') {
          const file = bNode!.children.get('file.txt');
          expect(file).toBeDefined();
          expect(file!.kind).toBe('file');
        }
      }
    });
  });
});
