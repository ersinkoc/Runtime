/**
 * npm Plugin — provides browser-based npm package installation.
 * @module plugins/npm/npm-plugin
 */

import type { RuntimePlugin, RuntimeKernel, VirtualFS } from '../../types.js';
import { PackageManager, type PackageManagerOptions } from '../../npm/package-manager.js';

export interface NpmPluginOptions extends PackageManagerOptions {}

/**
 * Create a browser-based npm package manager plugin.
 *
 * @example
 * ```typescript
 * const runtime = createRuntime({
 *   plugins: [vfsPlugin(), shimsPlugin(), npmPlugin()],
 * });
 * await runtime.npm.install('lodash');
 * ```
 */
export function npmPlugin(options?: NpmPluginOptions): RuntimePlugin {
  let pm: PackageManager | null = null;

  return {
    name: 'npm',
    version: '1.0.0',

    install(kernel: RuntimeKernel): void {
      // Create package manager once VFS is available
      const vfs = kernel.vfs;
      pm = new PackageManager(vfs, options);

      // Store on kernel for direct access
      (kernel as any)._npm = pm;

      // Expose via event for other plugins
      kernel.on('__getNpm', (...args: unknown[]) => {
        const callback = args[0] as (pm: PackageManager) => void;
        if (pm) callback(pm);
      });
    },

    async onDestroy(): Promise<void> {
      pm = null;
    },
  };
}
