import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VirtualFS } from '../../../src/vfs/virtual-fs.js';
import { PackageManager, parsePackageSpec } from '../../../src/npm/package-manager.js';

// Mock cdn-resolver
vi.mock('../../../src/npm/cdn-resolver.js', () => ({
  resolveFromCDN: vi.fn(),
}));
import { resolveFromCDN } from '../../../src/npm/cdn-resolver.js';

describe('parsePackageSpec', () => {
  it('should parse simple name', () => {
    expect(parsePackageSpec('lodash')).toEqual({ name: 'lodash', version: 'latest' });
  });

  it('should parse name@version', () => {
    expect(parsePackageSpec('lodash@4.17.21')).toEqual({ name: 'lodash', version: '4.17.21' });
  });

  it('should parse scoped package', () => {
    expect(parsePackageSpec('@types/node')).toEqual({ name: '@types/node', version: 'latest' });
  });

  it('should parse scoped package@version', () => {
    expect(parsePackageSpec('@types/node@20.0.0')).toEqual({ name: '@types/node', version: '20.0.0' });
  });

  it('should throw on invalid scoped package (no slash)', () => {
    expect(() => parsePackageSpec('@invalid')).toThrow('Invalid package spec');
  });

  it('should handle name with no @ as latest', () => {
    expect(parsePackageSpec('express')).toEqual({ name: 'express', version: 'latest' });
  });

  it('should handle scoped package with range', () => {
    expect(parsePackageSpec('@babel/core@^7.0.0')).toEqual({ name: '@babel/core', version: '^7.0.0' });
  });
});

describe('PackageManager', () => {
  it('should create with VFS', () => {
    const vfs = new VirtualFS();
    const pm = new PackageManager(vfs);
    expect(pm).toBeDefined();
  });

  it('should create with custom options', () => {
    const vfs = new VirtualFS();
    const pm = new PackageManager(vfs, {
      cacheDir: '/custom/modules',
      timeout: 5000,
      cdns: ['jsdelivr'],
    });
    expect(pm).toBeDefined();
  });

  it('should report not installed for missing package', () => {
    const vfs = new VirtualFS();
    const pm = new PackageManager(vfs);
    expect(pm.isInstalled('nonexistent')).toBe(false);
  });

  it('should report installed when package.json exists', () => {
    const vfs = new VirtualFS();
    const pm = new PackageManager(vfs);
    vfs.mkdirSync('/node_modules/test-pkg', { recursive: true });
    vfs.writeFileSync('/node_modules/test-pkg/package.json', '{"name":"test-pkg","version":"1.0.0"}');
    expect(pm.isInstalled('test-pkg')).toBe(true);
  });

  it('should use custom cacheDir for isInstalled', () => {
    const vfs = new VirtualFS();
    const pm = new PackageManager(vfs, { cacheDir: '/libs' });
    vfs.mkdirSync('/libs/my-lib', { recursive: true });
    vfs.writeFileSync('/libs/my-lib/package.json', '{}');
    expect(pm.isInstalled('my-lib')).toBe(true);
    expect(pm.isInstalled('other-lib')).toBe(false);
  });

  it('should list installed packages', () => {
    const vfs = new VirtualFS();
    const pm = new PackageManager(vfs);
    expect(pm.listInstalled()).toEqual([]);
  });

  it('should remove package', () => {
    const vfs = new VirtualFS();
    const pm = new PackageManager(vfs);
    vfs.mkdirSync('/node_modules/to-remove', { recursive: true });
    vfs.writeFileSync('/node_modules/to-remove/index.js', 'module.exports = 1;');
    pm.remove('to-remove');
    expect(vfs.existsSync('/node_modules/to-remove')).toBe(false);
  });

  it('should not throw when removing nonexistent package', () => {
    const vfs = new VirtualFS();
    const pm = new PackageManager(vfs);
    expect(() => pm.remove('nonexistent')).not.toThrow();
  });

  it('should remove with custom cacheDir', () => {
    const vfs = new VirtualFS();
    const pm = new PackageManager(vfs, { cacheDir: '/custom' });
    vfs.mkdirSync('/custom/pkg', { recursive: true });
    vfs.writeFileSync('/custom/pkg/index.js', 'x');
    pm.remove('pkg');
    expect(vfs.existsSync('/custom/pkg')).toBe(false);
  });
});

describe('PackageManager install', () => {
  beforeEach(() => {
    vi.mocked(resolveFromCDN).mockReset();
  });

  it('should install ESM package from CDN', async () => {
    const vfs = new VirtualFS();
    const pm = new PackageManager(vfs);
    vi.mocked(resolveFromCDN).mockResolvedValueOnce({
      format: 'esm',
      content: 'export default 42;',
    });
    const result = await pm.install('my-pkg@1.0.0');
    expect(result.name).toBe('my-pkg');
    expect(result.version).toBe('1.0.0');
    expect(result.path).toBe('/node_modules/my-pkg');
    expect(vfs.existsSync('/node_modules/my-pkg/index.js')).toBe(true);
    expect(vfs.existsSync('/node_modules/my-pkg/package.json')).toBe(true);
  });

  it('should install CJS package from CDN', async () => {
    const vfs = new VirtualFS();
    const pm = new PackageManager(vfs);
    vi.mocked(resolveFromCDN).mockResolvedValueOnce({
      format: 'cjs',
      content: 'module.exports = 42;',
    });
    const result = await pm.install('cjs-pkg@2.0.0');
    expect(result.name).toBe('cjs-pkg');
    expect(result.version).toBe('2.0.0');
    const pkgJson = JSON.parse(vfs.readFileSync('/node_modules/cjs-pkg/package.json', 'utf8') as string);
    expect(pkgJson.type).toBeUndefined();
  });

  it('should use 0.0.0 version for latest installs', async () => {
    const vfs = new VirtualFS();
    const pm = new PackageManager(vfs);
    vi.mocked(resolveFromCDN).mockResolvedValueOnce({
      format: 'esm',
      content: 'export default 1;',
    });
    const result = await pm.install('some-pkg');
    expect(result.version).toBe('0.0.0');
  });

  it('should return cached result for already-installed package', async () => {
    const vfs = new VirtualFS();
    const pm = new PackageManager(vfs);
    vi.mocked(resolveFromCDN).mockResolvedValueOnce({
      format: 'esm',
      content: 'export default 1;',
    });
    const first = await pm.install('cached-pkg@1.0.0');
    const second = await pm.install('cached-pkg@1.0.0');
    expect(second).toBe(first);
    // resolveFromCDN should only be called once
    expect(resolveFromCDN).toHaveBeenCalledTimes(1);
  });

  it('should deduplicate concurrent installs', async () => {
    const vfs = new VirtualFS();
    const pm = new PackageManager(vfs);
    vi.mocked(resolveFromCDN).mockResolvedValueOnce({
      format: 'esm',
      content: 'export default 1;',
    });
    const [a, b] = await Promise.all([
      pm.install('dedup-pkg@1.0.0'),
      pm.install('dedup-pkg@1.0.0'),
    ]);
    expect(a).toBe(b);
  });

  it('should installAll multiple packages', async () => {
    const vfs = new VirtualFS();
    const pm = new PackageManager(vfs);
    vi.mocked(resolveFromCDN)
      .mockResolvedValueOnce({ format: 'esm', content: 'export default 1;' })
      .mockResolvedValueOnce({ format: 'esm', content: 'export default 2;' });
    const results = await pm.installAll(['pkg-a@1.0.0', 'pkg-b@2.0.0']);
    expect(results).toHaveLength(2);
    expect(results[0]!.name).toBe('pkg-a');
    expect(results[1]!.name).toBe('pkg-b');
  });

  it('should track installed packages in listInstalled', async () => {
    const vfs = new VirtualFS();
    const pm = new PackageManager(vfs);
    vi.mocked(resolveFromCDN).mockResolvedValueOnce({
      format: 'esm',
      content: 'export default 1;',
    });
    await pm.install('tracked-pkg@1.0.0');
    const list = pm.listInstalled();
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe('tracked-pkg');
  });

  it('should remove installed package from internal map', async () => {
    const vfs = new VirtualFS();
    const pm = new PackageManager(vfs);
    vi.mocked(resolveFromCDN).mockResolvedValueOnce({
      format: 'esm',
      content: 'export default 1;',
    });
    await pm.install('removable@1.0.0');
    expect(pm.listInstalled()).toHaveLength(1);
    pm.remove('removable');
    expect(pm.listInstalled()).toHaveLength(0);
    expect(pm.isInstalled('removable')).toBe(false);
  });

  it('should throw for unknown CDN format', async () => {
    const vfs = new VirtualFS();
    const pm = new PackageManager(vfs);
    vi.mocked(resolveFromCDN).mockResolvedValueOnce({
      format: 'unknown-format' as any,
      content: 'data',
    });
    await expect(pm.install('bad-pkg@1.0.0')).rejects.toThrow('Unknown CDN result format');
  });

  it('should install tarball package from CDN', async () => {
    const vfs = new VirtualFS();
    const pm = new PackageManager(vfs);

    vi.mocked(resolveFromCDN).mockResolvedValueOnce({
      format: 'tarball',
      content: new ArrayBuffer(0),
    });

    const tarball = await import('../../../src/npm/tarball.js');
    const extractSpy = vi.spyOn(tarball, 'extractTgz').mockResolvedValueOnce(
      new Map([
        ['/package.json', new TextEncoder().encode('{"name":"tarball-pkg","version":"3.0.0","dependencies":{"dep-a":"^1.0.0"}}')],
        ['/index.js', new TextEncoder().encode('module.exports = 1;')],
      ]),
    );

    const result = await pm.install('tarball-pkg@3.0.0');
    expect(result.name).toBe('tarball-pkg');
    expect(result.version).toBe('3.0.0');
    expect(result.dependencies).toEqual({ 'dep-a': '^1.0.0' });
    expect(vfs.existsSync('/node_modules/tarball-pkg/index.js')).toBe(true);

    extractSpy.mockRestore();
  });

  it('should handle tarball without package.json', async () => {
    const vfs = new VirtualFS();
    const pm = new PackageManager(vfs);

    vi.mocked(resolveFromCDN).mockResolvedValueOnce({
      format: 'tarball',
      content: new ArrayBuffer(0),
    });

    const tarball = await import('../../../src/npm/tarball.js');
    const extractSpy = vi.spyOn(tarball, 'extractTgz').mockResolvedValueOnce(
      new Map([
        ['/index.js', new TextEncoder().encode('module.exports = 1;')],
      ]),
    );

    const result = await pm.install('no-pkg-json@1.0.0');
    expect(result.name).toBe('no-pkg-json');
    expect(result.version).toBe('1.0.0');
    expect(result.dependencies).toEqual({});

    extractSpy.mockRestore();
  });

  it('should use fallback for missing version/dependencies in tarball package.json', async () => {
    const vfs = new VirtualFS();
    const pm = new PackageManager(vfs);

    vi.mocked(resolveFromCDN).mockResolvedValueOnce({
      format: 'tarball',
      content: new ArrayBuffer(0),
    });

    const tarball = await import('../../../src/npm/tarball.js');
    const extractSpy = vi.spyOn(tarball, 'extractTgz').mockResolvedValueOnce(
      new Map([
        ['/package.json', new TextEncoder().encode('{"name":"partial-pkg"}')],
        ['/index.js', new TextEncoder().encode('module.exports = 1;')],
      ]),
    );

    const result = await pm.install('partial-pkg@2.0.0');
    expect(result.name).toBe('partial-pkg');
    expect(result.version).toBe('2.0.0');
    expect(result.dependencies).toEqual({});

    extractSpy.mockRestore();
  });
});
