/**
 * Example 03 — Browser npm Client
 *
 * Demonstrates installing packages from CDN and using them in the runtime.
 * Note: This example requires network access (fetches from CDN).
 */
import { createRuntime } from '@oxog/runtime';
import {
  vfsPlugin,
  shimsPlugin,
  npmPlugin,
} from '@oxog/runtime/plugins';

async function main() {
  // 1. Create runtime with npm plugin
  const runtime = createRuntime({
    plugins: [
      vfsPlugin(),
      shimsPlugin({ tier: 'full' }),
      npmPlugin(),
    ],
  });

  // 2. Install a package
  if (runtime.npm) {
    await runtime.npm.install('lodash');
    console.log('Installed packages:', runtime.npm.list());
  }

  // 3. Use the installed package
  const result = runtime.execute(`
    const _ = require('lodash');
    module.exports = _.capitalize('hello world');
  `);
  console.log(result.exports); // 'Hello world'

  // 4. Install multiple packages
  if (runtime.npm) {
    await runtime.npm.install(['ms', 'mime-types']);
  }

  // 5. Cleanup
  runtime.destroy();
}

main().catch(console.error);
