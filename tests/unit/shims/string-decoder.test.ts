import { describe, it, expect } from 'vitest';
import { StringDecoder } from '../../../src/shims/string-decoder.js';

describe('StringDecoder', () => {
  it('should decode simple utf8', () => {
    const decoder = new StringDecoder('utf8');
    const result = decoder.write(new Uint8Array([72, 101, 108, 108, 111]));
    expect(result).toBe('Hello');
  });

  it('should decode with end', () => {
    const decoder = new StringDecoder('utf8');
    const result = decoder.end(new Uint8Array([72, 105]));
    expect(result).toBe('Hi');
  });

  it('should handle empty end', () => {
    const decoder = new StringDecoder();
    const result = decoder.end();
    expect(result).toBe('');
  });

  it('should handle multi-byte utf8 across writes', () => {
    const decoder = new StringDecoder('utf8');
    // 'é' is 0xC3 0xA9 in UTF-8
    const bytes = new Uint8Array([0xC3, 0xA9]);
    const result = decoder.write(bytes);
    expect(result).toBe('é');
  });

  it('should default to utf8 encoding', () => {
    const decoder = new StringDecoder();
    const result = decoder.write(new Uint8Array([65, 66, 67]));
    expect(result).toBe('ABC');
  });

  it('should handle end(buf) combining buffers', () => {
    const decoder = new StringDecoder('utf8');
    const result = decoder.end(new Uint8Array([65, 66]));
    expect(result).toBe('AB');
  });

  it('should handle non-utf8 encoding', () => {
    const decoder = new StringDecoder('ascii');
    const result = decoder.write(new Uint8Array([72, 101, 108, 108, 111]));
    expect(result).toBe('Hello');
  });

  it('should return empty string when decode throws', () => {
    const decoder = new StringDecoder('utf8');
    // Mock the internal TextDecoder to throw
    const origDecode = (decoder as any).decoder.decode;
    (decoder as any).decoder.decode = () => { throw new Error('decode failure'); };
    const result = decoder.write(new Uint8Array([65]));
    expect(result).toBe('');
    // Restore
    (decoder as any).decoder.decode = origDecode;
  });
});
