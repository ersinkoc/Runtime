/**
 * Micro kernel — plugin registry, event bus, and core services.
 * This is the immutable core of the runtime (~4KB gzipped).
 * @module kernel
 */

import type {
  RuntimePlugin,
  RuntimeKernel,
  RuntimeConfig,
  RuntimeMode,
  VirtualFS,
} from './types.js';
import { RuntimeError } from './errors.js';

/**
 * Create a new micro kernel instance.
 *
 * @example
 * ```typescript
 * const kernel = createKernel({ cwd: '/app', env: {}, mode: 'trusted' });
 * kernel.use(myPlugin);
 * kernel.emit('ready');
 * ```
 */
export function createKernel(config: RuntimeConfig): RuntimeKernel {
  const plugins = new Map<string, RuntimePlugin>();
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  let vfsInstance: VirtualFS | null = null;

  const kernel: RuntimeKernel = {
    // ─── Plugin Registry ───────────────────────────────────────

    use(plugin: RuntimePlugin): void {
      if (plugins.has(plugin.name)) {
        throw new RuntimeError(
          `Plugin '${plugin.name}' is already registered`,
          'PLUGIN_DUPLICATE_ERROR',
          plugin.name,
        );
      }

      // Validate dependencies
      if (plugin.dependencies) {
        for (const dep of plugin.dependencies) {
          if (!plugins.has(dep)) {
            throw new RuntimeError(
              `Plugin '${plugin.name}' requires '${dep}' which is not registered`,
              'PLUGIN_DEPENDENCY_ERROR',
              plugin.name,
              `Register '${dep}' before '${plugin.name}'`,
            );
          }
        }
      }

      plugins.set(plugin.name, plugin);

      try {
        plugin.install(kernel);
      } catch (err) {
        plugins.delete(plugin.name);
        if (plugin.onError && err instanceof Error) {
          plugin.onError(err);
        }
        throw err;
      }
    },

    unregister(name: string): void {
      const plugin = plugins.get(name);
      if (!plugin) {
        throw new RuntimeError(
          `Plugin '${name}' is not registered`,
          'PLUGIN_ERROR',
          name,
        );
      }

      // Check if other plugins depend on this one
      for (const [otherName, otherPlugin] of plugins) {
        if (otherPlugin.dependencies?.includes(name)) {
          throw new RuntimeError(
            `Cannot unregister '${name}': plugin '${otherName}' depends on it`,
            'PLUGIN_DEPENDENCY_ERROR',
            name,
          );
        }
      }

      if (plugin.onDestroy) {
        // Fire and forget for sync cleanup, but we don't await here
        const result = plugin.onDestroy();
        if (result instanceof Promise) {
          result.catch((err: unknown) => {
            if (plugin.onError && err instanceof Error) {
              plugin.onError(err);
            }
          });
        }
      }

      plugins.delete(name);
    },

    getPlugin<T = RuntimePlugin>(name: string): T | undefined {
      return plugins.get(name) as T | undefined;
    },

    listPlugins(): string[] {
      return Array.from(plugins.keys());
    },

    // ─── Event Bus ─────────────────────────────────────────────

    on(event: string, handler: (...args: unknown[]) => void): void {
      let handlers = listeners.get(event);
      if (!handlers) {
        handlers = [];
        listeners.set(event, handlers);
      }
      handlers.push(handler);
    },

    off(event: string, handler: (...args: unknown[]) => void): void {
      const handlers = listeners.get(event);
      if (!handlers) return;
      const idx = handlers.indexOf(handler);
      if (idx !== -1) {
        handlers.splice(idx, 1);
      }
      if (handlers.length === 0) {
        listeners.delete(event);
      }
    },

    emit(event: string, ...args: unknown[]): void {
      const handlers = listeners.get(event);
      if (!handlers) return;
      // Iterate a copy in case handlers modify the list
      for (const handler of [...handlers]) {
        try {
          handler(...args);
        } catch (err) {
          // Emit error event unless this IS the error event (prevent infinite loop)
          if (event !== 'error') {
            kernel.emit('error', err, `event:${event}`);
          }
        }
      }
    },

    // ─── Core Services ─────────────────────────────────────────

    get vfs(): VirtualFS {
      if (!vfsInstance) {
        throw new RuntimeError(
          'VFS is not available — register vfsPlugin first',
          'PLUGIN_ERROR',
          'kernel',
          "Add vfsPlugin() to your plugins: createRuntime({ plugins: [vfsPlugin()] })",
        );
      }
      return vfsInstance;
    },

    config,
  };

  // Allow VFS plugin to set the vfs instance
  Object.defineProperty(kernel, '_setVfs', {
    value: (vfs: VirtualFS) => { vfsInstance = vfs; },
    enumerable: false,
    configurable: false,
  });

  return kernel;
}

/**
 * Create a RuntimeConfig from partial options.
 *
 * @example
 * ```typescript
 * const config = createConfig({ cwd: '/app' });
 * // { cwd: '/app', env: {}, mode: 'trusted' }
 * ```
 */
export function createConfig(options?: {
  cwd?: string;
  env?: Record<string, string>;
  mode?: RuntimeMode;
}): RuntimeConfig {
  return {
    cwd: options?.cwd ?? '/',
    env: options?.env ?? {},
    mode: options?.mode ?? 'trusted',
  };
}

/**
 * Topologically sort plugins by their dependencies.
 * Used when installing multiple plugins at once.
 *
 * @example
 * ```typescript
 * const sorted = topologicalSort(plugins);
 * for (const plugin of sorted) kernel.use(plugin);
 * ```
 */
export function topologicalSort(plugins: RuntimePlugin[]): RuntimePlugin[] {
  const nameMap = new Map<string, RuntimePlugin>();
  for (const p of plugins) {
    nameMap.set(p.name, p);
  }

  const sorted: RuntimePlugin[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(name: string): void {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      throw new RuntimeError(
        `Circular plugin dependency detected: '${name}'`,
        'PLUGIN_DEPENDENCY_ERROR',
        name,
      );
    }

    const plugin = nameMap.get(name);
    if (!plugin) return; // external dependency, will be validated by kernel.use()

    visiting.add(name);
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        visit(dep);
      }
    }
    visiting.delete(name);
    visited.add(name);
    sorted.push(plugin);
  }

  for (const plugin of plugins) {
    visit(plugin.name);
  }

  return sorted;
}
