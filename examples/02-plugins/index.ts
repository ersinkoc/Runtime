/**
 * Example 02 — Custom Plugin Configuration
 *
 * Demonstrates creating a runtime with specific plugins
 * and writing a custom plugin.
 */
import { createRuntime } from '@oxog/runtime';
import type { RuntimePlugin } from '@oxog/runtime';
import {
  vfsPlugin,
  shimsPlugin,
  transformPlugin,
  securityPlugin,
} from '@oxog/runtime/plugins';

// 1. Minimal runtime — VFS only
const minimal = createRuntime({
  plugins: [vfsPlugin()],
});
minimal.vfs.writeFileSync('/hello.txt', 'Hello from VFS');
console.log(minimal.vfs.readFileSync('/hello.txt', 'utf8')); // 'Hello from VFS'

// 2. Runtime with shims + transforms
const withTransforms = createRuntime({
  cwd: '/app',
  env: { NODE_ENV: 'development' },
  plugins: [
    vfsPlugin(),
    shimsPlugin({ tier: 'full' }),
    transformPlugin(),
  ],
});

// 3. Sandboxed runtime
const sandboxed = createRuntime({
  plugins: [
    vfsPlugin(),
    shimsPlugin({ tier: 'minimal' }),
    securityPlugin({ mode: 'sandbox' }),
  ],
});

// 4. Custom plugin
const loggingPlugin: RuntimePlugin = {
  name: 'logging',
  version: '1.0.0',

  install(kernel) {
    console.log(`[logging] Installed. Plugins: ${kernel.listPlugins().join(', ')}`);

    kernel.on('ready', () => {
      console.log('[logging] Runtime is ready');
    });
  },

  onReady() {
    console.log('[logging] onReady hook called');
  },

  onDestroy() {
    console.log('[logging] Plugin destroyed');
  },
};

const withLogging = createRuntime({
  plugins: [vfsPlugin(), shimsPlugin(), loggingPlugin],
});

// 5. Add plugin dynamically
withLogging.use(transformPlugin());

// 6. Cleanup
withLogging.destroy();
