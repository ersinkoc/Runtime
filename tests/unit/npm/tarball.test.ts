import { describe, it, expect } from 'vitest';
import { parseTar, decompressGzip } from '../../../src/npm/tarball.js';

describe('tarball', () => {
  describe('parseTar', () => {
    it('should parse empty tar', () => {
      // Empty tar is two 512-byte zero blocks
      const buffer = new ArrayBuffer(1024);
      const entries = parseTar(buffer);
      expect(entries).toEqual([]);
    });

    it('should parse tar with file entry', () => {
      // Create a minimal USTAR tar with one file
      const buffer = new ArrayBuffer(2048);
      const view = new Uint8Array(buffer);

      // File name: "test.txt"
      const name = 'package/test.txt';
      for (let i = 0; i < name.length; i++) {
        view[i] = name.charCodeAt(i);
      }

      // File mode: "0000644\0"
      const mode = '0000644\0';
      for (let i = 0; i < mode.length; i++) {
        view[100 + i] = mode.charCodeAt(i);
      }

      // File size: "0000000005\0\0" (5 bytes)
      const size = '0000000005\0\0';
      for (let i = 0; i < size.length; i++) {
        view[124 + i] = size.charCodeAt(i);
      }

      // Type flag: '0' (regular file)
      view[156] = 48; // '0'

      // File data starting at offset 512
      const data = 'hello';
      for (let i = 0; i < data.length; i++) {
        view[512 + i] = data.charCodeAt(i);
      }

      const entries = parseTar(buffer);
      expect(entries.length).toBe(1);
      expect(entries[0]!.name).toBe('/test.txt');
      expect(entries[0]!.type).toBe('file');
      expect(entries[0]!.size).toBe(5);
      expect(new TextDecoder().decode(entries[0]!.data)).toBe('hello');
    });

    it('should handle directory entries', () => {
      const buffer = new ArrayBuffer(1024);
      const view = new Uint8Array(buffer);

      const name = 'package/src/';
      for (let i = 0; i < name.length; i++) {
        view[i] = name.charCodeAt(i);
      }

      const mode = '0000755\0';
      for (let i = 0; i < mode.length; i++) {
        view[100 + i] = mode.charCodeAt(i);
      }

      const size = '0000000000\0\0';
      for (let i = 0; i < size.length; i++) {
        view[124 + i] = size.charCodeAt(i);
      }

      // Type flag: '5' (directory)
      view[156] = 53; // '5'

      const entries = parseTar(buffer);
      expect(entries.length).toBe(1);
      expect(entries[0]!.type).toBe('directory');
    });

    it('should handle symlink entries', () => {
      const buffer = new ArrayBuffer(1024);
      const view = new Uint8Array(buffer);

      const name = 'package/link.txt';
      for (let i = 0; i < name.length; i++) {
        view[i] = name.charCodeAt(i);
      }

      const mode = '0000644\0';
      for (let i = 0; i < mode.length; i++) {
        view[100 + i] = mode.charCodeAt(i);
      }

      const size = '0000000000\0\0';
      for (let i = 0; i < size.length; i++) {
        view[124 + i] = size.charCodeAt(i);
      }

      // Type flag: '2' (symlink)
      view[156] = 50;

      // Linkname at offset 157
      const linkname = 'target.txt';
      for (let i = 0; i < linkname.length; i++) {
        view[157 + i] = linkname.charCodeAt(i);
      }

      const entries = parseTar(buffer);
      expect(entries.length).toBe(1);
      expect(entries[0]!.type).toBe('symlink');
      expect(entries[0]!.linkname).toBe('target.txt');
    });

    it('should handle USTAR prefix', () => {
      const buffer = new ArrayBuffer(2048);
      const view = new Uint8Array(buffer);

      // Short name
      const name = 'file.js';
      for (let i = 0; i < name.length; i++) {
        view[i] = name.charCodeAt(i);
      }

      const mode = '0000644\0';
      for (let i = 0; i < mode.length; i++) {
        view[100 + i] = mode.charCodeAt(i);
      }

      const size = '0000000003\0\0';
      for (let i = 0; i < size.length; i++) {
        view[124 + i] = size.charCodeAt(i);
      }

      view[156] = 48; // '0' file

      // USTAR prefix at offset 345
      const prefix = 'package/src';
      for (let i = 0; i < prefix.length; i++) {
        view[345 + i] = prefix.charCodeAt(i);
      }

      // File data
      view[512] = 65; view[513] = 66; view[514] = 67; // "ABC"

      const entries = parseTar(buffer);
      expect(entries.length).toBe(1);
      expect(entries[0]!.name).toBe('/src/file.js');
    });
  });

  describe('extractTgz', () => {
    it('should extract files from tgz', async () => {
      // Create a minimal tar
      const tarBuffer = new ArrayBuffer(2048);
      const view = new Uint8Array(tarBuffer);

      const name = 'package/index.js';
      for (let i = 0; i < name.length; i++) {
        view[i] = name.charCodeAt(i);
      }

      const mode = '0000644\0';
      for (let i = 0; i < mode.length; i++) {
        view[100 + i] = mode.charCodeAt(i);
      }

      const size = '0000000005\0\0';
      for (let i = 0; i < size.length; i++) {
        view[124 + i] = size.charCodeAt(i);
      }

      view[156] = 48; // '0' file
      const data = 'hello';
      for (let i = 0; i < data.length; i++) {
        view[512 + i] = data.charCodeAt(i);
      }

      // Gzip the tar
      const cs = new CompressionStream('gzip');
      const writer = cs.writable.getWriter();
      writer.write(new Uint8Array(tarBuffer));
      writer.close();
      const compressed = await new Response(cs.readable).arrayBuffer();

      const { extractTgz } = await import('../../../src/npm/tarball.js');
      const files = await extractTgz(compressed);
      expect(files.has('/index.js')).toBe(true);
      expect(new TextDecoder().decode(files.get('/index.js')!)).toBe('hello');
    });
  });

  describe('decompressGzip', () => {
    it('should decompress gzipped data', async () => {
      // Create gzip data using CompressionStream
      const input = new TextEncoder().encode('Hello World');
      const cs = new CompressionStream('gzip');
      const writer = cs.writable.getWriter();
      writer.write(input);
      writer.close();
      const compressed = await new Response(cs.readable).arrayBuffer();

      const decompressed = await decompressGzip(compressed);
      const text = new TextDecoder().decode(decompressed);
      expect(text).toBe('Hello World');
    });
  });

  describe('parseTar edge cases', () => {
    it('should parse directory entries', () => {
      const buffer = new ArrayBuffer(2048);
      const view = new Uint8Array(buffer);

      const name = 'package/src/';
      for (let i = 0; i < name.length; i++) view[i] = name.charCodeAt(i);

      const mode = '0000755\0';
      for (let i = 0; i < mode.length; i++) view[100 + i] = mode.charCodeAt(i);

      const size = '00000000000\0';
      for (let i = 0; i < size.length; i++) view[124 + i] = size.charCodeAt(i);

      view[156] = 53; // '5' = directory

      const entries = parseTar(buffer);
      expect(entries.length).toBe(1);
      expect(entries[0]!.type).toBe('directory');
      expect(entries[0]!.name).toBe('/src/');
    });

    it('should parse symlink entries', () => {
      const buffer = new ArrayBuffer(2048);
      const view = new Uint8Array(buffer);

      const name = 'package/link';
      for (let i = 0; i < name.length; i++) view[i] = name.charCodeAt(i);

      const mode = '0000777\0';
      for (let i = 0; i < mode.length; i++) view[100 + i] = mode.charCodeAt(i);

      const size = '00000000000\0';
      for (let i = 0; i < size.length; i++) view[124 + i] = size.charCodeAt(i);

      view[156] = 50; // '2' = symlink

      const target = './target.txt';
      for (let i = 0; i < target.length; i++) view[157 + i] = target.charCodeAt(i);

      const entries = parseTar(buffer);
      expect(entries.length).toBe(1);
      expect(entries[0]!.type).toBe('symlink');
      expect(entries[0]!.linkname).toBe('./target.txt');
    });

    it('should parse entry with USTAR prefix', () => {
      const buffer = new ArrayBuffer(2048);
      const view = new Uint8Array(buffer);

      const name = 'file.js';
      for (let i = 0; i < name.length; i++) view[i] = name.charCodeAt(i);

      const mode = '0000644\0';
      for (let i = 0; i < mode.length; i++) view[100 + i] = mode.charCodeAt(i);

      const size = '0000000003\0\0';
      for (let i = 0; i < size.length; i++) view[124 + i] = size.charCodeAt(i);

      view[156] = 48; // '0' = file

      // USTAR prefix at offset 345
      const prefix = 'package/deep/dir';
      for (let i = 0; i < prefix.length; i++) view[345 + i] = prefix.charCodeAt(i);

      view[512] = 65; view[513] = 66; view[514] = 67; // "ABC"

      const entries = parseTar(buffer);
      expect(entries.length).toBe(1);
      // prefix/name = "package/deep/dir/file.js" → stripped to "deep/dir/file.js"
      expect(entries[0]!.name).toBe('/deep/dir/file.js');
    });

    it('should use default mode when mode is empty', () => {
      const buffer = new ArrayBuffer(2048);
      const view = new Uint8Array(buffer);

      const name = 'package/nomode.txt';
      for (let i = 0; i < name.length; i++) view[i] = name.charCodeAt(i);
      // Leave mode field empty (all zeros) — should default to 0o644

      const size = '0000000001\0\0';
      for (let i = 0; i < size.length; i++) view[124 + i] = size.charCodeAt(i);

      view[156] = 48;
      view[512] = 65;

      const entries = parseTar(buffer);
      expect(entries[0]!.mode).toBe(0o644);
    });

    it('should handle name already starting with /', () => {
      const buffer = new ArrayBuffer(2048);
      const view = new Uint8Array(buffer);

      // Name starts with / (no package/ prefix to strip)
      const name = '/absolute/file.txt';
      for (let i = 0; i < name.length; i++) view[i] = name.charCodeAt(i);

      const mode = '0000644\0';
      for (let i = 0; i < mode.length; i++) view[100 + i] = mode.charCodeAt(i);

      const size = '0000000002\0\0';
      for (let i = 0; i < size.length; i++) view[124 + i] = size.charCodeAt(i);

      view[156] = 48;
      view[512] = 65; view[513] = 66;

      const entries = parseTar(buffer);
      expect(entries[0]!.name).toBe('/absolute/file.txt');
    });

    it('should stop on empty name in header', () => {
      const buffer = new ArrayBuffer(2048);
      const view = new Uint8Array(buffer);

      // Leave name all zeros but set non-zero byte elsewhere in header
      view[100] = 49; // non-zero byte in mode field
      // Name field is all zeros, so readString returns empty string → break

      const entries = parseTar(buffer);
      expect(entries.length).toBe(0);
    });

    it('should handle type flag of 0 (NUL byte) defaulting to file', () => {
      const buffer = new ArrayBuffer(2048);
      const view = new Uint8Array(buffer);

      const name = 'package/nul-type.txt';
      for (let i = 0; i < name.length; i++) view[i] = name.charCodeAt(i);

      const mode = '0000644\0';
      for (let i = 0; i < mode.length; i++) view[100 + i] = mode.charCodeAt(i);

      const size = '0000000001\0\0';
      for (let i = 0; i < size.length; i++) view[124 + i] = size.charCodeAt(i);

      // Leave view[156] as 0 (NUL) — should default to '0' (file) via || 48
      view[512] = 65;

      const entries = parseTar(buffer);
      expect(entries[0]!.type).toBe('file');
    });
  });
});
