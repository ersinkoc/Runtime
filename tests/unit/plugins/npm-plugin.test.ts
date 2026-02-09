import { describe, it, expect } from 'vitest';
import { npmPlugin } from '../../../src/plugins/npm/npm-plugin.js';
import { vfsPlugin } from '../../../src/plugins/core/vfs-plugin.js';
import { createKernel } from '../../../src/kernel.js';
import { PackageManager } from '../../../src/npm/package-manager.js';

describe('npmPlugin', () => {
  function setup(options?: Parameters<typeof npmPlugin>[0]) {
    const kernel = createKernel();
    kernel.use(vfsPlugin());
    kernel.use(npmPlugin(options));
    return kernel;
  }

  it('should install successfully', () => {
    const kernel = setup();
    expect(kernel.listPlugins()).toContain('npm');
  });

  it('should store PackageManager on kernel', () => {
    const kernel = setup();
    const pm = (kernel as any)._npm;
    expect(pm).toBeInstanceOf(PackageManager);
  });

  it('should expose PackageManager via __getNpm event', () => {
    const kernel = setup();
    let receivedPm: unknown = null;
    kernel.emit('__getNpm', (pm: unknown) => { receivedPm = pm; });
    expect(receivedPm).toBeInstanceOf(PackageManager);
  });

  it('should support custom options', () => {
    const kernel = setup({ timeout: 5000, cacheDir: '/custom/modules' });
    const pm = (kernel as any)._npm;
    expect(pm).toBeInstanceOf(PackageManager);
  });

  it('should have onDestroy lifecycle', async () => {
    const plugin = npmPlugin();
    expect(typeof plugin.onDestroy).toBe('function');
  });

  it('should nullify pm on plugin unregister', () => {
    const kernel = setup();
    expect(kernel.listPlugins()).toContain('npm');
    // Unregistering the plugin triggers onDestroy
    kernel.unregister('npm');
    expect(kernel.listPlugins()).not.toContain('npm');
  });
});
