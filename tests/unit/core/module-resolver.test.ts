import { describe, it, expect, beforeEach } from 'vitest';
import { resolveModule, resolveExports, getModuleFormat, clearResolutionCache } from '../../../src/core/module-resolver.js';
import { VirtualFS } from '../../../src/vfs/virtual-fs.js';
import { resetInodeCounter } from '../../../src/vfs/fs-node.js';
import { RuntimeError } from '../../../src/errors.js';

describe('resolveModule', () => {
  let vfs: VirtualFS;
  const builtins = new Set(['path', 'fs', 'events']);

  beforeEach(() => {
    resetInodeCounter();
    clearResolutionCache();
    vfs = new VirtualFS();
  });

  it('should resolve built-in modules', () => {
    expect(resolveModule('path', '/app.js', vfs, builtins)).toBe('__builtin__:path');
    expect(resolveModule('fs', '/app.js', vfs, builtins)).toBe('__builtin__:fs');
  });

  it('should resolve node: prefixed builtins', () => {
    expect(resolveModule('node:path', '/app.js', vfs, builtins)).toBe('__builtin__:path');
  });

  it('should resolve relative files', () => {
    vfs.mkdirSync('/app', { recursive: true });
    vfs.writeFileSync('/app/utils.js', 'module.exports = {};');
    expect(resolveModule('./utils.js', '/app/index.js', vfs, builtins)).toBe('/app/utils.js');
  });

  it('should try extensions for relative paths', () => {
    vfs.mkdirSync('/app', { recursive: true });
    vfs.writeFileSync('/app/utils.ts', 'export const x = 1;');
    expect(resolveModule('./utils', '/app/index.js', vfs, builtins)).toBe('/app/utils.ts');
  });

  it('should resolve directory with index file', () => {
    vfs.mkdirSync('/app/utils', { recursive: true });
    vfs.writeFileSync('/app/utils/index.js', 'module.exports = {};');
    expect(resolveModule('./utils', '/app/index.js', vfs, builtins)).toBe('/app/utils/index.js');
  });

  it('should resolve from node_modules', () => {
    vfs.mkdirSync('/app/node_modules/lodash', { recursive: true });
    vfs.writeFileSync('/app/node_modules/lodash/index.js', 'module.exports = {};');
    expect(resolveModule('lodash', '/app/index.js', vfs, builtins)).toBe('/app/node_modules/lodash/index.js');
  });

  it('should resolve package.json main field', () => {
    vfs.mkdirSync('/node_modules/pkg', { recursive: true });
    vfs.writeFileSync('/node_modules/pkg/package.json', JSON.stringify({ main: './lib/entry.js' }));
    vfs.mkdirSync('/node_modules/pkg/lib', { recursive: true });
    vfs.writeFileSync('/node_modules/pkg/lib/entry.js', '');
    expect(resolveModule('pkg', '/app.js', vfs, builtins)).toBe('/node_modules/pkg/lib/entry.js');
  });

  it('should walk up directories for node_modules', () => {
    vfs.mkdirSync('/node_modules/global-pkg', { recursive: true });
    vfs.writeFileSync('/node_modules/global-pkg/index.js', '');
    vfs.mkdirSync('/app/src', { recursive: true });
    expect(resolveModule('global-pkg', '/app/src/index.js', vfs, builtins)).toBe('/node_modules/global-pkg/index.js');
  });

  it('should throw on unresolvable module', () => {
    expect(() => resolveModule('./missing', '/app.js', vfs, builtins)).toThrow(RuntimeError);
    expect(() => resolveModule('./missing', '/app.js', vfs, builtins)).toThrow('Cannot find module');
  });

  it('should throw on unresolvable bare module', () => {
    expect(() => resolveModule('nonexistent', '/app.js', vfs, builtins)).toThrow(RuntimeError);
  });

  it('should resolve parent-relative paths', () => {
    vfs.mkdirSync('/app/src', { recursive: true });
    vfs.writeFileSync('/app/lib.js', 'module.exports = {};');
    expect(resolveModule('../lib.js', '/app/src/index.js', vfs, builtins)).toBe('/app/lib.js');
  });

  it('should resolve absolute paths', () => {
    vfs.mkdirSync('/lib', { recursive: true });
    vfs.writeFileSync('/lib/util.js', 'module.exports = {};');
    expect(resolveModule('/lib/util.js', '/app/index.js', vfs, builtins)).toBe('/lib/util.js');
  });

  it('should resolve scoped packages', () => {
    vfs.mkdirSync('/node_modules/@scope/pkg', { recursive: true });
    vfs.writeFileSync('/node_modules/@scope/pkg/index.js', '');
    expect(resolveModule('@scope/pkg', '/app.js', vfs, builtins)).toBe('/node_modules/@scope/pkg/index.js');
  });

  it('should resolve scoped package subpaths', () => {
    vfs.mkdirSync('/node_modules/@scope/pkg/lib', { recursive: true });
    vfs.writeFileSync('/node_modules/@scope/pkg/lib/utils.js', '');
    expect(resolveModule('@scope/pkg/lib/utils', '/app.js', vfs, builtins)).toBe('/node_modules/@scope/pkg/lib/utils.js');
  });

  it('should resolve package subpath imports', () => {
    vfs.mkdirSync('/node_modules/pkg/lib', { recursive: true });
    vfs.writeFileSync('/node_modules/pkg/lib/utils.js', '');
    vfs.writeFileSync('/node_modules/pkg/package.json', '{}');
    expect(resolveModule('pkg/lib/utils', '/app.js', vfs, builtins)).toBe('/node_modules/pkg/lib/utils.js');
  });

  it('should resolve package.json module field', () => {
    vfs.mkdirSync('/node_modules/esm-pkg/esm', { recursive: true });
    vfs.writeFileSync('/node_modules/esm-pkg/package.json', JSON.stringify({ module: './esm/index.mjs' }));
    vfs.writeFileSync('/node_modules/esm-pkg/esm/index.mjs', '');
    expect(resolveModule('esm-pkg', '/app.js', vfs, builtins)).toBe('/node_modules/esm-pkg/esm/index.mjs');
  });

  it('should resolve package.json exports field', () => {
    vfs.mkdirSync('/node_modules/exp-pkg', { recursive: true });
    vfs.writeFileSync('/node_modules/exp-pkg/package.json', JSON.stringify({
      exports: { '.': './lib/index.js' },
    }));
    vfs.mkdirSync('/node_modules/exp-pkg/lib', { recursive: true });
    vfs.writeFileSync('/node_modules/exp-pkg/lib/index.js', '');
    expect(resolveModule('exp-pkg', '/app.js', vfs, builtins)).toBe('/node_modules/exp-pkg/lib/index.js');
  });

  it('should fallback when exports resolves to non-existent file', () => {
    vfs.mkdirSync('/node_modules/bad-exp', { recursive: true });
    vfs.writeFileSync('/node_modules/bad-exp/package.json', JSON.stringify({
      exports: { '.': './missing.js' },
      main: './fallback.js',
    }));
    vfs.writeFileSync('/node_modules/bad-exp/fallback.js', '');
    expect(resolveModule('bad-exp', '/app.js', vfs, builtins)).toBe('/node_modules/bad-exp/fallback.js');
  });

  it('should handle invalid package.json in node_modules', () => {
    vfs.mkdirSync('/node_modules/broken', { recursive: true });
    vfs.writeFileSync('/node_modules/broken/package.json', 'not json{{{');
    vfs.writeFileSync('/node_modules/broken/index.js', '');
    expect(resolveModule('broken', '/app.js', vfs, builtins)).toBe('/node_modules/broken/index.js');
  });
});

describe('resolveExports', () => {
  const conditions = ['browser', 'import', 'require', 'default'];

  it('should resolve string exports', () => {
    expect(resolveExports('./lib/index.js', '.', conditions)).toBe('./lib/index.js');
  });

  it('should resolve conditions object', () => {
    const exports = { import: './lib/index.mjs', require: './lib/index.cjs' };
    expect(resolveExports(exports, '.', ['require', 'default'])).toBe('./lib/index.cjs');
  });

  it('should respect condition priority', () => {
    const exports = { browser: './browser.js', import: './index.mjs', default: './index.js' };
    expect(resolveExports(exports, '.', ['browser', 'import', 'default'])).toBe('./browser.js');
  });

  it('should resolve subpath exports', () => {
    const exports = { '.': './index.js', './utils': './lib/utils.js' };
    expect(resolveExports(exports, './utils', conditions)).toBe('./lib/utils.js');
  });

  it('should resolve nested conditions', () => {
    const exports = {
      '.': { import: { browser: './browser.mjs', default: './index.mjs' }, require: './index.cjs' },
    };
    expect(resolveExports(exports, '.', ['browser', 'import', 'default'])).toBe('./browser.mjs');
  });

  it('should resolve array exports (first match)', () => {
    const exports = ['./lib/index.js', './fallback.js'];
    expect(resolveExports(exports, '.', conditions)).toBe('./lib/index.js');
  });

  it('should resolve wildcard patterns', () => {
    const exports = { './*': './src/*.js' };
    expect(resolveExports(exports, './utils', conditions)).toBe('./src/utils.js');
  });

  it('should return null for non-matching subpath', () => {
    expect(resolveExports('./index.js', './utils', conditions)).toBeNull();
  });

  it('should return null for null/undefined', () => {
    expect(resolveExports(null, '.', conditions)).toBeNull();
    expect(resolveExports(undefined, '.', conditions)).toBeNull();
  });

  it('should return null for non-matching conditions', () => {
    const exports = { import: './index.mjs' };
    expect(resolveExports(exports, '.', ['require'])).toBeNull();
  });

  it('should return null for array with no matching items', () => {
    const exports = [null, undefined, 42];
    expect(resolveExports(exports, '.', conditions)).toBeNull();
  });

  it('should resolve wildcard pattern with suffix', () => {
    const exports = { './*.js': './dist/*.js' };
    expect(resolveExports(exports, './utils.js', conditions)).toBe('./dist/utils.js');
  });

  it('should return null for non-matching wildcard', () => {
    const exports = { './*.js': './dist/*.js' };
    expect(resolveExports(exports, './something.ts', conditions)).toBeNull();
  });

  it('should return null when no subpath matches in object', () => {
    const exports = { './foo': './lib/foo.js', './bar': './lib/bar.js' };
    expect(resolveExports(exports, './baz', conditions)).toBeNull();
  });

  it('should handle conditions with non-string values in subpath', () => {
    const exports = { '.': { import: { browser: './b.js' } } };
    expect(resolveExports(exports, '.', ['import', 'browser'])).toBe('./b.js');
  });

  it('should return null for conditions object with non-. subpath', () => {
    const exports = { import: './index.mjs' };
    expect(resolveExports(exports, './sub', conditions)).toBeNull();
  });
});

describe('getModuleFormat', () => {
  let vfs: VirtualFS;

  beforeEach(() => {
    resetInodeCounter();
    vfs = new VirtualFS();
  });

  it('should detect .mjs as ESM', () => {
    expect(getModuleFormat('/app.mjs', vfs)).toBe('esm');
  });

  it('should detect .mts as ESM', () => {
    expect(getModuleFormat('/app.mts', vfs)).toBe('esm');
  });

  it('should detect .cjs as CJS', () => {
    expect(getModuleFormat('/app.cjs', vfs)).toBe('cjs');
  });

  it('should detect .cts as CJS', () => {
    expect(getModuleFormat('/app.cts', vfs)).toBe('cjs');
  });

  it('should check package.json type field', () => {
    vfs.writeFileSync('/package.json', JSON.stringify({ type: 'module' }));
    expect(getModuleFormat('/app.js', vfs)).toBe('esm');
  });

  it('should default to CJS', () => {
    expect(getModuleFormat('/app.js', vfs)).toBe('cjs');
  });

  it('should check nearest package.json', () => {
    vfs.writeFileSync('/package.json', JSON.stringify({ type: 'commonjs' }));
    vfs.mkdirSync('/src', { recursive: true });
    vfs.writeFileSync('/src/package.json', JSON.stringify({ type: 'module' }));
    expect(getModuleFormat('/src/app.js', vfs)).toBe('esm');
    expect(getModuleFormat('/app.js', vfs)).toBe('cjs');
  });

  it('should handle invalid package.json', () => {
    vfs.writeFileSync('/package.json', 'not json');
    expect(getModuleFormat('/app.js', vfs)).toBe('cjs');
  });
});
