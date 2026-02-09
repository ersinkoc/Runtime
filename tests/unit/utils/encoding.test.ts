import { describe, it, expect } from 'vitest';
import { encodeUTF8, decodeUTF8 } from '../../../src/utils/encoding.js';

describe('encodeUTF8', () => {
  it('should encode ASCII string', () => {
    const result = encodeUTF8('hello');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(Array.from(result)).toEqual([104, 101, 108, 108, 111]);
  });

  it('should encode empty string', () => {
    const result = encodeUTF8('');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(0);
  });

  it('should encode unicode string', () => {
    const result = encodeUTF8('é');
    expect(result.length).toBe(2); // é is 2 bytes in UTF-8
  });
});

describe('decodeUTF8', () => {
  it('should decode ASCII bytes', () => {
    const bytes = new Uint8Array([104, 101, 108, 108, 111]);
    expect(decodeUTF8(bytes)).toBe('hello');
  });

  it('should decode empty array', () => {
    expect(decodeUTF8(new Uint8Array([]))).toBe('');
  });

  it('should roundtrip encode/decode', () => {
    const original = 'Hello, World! 🌍';
    const encoded = encodeUTF8(original);
    const decoded = decodeUTF8(encoded);
    expect(decoded).toBe(original);
  });
});
