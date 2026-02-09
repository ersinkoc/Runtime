import { describe, it, expect } from 'vitest';
import urlModule from '../../../src/shims/url.js';

describe('url shim', () => {
  describe('URL / URLSearchParams', () => {
    it('should export WHATWG URL', () => {
      const u = new urlModule.URL('https://example.com/path?q=1');
      expect(u.hostname).toBe('example.com');
      expect(u.pathname).toBe('/path');
    });

    it('should export URLSearchParams', () => {
      const params = new urlModule.URLSearchParams('a=1&b=2');
      expect(params.get('a')).toBe('1');
    });
  });

  describe('parse', () => {
    it('should parse URL string', () => {
      const result = urlModule.parse('https://user:pass@example.com:8080/path?q=1#hash');
      expect(result.protocol).toBe('https:');
      expect(result.auth).toBe('user:pass');
      expect(result.hostname).toBe('example.com');
      expect(result.port).toBe('8080');
      expect(result.pathname).toBe('/path');
      expect(result.search).toBe('?q=1');
      expect(result.hash).toBe('#hash');
    });

    it('should parse query when requested', () => {
      const result = urlModule.parse('https://example.com?a=1&b=2', true);
      expect(result.query).toEqual({ a: '1', b: '2' });
    });

    it('should return query as string by default', () => {
      const result = urlModule.parse('https://example.com?a=1');
      expect(result.query).toBe('a=1');
    });

    it('should handle relative paths', () => {
      const result = urlModule.parse('/foo/bar');
      expect(result.pathname).toBe('/foo/bar');
    });
  });

  describe('format', () => {
    it('should format URL object', () => {
      const result = urlModule.format({
        protocol: 'https:',
        hostname: 'example.com',
        pathname: '/path',
      });
      expect(result).toContain('https:');
      expect(result).toContain('example.com');
      expect(result).toContain('/path');
    });

    it('should use href directly', () => {
      expect(urlModule.format({ href: 'https://example.com' })).toBe('https://example.com');
    });

    it('should format with auth, port, search, and hash', () => {
      const result = urlModule.format({
        protocol: 'https:',
        slashes: true,
        auth: 'user:pass',
        hostname: 'example.com',
        port: '8080',
        pathname: '/path',
        search: '?q=1',
        hash: '#top',
      });
      expect(result).toBe('https://user:pass@example.com:8080/path?q=1#top');
    });

    it('should format with query string (no search)', () => {
      const result = urlModule.format({
        protocol: 'http:',
        hostname: 'example.com',
        pathname: '/',
        query: 'a=1&b=2',
      });
      expect(result).toContain('?a=1&b=2');
    });

    it('should format with query object (no search)', () => {
      const result = urlModule.format({
        protocol: 'http:',
        hostname: 'example.com',
        pathname: '/',
        query: { key: 'value' },
      });
      expect(result).toContain('?key=value');
    });

    it('should format hash without leading #', () => {
      const result = urlModule.format({
        protocol: 'http:',
        hostname: 'example.com',
        hash: 'section',
      });
      expect(result).toContain('#section');
    });

    it('should format search without leading ?', () => {
      const result = urlModule.format({
        protocol: 'http:',
        hostname: 'example.com',
        search: 'q=1',
      });
      expect(result).toContain('?q=1');
    });
  });

  describe('resolve', () => {
    it('should resolve relative URL', () => {
      const result = urlModule.resolve('https://example.com/a/', './b');
      expect(result).toBe('https://example.com/a/b');
    });
  });

  describe('pathToFileURL', () => {
    it('should convert path to file URL', () => {
      const result = urlModule.pathToFileURL('/foo/bar');
      expect(result.protocol).toBe('file:');
      expect(result.pathname).toBe('/foo/bar');
    });
  });

  describe('fileURLToPath', () => {
    it('should convert file URL to path', () => {
      const result = urlModule.fileURLToPath('file:///foo/bar');
      expect(result).toBe('/foo/bar');
    });

    it('should throw for non-file URLs', () => {
      expect(() => urlModule.fileURLToPath('https://example.com')).toThrow('Must be a file URL');
    });

    it('should accept URL object', () => {
      const url = new URL('file:///hello/world');
      expect(urlModule.fileURLToPath(url)).toBe('/hello/world');
    });
  });

  describe('parse branch coverage', () => {
    it('should parse URL with username only (no password)', () => {
      const result = urlModule.parse('http://user@example.com/path');
      expect(result.auth).toBe('user');
    });

    it('should return null for missing port, search, hash', () => {
      const result = urlModule.parse('http://example.com/path');
      expect(result.port).toBeNull();
      expect(result.search).toBeNull();
      expect(result.hash).toBeNull();
      expect(result.query).toBeNull();
    });
  });

  describe('format without protocol or auth', () => {
    it('should format with just pathname when no protocol', () => {
      const result = urlModule.format({ pathname: '/path' });
      expect(result).toBe('/path');
    });

    it('should format with protocol but no auth', () => {
      const result = urlModule.format({ protocol: 'http:', hostname: 'example.com' });
      expect(result).toBe('http:example.com');
    });
  });

  describe('format branch coverage', () => {
    it('should add colon to protocol without colon', () => {
      const result = urlModule.format({
        protocol: 'http',
        slashes: true,
        hostname: 'example.com',
      });
      expect(result).toBe('http://example.com');
    });

    it('should format without slashes', () => {
      const result = urlModule.format({
        protocol: 'mailto:',
        hostname: 'user@example.com',
      });
      expect(result).toBe('mailto:user@example.com');
    });
  });
});
