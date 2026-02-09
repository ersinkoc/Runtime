import { describe, it, expect } from 'vitest';
import querystringModule from '../../../src/shims/querystring.js';

const { parse, stringify, escape, unescape } = querystringModule;

describe('querystring shim', () => {
  describe('stringify', () => {
    it('should stringify simple object', () => {
      expect(stringify({ foo: 'bar', baz: 'qux' })).toBe('foo=bar&baz=qux');
    });

    it('should handle arrays', () => {
      expect(stringify({ a: ['1', '2'] as any })).toBe('a=1&a=2');
    });

    it('should handle custom separators', () => {
      expect(stringify({ a: '1', b: '2' }, ';', ':')).toBe('a:1;b:2');
    });

    it('should encode special characters', () => {
      const result = stringify({ key: 'hello world' });
      expect(result).toBe('key=hello%20world');
    });

    it('should handle null and undefined values', () => {
      const result = stringify({ a: null, b: undefined } as any);
      expect(result).toBe('a=&b=');
    });
  });

  describe('parse', () => {
    it('should parse simple query string', () => {
      expect(parse('foo=bar&baz=qux')).toEqual({ foo: 'bar', baz: 'qux' });
    });

    it('should handle duplicate keys as array', () => {
      expect(parse('a=1&a=2')).toEqual({ a: ['1', '2'] });
    });

    it('should handle three or more duplicate keys', () => {
      expect(parse('a=1&a=2&a=3')).toEqual({ a: ['1', '2', '3'] });
    });

    it('should handle custom separators', () => {
      expect(parse('a:1;b:2', ';', ':')).toEqual({ a: '1', b: '2' });
    });

    it('should handle empty string', () => {
      expect(parse('')).toEqual({});
    });

    it('should handle keys without values', () => {
      expect(parse('key')).toEqual({ key: '' });
    });

    it('should decode encoded characters', () => {
      expect(parse('key=hello%20world')).toEqual({ key: 'hello world' });
    });
  });

  describe('escape / unescape', () => {
    it('should escape', () => {
      expect(escape('hello world')).toBe('hello%20world');
    });

    it('should unescape', () => {
      expect(unescape('hello%20world')).toBe('hello world');
    });

    it('should unescape + as space', () => {
      expect(unescape('hello+world')).toBe('hello world');
    });
  });

  describe('encode / decode aliases', () => {
    it('should have encode and decode', () => {
      expect(querystringModule.encode).toBe(querystringModule.stringify);
      expect(querystringModule.decode).toBe(querystringModule.parse);
    });
  });
});
