/**
 * VFS Plugin — registers the Virtual File System with the kernel.
 * @module plugins/core/vfs-plugin
 */

import type { RuntimePlugin, RuntimeKernel, VFSPluginOptions } from '../../types.js';
import { VirtualFS } from '../../vfs/virtual-fs.js';

/**
 * Create the VFS plugin.
 *
 * @example
 * ```typescript
 * const runtime = createRuntime({
 *   plugins: [vfsPlugin()],
 * });
 * runtime.vfs.writeFileSync('/hello.txt', 'world');
 * ```
 */
export function vfsPlugin(options?: VFSPluginOptions): RuntimePlugin {
  let vfs: VirtualFS;

  return {
    name: 'vfs',
    version: '1.0.0',

    install(kernel: RuntimeKernel): void {
      vfs = new VirtualFS();

      // Set VFS on kernel via internal setter
      (kernel as any)._setVfs(vfs);

      // Create default directories
      vfs.mkdirSync('/tmp', { recursive: true });
    },

    onDestroy(): void {
      // VFS cleanup if needed in the future
    },
  };
}
