/**
 * Shims Plugin — registers Node.js API shims with the kernel's module loader.
 * @module plugins/core/shims-plugin
 */

import type { RuntimePlugin, RuntimeKernel, ShimsPluginOptions, ModuleLoader } from '../../types.js';
import { getShims } from '../../shims/index.js';

/**
 * Create the shims plugin.
 *
 * @example
 * ```typescript
 * const runtime = createRuntime({
 *   plugins: [vfsPlugin(), shimsPlugin({ tier: 'full' })],
 * });
 * ```
 */
export function shimsPlugin(options?: ShimsPluginOptions): RuntimePlugin {
  return {
    name: 'shims',
    version: '1.0.0',

    install(kernel: RuntimeKernel): void {
      const shims = getShims({
        tier: options?.tier,
        include: options?.include,
        exclude: options?.exclude,
      });

      // Register shims as built-in modules via event
      // The module loader will pick these up
      kernel.on('__registerShims', (loader: unknown) => {
        if (loader && typeof (loader as any).registerBuiltin === 'function') {
          const ml = loader as ModuleLoader;
          for (const [name, shimModule] of shims) {
            ml.registerBuiltin(name, shimModule);
          }
        }
      });

      // Store shims on kernel for direct access
      (kernel as any)._shims = shims;
    },
  };
}
