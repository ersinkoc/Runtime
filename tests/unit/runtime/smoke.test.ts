import { describe, it, expect } from 'vitest';
import { createRuntime, createContainer } from '../../../src/index.js';
import { vfsPlugin } from '../../../src/plugins/core/vfs-plugin.js';
import { shimsPlugin } from '../../../src/plugins/core/shims-plugin.js';
import { transformPlugin } from '../../../src/plugins/transform/transform-plugin.js';
import { securityPlugin } from '../../../src/plugins/security/security-plugin.js';

describe('smoke tests', () => {
  it('should create runtime and execute basic code', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin()],
    });
    const result = runtime.execute('module.exports = 1 + 2;');
    expect(result.exports).toBe(3);
    runtime.destroy();
  });

  it('should support multi-file require', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin()],
    });
    runtime.vfs.mkdirSync('/lib', { recursive: true });
    runtime.vfs.writeFileSync('/lib/math.js', `
      exports.add = (a, b) => a + b;
      exports.mul = (a, b) => a * b;
    `);
    const result = runtime.execute(`
      const { add, mul } = require('./lib/math');
      module.exports = { sum: add(2, 3), product: mul(4, 5) };
    `, '/index.js');
    expect(result.exports).toEqual({ sum: 5, product: 20 });
    runtime.destroy();
  });

  it('should support Node.js builtin shims', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin({ tier: 'full' })],
    });
    const result = runtime.execute(`
      const path = require('path');
      const { Buffer } = require('buffer');
      const { EventEmitter } = require('events');

      const ext = path.extname('readme.md');
      const buf = Buffer.from('hello');
      const ee = new EventEmitter();
      let received = null;
      ee.on('data', (v) => { received = v; });
      ee.emit('data', 42);

      module.exports = { ext, bufLen: buf.length, received };
    `);
    expect(result.exports).toEqual({ ext: '.md', bufLen: 5, received: 42 });
    runtime.destroy();
  });

  it('should handle JSON files', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin()],
    });
    runtime.vfs.writeFileSync('/data.json', JSON.stringify({ name: 'test', version: '1.0.0' }));
    const result = runtime.execute(`
      const pkg = require('./data.json');
      module.exports = pkg.name + '@' + pkg.version;
    `, '/index.js');
    expect(result.exports).toBe('test@1.0.0');
    runtime.destroy();
  });

  it('should support createContainer convenience function', () => {
    const container = createContainer();
    const result = container.execute('module.exports = "hello from container";');
    expect(result.exports).toBe('hello from container');
    container.destroy();
  });

  it('should support circular dependencies', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin()],
    });
    runtime.vfs.writeFileSync('/a.js', `
      exports.name = 'a';
      const b = require('./b');
      exports.bName = b.name;
    `);
    runtime.vfs.writeFileSync('/b.js', `
      exports.name = 'b';
      const a = require('./a');
      exports.aName = a.name;
    `);
    const result = runtime.execute(`
      const a = require('./a');
      module.exports = { aName: a.name, aBName: a.bName };
    `, '/index.js');
    expect(result.exports).toEqual({ aName: 'a', aBName: 'b' });
    runtime.destroy();
  });

  it('should support crypto shim', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin({ tier: 'full' })],
    });
    const result = runtime.execute(`
      const crypto = require('crypto');
      const uuid = crypto.randomUUID();
      module.exports = typeof uuid === 'string' && uuid.length === 36;
    `);
    expect(result.exports).toBe(true);
    runtime.destroy();
  });

  it('should support fs shim writing and reading', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin({ tier: 'full' })],
    });
    const result = runtime.execute(`
      const fs = require('fs');
      fs.writeFileSync('/test.txt', 'hello world');
      module.exports = fs.readFileSync('/test.txt', 'utf8');
    `);
    expect(result.exports).toBe('hello world');
    runtime.destroy();
  });

  it('should support process shim', () => {
    const runtime = createRuntime({
      cwd: '/myapp',
      env: { NODE_ENV: 'production', APP_NAME: 'test' },
      plugins: [vfsPlugin(), shimsPlugin({ tier: 'full' })],
    });
    const result = runtime.execute(`
      const process = require('process');
      module.exports = {
        cwd: process.cwd(),
        env: process.env.NODE_ENV,
        app: process.env.APP_NAME,
        platform: process.platform,
      };
    `);
    expect(result.exports).toEqual({
      cwd: '/myapp',
      env: 'production',
      app: 'test',
      platform: 'browser',
    });
    runtime.destroy();
  });

  it('should support security plugin with allowlist', () => {
    const runtime = createRuntime({
      plugins: [
        vfsPlugin(),
        shimsPlugin({ tier: 'full' }),
        securityPlugin({
          mode: 'sandbox',
          allowedModules: ['path', 'buffer'],
        }),
      ],
    });
    // Allowed module should work
    const result = runtime.execute(`
      const path = require('path');
      module.exports = path.join('/a', 'b');
    `);
    expect(result.exports).toBe('/a/b');
    runtime.destroy();
  });

  it('should support transform plugin for ESM conversion', () => {
    const runtime = createRuntime({
      plugins: [
        vfsPlugin(),
        shimsPlugin({ tier: 'full' }),
        transformPlugin(),
      ],
    });
    // CJS code should work normally
    const result = runtime.execute('module.exports = 42;');
    expect(result.exports).toBe(42);
    runtime.destroy();
  });

  it('should handle runtime errors gracefully', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin()],
    });
    expect(() => runtime.execute('throw new Error("boom");')).toThrow('boom');
    runtime.destroy();
  });

  it('should handle module not found errors', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin()],
    });
    expect(() => runtime.execute('require("nonexistent");')).toThrow();
    runtime.destroy();
  });

  it('should support runFile', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin()],
    });
    runtime.vfs.writeFileSync('/app.js', 'module.exports = "from file";');
    const result = runtime.runFile('/app.js');
    expect(result.exports).toBe('from file');
    runtime.destroy();
  });

  it('should support clearCache for re-execution', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin()],
    });
    runtime.vfs.writeFileSync('/counter.js', 'module.exports = { n: 0 };');
    const first = runtime.require('/counter.js') as any;
    first.n = 99;
    runtime.clearCache();
    const second = runtime.require('/counter.js') as any;
    expect(second.n).toBe(0);
    runtime.destroy();
  });
});
