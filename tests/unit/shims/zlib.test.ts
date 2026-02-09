import { describe, it, expect } from 'vitest';
import zlibModule from '../../../src/shims/zlib.js';

describe('zlib shim', () => {
  describe('gzip / gunzip', () => {
    it('should compress and decompress', async () => {
      const input = new TextEncoder().encode('Hello, World!');
      const compressed = await zlibModule.gzip(input);
      expect(compressed).toBeDefined();
      expect(compressed!.length).toBeGreaterThan(0);
      const decompressed = await zlibModule.gunzip(compressed!);
      expect(new TextDecoder().decode(decompressed!)).toBe('Hello, World!');
    });
  });

  describe('deflate / inflate', () => {
    it('should compress and decompress', async () => {
      const input = new TextEncoder().encode('Test data for deflate');
      const compressed = await zlibModule.deflate(input);
      expect(compressed).toBeDefined();
      const decompressed = await zlibModule.inflate(compressed!);
      expect(new TextDecoder().decode(decompressed!)).toBe('Test data for deflate');
    });
  });

  describe('deflateRaw / inflateRaw', () => {
    it('should compress and decompress', async () => {
      const input = new TextEncoder().encode('Raw deflate data');
      const compressed = await zlibModule.deflateRaw(input);
      expect(compressed).toBeDefined();
      const decompressed = await zlibModule.inflateRaw(compressed!);
      expect(new TextDecoder().decode(decompressed!)).toBe('Raw deflate data');
    });
  });

  describe('gzip with string input', () => {
    it('should handle string input', async () => {
      const compressed = await zlibModule.gzip('Hello');
      expect(compressed).toBeDefined();
      const decompressed = await zlibModule.gunzip(compressed!);
      expect(new TextDecoder().decode(decompressed!)).toBe('Hello');
    });
  });

  describe('callback style', () => {
    it('should support callback for gzip', async () => {
      const result = await new Promise<Buffer>((resolve, reject) => {
        zlibModule.gzip('test', (err, result) => {
          if (err) reject(err);
          else resolve(result!);
        });
      });
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('brotli stubs', () => {
    it('should reject brotliCompress', async () => {
      await expect(zlibModule.brotliCompress('test')).rejects.toThrow('not supported');
    });

    it('should reject brotliDecompress', async () => {
      await expect(zlibModule.brotliDecompress(new Uint8Array(1))).rejects.toThrow('not supported');
    });
  });

  describe('createGzip / createGunzip', () => {
    it('should create compression objects', () => {
      expect(zlibModule.createGzip()).toBeDefined();
      expect(zlibModule.createGunzip()).toBeDefined();
      expect(zlibModule.createDeflate()).toBeDefined();
      expect(zlibModule.createInflate()).toBeDefined();
    });

    it('should create functional gzip/gunzip objects', async () => {
      const gz = zlibModule.createGzip();
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const compressed = await gz.compress(data);
      expect(compressed).toBeDefined();
      const guz = zlibModule.createGunzip();
      const decompressed = await guz.decompress(compressed!);
      expect(decompressed).toBeDefined();
    });

    it('should create functional deflate/inflate objects', async () => {
      const def = zlibModule.createDeflate();
      const data = new Uint8Array([10, 20, 30]);
      const compressed = await def.compress(data);
      expect(compressed).toBeDefined();
      const inf = zlibModule.createInflate();
      const decompressed = await inf.decompress(compressed!);
      expect(decompressed).toBeDefined();
    });
  });

  describe('callback error wrapping', () => {
    it('should wrap non-Error rejection in Error for callback', async () => {
      const OrigCS = globalThis.CompressionStream;
      globalThis.CompressionStream = function () { throw 'string error'; } as any;
      try {
        const result = await new Promise<Error | null>((resolve) => {
          zlibModule.gzip('test', (err) => resolve(err));
        });
        expect(result).toBeInstanceOf(Error);
        expect(result!.message).toBe('string error');
      } finally {
        globalThis.CompressionStream = OrigCS;
      }
    });
  });

  describe('brotli callback mode', () => {
    it('should call callback with error for brotliCompress', async () => {
      const result = await new Promise<{ err: Error | null }>((resolve) => {
        zlibModule.brotliCompress('test', (err) => {
          resolve({ err });
        });
      });
      expect(result.err).toBeInstanceOf(Error);
      expect(result.err!.message).toContain('not supported');
    });

    it('should call callback with error for brotliDecompress', async () => {
      const result = await new Promise<{ err: Error | null }>((resolve) => {
        zlibModule.brotliDecompress(new Uint8Array(1), (err) => {
          resolve({ err });
        });
      });
      expect(result.err).toBeInstanceOf(Error);
      expect(result.err!.message).toContain('not supported');
    });
  });
});
