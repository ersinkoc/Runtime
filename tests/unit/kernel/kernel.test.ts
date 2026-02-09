import { describe, it, expect, vi } from 'vitest';
import { createKernel, createConfig, topologicalSort } from '../../../src/kernel.js';
import type { RuntimePlugin, RuntimeKernel } from '../../../src/types.js';
import { RuntimeError } from '../../../src/errors.js';

// Helper to create a simple plugin
function createPlugin(
  name: string,
  opts?: Partial<RuntimePlugin>,
): RuntimePlugin {
  return {
    name,
    version: '1.0.0',
    install: vi.fn(),
    ...opts,
  };
}

describe('createConfig', () => {
  it('should return default config when no options provided', () => {
    const config = createConfig();
    expect(config.cwd).toBe('/');
    expect(config.env).toEqual({});
    expect(config.mode).toBe('trusted');
  });

  it('should use provided options', () => {
    const config = createConfig({
      cwd: '/app',
      env: { NODE_ENV: 'test' },
      mode: 'worker',
    });
    expect(config.cwd).toBe('/app');
    expect(config.env).toEqual({ NODE_ENV: 'test' });
    expect(config.mode).toBe('worker');
  });

  it('should fill in defaults for partial options', () => {
    const config = createConfig({ cwd: '/custom' });
    expect(config.cwd).toBe('/custom');
    expect(config.env).toEqual({});
    expect(config.mode).toBe('trusted');
  });
});

describe('createKernel', () => {
  function makeKernel() {
    return createKernel(createConfig());
  }

  describe('Plugin Registry', () => {
    it('should register a plugin', () => {
      const kernel = makeKernel();
      const plugin = createPlugin('test-plugin');
      kernel.use(plugin);
      expect(kernel.listPlugins()).toEqual(['test-plugin']);
      expect(plugin.install).toHaveBeenCalledTimes(1);
      // Verify kernel was passed as argument (deep comparison would trigger vfs getter)
      const callArg = (plugin.install as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(callArg).toBe(kernel);
    });

    it('should get a registered plugin by name', () => {
      const kernel = makeKernel();
      const plugin = createPlugin('test-plugin');
      kernel.use(plugin);
      expect(kernel.getPlugin('test-plugin')).toBe(plugin);
    });

    it('should return undefined for unregistered plugin', () => {
      const kernel = makeKernel();
      expect(kernel.getPlugin('nonexistent')).toBeUndefined();
    });

    it('should list all registered plugins', () => {
      const kernel = makeKernel();
      kernel.use(createPlugin('plugin-a'));
      kernel.use(createPlugin('plugin-b'));
      kernel.use(createPlugin('plugin-c'));
      expect(kernel.listPlugins()).toEqual(['plugin-a', 'plugin-b', 'plugin-c']);
    });

    it('should throw on duplicate plugin name', () => {
      const kernel = makeKernel();
      kernel.use(createPlugin('dup'));
      expect(() => kernel.use(createPlugin('dup'))).toThrow(RuntimeError);
      expect(() => kernel.use(createPlugin('dup'))).toThrow(
        "Plugin 'dup' is already registered",
      );
    });

    it('should validate plugin dependencies', () => {
      const kernel = makeKernel();
      const plugin = createPlugin('child', {
        dependencies: ['parent'],
      });
      expect(() => kernel.use(plugin)).toThrow(RuntimeError);
      expect(() => kernel.use(createPlugin('child2', { dependencies: ['parent'] }))).toThrow(
        "requires 'parent'",
      );
    });

    it('should allow plugin with satisfied dependencies', () => {
      const kernel = makeKernel();
      kernel.use(createPlugin('parent'));
      const child = createPlugin('child', { dependencies: ['parent'] });
      kernel.use(child);
      expect(kernel.listPlugins()).toEqual(['parent', 'child']);
    });

    it('should remove plugin on install error and re-throw', () => {
      const kernel = makeKernel();
      const error = new Error('Install failed');
      const onError = vi.fn();
      const plugin = createPlugin('bad', {
        install: () => { throw error; },
        onError,
      });
      expect(() => kernel.use(plugin)).toThrow('Install failed');
      expect(kernel.listPlugins()).toEqual([]);
      expect(onError).toHaveBeenCalledWith(error);
    });

    it('should not call onError if error is not Error instance', () => {
      const kernel = makeKernel();
      const onError = vi.fn();
      const plugin = createPlugin('bad', {
        install: () => { throw 'string error'; }, // eslint-disable-line
        onError,
      });
      expect(() => kernel.use(plugin)).toThrow('string error');
      expect(onError).not.toHaveBeenCalled();
    });

    it('should unregister a plugin', () => {
      const kernel = makeKernel();
      const onDestroy = vi.fn();
      kernel.use(createPlugin('removable', { onDestroy }));
      kernel.unregister('removable');
      expect(kernel.listPlugins()).toEqual([]);
      expect(onDestroy).toHaveBeenCalled();
    });

    it('should throw when unregistering non-existent plugin', () => {
      const kernel = makeKernel();
      expect(() => kernel.unregister('ghost')).toThrow(RuntimeError);
      expect(() => kernel.unregister('ghost')).toThrow("Plugin 'ghost' is not registered");
    });

    it('should prevent unregistering plugin with dependents', () => {
      const kernel = makeKernel();
      kernel.use(createPlugin('base'));
      kernel.use(createPlugin('dependent', { dependencies: ['base'] }));
      expect(() => kernel.unregister('base')).toThrow(RuntimeError);
      expect(() => kernel.unregister('base')).toThrow("plugin 'dependent' depends on it");
    });

    it('should handle async onDestroy', async () => {
      const kernel = makeKernel();
      let destroyed = false;
      kernel.use(
        createPlugin('async-destroy', {
          onDestroy: async () => {
            await new Promise((r) => setTimeout(r, 10));
            destroyed = true;
          },
        }),
      );
      kernel.unregister('async-destroy');
      // Wait for async destroy
      await new Promise((r) => setTimeout(r, 50));
      expect(destroyed).toBe(true);
    });

    it('should handle async onDestroy error with onError', async () => {
      const kernel = makeKernel();
      const onError = vi.fn();
      kernel.use(
        createPlugin('async-err', {
          onDestroy: async () => {
            throw new Error('async destroy failed');
          },
          onError,
        }),
      );
      kernel.unregister('async-err');
      await new Promise((r) => setTimeout(r, 50));
      expect(onError).toHaveBeenCalled();
    });

    it('should handle async onDestroy error without onError', async () => {
      const kernel = makeKernel();
      kernel.use(
        createPlugin('async-err-no-handler', {
          onDestroy: async () => {
            throw new Error('async destroy failed');
          },
        }),
      );
      // Should not throw — the error is silently caught
      kernel.unregister('async-err-no-handler');
      await new Promise((r) => setTimeout(r, 50));
    });

    it('should handle plugin without onDestroy', () => {
      const kernel = makeKernel();
      kernel.use(createPlugin('simple'));
      kernel.unregister('simple');
      expect(kernel.listPlugins()).toEqual([]);
    });
  });

  describe('Event Bus', () => {
    it('should add and emit event listeners', () => {
      const kernel = makeKernel();
      const handler = vi.fn();
      kernel.on('test', handler);
      kernel.emit('test', 'arg1', 'arg2');
      expect(handler).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should support multiple listeners for same event', () => {
      const kernel = makeKernel();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      kernel.on('test', handler1);
      kernel.on('test', handler2);
      kernel.emit('test', 'data');
      expect(handler1).toHaveBeenCalledWith('data');
      expect(handler2).toHaveBeenCalledWith('data');
    });

    it('should remove a specific listener', () => {
      const kernel = makeKernel();
      const handler = vi.fn();
      kernel.on('test', handler);
      kernel.off('test', handler);
      kernel.emit('test');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle removing non-existent listener', () => {
      const kernel = makeKernel();
      const handler = vi.fn();
      // No error when removing from non-existent event
      kernel.off('nonexistent', handler);
      // No error when removing handler not in list
      kernel.on('test', vi.fn());
      kernel.off('test', handler);
    });

    it('should clean up empty listener arrays', () => {
      const kernel = makeKernel();
      const handler = vi.fn();
      kernel.on('test', handler);
      kernel.off('test', handler);
      // Emit should not fail
      kernel.emit('test');
    });

    it('should not fail when emitting event with no listeners', () => {
      const kernel = makeKernel();
      // Should not throw
      kernel.emit('unregistered-event', 'some-data');
    });

    it('should catch handler errors and emit on error channel', () => {
      const kernel = makeKernel();
      const errorHandler = vi.fn();
      kernel.on('error', errorHandler);

      const error = new Error('handler failed');
      kernel.on('test', () => { throw error; });
      kernel.emit('test');

      expect(errorHandler).toHaveBeenCalledWith(error, 'event:test');
    });

    it('should not infinitely recurse when error handler throws', () => {
      const kernel = makeKernel();
      kernel.on('error', () => { throw new Error('error in error handler'); });
      // Should not throw or recurse
      kernel.emit('error', new Error('original'));
    });

    it('should iterate a copy of handlers (safe modification during emit)', () => {
      const kernel = makeKernel();
      const handler2 = vi.fn();
      const handler1 = vi.fn(() => {
        kernel.off('test', handler2);
      });
      kernel.on('test', handler1);
      kernel.on('test', handler2);
      kernel.emit('test');
      // handler2 should still be called because we iterate a copy
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should emit with no arguments', () => {
      const kernel = makeKernel();
      const handler = vi.fn();
      kernel.on('ready', handler);
      kernel.emit('ready');
      expect(handler).toHaveBeenCalledWith();
    });
  });

  describe('VFS Access', () => {
    it('should throw when accessing vfs before vfsPlugin is loaded', () => {
      const kernel = makeKernel();
      expect(() => kernel.vfs).toThrow(RuntimeError);
      expect(() => kernel.vfs).toThrow('VFS is not available');
    });

    it('should provide vfs after _setVfs is called', () => {
      const kernel = makeKernel();
      const mockVfs = { mock: true } as any;
      (kernel as any)._setVfs(mockVfs);
      expect(kernel.vfs).toBe(mockVfs);
    });
  });

  describe('Config', () => {
    it('should expose config', () => {
      const config = createConfig({ cwd: '/test', env: { A: 'B' }, mode: 'sandbox' });
      const kernel = createKernel(config);
      expect(kernel.config).toBe(config);
      expect(kernel.config.cwd).toBe('/test');
      expect(kernel.config.env).toEqual({ A: 'B' });
      expect(kernel.config.mode).toBe('sandbox');
    });
  });
});

describe('topologicalSort', () => {
  it('should sort plugins by dependencies', () => {
    const a = createPlugin('a');
    const b = createPlugin('b', { dependencies: ['a'] });
    const c = createPlugin('c', { dependencies: ['b'] });

    const sorted = topologicalSort([c, a, b]);
    expect(sorted.map((p) => p.name)).toEqual(['a', 'b', 'c']);
  });

  it('should handle plugins with no dependencies', () => {
    const a = createPlugin('a');
    const b = createPlugin('b');
    const sorted = topologicalSort([a, b]);
    expect(sorted.map((p) => p.name)).toEqual(['a', 'b']);
  });

  it('should handle diamond dependencies', () => {
    const a = createPlugin('a');
    const b = createPlugin('b', { dependencies: ['a'] });
    const c = createPlugin('c', { dependencies: ['a'] });
    const d = createPlugin('d', { dependencies: ['b', 'c'] });

    const sorted = topologicalSort([d, c, b, a]);
    const names = sorted.map((p) => p.name);
    expect(names.indexOf('a')).toBeLessThan(names.indexOf('b'));
    expect(names.indexOf('a')).toBeLessThan(names.indexOf('c'));
    expect(names.indexOf('b')).toBeLessThan(names.indexOf('d'));
    expect(names.indexOf('c')).toBeLessThan(names.indexOf('d'));
  });

  it('should detect circular dependencies', () => {
    const a = createPlugin('a', { dependencies: ['b'] });
    const b = createPlugin('b', { dependencies: ['a'] });
    expect(() => topologicalSort([a, b])).toThrow(RuntimeError);
    expect(() => topologicalSort([a, b])).toThrow('Circular plugin dependency');
  });

  it('should handle empty array', () => {
    expect(topologicalSort([])).toEqual([]);
  });

  it('should handle external dependencies (not in array)', () => {
    const a = createPlugin('a', { dependencies: ['external'] });
    // Should not throw — external deps are validated by kernel.use()
    const sorted = topologicalSort([a]);
    expect(sorted.map((p) => p.name)).toEqual(['a']);
  });
});
