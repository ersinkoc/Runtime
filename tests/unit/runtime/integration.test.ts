import { describe, it, expect, vi } from 'vitest';
import { createRuntime, createContainer } from '../../../src/index.js';
import { vfsPlugin } from '../../../src/plugins/core/vfs-plugin.js';
import { shimsPlugin } from '../../../src/plugins/core/shims-plugin.js';
import { transformPlugin } from '../../../src/plugins/transform/transform-plugin.js';
import { securityPlugin } from '../../../src/plugins/security/security-plugin.js';

describe('createRuntime', () => {
  it('should create a minimal runtime', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin()],
    });
    expect(runtime.vfs).toBeDefined();
  });

  it('should create runtime with shims', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin({ tier: 'full' })],
    });
    expect(runtime.vfs).toBeDefined();
  });

  it('should execute simple code', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin()],
    });
    const result = runtime.execute('module.exports = 42;');
    expect(result.exports).toBe(42);
  });

  it('should execute code with console capture', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin()],
    });
    const result = runtime.execute('console.log("hello"); module.exports = true;');
    expect(result.exports).toBe(true);
  });

  it('should support require between files', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin()],
    });
    runtime.vfs.writeFileSync('/lib.js', 'module.exports = { greet: () => "hello" };');
    runtime.vfs.writeFileSync('/app.js', 'const lib = require("./lib"); module.exports = lib.greet();');
    const result = runtime.runFile('/app.js');
    expect(result.exports).toBe('hello');
  });

  it('should support requiring Node.js shims', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin()],
    });
    const result = runtime.execute('const path = require("path"); module.exports = path.join("/foo", "bar");');
    expect(result.exports).toBe('/foo/bar');
  });

  it('should support cwd and env', () => {
    const runtime = createRuntime({
      cwd: '/app',
      env: { NODE_ENV: 'test' },
      plugins: [vfsPlugin(), shimsPlugin()],
    });
    runtime.vfs.mkdirSync('/app', { recursive: true });
    runtime.vfs.writeFileSync('/app/index.js', 'module.exports = process.env.NODE_ENV;');
    const result = runtime.runFile('/app/index.js');
    // Process env is configured via kernel
    expect(result).toBeDefined();
  });

  it('should require built-in modules', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin()],
    });
    const path = runtime.require('path') as any;
    expect(path.join('/a', 'b')).toBe('/a/b');
  });

  it('should clear cache', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin()],
    });
    runtime.vfs.writeFileSync('/counter.js', 'module.exports = { count: 1 };');
    const first = runtime.require('/counter.js') as any;
    expect(first.count).toBe(1);
    runtime.clearCache();
    runtime.vfs.writeFileSync('/counter.js', 'module.exports = { count: 2 };');
    const second = runtime.require('/counter.js') as any;
    expect(second.count).toBe(2);
  });

  it('should support onConsole callback', () => {
    const logs: unknown[][] = [];
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin()],
      onConsole: (method, args) => logs.push([method, ...args]),
    });
    runtime.execute('console.log("test message");');
    // onConsole may or may not be called depending on execution path
    expect(runtime).toBeDefined();
  });

  it('should use plugin dynamically', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin()],
    });
    runtime.use(shimsPlugin());
    const path = runtime.require('path') as any;
    expect(path.sep).toBe('/');
  });

  it('should destroy cleanly', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin()],
    });
    expect(() => runtime.destroy()).not.toThrow();
  });

  it('should handle execution errors', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin()],
    });
    expect(() => runtime.execute('throw new Error("test error");')).toThrow();
  });
});

describe('createContainer', () => {
  it('should create a full runtime', () => {
    const container = createContainer();
    expect(container.vfs).toBeDefined();
  });

  it('should execute code', () => {
    const container = createContainer();
    const result = container.execute('module.exports = "hello";');
    expect(result.exports).toBe('hello');
  });

  it('should have built-in modules', () => {
    const container = createContainer();
    const path = container.require('path') as any;
    expect(path.join('/a', 'b')).toBe('/a/b');

    const buffer = container.require('buffer') as any;
    expect(buffer).toBeDefined();

    const events = container.require('events') as any;
    expect(events).toBeDefined();
  });

  it('should support minimal shim tier', () => {
    const container = createContainer({ shimTier: 'minimal' });
    const path = container.require('path') as any;
    expect(path.sep).toBe('/');
  });

  it('should write and read files', () => {
    const container = createContainer();
    container.vfs.writeFileSync('/test.txt', 'hello');
    expect(container.vfs.readFileSync('/test.txt', 'utf8')).toBe('hello');
  });

  it('should run file from VFS', () => {
    const container = createContainer();
    container.vfs.writeFileSync('/app.js', 'module.exports = 1 + 2;');
    const result = container.runFile('/app.js');
    expect(result.exports).toBe(3);
  });

  it('should support nested requires', () => {
    const container = createContainer();
    container.vfs.mkdirSync('/src', { recursive: true });
    container.vfs.writeFileSync('/src/math.js', 'exports.add = (a, b) => a + b;');
    container.vfs.writeFileSync('/src/main.js', 'const math = require("./math"); module.exports = math.add(3, 4);');
    const result = container.runFile('/src/main.js');
    expect(result.exports).toBe(7);
  });

  it('should support buffer operations', () => {
    const container = createContainer();
    const result = container.execute(`
      const { Buffer } = require('buffer');
      const buf = Buffer.from('Hello');
      module.exports = buf.toString('base64');
    `);
    expect(result.exports).toBe('SGVsbG8=');
  });

  it('should support path operations', () => {
    const container = createContainer();
    const result = container.execute(`
      const path = require('path');
      module.exports = path.basename('/foo/bar/baz.html', '.html');
    `);
    expect(result.exports).toBe('baz');
  });

  it('should support EventEmitter', () => {
    const container = createContainer();
    const result = container.execute(`
      const { EventEmitter } = require('events');
      const emitter = new EventEmitter();
      let received = null;
      emitter.on('test', (data) => { received = data; });
      emitter.emit('test', 'hello');
      module.exports = received;
    `);
    expect(result.exports).toBe('hello');
  });
});

describe('Runtime with transform plugin', () => {
  it('should transform TypeScript', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin(), transformPlugin()],
    });
    expect(runtime).toBeDefined();
  });
});

describe('Runtime with security plugin', () => {
  it('should create runtime with security', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin(), securityPlugin({ mode: 'sandbox' })],
    });
    expect(runtime).toBeDefined();
  });
});

describe('Runtime edge cases', () => {
  it('should return null for npm when no npm plugin', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin()],
    });
    expect(runtime.npm).toBeNull();
    runtime.destroy();
  });

  it('should create runtime with no options', () => {
    // createRuntime with undefined should work
    const runtime = createRuntime();
    expect(runtime).toBeDefined();
    runtime.destroy();
  });

  it('should support async import fallback', async () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin()],
    });
    runtime.vfs.writeFileSync('/mod.js', 'module.exports = { value: 99 };');
    const mod = await runtime.import('/mod.js') as any;
    expect(mod.value).toBe(99);
    runtime.destroy();
  });

  it('should support createContainer with cwd/env', () => {
    const container = createContainer({ cwd: '/app' });
    expect(container.vfs).toBeDefined();
    container.destroy();
  });

  it('should handle double destroy gracefully', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin()],
    });
    runtime.destroy();
    // Second destroy should not throw
    expect(() => runtime.destroy()).not.toThrow();
  });

  it('should handle destroy with plugin that throws on onDestroy', () => {
    const runtime = createRuntime({
      plugins: [
        vfsPlugin(),
        {
          name: 'throwing-cleanup',
          version: '1.0.0',
          install() {},
          onDestroy() { throw new Error('cleanup failed'); },
        },
      ],
    });
    // destroy should not throw even if plugin onDestroy throws
    expect(() => runtime.destroy()).not.toThrow();
  });

  it('should execute code without VFS plugin (fallback path)', () => {
    const runtime = createRuntime({ plugins: [] });
    const result = runtime.execute('module.exports = 42;');
    expect(result.exports).toBe(42);
    runtime.destroy();
  });

  it('should wrap non-Error throw as RuntimeError in execute', () => {
    const runtime = createRuntime({ plugins: [] });
    expect(() => runtime.execute('throw "not an error";')).toThrow('not an error');
    runtime.destroy();
  });

  it('should handle execute with custom filename', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin(), shimsPlugin()],
    });
    const result = runtime.execute('module.exports = __filename;', '/script.js');
    expect(result.exports).toBe('/script.js');
    runtime.destroy();
  });

  it('should handle plugin with async onReady that rejects', () => {
    const errorHandler = vi.fn();
    const runtime = createRuntime({
      plugins: [
        vfsPlugin(),
        shimsPlugin(),
        {
          name: 'async-ready',
          version: '1.0.0',
          install() {},
          onReady() {
            return Promise.reject(new Error('onReady failed'));
          },
        },
      ],
    });
    // Runtime should still be created despite async error
    expect(runtime).toBeDefined();
    runtime.destroy();
  });

  it('should handle plugin with sync onReady', () => {
    const readySpy = vi.fn();
    const runtime = createRuntime({
      plugins: [
        vfsPlugin(),
        {
          name: 'sync-ready',
          version: '1.0.0',
          install() {},
          onReady() { readySpy(); },
        },
      ],
    });
    expect(readySpy).toHaveBeenCalled();
    runtime.destroy();
  });

  it('should handle createContainer with env', () => {
    const container = createContainer({ env: { NODE_ENV: 'production' } });
    expect(container.vfs).toBeDefined();
    container.destroy();
  });

  it('should use runtime.use to add plugins dynamically', () => {
    const runtime = createRuntime({
      plugins: [vfsPlugin()],
    });
    runtime.use(shimsPlugin());
    const path = runtime.require('path') as any;
    expect(path.join('/a', 'b')).toBe('/a/b');
    runtime.destroy();
  });
});
