/**
 * @oxog/runtime — Browser-Native Node.js Runtime
 *
 * Zero-dependency, plugin-based Node.js runtime that runs entirely in the browser.
 *
 * @example
 * ```typescript
 * import { createRuntime } from '@oxog/runtime';
 * import { vfsPlugin, shimsPlugin } from '@oxog/runtime/plugins';
 *
 * const runtime = createRuntime({
 *   plugins: [vfsPlugin(), shimsPlugin()],
 * });
 *
 * runtime.vfs.writeFileSync('/hello.js', 'module.exports = "world";');
 * const result = runtime.execute('module.exports = require("./hello");', '/index.js');
 * console.log(result.exports); // 'world'
 * ```
 *
 * @module index
 */

import type {
  Runtime,
  RuntimeOptions,
  ContainerOptions,
  ExecuteResult,
  ConsoleEntry,
  VirtualFS,
  PackageManager,
  RuntimePlugin,
} from './types.js';
import { createKernel, createConfig, topologicalSort } from './kernel.js';
import { createModuleLoader } from './core/module-loader.js';
import { createConsoleCapture } from './shims/console.js';
import { RuntimeError } from './errors.js';
import { vfsPlugin } from './plugins/core/vfs-plugin.js';
import { shimsPlugin } from './plugins/core/shims-plugin.js';
import { _bindVFS } from './shims/fs.js';
import processShim from './shims/process.js';

// Re-export types
export type {
  Runtime,
  RuntimeOptions,
  ContainerOptions,
  RuntimePlugin,
  ExecuteResult,
  ConsoleEntry,
  VirtualFS,
  PackageManager,
  RuntimeKernel,
  RuntimeConfig,
  RuntimeMode,
  FSStats,
  Dirent,
  WatchOptions,
  WatchListener,
  FSWatcher,
  ModuleLoader,
  VFSPluginOptions,
  ShimsPluginOptions,
  NpmPluginOptions,
  TransformPluginOptions,
  SandboxPluginOptions,
  PersistencePluginOptions,
} from './types.js';

export { RuntimeError, createError } from './errors.js';

/**
 * Create a runtime instance with specified plugins.
 *
 * @example
 * ```typescript
 * import { createRuntime } from '@oxog/runtime';
 * import { vfsPlugin, shimsPlugin } from '@oxog/runtime/plugins';
 *
 * const runtime = createRuntime({
 *   plugins: [vfsPlugin(), shimsPlugin({ tier: 'full' })],
 * });
 * ```
 */
export function createRuntime(options?: RuntimeOptions): Runtime {
  const config = createConfig({
    cwd: options?.cwd,
    env: options?.env,
    mode: options?.mode,
  });

  const kernel = createKernel(config);
  const plugins = options?.plugins ?? [];

  // Sort plugins topologically and install
  const sorted = topologicalSort(plugins);
  for (const plugin of sorted) {
    kernel.use(plugin);
  }

  // Create module loader
  const moduleLoader = createModuleLoader(kernel);

  // Register shims if shims plugin is loaded
  const shims = (kernel as any)._shims as Map<string, unknown> | undefined;
  if (shims) {
    for (const [name, shimModule] of shims) {
      moduleLoader.registerBuiltin(name, shimModule);
    }
  }

  // Bind fs shim to VFS and configure process shim
  try { _bindVFS(kernel.vfs); } catch { /* VFS may not be available */ }
  processShim._configure(config.cwd, config.env);

  // Call onReady for all plugins
  for (const plugin of sorted) {
    if (plugin.onReady) {
      const result = plugin.onReady();
      if (result instanceof Promise) {
        result.catch((err: unknown) => {
          kernel.emit('error', err, `plugin:${plugin.name}:onReady`);
        });
      }
    }
  }

  kernel.emit('ready');

  // Create runtime facade
  const runtime: Runtime = {
    get vfs(): VirtualFS {
      return kernel.vfs;
    },

    get npm(): PackageManager | null {
      // Will be set by npmPlugin
      return (kernel as any)._npm ?? null;
    },

    execute(code: string, filename?: string): ExecuteResult {
      const fname = filename ?? `/__exec_${Date.now()}.js`;
      const onConsole = options?.onConsole;
      const { console: capturedConsole, entries } = createConsoleCapture(
        onConsole
          ? (entry) => onConsole(entry.method, entry.args)
          : undefined,
      );

      // Write temporary file to VFS for module system compatibility
      try {
        kernel.vfs.writeFileSync(fname, code);
      } catch {
        // VFS may not be available — execute directly
      }

      // Create a wrapped execution context
      const consoleProxy = capturedConsole;
      const wrappedCode = code;

      try {
        // Try using the module loader first (provides require, __filename, etc.)
        try {
          // Clear any cached version
          moduleLoader.clearCache();
          kernel.vfs.writeFileSync(fname, wrappedCode);
          const exports = moduleLoader.require(fname, config.cwd + '/');
          return { exports, console: entries };
        } catch {
          // Fallback: direct execution
          const fn = new Function('console', 'require', 'module', 'exports',
            wrappedCode + '\n//# sourceURL=vfs://' + fname,
          );
          const mod = { exports: {} as any };
          fn(consoleProxy, (spec: string) => moduleLoader.require(spec, fname), mod, mod.exports);
          return { exports: mod.exports, console: entries };
        }
      } catch (err) {
        if (err instanceof RuntimeError) throw err;
        throw new RuntimeError(
          err instanceof Error ? err.message : String(err),
          'EXECUTION_ERROR',
          fname,
        );
      }
    },

    runFile(path: string): ExecuteResult {
      const code = kernel.vfs.readFileSync(path, 'utf8') as string;
      return runtime.execute(code, path);
    },

    require(specifier: string): unknown {
      return moduleLoader.require(specifier, config.cwd + '/');
    },

    async import(specifier: string): Promise<unknown> {
      return moduleLoader.import(specifier, config.cwd + '/');
    },

    use(plugin: RuntimePlugin): void {
      kernel.use(plugin);
      // Register any new shims
      const newShims = (kernel as any)._shims as Map<string, unknown> | undefined;
      if (newShims) {
        for (const [name, shimModule] of newShims) {
          moduleLoader.registerBuiltin(name, shimModule);
        }
      }
    },

    clearCache(): void {
      moduleLoader.clearCache();
    },

    destroy(): void {
      kernel.emit('destroy');
      const pluginNames = [...kernel.listPlugins()].reverse();
      for (const name of pluginNames) {
        try {
          kernel.unregister(name);
        } catch {
          // Best effort cleanup
        }
      }
    },
  };

  return runtime;
}

/**
 * Create a full runtime with all plugins pre-loaded.
 *
 * @example
 * ```typescript
 * import { createContainer } from '@oxog/runtime';
 *
 * const container = createContainer();
 * container.vfs.writeFileSync('/app.js', 'console.log("hello")');
 * container.runFile('/app.js');
 * ```
 */
export function createContainer(options?: ContainerOptions): Runtime {
  const plugins: RuntimePlugin[] = [
    vfsPlugin({ persistence: options?.persistence }),
    shimsPlugin({ tier: options?.shimTier ?? 'full' }),
  ];

  return createRuntime({
    ...options,
    plugins,
  });
}
