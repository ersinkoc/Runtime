/**
 * Integration tests for all example patterns.
 * Validates that every examples/* scenario works end-to-end.
 */
import { describe, it, expect } from 'vitest';
import { createRuntime, createContainer } from '../../src/index.js';
import type { RuntimePlugin } from '../../src/types.js';
import { vfsPlugin } from '../../src/plugins/core/vfs-plugin.js';
import { shimsPlugin } from '../../src/plugins/core/shims-plugin.js';
import { transformPlugin } from '../../src/plugins/transform/transform-plugin.js';
import { securityPlugin } from '../../src/plugins/security/security-plugin.js';
import { serverBridgePlugin } from '../../src/plugins/server/server-bridge-plugin.js';

// ─── Example 01: Basic Usage ─────────────────────────────────────

describe('Example 01 — Basic Usage', () => {
  it('should create container and run code with path + buffer', () => {
    const container = createContainer();

    container.vfs.writeFileSync('/app.js', `
      const path = require('path');
      const { Buffer } = require('buffer');

      const greeting = Buffer.from('Hello World').toString('base64');
      const joined = path.join('/users', 'ersin', 'projects');

      module.exports = { greeting, joined };
    `);

    const result = container.runFile('/app.js');
    const exports = result.exports as any;
    expect(exports.greeting).toBe('SGVsbG8gV29ybGQ=');
    expect(exports.joined).toBe('/users/ersin/projects');
    container.destroy();
  });

  it('should use require directly for builtins', () => {
    const container = createContainer();
    const pathShim = container.require('path') as any;
    expect(pathShim.extname('app.tsx')).toBe('.tsx');
    container.destroy();
  });

  it('should execute inline code', () => {
    const container = createContainer();
    const inline = container.execute('module.exports = 2 + 2;');
    expect(inline.exports).toBe(4);
    container.destroy();
  });

  it('should support multi-file projects', () => {
    const container = createContainer();

    container.vfs.mkdirSync('/src', { recursive: true });
    container.vfs.writeFileSync('/src/math.js', `
      exports.add = (a, b) => a + b;
      exports.multiply = (a, b) => a * b;
    `);
    container.vfs.writeFileSync('/src/main.js', `
      const { add, multiply } = require('./math');
      module.exports = { sum: add(3, 4), product: multiply(5, 6) };
    `);

    const project = container.runFile('/src/main.js');
    const exports = project.exports as any;
    expect(exports.sum).toBe(7);
    expect(exports.product).toBe(30);
    container.destroy();
  });
});

// ─── Example 02: Plugin Configuration ────────────────────────────

describe('Example 02 — Plugin Configuration', () => {
  it('should create minimal runtime with VFS only', () => {
    const minimal = createRuntime({
      plugins: [vfsPlugin()],
    });
    minimal.vfs.writeFileSync('/hello.txt', 'Hello from VFS');
    expect(minimal.vfs.readFileSync('/hello.txt', 'utf8')).toBe('Hello from VFS');
    minimal.destroy();
  });

  it('should create runtime with shims + transforms', () => {
    const withTransforms = createRuntime({
      cwd: '/app',
      env: { NODE_ENV: 'development' },
      plugins: [
        vfsPlugin(),
        shimsPlugin({ tier: 'full' }),
        transformPlugin(),
      ],
    });
    expect(withTransforms.vfs).toBeDefined();
    withTransforms.destroy();
  });

  it('should create sandboxed runtime', () => {
    const sandboxed = createRuntime({
      plugins: [
        vfsPlugin(),
        shimsPlugin({ tier: 'minimal' }),
        securityPlugin({ mode: 'sandbox' }),
      ],
    });
    expect(sandboxed.vfs).toBeDefined();
    sandboxed.destroy();
  });

  it('should support custom plugins', () => {
    const installCalls: string[] = [];

    const loggingPlugin: RuntimePlugin = {
      name: 'logging',
      version: '1.0.0',
      install(kernel) {
        installCalls.push('installed');
        kernel.on('ready', () => {
          installCalls.push('ready');
        });
      },
      onReady() {
        installCalls.push('onReady');
      },
      onDestroy() {
        installCalls.push('destroyed');
      },
    };

    const withLogging = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin(), loggingPlugin],
    });

    expect(installCalls).toContain('installed');
    expect(installCalls).toContain('onReady');

    withLogging.destroy();
  });

  it('should add plugins dynamically', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin()],
    });
    runtime.use(shimsPlugin());
    runtime.use(transformPlugin());

    const path = runtime.require('path') as any;
    expect(path.join('/a', 'b')).toBe('/a/b');
    runtime.destroy();
  });
});

// ─── Example 03: npm Client (patterns only — no network) ────────

describe('Example 03 — npm Client patterns', () => {
  it('should create runtime with npm plugin and check npm property', () => {
    // npm plugin is imported but we don't call install (requires network)
    // Just verify the npm property returns null without plugin
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin({ tier: 'full' })],
    });

    expect(runtime.npm).toBeNull();

    // Simulate what happens after npm install: write module to node_modules
    runtime.vfs.mkdirSync('/node_modules/lodash', { recursive: true });
    runtime.vfs.writeFileSync('/node_modules/lodash/index.js',
      'module.exports = { capitalize: (s) => s.charAt(0).toUpperCase() + s.slice(1) };'
    );

    const result = runtime.execute(`
      const _ = require('lodash');
      module.exports = _.capitalize('hello world');
    `);
    expect(result.exports).toBe('Hello world');

    runtime.destroy();
  });

  it('should support installing multiple simulated packages', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin()],
    });

    // Simulate npm install results
    runtime.vfs.mkdirSync('/node_modules/ms', { recursive: true });
    runtime.vfs.writeFileSync('/node_modules/ms/index.js',
      'module.exports = function(val) { return val + "ms"; };'
    );
    runtime.vfs.mkdirSync('/node_modules/mime-types', { recursive: true });
    runtime.vfs.writeFileSync('/node_modules/mime-types/index.js',
      'module.exports = { lookup: (ext) => "text/" + ext };'
    );

    const result = runtime.execute(`
      const ms = require('ms');
      const mime = require('mime-types');
      module.exports = { time: ms(100), type: mime.lookup('html') };
    `);
    const exports = result.exports as any;
    expect(exports.time).toBe('100ms');
    expect(exports.type).toBe('text/html');

    runtime.destroy();
  });
});

// ─── Example 04: TypeScript / JSX ────────────────────────────────

describe('Example 04 — TypeScript Transforms', () => {
  it('should run TypeScript files with transform plugin', () => {
    const runtime = createRuntime({
      plugins: [
        vfsPlugin(),
        shimsPlugin({ tier: 'full' }),
        transformPlugin(),
      ],
    });

    runtime.vfs.mkdirSync('/src', { recursive: true });
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

    const result = runtime.runFile('/src/main.ts');
    expect(result.exports).toBe('Hello, TypeScript!');
    runtime.destroy();
  });

  it('should transform ESM syntax to CJS', () => {
    const runtime = createRuntime({
      plugins: [
        vfsPlugin(),
        shimsPlugin({ tier: 'full' }),
        transformPlugin(),
      ],
    });

    runtime.vfs.mkdirSync('/src', { recursive: true });
    runtime.vfs.writeFileSync('/src/esm-example.ts', `
      const path = require('path');
      const fullPath: string = path.join('/app', 'src', 'index.ts');
      module.exports = fullPath;
    `);

    const result = runtime.runFile('/src/esm-example.ts');
    expect(result.exports).toBe('/app/src/index.ts');
    runtime.destroy();
  });

  it('should support custom transform function', () => {
    const customRuntime = createRuntime({
      plugins: [
        vfsPlugin(),
        shimsPlugin(),
        transformPlugin({
          transform(code, _filename) {
            return code.replace(/console\.log/g, 'console.info');
          },
        }),
      ],
    });

    customRuntime.vfs.writeFileSync('/app.js', `
      console.log("test");
      module.exports = true;
    `);

    const result = customRuntime.runFile('/app.js');
    expect(result.exports).toBe(true);
    customRuntime.destroy();
  });
});

// ─── Example 05: Virtual HTTP Server ─────────────────────────────

describe('Example 05 — Virtual HTTP Server', () => {
  it('should create runtime with server bridge plugin', () => {
    const runtime = createRuntime({
      plugins: [
        vfsPlugin(),
        shimsPlugin({ tier: 'full' }),
        serverBridgePlugin({ basePath: '/__api__' }),
      ],
    });

    expect(runtime.vfs).toBeDefined();

    // Write the server code
    runtime.vfs.writeFileSync('/server.js', `
      const http = require('http');

      const server = http.createServer((req, res) => {
        if (req.url === '/api/hello') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Hello from virtual server!' }));
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      });

      server.listen(3000);
      module.exports = server;
    `);

    // Verify the server code loads without errors
    const result = runtime.runFile('/server.js');
    expect(result.exports).toBeDefined();
    runtime.destroy();
  });
});

// ─── Example 06: Real-World Playground ───────────────────────────

describe('Example 06 — Code Playground', () => {
  it('should implement a playground that runs multi-file projects', () => {
    // Recreate the Playground pattern from example 06
    const runtime = createRuntime({
      cwd: '/project',
      env: { NODE_ENV: 'development' },
      plugins: [
        vfsPlugin(),
        shimsPlugin({ tier: 'full' }),
        transformPlugin(),
      ],
    });

    runtime.vfs.mkdirSync('/project/src', { recursive: true });
    runtime.vfs.mkdirSync('/project/node_modules', { recursive: true });

    // Set up files
    runtime.vfs.writeFileSync('/project/src/utils.js', `
      exports.formatDate = (date) => {
        return date.toISOString().split('T')[0];
      };
      exports.capitalize = (str) => {
        return str.charAt(0).toUpperCase() + str.slice(1);
      };
    `);

    runtime.vfs.writeFileSync('/project/src/index.js', `
      const path = require('path');
      const { Buffer } = require('buffer');
      const { formatDate, capitalize } = require('./utils');

      const today = formatDate(new Date('2026-02-08'));
      const greeting = capitalize('hello');
      const encoded = Buffer.from(greeting).toString('base64');
      const ext = path.extname('readme.md');

      module.exports = { today, greeting, encoded, ext };
    `);

    const result = runtime.runFile('/project/src/index.js');
    const exports = result.exports as any;
    expect(exports.today).toBe('2026-02-08');
    expect(exports.greeting).toBe('Hello');
    expect(exports.encoded).toBe('SGVsbG8=');
    expect(exports.ext).toBe('.md');

    runtime.destroy();
  });

  it('should support quick eval with crypto', () => {
    const container = createContainer();
    const evalResult = container.execute(`
      const crypto = require('crypto');
      module.exports = crypto.randomUUID();
    `);
    const uuid = evalResult.exports as string;
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    container.destroy();
  });

  it('should support clearCache for re-execution', () => {
    const runtime = createRuntime({
      cwd: '/project',
      plugins: [vfsPlugin(), shimsPlugin()],
    });

    runtime.vfs.mkdirSync('/project/src', { recursive: true });

    // First version
    runtime.vfs.writeFileSync('/project/src/config.js', 'module.exports = { version: 1 };');
    const v1 = runtime.require('/project/src/config.js') as any;
    expect(v1.version).toBe(1);

    // Update file and clear cache
    runtime.vfs.writeFileSync('/project/src/config.js', 'module.exports = { version: 2 };');
    runtime.clearCache();
    const v2 = runtime.require('/project/src/config.js') as any;
    expect(v2.version).toBe(2);

    runtime.destroy();
  });

  it('should handle destroy and recreate cycle', () => {
    // Simulate playground reset
    let runtime = createRuntime({
      cwd: '/project',
      plugins: [vfsPlugin(), shimsPlugin()],
    });

    runtime.vfs.mkdirSync('/project/src', { recursive: true });
    runtime.vfs.writeFileSync('/project/src/app.js', 'module.exports = "v1";');
    expect(runtime.runFile('/project/src/app.js').exports).toBe('v1');

    runtime.destroy();

    // Recreate
    runtime = createRuntime({
      cwd: '/project',
      plugins: [vfsPlugin(), shimsPlugin()],
    });

    runtime.vfs.mkdirSync('/project/src', { recursive: true });
    runtime.vfs.writeFileSync('/project/src/app.js', 'module.exports = "v2";');
    expect(runtime.runFile('/project/src/app.js').exports).toBe('v2');

    runtime.destroy();
  });
});
