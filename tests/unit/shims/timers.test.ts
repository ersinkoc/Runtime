import { describe, it, expect, vi } from 'vitest';
import timersModule from '../../../src/shims/timers.js';

describe('timers shim', () => {
  it('should export setTimeout', () => {
    expect(typeof timersModule.setTimeout).toBe('function');
  });

  it('should export clearTimeout', () => {
    expect(typeof timersModule.clearTimeout).toBe('function');
  });

  it('should export setInterval', () => {
    expect(typeof timersModule.setInterval).toBe('function');
  });

  it('should export clearInterval', () => {
    expect(typeof timersModule.clearInterval).toBe('function');
  });

  describe('setImmediate', () => {
    it('should call callback', async () => {
      const handler = vi.fn();
      timersModule.setImmediate(handler);
      await new Promise((r) => setTimeout(r, 10));
      expect(handler).toHaveBeenCalled();
    });

    it('should pass arguments', async () => {
      const handler = vi.fn();
      timersModule.setImmediate(handler, 'a', 'b');
      await new Promise((r) => setTimeout(r, 10));
      expect(handler).toHaveBeenCalledWith('a', 'b');
    });
  });

  describe('clearImmediate', () => {
    it('should cancel setImmediate', async () => {
      const handler = vi.fn();
      const id = timersModule.setImmediate(handler);
      timersModule.clearImmediate(id);
      await new Promise((r) => setTimeout(r, 20));
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('promises.setTimeout', () => {
    it('should resolve after delay', async () => {
      const result = await timersModule.promises.setTimeout(10, 'value');
      expect(result).toBe('value');
    });
  });

  describe('promises.setInterval', () => {
    it('should yield values', async () => {
      const iter = timersModule.promises.setInterval(10, 'tick');
      const values: unknown[] = [];
      for await (const val of iter) {
        values.push(val);
        if (values.length >= 2) break;
      }
      expect(values).toEqual(['tick', 'tick']);
    });
  });
});
