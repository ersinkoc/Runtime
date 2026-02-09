import { describe, it, expect } from 'vitest';
import { vfsPlugin } from '../../../src/plugins/core/vfs-plugin.js';
import { createKernel } from '../../../src/kernel.js';

describe('vfsPlugin', () => {
  it('should install successfully', () => {
    const kernel = createKernel();
    kernel.use(vfsPlugin());
    expect(kernel.listPlugins()).toContain('vfs');
  });

  it('should set VFS on kernel', () => {
    const kernel = createKernel();
    kernel.use(vfsPlugin());
    expect(kernel.vfs).toBeDefined();
  });

  it('should create /tmp directory', () => {
    const kernel = createKernel();
    kernel.use(vfsPlugin());
    expect(kernel.vfs.existsSync('/tmp')).toBe(true);
  });

  it('should support file operations after install', () => {
    const kernel = createKernel();
    kernel.use(vfsPlugin());
    kernel.vfs.writeFileSync('/hello.txt', 'world');
    expect(kernel.vfs.readFileSync('/hello.txt', 'utf8')).toBe('world');
  });

  it('should have onDestroy lifecycle', () => {
    const kernel = createKernel();
    const plugin = vfsPlugin();
    expect(typeof plugin.onDestroy).toBe('function');
  });
});
