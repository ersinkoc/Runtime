import { describe, it, expect } from 'vitest';
import pathShim from '../../../src/shims/path.js';

describe('path shim', () => {
  it('should have sep and delimiter', () => {
    expect(pathShim.sep).toBe('/');
    expect(pathShim.delimiter).toBe(':');
  });

  describe('normalize', () => {
    it('should resolve . and .. segments', () => {
      expect(pathShim.normalize('/foo/bar//baz/asdf/quux/..')).toBe('/foo/bar/baz/asdf');
    });

    it('should return . for empty', () => {
      expect(pathShim.normalize('')).toBe('.');
    });

    it('should handle trailing slash', () => {
      expect(pathShim.normalize('/foo/bar/')).toBe('/foo/bar/');
    });

    it('should keep .. in relative paths', () => {
      expect(pathShim.normalize('../foo/bar')).toBe('../foo/bar');
    });

    it('should throw for non-string input', () => {
      expect(() => pathShim.normalize(123 as any)).toThrow(TypeError);
    });
  });

  describe('join', () => {
    it('should join paths', () => {
      expect(pathShim.join('/foo', 'bar', 'baz/asdf', 'quux', '..')).toBe('/foo/bar/baz/asdf');
    });

    it('should return . for empty', () => {
      expect(pathShim.join()).toBe('.');
    });
  });

  describe('resolve', () => {
    it('should resolve absolute path', () => {
      expect(pathShim.resolve('/foo/bar', './baz')).toBe('/foo/bar/baz');
    });

    it('should resolve relative paths right-to-left', () => {
      expect(pathShim.resolve('/foo', '/bar', 'baz')).toBe('/bar/baz');
    });

    it('should prepend / for all relative paths', () => {
      const result = pathShim.resolve('foo', 'bar');
      expect(result.startsWith('/')).toBe(true);
      expect(result).toContain('foo/bar');
    });
  });

  describe('isAbsolute', () => {
    it('should detect absolute paths', () => {
      expect(pathShim.isAbsolute('/foo/bar')).toBe(true);
      expect(pathShim.isAbsolute('foo/bar')).toBe(false);
    });
  });

  describe('dirname', () => {
    it('should return parent directory', () => {
      expect(pathShim.dirname('/foo/bar/baz/asdf/quux')).toBe('/foo/bar/baz/asdf');
    });

    it('should return . for filename only', () => {
      expect(pathShim.dirname('foo')).toBe('.');
    });
  });

  describe('basename', () => {
    it('should return filename', () => {
      expect(pathShim.basename('/foo/bar/baz/asdf/quux.html')).toBe('quux.html');
    });

    it('should strip extension', () => {
      expect(pathShim.basename('/foo/bar/baz/asdf/quux.html', '.html')).toBe('quux');
    });
  });

  describe('extname', () => {
    it('should return extension', () => {
      expect(pathShim.extname('index.html')).toBe('.html');
      expect(pathShim.extname('index.coffee.md')).toBe('.md');
      expect(pathShim.extname('index.')).toBe('.');
    });

    it('should return empty for no extension', () => {
      expect(pathShim.extname('index')).toBe('');
      expect(pathShim.extname('.index')).toBe('');
    });

    it('should handle paths with directory separators', () => {
      expect(pathShim.extname('/dir/file.txt')).toBe('.txt');
      expect(pathShim.extname('/dir/')).toBe('');
      expect(pathShim.extname('dir/.hidden')).toBe('');
    });
  });

  describe('parse', () => {
    it('should parse path components', () => {
      const result = pathShim.parse('/home/user/dir/file.txt');
      expect(result.root).toBe('/');
      expect(result.dir).toBe('/home/user/dir');
      expect(result.base).toBe('file.txt');
      expect(result.ext).toBe('.txt');
      expect(result.name).toBe('file');
    });
  });

  describe('format', () => {
    it('should format from parse output', () => {
      expect(pathShim.format({ dir: '/home/user/dir', base: 'file.txt' })).toBe('/home/user/dir/file.txt');
    });

    it('should use root when dir is missing', () => {
      expect(pathShim.format({ root: '/', base: 'file.txt' })).toBe('/file.txt');
    });

    it('should construct base from name and ext', () => {
      expect(pathShim.format({ dir: '/dir', name: 'file', ext: '.txt' })).toBe('/dir/file.txt');
    });
  });

  describe('relative', () => {
    it('should compute relative path', () => {
      expect(pathShim.relative('/data/orandea/test/aaa', '/data/orandea/impl/bbb')).toBe('../../impl/bbb');
    });

    it('should return empty for same path', () => {
      expect(pathShim.relative('/foo/bar', '/foo/bar')).toBe('');
    });
  });

  describe('posix', () => {
    it('should expose posix namespace', () => {
      expect(pathShim.posix.sep).toBe('/');
      expect(typeof pathShim.posix.join).toBe('function');
    });
  });

  describe('isAbsolute edge cases', () => {
    it('should return false for empty string', () => {
      expect(pathShim.isAbsolute('')).toBe(false);
    });
  });

  describe('format branch coverage', () => {
    it('should return base alone when dir is empty', () => {
      expect(pathShim.format({ base: 'file.txt' })).toBe('file.txt');
    });

    it('should concat dir and base with / when dir !== root', () => {
      expect(pathShim.format({ root: '/', dir: '/foo', base: 'bar.txt' })).toBe('/foo/bar.txt');
    });

    it('should concat dir and base without / when dir === root', () => {
      expect(pathShim.format({ root: '/', dir: '/', base: 'file.txt' })).toBe('/file.txt');
    });
  });

  describe('relative branch coverage', () => {
    it('should return empty for differently-written but same resolved path', () => {
      expect(pathShim.relative('/foo/bar/../baz', '/foo/baz')).toBe('');
    });
  });

  describe('normalize branch coverage', () => {
    it('should handle relative double ..', () => {
      expect(pathShim.normalize('../../foo')).toBe('../../foo');
    });
  });

  describe('parse branch coverage', () => {
    it('should parse relative path (non-absolute root)', () => {
      const result = pathShim.parse('file.txt');
      expect(result.root).toBe('');
      expect(result.base).toBe('file.txt');
      expect(result.ext).toBe('.txt');
    });

    it('should parse path without extension', () => {
      const result = pathShim.parse('myfile');
      expect(result.ext).toBe('');
      expect(result.name).toBe('myfile');
    });
  });

  describe('format with empty object', () => {
    it('should return empty string for empty object', () => {
      expect(pathShim.format({})).toBe('');
    });
  });

  describe('normalize dot path', () => {
    it('should return . for single dot', () => {
      expect(pathShim.normalize('.')).toBe('.');
    });
  });

  describe('join with empty strings', () => {
    it('should return . when all paths are empty', () => {
      expect(pathShim.join('')).toBe('.');
      expect(pathShim.join('', '')).toBe('.');
    });
  });

  describe('dirname double slash prefix', () => {
    it('should return // for //a', () => {
      expect(pathShim.dirname('//a')).toBe('//');
    });
  });

  describe('extname double dot', () => {
    it('should return empty for ..', () => {
      expect(pathShim.extname('..')).toBe('');
    });
  });

  describe('dirname branch coverage', () => {
    it('should return / for root', () => {
      expect(pathShim.dirname('/')).toBe('/');
    });

    it('should return / for // (all slashes)', () => {
      expect(pathShim.dirname('//')).toBe('/');
    });

    it('should return . for empty string', () => {
      expect(pathShim.dirname('')).toBe('.');
    });
  });

  describe('resolve branch coverage', () => {
    it('should handle empty path segments', () => {
      const result = pathShim.resolve('/foo', '', 'bar');
      expect(result).toBe('/foo/bar');
    });
  });

  describe('basename branch coverage', () => {
    it('should handle path with trailing slash', () => {
      // The implementation keeps trailing slash in basename
      const result = pathShim.basename('/foo/bar/');
      expect(result).toBe('bar/');
    });

    it('should return / for root', () => {
      expect(pathShim.basename('/')).toBe('/');
    });

    it('should return filename for simple name', () => {
      expect(pathShim.basename('file.txt')).toBe('file.txt');
    });
  });
});
