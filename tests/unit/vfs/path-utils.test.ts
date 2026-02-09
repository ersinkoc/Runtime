import { describe, it, expect } from 'vitest';
import {
  normalizePath,
  dirname,
  basename,
  joinPath,
  splitPath,
  isAbsolute,
  resolvePath,
} from '../../../src/vfs/path-utils.js';

describe('normalizePath', () => {
  it('should normalize simple paths', () => {
    expect(normalizePath('/foo/bar')).toBe('/foo/bar');
  });

  it('should resolve . segments', () => {
    expect(normalizePath('/foo/./bar')).toBe('/foo/bar');
  });

  it('should resolve .. segments', () => {
    expect(normalizePath('/foo/../bar')).toBe('/bar');
    expect(normalizePath('/foo/bar/../baz')).toBe('/foo/baz');
  });

  it('should collapse multiple slashes', () => {
    expect(normalizePath('/foo//bar///baz')).toBe('/foo/bar/baz');
  });

  it('should convert backslashes', () => {
    expect(normalizePath('\\foo\\bar')).toBe('/foo/bar');
  });

  it('should handle root', () => {
    expect(normalizePath('/')).toBe('/');
  });

  it('should prefix with / for relative paths', () => {
    expect(normalizePath('foo/bar')).toBe('/foo/bar');
  });

  it('should handle complex normalization', () => {
    expect(normalizePath('/foo/../bar/./baz//qux')).toBe('/bar/baz/qux');
  });

  it('should handle .. at root', () => {
    expect(normalizePath('/../foo')).toBe('/foo');
  });

  it('should handle empty string', () => {
    expect(normalizePath('')).toBe('/');
  });
});

describe('dirname', () => {
  it('should return parent directory', () => {
    expect(dirname('/foo/bar/baz.txt')).toBe('/foo/bar');
  });

  it('should return / for root-level files', () => {
    expect(dirname('/foo')).toBe('/');
  });

  it('should return / for root', () => {
    expect(dirname('/')).toBe('/');
  });
});

describe('basename', () => {
  it('should return file name', () => {
    expect(basename('/foo/bar/baz.txt')).toBe('baz.txt');
  });

  it('should strip extension', () => {
    expect(basename('/foo/bar/baz.txt', '.txt')).toBe('baz');
  });

  it('should not strip non-matching extension', () => {
    expect(basename('/foo/bar/baz.txt', '.js')).toBe('baz.txt');
  });

  it('should handle root-level', () => {
    expect(basename('/foo')).toBe('foo');
  });
});

describe('joinPath', () => {
  it('should join segments', () => {
    expect(joinPath('/foo', 'bar', 'baz')).toBe('/foo/bar/baz');
  });

  it('should handle relative segments', () => {
    expect(joinPath('/foo', '../bar')).toBe('/bar');
  });
});

describe('splitPath', () => {
  it('should split into parent and name', () => {
    expect(splitPath('/foo/bar/baz')).toEqual({ parent: '/foo/bar', name: 'baz' });
  });

  it('should handle root-level', () => {
    expect(splitPath('/foo')).toEqual({ parent: '/', name: 'foo' });
  });

  it('should handle root', () => {
    expect(splitPath('/')).toEqual({ parent: '/', name: '' });
  });
});

describe('isAbsolute', () => {
  it('should detect absolute paths', () => {
    expect(isAbsolute('/foo')).toBe(true);
    expect(isAbsolute('\\foo')).toBe(true);
  });

  it('should detect relative paths', () => {
    expect(isAbsolute('foo')).toBe(false);
    expect(isAbsolute('./foo')).toBe(false);
  });
});

describe('resolvePath', () => {
  it('should resolve relative path', () => {
    expect(resolvePath('/app/src', '../lib/utils')).toBe('/app/lib/utils');
  });

  it('should use absolute path as-is', () => {
    expect(resolvePath('/app', '/absolute')).toBe('/absolute');
  });

  it('should resolve current dir reference', () => {
    expect(resolvePath('/app/src', './file.ts')).toBe('/app/src/file.ts');
  });
});
