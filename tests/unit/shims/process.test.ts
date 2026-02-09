import { describe, it, expect, vi } from 'vitest';
import processShim from '../../../src/shims/process.js';

describe('process shim', () => {
  it('should have platform and arch', () => {
    expect(processShim.platform).toBe('browser');
    expect(processShim.arch).toBe('wasm');
  });

  it('should have version info', () => {
    expect(processShim.version).toBe('v20.0.0');
    expect(processShim.versions.node).toBe('20.0.0');
  });

  it('should have pid and ppid', () => {
    expect(processShim.pid).toBe(1);
    expect(processShim.ppid).toBe(0);
  });

  it('should have title', () => {
    expect(processShim.title).toBe('@oxog/runtime');
  });

  it('should have argv and related', () => {
    expect(processShim.argv).toBeInstanceOf(Array);
    expect(processShim.argv.length).toBeGreaterThanOrEqual(2);
    expect(processShim.argv0).toBe('node');
    expect(processShim.execArgv).toEqual([]);
  });

  describe('cwd/chdir', () => {
    it('should get and set cwd', () => {
      const original = processShim.cwd();
      processShim.chdir('/test');
      expect(processShim.cwd()).toBe('/test');
      processShim.chdir(original);
    });
  });

  describe('env', () => {
    it('should get and set env', () => {
      processShim.env.TEST_VAR = 'hello';
      expect(processShim.env.TEST_VAR).toBe('hello');
      delete processShim.env.TEST_VAR;
    });

    it('should support env setter', () => {
      const original = processShim.env;
      const newEnv = { CUSTOM_KEY: 'custom_val' } as any;
      processShim.env = newEnv;
      expect(processShim.env.CUSTOM_KEY).toBe('custom_val');
      processShim.env = original;
    });
  });

  describe('exit', () => {
    it('should emit exit event and throw', () => {
      const handler = vi.fn();
      processShim.on('exit', handler);
      expect(() => processShim.exit(0)).toThrow('process.exit(0)');
      expect(handler).toHaveBeenCalledWith(0);
      processShim.off('exit', handler);
    });

    it('should default to code 0', () => {
      expect(() => processShim.exit()).toThrow('process.exit(0)');
    });
  });

  describe('abort', () => {
    it('should throw', () => {
      expect(() => processShim.abort()).toThrow('process.abort()');
    });
  });

  describe('nextTick', () => {
    it('should call callback asynchronously', async () => {
      const result: number[] = [];
      processShim.nextTick(() => result.push(2));
      result.push(1);
      await new Promise((r) => setTimeout(r, 10));
      expect(result).toEqual([1, 2]);
    });

    it('should pass arguments', async () => {
      const handler = vi.fn();
      processShim.nextTick(handler, 'a', 'b');
      await new Promise((r) => setTimeout(r, 10));
      expect(handler).toHaveBeenCalledWith('a', 'b');
    });
  });

  describe('hrtime', () => {
    it('should return [seconds, nanoseconds]', () => {
      const result = processShim.hrtime();
      expect(result).toHaveLength(2);
      expect(typeof result[0]).toBe('number');
      expect(typeof result[1]).toBe('number');
    });

    it('should compute difference', () => {
      const start = processShim.hrtime();
      const diff = processShim.hrtime(start);
      expect(diff[0]).toBeGreaterThanOrEqual(0);
    });

    it('should handle nanosecond underflow in diff', () => {
      // Pass a fake start with very high nanoseconds to force the diffNano < 0 path
      const fakeStart: [number, number] = [0, 999_999_999];
      const diff = processShim.hrtime(fakeStart);
      // After underflow correction, nanoseconds should be non-negative
      expect(diff[1]).toBeGreaterThanOrEqual(0);
    });
  });

  describe('memoryUsage', () => {
    it('should return memory object', () => {
      const mem = processShim.memoryUsage();
      expect(mem).toHaveProperty('rss');
      expect(mem).toHaveProperty('heapTotal');
      expect(mem).toHaveProperty('heapUsed');
      expect(mem).toHaveProperty('external');
      expect(mem).toHaveProperty('arrayBuffers');
    });

    it('should return numeric values', () => {
      const mem = processShim.memoryUsage();
      expect(typeof mem.rss).toBe('number');
      expect(typeof mem.heapUsed).toBe('number');
      expect(mem.external).toBe(0);
      expect(mem.arrayBuffers).toBe(0);
    });

    it('should use performance.memory when available', () => {
      const mockMemory = { totalJSHeapSize: 50000000, usedJSHeapSize: 30000000 };
      Object.defineProperty(performance, 'memory', { value: mockMemory, configurable: true });
      const mem = processShim.memoryUsage();
      expect(mem.rss).toBe(50000000);
      expect(mem.heapTotal).toBe(50000000);
      expect(mem.heapUsed).toBe(30000000);
      expect(mem.external).toBe(0);
      expect(mem.arrayBuffers).toBe(0);
      Object.defineProperty(performance, 'memory', { value: undefined, configurable: true });
    });

    it('should handle missing memory properties (nullish coalescing)', () => {
      Object.defineProperty(performance, 'memory', { value: {}, configurable: true });
      const mem = processShim.memoryUsage();
      expect(mem.rss).toBe(0);
      expect(mem.heapTotal).toBe(0);
      expect(mem.heapUsed).toBe(0);
      Object.defineProperty(performance, 'memory', { value: undefined, configurable: true });
    });
  });

  describe('uptime', () => {
    it('should return positive number', () => {
      expect(processShim.uptime()).toBeGreaterThanOrEqual(0);
    });
  });

  describe('stdout/stderr', () => {
    it('should have write function', () => {
      expect(typeof processShim.stdout.write).toBe('function');
      expect(typeof processShim.stderr.write).toBe('function');
    });

    it('should return true from write', () => {
      expect(processShim.stdout.write('test')).toBe(true);
    });

    it('should return true from stderr write', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(processShim.stderr.write('err')).toBe(true);
      spy.mockRestore();
    });
  });

  describe('stdin', () => {
    it('should have read method', () => {
      expect(processShim.stdin.read()).toBeNull();
      expect(processShim.stdin.isTTY).toBe(false);
    });

    it('should have on, resume, and pause methods', () => {
      expect(processShim.stdin.on()).toBeUndefined();
      expect(processShim.stdin.resume()).toBeUndefined();
      expect(processShim.stdin.pause()).toBeUndefined();
    });
  });

  describe('emitWarning', () => {
    it('should emit warning event', () => {
      const handler = vi.fn();
      processShim.on('warning', handler);
      processShim.emitWarning('test warning');
      expect(handler).toHaveBeenCalled();
      const arg = handler.mock.calls[0]![0];
      expect(arg).toBeInstanceOf(Error);
      expect(arg.message).toBe('test warning');
      processShim.off('warning', handler);
    });

    it('should emit warning with Error object', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const handler = vi.fn();
      processShim.on('warning', handler);
      const err = new Error('err warning');
      processShim.emitWarning(err);
      expect(handler).toHaveBeenCalledWith(err);
      expect(warnSpy).toHaveBeenCalled();
      processShim.off('warning', handler);
      warnSpy.mockRestore();
    });

    it('should use custom name for warning prefix', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      processShim.emitWarning('deprecation warning', 'DeprecationWarning');
      expect(warnSpy.mock.calls[0]![0]).toContain('DeprecationWarning');
      warnSpy.mockRestore();
    });
  });

  describe('_configure', () => {
    it('should set cwd and env', () => {
      const original = processShim.cwd();
      processShim._configure('/configured', { KEY: 'val' });
      expect(processShim.cwd()).toBe('/configured');
      expect(processShim.env.KEY).toBe('val');
      processShim._configure(original, {});
    });
  });

  describe('EventEmitter inheritance', () => {
    it('should support on/emit', () => {
      const handler = vi.fn();
      processShim.on('customEvent', handler);
      processShim.emit('customEvent', 'data');
      expect(handler).toHaveBeenCalledWith('data');
      processShim.off('customEvent', handler);
    });
  });

  describe('stdin.read', () => {
    it('should return null', () => {
      expect(processShim.stdin.read()).toBeNull();
    });
  });

  describe('env setter', () => {
    it('should replace env object', () => {
      const original = processShim.env;
      processShim.env = { CUSTOM: 'value' };
      expect(processShim.env.CUSTOM).toBe('value');
      processShim.env = original;
    });
  });
});
