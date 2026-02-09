/**
 * Example 06 — Real-World: In-Browser Code Playground
 *
 * Demonstrates building a code playground that executes user code
 * safely in the browser with full Node.js compatibility.
 */
import { createRuntime, createContainer } from '@oxog/runtime';
import type { Runtime, ExecuteResult } from '@oxog/runtime';
import {
  vfsPlugin,
  shimsPlugin,
  transformPlugin,
  securityPlugin,
} from '@oxog/runtime/plugins';

// ─── Playground Engine ───────────────────────────────────────────

class Playground {
  private runtime: Runtime;
  private files = new Map<string, string>();

  constructor() {
    this.runtime = createRuntime({
      cwd: '/project',
      env: { NODE_ENV: 'development' },
      plugins: [
        vfsPlugin(),
        shimsPlugin({ tier: 'full' }),
        transformPlugin(),
        securityPlugin({ mode: 'sandbox' }),
      ],
    });

    // Initialize project structure
    this.runtime.vfs.mkdirSync('/project/src', { recursive: true });
    this.runtime.vfs.mkdirSync('/project/node_modules', { recursive: true });
  }

  /** Add or update a file in the playground */
  setFile(path: string, content: string): void {
    const fullPath = `/project${path}`;
    this.files.set(path, content);
    this.runtime.vfs.writeFileSync(fullPath, content);
  }

  /** Run the main entry point */
  run(entryPoint: string = '/src/index.js'): ExecuteResult {
    this.runtime.clearCache();
    return this.runtime.runFile(`/project${entryPoint}`);
  }

  /** Execute arbitrary code */
  eval(code: string): ExecuteResult {
    this.runtime.clearCache();
    return this.runtime.execute(code);
  }

  /** List all files */
  listFiles(): string[] {
    return Array.from(this.files.keys());
  }

  /** Reset the playground */
  reset(): void {
    this.runtime.destroy();
    this.files.clear();
    this.runtime = createRuntime({
      cwd: '/project',
      plugins: [
        vfsPlugin(),
        shimsPlugin({ tier: 'full' }),
        transformPlugin(),
        securityPlugin({ mode: 'sandbox' }),
      ],
    });
    this.runtime.vfs.mkdirSync('/project/src', { recursive: true });
  }

  destroy(): void {
    this.runtime.destroy();
  }
}

// ─── Usage ───────────────────────────────────────────────────────

const playground = new Playground();

// Set up a multi-file project
playground.setFile('/src/utils.js', `
  exports.formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  exports.capitalize = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };
`);

playground.setFile('/src/index.js', `
  const path = require('path');
  const { Buffer } = require('buffer');
  const { formatDate, capitalize } = require('./utils');

  const today = formatDate(new Date());
  const greeting = capitalize('hello');
  const encoded = Buffer.from(greeting).toString('base64');
  const ext = path.extname('readme.md');

  module.exports = {
    today,
    greeting,
    encoded,
    ext,
  };
`);

// Run the project
const result = playground.run();
console.log('Result:', result.exports);

// Quick eval
const evalResult = playground.eval(`
  const crypto = require('crypto');
  module.exports = crypto.randomUUID();
`);
console.log('UUID:', evalResult.exports);

// Cleanup
playground.destroy();
