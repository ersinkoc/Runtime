import { describe, it, expect } from 'vitest';
import { fnv1a } from '../../../src/utils/hash.js';

describe('fnv1a', () => {
  it('should return a number', () => {
    expect(typeof fnv1a('hello')).toBe('number');
  });

  it('should return consistent hash for same input', () => {
    expect(fnv1a('hello')).toBe(fnv1a('hello'));
    expect(fnv1a('world')).toBe(fnv1a('world'));
  });

  it('should return different hashes for different inputs', () => {
    expect(fnv1a('hello')).not.toBe(fnv1a('world'));
    expect(fnv1a('abc')).not.toBe(fnv1a('abd'));
  });

  it('should return unsigned 32-bit integer', () => {
    const hash = fnv1a('test');
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThanOrEqual(0xFFFFFFFF);
  });

  it('should handle empty string', () => {
    const hash = fnv1a('');
    expect(typeof hash).toBe('number');
    expect(hash).toBe(0x811c9dc5); // FNV offset basis for empty string
  });

  it('should handle unicode characters', () => {
    const hash1 = fnv1a('こんにちは');
    const hash2 = fnv1a('こんにちは');
    expect(hash1).toBe(hash2);
  });

  it('should handle long strings', () => {
    const longStr = 'a'.repeat(10000);
    const hash = fnv1a(longStr);
    expect(typeof hash).toBe('number');
    expect(hash).toBeGreaterThanOrEqual(0);
  });
});
