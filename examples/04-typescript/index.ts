/**
 * Example 04 — TypeScript / JSX Transforms
 *
 * Demonstrates the transform plugin stripping TS and compiling JSX.
 */
import { createRuntime } from '@oxog/runtime';
import {
  vfsPlugin,
  shimsPlugin,
  transformPlugin,
} from '@oxog/runtime/plugins';

// 1. Create runtime with transforms
const runtime = createRuntime({
  plugins: [
    vfsPlugin(),
    shimsPlugin({ tier: 'full' }),
    transformPlugin(),
  ],
});

// 2. Write TypeScript code to VFS
runtime.vfs.writeFileSync('/src/greet.ts', `
  const greet = (name: string): string => {
    return 'Hello, ' + name + '!';
  };

  module.exports = { greet };
`);

runtime.vfs.writeFileSync('/src/main.ts', `
  const { greet } = require('./greet');
  module.exports = greet('TypeScript');
`);

// 3. Run TypeScript (auto-transformed to JS)
const result = runtime.runFile('/src/main.ts');
console.log(result.exports); // 'Hello, TypeScript!'

// 4. ESM syntax (auto-converted to CJS)
runtime.vfs.writeFileSync('/src/esm-example.ts', `
  import { join } from 'path';
  export const fullPath = join('/app', 'src', 'index.ts');
`);

// 5. Custom transform function
const customRuntime = createRuntime({
  plugins: [
    vfsPlugin(),
    shimsPlugin(),
    transformPlugin({
      transform(code, filename) {
        console.log(`Transforming: ${filename}`);
        // Add custom transform logic
        return code.replace(/console\.log/g, 'console.info');
      },
    }),
  ],
});

customRuntime.destroy();
runtime.destroy();
