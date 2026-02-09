import { describe, it, expect, vi } from 'vitest';
import utilModule from '../../../src/shims/util.js';

const { format, inspect, deprecate, promisify, callbackify, inherits, types } = utilModule;

describe('util shim', () => {
  describe('format', () => {
    it('should format with %s', () => {
      expect(format('hello %s', 'world')).toBe('hello world');
    });

    it('should format with %d', () => {
      expect(format('count: %d', 42)).toBe('count: 42');
    });

    it('should format with %i', () => {
      expect(format('int: %i', 3.7)).toBe('int: 3');
    });

    it('should format with %j', () => {
      expect(format('json: %j', { a: 1 })).toBe('json: {"a":1}');
    });

    it('should handle %%', () => {
      expect(format('100%%')).toBe('100%');
    });

    it('should handle non-string first arg', () => {
      const result = format(42, 'hello');
      expect(result).toContain('42');
    });

    it('should handle missing args', () => {
      expect(format('%s %s', 'hello')).toBe('hello %s');
    });

    it('should format with %o', () => {
      const result = format('%o', { a: 1 });
      expect(result).toContain('a');
    });

    it('should format with %f', () => {
      expect(format('%f', 3.14)).toBe('3.14');
    });
  });

  describe('inspect', () => {
    it('should inspect null', () => {
      expect(inspect(null)).toBe('null');
    });

    it('should inspect undefined', () => {
      expect(inspect(undefined)).toBe('undefined');
    });

    it('should inspect string', () => {
      expect(inspect('hello')).toBe('hello');
    });

    it('should inspect number', () => {
      expect(inspect(42)).toBe('42');
    });

    it('should inspect boolean', () => {
      expect(inspect(true)).toBe('true');
    });

    it('should inspect function', () => {
      function myFunc() {}
      expect(inspect(myFunc)).toBe('[Function: myFunc]');
    });

    it('should inspect array', () => {
      expect(inspect([1, 2, 3])).toBe('[ 1, 2, 3 ]');
    });

    it('should inspect object', () => {
      expect(inspect({ a: 1 })).toContain('a: 1');
    });

    it('should inspect Date', () => {
      const d = new Date('2024-01-01T00:00:00.000Z');
      expect(inspect(d)).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should inspect RegExp', () => {
      expect(inspect(/abc/i)).toBe('/abc/i');
    });

    it('should inspect Error', () => {
      expect(inspect(new Error('oops'))).toBe('Error: oops');
    });

    it('should respect depth', () => {
      const deep = { a: { b: { c: 1 } } };
      const result = inspect(deep, { depth: 1 });
      expect(result).toContain('[Object]');
    });

    it('should inspect Map', () => {
      const m = new Map([['key', 'value']]);
      expect(inspect(m)).toContain('Map');
    });

    it('should inspect Set', () => {
      const s = new Set([1, 2]);
      expect(inspect(s)).toContain('Set');
    });
  });

  describe('deprecate', () => {
    it('should call the function', () => {
      const fn = vi.fn(() => 42);
      const deprecated = deprecate(fn, 'use something else');
      expect(deprecated()).toBe(42);
      expect(fn).toHaveBeenCalled();
    });

    it('should warn only once', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const fn = vi.fn();
      const deprecated = deprecate(fn, 'deprecated');
      deprecated();
      deprecated();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    });
  });

  describe('promisify', () => {
    it('should convert callback-style to promise', async () => {
      function asyncFn(a: number, b: number, cb: (err: null, result: number) => void) {
        cb(null, a + b);
      }
      const promised = promisify<number>(asyncFn);
      const result = await promised(1, 2);
      expect(result).toBe(3);
    });

    it('should reject on error', async () => {
      function failFn(cb: (err: Error) => void) {
        cb(new Error('fail'));
      }
      const promised = promisify(failFn);
      await expect(promised()).rejects.toThrow('fail');
    });
  });

  describe('callbackify', () => {
    it('should convert promise to callback-style', async () => {
      async function asyncFn() { return 42; }
      const cbFn = callbackify(asyncFn);
      const result = await new Promise<{ err: Error | null; result: number }>((resolve) => {
        cbFn((err: Error | null, result: number) => {
          resolve({ err, result });
        });
      });
      expect(result.err).toBeNull();
      expect(result.result).toBe(42);
    });

    it('should pass error to callback on rejection', async () => {
      async function failingFn(): Promise<number> { throw new Error('async fail'); }
      const cbFn = callbackify(failingFn);
      const result = await new Promise<{ err: Error | null }>((resolve) => {
        cbFn((err: Error | null) => {
          resolve({ err });
        });
      });
      expect(result.err).toBeInstanceOf(Error);
      expect(result.err!.message).toBe('async fail');
    });
  });

  describe('inherits', () => {
    it('should set up prototype chain', () => {
      function Parent(this: any) { this.parent = true; }
      Parent.prototype.parentMethod = () => 'parent';
      function Child(this: any) { this.child = true; }
      inherits(Child as any, Parent as any);
      expect(Object.getPrototypeOf(Child.prototype)).toBe(Parent.prototype);
    });
  });

  describe('types', () => {
    it('should detect Date', () => {
      expect(types.isDate(new Date())).toBe(true);
      expect(types.isDate('2024')).toBe(false);
    });

    it('should detect RegExp', () => {
      expect(types.isRegExp(/abc/)).toBe(true);
      expect(types.isRegExp('abc')).toBe(false);
    });

    it('should detect Map', () => {
      expect(types.isMap(new Map())).toBe(true);
      expect(types.isMap({})).toBe(false);
    });

    it('should detect Set', () => {
      expect(types.isSet(new Set())).toBe(true);
      expect(types.isSet([])).toBe(false);
    });

    it('should detect Promise', () => {
      expect(types.isPromise(Promise.resolve())).toBe(true);
      expect(types.isPromise({})).toBe(false);
    });

    it('should detect ArrayBuffer', () => {
      expect(types.isArrayBuffer(new ArrayBuffer(1))).toBe(true);
      expect(types.isArrayBuffer(new Uint8Array(1))).toBe(false);
    });

    it('should detect NativeError', () => {
      expect(types.isNativeError(new Error())).toBe(true);
      expect(types.isNativeError('error')).toBe(false);
    });
  });

  describe('isTypedArray', () => {
    it('should detect typed arrays', () => {
      expect(types.isTypedArray(new Uint8Array(1))).toBe(true);
      expect(types.isTypedArray(new Int8Array(1))).toBe(true);
      expect(types.isTypedArray(new Float64Array(1))).toBe(true);
      expect(types.isTypedArray([])).toBe(false);
      expect(types.isTypedArray(new ArrayBuffer(1))).toBe(false);
    });
  });

  describe('debuglog', () => {
    it('should return a noop function when not enabled', () => {
      const log = utilModule.debuglog('TEST_SECTION');
      expect(typeof log).toBe('function');
      log('message');
    });

    it('should log when NODE_DEBUG includes set', () => {
      const original = process.env.NODE_DEBUG;
      process.env.NODE_DEBUG = 'MY_MODULE';
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const log = utilModule.debuglog('MY_MODULE');
      log('hello %s', 'world');
      expect(errorSpy).toHaveBeenCalled();
      expect(errorSpy.mock.calls[0]![0]).toContain('MY_MODULE');
      errorSpy.mockRestore();
      process.env.NODE_DEBUG = original;
    });
  });

  describe('inspect advanced', () => {
    it('should inspect Symbol', () => {
      const result = inspect(Symbol('test'));
      expect(result).toContain('Symbol');
    });

    it('should inspect BigInt', () => {
      const result = inspect(BigInt(42));
      expect(result).toBe('42');
    });
  });

  describe('format with extra args', () => {
    it('should handle more args than format specifiers', () => {
      const result = format('%s', 'hello', 'extra1', 42);
      // Extra args don't get appended in this implementation
      expect(result).toBe('hello');
    });
  });

  describe('inspect depth limits', () => {
    it('should show [Array] at depth limit', () => {
      const result = inspect([1, 2], { depth: 0 });
      expect(result).toBe('[Array]');
    });

    it('should show Map(...) at depth limit', () => {
      const result = inspect(new Map([['k', 'v']]), { depth: 0 });
      expect(result).toBe('Map(...)');
    });

    it('should show Set(...) at depth limit', () => {
      const result = inspect(new Set([1, 2]), { depth: 0 });
      expect(result).toBe('Set(...)');
    });

    it('should show [Object] at depth limit', () => {
      const result = inspect({ a: 1 }, { depth: 0 });
      expect(result).toBe('[Object]');
    });
  });

  describe('TextEncoder/TextDecoder', () => {
    it('should export TextEncoder and TextDecoder', () => {
      expect(utilModule.TextEncoder).toBeDefined();
      expect(utilModule.TextDecoder).toBeDefined();
    });
  });

  describe('format with %j circular reference', () => {
    it('should return [Circular] for circular objects', () => {
      const obj: any = {};
      obj.self = obj;
      const result = format('%j', obj);
      expect(result).toBe('[Circular]');
    });
  });

  describe('inspect nested string at depth > 0', () => {
    it('should wrap string in quotes at depth > 0', () => {
      const result = inspect({ name: 'test' });
      expect(result).toContain("'test'");
    });
  });

  describe('inspect anonymous function', () => {
    it('should show [Function: anonymous] for unnamed functions', () => {
      const result = inspect(() => {});
      expect(result).toBe('[Function: anonymous]');
    });
  });
});
