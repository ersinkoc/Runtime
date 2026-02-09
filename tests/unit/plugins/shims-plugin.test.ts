import { describe, it, expect } from 'vitest';
import { shimsPlugin } from '../../../src/plugins/core/shims-plugin.js';
import { vfsPlugin } from '../../../src/plugins/core/vfs-plugin.js';
import { createKernel } from '../../../src/kernel.js';

describe('shimsPlugin', () => {
  function setup(options?: Parameters<typeof shimsPlugin>[0]) {
    const kernel = createKernel();
    kernel.use(vfsPlugin());
    kernel.use(shimsPlugin(options));
    return kernel;
  }

  it('should install successfully', () => {
    const kernel = setup();
    expect(kernel.listPlugins()).toContain('shims');
  });

  it('should store shims on kernel', () => {
    const kernel = setup();
    const shims = (kernel as any)._shims;
    expect(shims).toBeDefined();
    expect(shims instanceof Map).toBe(true);
  });

  it('should include basic tier modules by default', () => {
    const kernel = setup();
    const shims = (kernel as any)._shims as Map<string, unknown>;
    expect(shims.has('path')).toBe(true);
    expect(shims.has('events')).toBe(true);
    expect(shims.has('buffer')).toBe(true);
  });

  it('should include full tier when specified', () => {
    const kernel = setup({ tier: 'full' });
    const shims = (kernel as any)._shims as Map<string, unknown>;
    expect(shims.has('fs')).toBe(true);
    expect(shims.has('crypto')).toBe(true);
    expect(shims.has('http')).toBe(true);
  });

  it('should respect include filter with custom tier', () => {
    const kernel = setup({ tier: 'custom', include: ['path'] });
    const shims = (kernel as any)._shims as Map<string, unknown>;
    expect(shims.has('path')).toBe(true);
    // Only the specified module should be present
    expect(shims.size).toBe(1);
  });

  it('should use minimal tier', () => {
    const kernel = setup({ tier: 'minimal' });
    const shims = (kernel as any)._shims as Map<string, unknown>;
    expect(shims.has('path')).toBe(true);
    expect(shims.has('buffer')).toBe(true);
    expect(shims.has('events')).toBe(true);
    // Full tier modules should not be present
    expect(shims.has('http')).toBe(false);
    expect(shims.has('crypto')).toBe(false);
  });

  it('should respect exclude filter', () => {
    const kernel = setup({ tier: 'full', exclude: ['crypto'] });
    const shims = (kernel as any)._shims as Map<string, unknown>;
    expect(shims.has('crypto')).toBe(false);
    expect(shims.has('path')).toBe(true);
  });

  it('should register shims via __registerShims event', () => {
    const kernel = setup({ tier: 'full' });
    const registered: string[] = [];
    const mockLoader = {
      registerBuiltin(name: string, _mod: unknown) {
        registered.push(name);
      },
    };
    kernel.emit('__registerShims', mockLoader);
    expect(registered.length).toBeGreaterThan(0);
    expect(registered).toContain('path');
  });

  it('should not call registerBuiltin with non-loader argument', () => {
    const kernel = setup();
    // Should not throw when non-loader is passed
    expect(() => kernel.emit('__registerShims', null)).not.toThrow();
    expect(() => kernel.emit('__registerShims', 'not-a-loader')).not.toThrow();
  });
});
