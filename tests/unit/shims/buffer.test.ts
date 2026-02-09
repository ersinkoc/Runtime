import { describe, it, expect } from 'vitest';
import { Buffer } from '../../../src/shims/buffer.js';

describe('Buffer', () => {
  describe('from', () => {
    it('should create from string', () => {
      const buf = Buffer.from('hello');
      expect(buf.toString()).toBe('hello');
    });

    it('should create from hex string', () => {
      const buf = Buffer.from('48656c6c6f', 'hex');
      expect(buf.toString('utf8')).toBe('Hello');
    });

    it('should create from base64', () => {
      const buf = Buffer.from('SGVsbG8=', 'base64');
      expect(buf.toString()).toBe('Hello');
    });

    it('should create from array', () => {
      const buf = Buffer.from([72, 101, 108, 108, 111]);
      expect(buf.toString()).toBe('Hello');
    });

    it('should create from Uint8Array', () => {
      const buf = Buffer.from(new Uint8Array([1, 2, 3]));
      expect(buf.length).toBe(3);
    });

    it('should create from ArrayBuffer', () => {
      const ab = new ArrayBuffer(3);
      new Uint8Array(ab).set([1, 2, 3]);
      const buf = Buffer.from(ab);
      expect(buf.length).toBe(3);
    });

    it('should create from ascii', () => {
      const buf = Buffer.from('Hello', 'ascii');
      expect(buf.toString('ascii')).toBe('Hello');
    });

    it('should fallback to utf8 for unknown encoding', () => {
      const buf = Buffer.from('test', 'unknown' as any);
      expect(buf.toString()).toBe('test');
    });
  });

  describe('alloc', () => {
    it('should allocate zero-filled buffer', () => {
      const buf = Buffer.alloc(5);
      expect(buf.length).toBe(5);
      expect(buf[0]).toBe(0);
    });

    it('should fill with number', () => {
      const buf = Buffer.alloc(3, 0xFF);
      expect(buf[0]).toBe(0xFF);
      expect(buf[2]).toBe(0xFF);
    });

    it('should fill with string', () => {
      const buf = Buffer.alloc(5, 'ab');
      expect(buf.toString()).toBe('ababa');
    });
  });

  describe('allocUnsafe', () => {
    it('should allocate buffer of correct size', () => {
      const buf = Buffer.allocUnsafe(10);
      expect(buf.length).toBe(10);
    });
  });

  describe('concat', () => {
    it('should concatenate buffers', () => {
      const a = Buffer.from('Hello');
      const b = Buffer.from(' ');
      const c = Buffer.from('World');
      const result = Buffer.concat([a, b, c]);
      expect(result.toString()).toBe('Hello World');
    });

    it('should respect totalLength', () => {
      const result = Buffer.concat([Buffer.from('Hello'), Buffer.from('World')], 5);
      expect(result.toString()).toBe('Hello');
    });
  });

  describe('isBuffer', () => {
    it('should detect buffers', () => {
      expect(Buffer.isBuffer(Buffer.from('test'))).toBe(true);
      expect(Buffer.isBuffer(new Uint8Array(5))).toBe(false);
      expect(Buffer.isBuffer('string')).toBe(false);
    });
  });

  describe('isEncoding', () => {
    it('should detect supported encodings', () => {
      expect(Buffer.isEncoding('utf8')).toBe(true);
      expect(Buffer.isEncoding('hex')).toBe(true);
      expect(Buffer.isEncoding('base64')).toBe(true);
      expect(Buffer.isEncoding('unknown')).toBe(false);
    });
  });

  describe('byteLength', () => {
    it('should return byte length of string', () => {
      expect(Buffer.byteLength('Hello')).toBe(5);
      expect(Buffer.byteLength('é')).toBe(2);
    });
  });

  describe('toString', () => {
    it('should convert to hex', () => {
      const buf = Buffer.from([0xDE, 0xAD, 0xBE, 0xEF]);
      expect(buf.toString('hex')).toBe('deadbeef');
    });

    it('should convert to base64', () => {
      const buf = Buffer.from('Hello');
      expect(buf.toString('base64')).toBe('SGVsbG8=');
    });

    it('should support start and end', () => {
      const buf = Buffer.from('Hello World');
      expect(buf.toString('utf8', 0, 5)).toBe('Hello');
    });

    it('should use default encoding for unknown', () => {
      const buf = Buffer.from('test');
      // Unknown encoding falls through to default UTF-8 decode
      expect(buf.toString('unknown' as any)).toBe('test');
    });
  });

  describe('compare', () => {
    it('should compare buffers', () => {
      expect(Buffer.from('abc').compare(Buffer.from('abc'))).toBe(0);
      expect(Buffer.from('abc').compare(Buffer.from('abd'))).toBe(-1);
      expect(Buffer.from('abd').compare(Buffer.from('abc'))).toBe(1);
    });

    it('should compare different lengths', () => {
      expect(Buffer.from('ab').compare(Buffer.from('abc'))).toBe(-1);
    });
  });

  describe('equals', () => {
    it('should check equality', () => {
      expect(Buffer.from('test').equals(Buffer.from('test'))).toBe(true);
      expect(Buffer.from('test').equals(Buffer.from('nope'))).toBe(false);
    });
  });

  describe('indexOf', () => {
    it('should find byte', () => {
      expect(Buffer.from([1, 2, 3, 4]).indexOf(3)).toBe(2);
    });

    it('should find string', () => {
      expect(Buffer.from('Hello World').indexOf('World')).toBe(6);
    });

    it('should return -1 when not found', () => {
      expect(Buffer.from('Hello').indexOf('xyz')).toBe(-1);
    });

    it('should return -1 for byte not found', () => {
      expect(Buffer.from([1, 2, 3]).indexOf(99)).toBe(-1);
    });
  });

  describe('includes', () => {
    it('should check containment', () => {
      expect(Buffer.from('Hello World').includes('World')).toBe(true);
      expect(Buffer.from('Hello').includes('xyz')).toBe(false);
    });
  });

  describe('slice', () => {
    it('should return a Buffer', () => {
      const buf = Buffer.from('Hello');
      const sliced = buf.slice(0, 2);
      expect(Buffer.isBuffer(sliced)).toBe(true);
      expect(sliced.toString()).toBe('He');
    });
  });

  describe('read/write integers', () => {
    it('should read/write UInt8', () => {
      const buf = Buffer.alloc(1);
      buf.writeUInt8(42);
      expect(buf.readUInt8()).toBe(42);
    });

    it('should read/write UInt16LE', () => {
      const buf = Buffer.alloc(2);
      buf.writeUInt16LE(0x0102);
      expect(buf.readUInt16LE()).toBe(0x0102);
    });

    it('should read/write UInt32BE', () => {
      const buf = Buffer.alloc(4);
      buf.writeUInt32BE(0x01020304);
      expect(buf.readUInt32BE()).toBe(0x01020304);
    });

    it('should read signed integers', () => {
      const buf = Buffer.from([0xFF]);
      expect(buf.readInt8()).toBe(-1);
    });

    it('should read/write UInt16BE', () => {
      const buf = Buffer.alloc(2);
      buf.writeUInt16BE(0x0102);
      expect(buf.readUInt16BE()).toBe(0x0102);
    });

    it('should read/write UInt32LE', () => {
      const buf = Buffer.alloc(4);
      buf.writeUInt32LE(0x04030201);
      expect(buf.readUInt32LE()).toBe(0x04030201);
    });

    it('should write at specific offset', () => {
      const buf = Buffer.alloc(6);
      buf.writeUInt16LE(0xAABB, 2);
      expect(buf.readUInt16LE(2)).toBe(0xAABB);
    });

    it('should read/write Int32LE', () => {
      const buf = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]);
      expect(buf.readInt32LE()).toBe(-1);
      const buf2 = Buffer.from([1, 0, 0, 0]);
      expect(buf2.readInt32LE()).toBe(1);
    });

    it('should read/write Int32BE', () => {
      const buf = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]);
      expect(buf.readInt32BE()).toBe(-1);
      const buf2 = Buffer.from([0, 0, 0, 1]);
      expect(buf2.readInt32BE()).toBe(1);
    });

    it('should read Int16LE signed', () => {
      const buf = Buffer.from([0xFF, 0xFF]);
      expect(buf.readInt16LE()).toBe(-1);
    });

    it('should read Int16BE signed', () => {
      const buf = Buffer.from([0xFF, 0xFF]);
      expect(buf.readInt16BE()).toBe(-1);
    });
  });

  describe('copy', () => {
    it('should copy to target', () => {
      const src = Buffer.from('Hello');
      const dst = Buffer.alloc(5);
      src.copy(dst);
      expect(dst.toString()).toBe('Hello');
    });
  });

  describe('write', () => {
    it('should write string to buffer', () => {
      const buf = Buffer.alloc(5);
      buf.write('Hi');
      expect(buf.toString('utf8', 0, 2)).toBe('Hi');
    });
  });

  describe('toJSON', () => {
    it('should return JSON representation', () => {
      const buf = Buffer.from([1, 2, 3]);
      const json = buf.toJSON();
      expect(json.type).toBe('Buffer');
      expect(json.data).toEqual([1, 2, 3]);
    });
  });

  describe('subarray', () => {
    it('should return a Buffer', () => {
      const buf = Buffer.from('Hello');
      const sub = buf.subarray(0, 2);
      expect(Buffer.isBuffer(sub)).toBe(true);
    });
  });

  describe('from with mapfn', () => {
    it('should create from arrayLike with mapping function', () => {
      // Use an array-like object (not Array) to avoid the Array.isArray branch
      const arrayLike = { length: 3, 0: 1, 1: 2, 2: 3 };
      const buf = Buffer.from(arrayLike, (x: number) => x * 2);
      expect(buf[0]).toBe(2);
      expect(buf[1]).toBe(4);
      expect(buf[2]).toBe(6);
    });
  });

  describe('from with iterable', () => {
    it('should create from iterable', () => {
      const iterable = {
        *[Symbol.iterator]() {
          yield 65;
          yield 66;
          yield 67;
        },
      };
      const buf = Buffer.from(iterable as any);
      expect(buf.toString()).toBe('ABC');
    });

    it('should throw for invalid input', () => {
      expect(() => Buffer.from(42 as any)).toThrow(TypeError);
    });
  });

  describe('readInt signed branches', () => {
    it('should read negative Int8', () => {
      const buf = Buffer.alloc(1);
      buf[0] = 200; // > 127, so negative in signed
      expect(buf.readInt8(0)).toBe(200 - 256);
    });

    it('should read positive Int8', () => {
      const buf = Buffer.alloc(1);
      buf[0] = 100;
      expect(buf.readInt8(0)).toBe(100);
    });

    it('should read negative Int16LE', () => {
      const buf = Buffer.alloc(2);
      // 0xFFFF = -1 in signed 16-bit
      buf[0] = 0xFF;
      buf[1] = 0xFF;
      expect(buf.readInt16LE(0)).toBe(-1);
    });

    it('should read positive Int16LE', () => {
      const buf = Buffer.alloc(2);
      buf[0] = 0x01;
      buf[1] = 0x00;
      expect(buf.readInt16LE(0)).toBe(1);
    });

    it('should read negative Int16BE', () => {
      const buf = Buffer.alloc(2);
      buf[0] = 0xFF;
      buf[1] = 0xFE;
      expect(buf.readInt16BE(0)).toBe(-2);
    });

    it('should read positive Int16BE', () => {
      const buf = Buffer.alloc(2);
      buf[0] = 0x00;
      buf[1] = 0x01;
      expect(buf.readInt16BE(0)).toBe(1);
    });
  });

  describe('isBuffer', () => {
    it('should return true for Buffer', () => {
      expect(Buffer.isBuffer(Buffer.from('hello'))).toBe(true);
    });

    it('should return false for non-Buffer', () => {
      expect(Buffer.isBuffer(new Uint8Array(1))).toBe(false);
      expect(Buffer.isBuffer('hello')).toBe(false);
    });
  });

  describe('compare branch coverage', () => {
    it('should return 1 when buffer is longer with same prefix', () => {
      const a = Buffer.from('hello');
      const b = Buffer.from('hell');
      expect(a.compare(b)).toBe(1);
    });

    it('should return -1 when buffer is shorter with same prefix', () => {
      const a = Buffer.from('hel');
      const b = Buffer.from('hell');
      expect(a.compare(b)).toBe(-1);
    });
  });

  describe('indexOf with Buffer value', () => {
    it('should find Buffer needle', () => {
      const buf = Buffer.from('hello world');
      const needle = Buffer.from('world');
      expect(buf.indexOf(needle)).toBe(6);
    });
  });
});
