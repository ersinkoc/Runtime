import { describe, it, expect } from 'vitest';
import assert, { AssertionError } from '../../../src/shims/assert.js';

describe('assert shim', () => {
  describe('ok', () => {
    it('should pass for truthy values', () => {
      expect(() => assert.ok(true)).not.toThrow();
      expect(() => assert.ok(1)).not.toThrow();
      expect(() => assert.ok('hello')).not.toThrow();
    });

    it('should throw for falsy values', () => {
      expect(() => assert.ok(false)).toThrow(AssertionError);
      expect(() => assert.ok(0)).toThrow(AssertionError);
      expect(() => assert.ok('')).toThrow(AssertionError);
      expect(() => assert.ok(null)).toThrow(AssertionError);
    });

    it('should work as default export', () => {
      expect(() => assert(true)).not.toThrow();
      expect(() => assert(false)).toThrow();
    });
  });

  describe('equal / notEqual', () => {
    it('should compare with ==', () => {
      expect(() => assert.equal(1, 1)).not.toThrow();
      expect(() => assert.equal(1, '1')).not.toThrow();
      expect(() => assert.equal(1, 2)).toThrow(AssertionError);
    });

    it('should check inequality', () => {
      expect(() => assert.notEqual(1, 2)).not.toThrow();
      expect(() => assert.notEqual(1, 1)).toThrow(AssertionError);
    });
  });

  describe('strictEqual / notStrictEqual', () => {
    it('should compare with Object.is', () => {
      expect(() => assert.strictEqual(1, 1)).not.toThrow();
      expect(() => assert.strictEqual(1, '1' as any)).toThrow(AssertionError);
    });

    it('should check strict inequality', () => {
      expect(() => assert.notStrictEqual(1, '1' as any)).not.toThrow();
      expect(() => assert.notStrictEqual(1, 1)).toThrow(AssertionError);
    });
  });

  describe('deepEqual', () => {
    it('should compare objects deeply', () => {
      expect(() => assert.deepEqual({ a: 1 }, { a: 1 })).not.toThrow();
      expect(() => assert.deepEqual({ a: 1 }, { a: 2 })).toThrow(AssertionError);
    });

    it('should compare arrays', () => {
      expect(() => assert.deepEqual([1, 2, 3], [1, 2, 3])).not.toThrow();
      expect(() => assert.deepEqual([1, 2], [1, 2, 3])).toThrow(AssertionError);
    });

    it('should compare nested objects', () => {
      expect(() => assert.deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).not.toThrow();
      expect(() => assert.deepEqual({ a: { b: 1 } }, { a: { b: 2 } })).toThrow(AssertionError);
    });

    it('should compare Dates', () => {
      const d1 = new Date('2024-01-01');
      const d2 = new Date('2024-01-01');
      expect(() => assert.deepEqual(d1, d2)).not.toThrow();
    });

    it('should compare Maps', () => {
      const m1 = new Map([['a', 1]]);
      const m2 = new Map([['a', 1]]);
      expect(() => assert.deepEqual(m1, m2)).not.toThrow();
    });

    it('should compare Sets', () => {
      const s1 = new Set([1, 2]);
      const s2 = new Set([1, 2]);
      expect(() => assert.deepEqual(s1, s2)).not.toThrow();
    });
  });

  describe('deepStrictEqual / notDeepStrictEqual', () => {
    it('should use strict comparison', () => {
      expect(() => assert.deepStrictEqual({ a: 1 }, { a: 1 })).not.toThrow();
      expect(() => assert.notDeepStrictEqual({ a: 1 }, { a: '1' })).not.toThrow();
    });

    it('should throw for non-equal objects', () => {
      expect(() => assert.deepStrictEqual({ a: 1 }, { a: 2 })).toThrow(AssertionError);
    });

    it('should throw notDeepStrictEqual for equal objects', () => {
      expect(() => assert.notDeepStrictEqual({ a: 1 }, { a: 1 })).toThrow(AssertionError);
    });
  });

  describe('notDeepEqual', () => {
    it('should pass for different objects', () => {
      expect(() => assert.notDeepEqual({ a: 1 }, { a: 2 })).not.toThrow();
      expect(() => assert.notDeepEqual({ a: 1 }, { a: 1 })).toThrow(AssertionError);
    });
  });

  describe('throws', () => {
    it('should pass when function throws', () => {
      expect(() => assert.throws(() => { throw new Error('test'); })).not.toThrow();
    });

    it('should fail when function does not throw', () => {
      expect(() => assert.throws(() => {})).toThrow(AssertionError);
    });

    it('should check error message with string', () => {
      expect(() => assert.throws(() => { throw new Error('test error'); }, 'test')).not.toThrow();
    });

    it('should check error message with regex', () => {
      expect(() => assert.throws(() => { throw new Error('test error'); }, /test/)).not.toThrow();
    });

    it('should check error type', () => {
      expect(() => assert.throws(() => { throw new TypeError('test'); }, TypeError)).not.toThrow();
    });

    it('should fail for wrong error constructor', () => {
      expect(() => assert.throws(() => { throw new Error('test'); }, TypeError)).toThrow(AssertionError);
    });

    it('should fail for wrong error message string', () => {
      expect(() => assert.throws(() => { throw new Error('actual'); }, 'different')).toThrow(AssertionError);
    });

    it('should fail for wrong error message regex', () => {
      expect(() => assert.throws(() => { throw new Error('actual'); }, /different/)).toThrow(AssertionError);
    });
  });

  describe('doesNotThrow', () => {
    it('should pass when function does not throw', () => {
      expect(() => assert.doesNotThrow(() => {})).not.toThrow();
    });

    it('should fail when function throws', () => {
      expect(() => assert.doesNotThrow(() => { throw new Error('oops'); })).toThrow(AssertionError);
    });
  });

  describe('rejects', () => {
    it('should pass when promise rejects', async () => {
      await assert.rejects(() => Promise.reject(new Error('fail')));
    });

    it('should fail when promise resolves', async () => {
      await expect(assert.rejects(() => Promise.resolve())).rejects.toThrow();
    });

    it('should check rejection message with string', async () => {
      await assert.rejects(() => Promise.reject(new Error('custom error')), 'custom');
    });

    it('should fail for wrong rejection message string', async () => {
      await expect(
        assert.rejects(() => Promise.reject(new Error('custom error')), 'wrong'),
      ).rejects.toThrow();
    });

    it('should check rejection with regex', async () => {
      await assert.rejects(() => Promise.reject(new Error('custom error')), /custom/);
    });

    it('should fail for non-matching rejection regex', async () => {
      await expect(
        assert.rejects(() => Promise.reject(new Error('actual message')), /different/),
      ).rejects.toThrow(AssertionError);
    });

    it('should check rejection with constructor', async () => {
      await assert.rejects(() => Promise.reject(new TypeError('type error')), TypeError);
    });

    it('should fail for wrong rejection constructor', async () => {
      await expect(
        assert.rejects(() => Promise.reject(new Error('error')), TypeError),
      ).rejects.toThrow();
    });

    it('should accept a direct promise', async () => {
      await assert.rejects(Promise.reject(new Error('direct')));
    });
  });

  describe('doesNotReject', () => {
    it('should pass when promise resolves', async () => {
      await assert.doesNotReject(() => Promise.resolve());
    });

    it('should fail when promise rejects', async () => {
      await expect(
        assert.doesNotReject(() => Promise.reject(new Error('oops'))),
      ).rejects.toThrow();
    });

    it('should accept a direct promise', async () => {
      await assert.doesNotReject(Promise.resolve());
    });
  });

  describe('fail', () => {
    it('should always throw', () => {
      expect(() => assert.fail('custom message')).toThrow(AssertionError);
    });
  });

  describe('ifError', () => {
    it('should pass for null/undefined', () => {
      expect(() => assert.ifError(null)).not.toThrow();
      expect(() => assert.ifError(undefined)).not.toThrow();
    });

    it('should throw for error', () => {
      expect(() => assert.ifError(new Error('test'))).toThrow();
    });

    it('should wrap non-Error values', () => {
      expect(() => assert.ifError('string error')).toThrow(AssertionError);
      expect(() => assert.ifError(42)).toThrow(AssertionError);
    });
  });

  describe('match / doesNotMatch', () => {
    it('should match regex', () => {
      expect(() => assert.match('hello world', /hello/)).not.toThrow();
      expect(() => assert.match('hello', /xyz/)).toThrow(AssertionError);
    });

    it('should not match regex', () => {
      expect(() => assert.doesNotMatch('hello', /xyz/)).not.toThrow();
      expect(() => assert.doesNotMatch('hello', /hello/)).toThrow(AssertionError);
    });
  });

  describe('AssertionError', () => {
    it('should have expected properties', () => {
      const err = new AssertionError({ message: 'test', actual: 1, expected: 2, operator: '===' });
      expect(err.message).toBe('test');
      expect(err.actual).toBe(1);
      expect(err.expected).toBe(2);
      expect(err.operator).toBe('===');
      expect(err.name).toBe('AssertionError');
    });
  });

  describe('isDeepEqual branches', () => {
    it('should fail for Maps with missing key', () => {
      const a = new Map([['key1', 'val1']]);
      const b = new Map([['key2', 'val2']]);
      expect(() => assert.deepStrictEqual(a, b)).toThrow(AssertionError);
    });

    it('should fail for Maps with non-equal values', () => {
      const a = new Map([['key', 'val1']]);
      const b = new Map([['key', 'val2']]);
      expect(() => assert.deepStrictEqual(a, b)).toThrow(AssertionError);
    });

    it('should fail for Sets with different sizes', () => {
      const a = new Set([1, 2, 3]);
      const b = new Set([1, 2]);
      expect(() => assert.deepStrictEqual(a, b)).toThrow(AssertionError);
    });

    it('should fail for Sets with missing values', () => {
      const a = new Set([1, 2]);
      const b = new Set([1, 3]);
      expect(() => assert.deepStrictEqual(a, b)).toThrow(AssertionError);
    });

    it('should fail for objects with different key counts', () => {
      expect(() => assert.deepStrictEqual({ a: 1, b: 2 }, { a: 1 })).toThrow(AssertionError);
    });

    it('should pass for equal Maps', () => {
      const a = new Map([['k', 'v']]);
      const b = new Map([['k', 'v']]);
      expect(() => assert.deepStrictEqual(a, b)).not.toThrow();
    });

    it('should fail for Maps with different sizes', () => {
      const a = new Map([['k1', 'v1'], ['k2', 'v2']]);
      const b = new Map([['k1', 'v1']]);
      expect(() => assert.deepStrictEqual(a, b)).toThrow(AssertionError);
    });

    it('should compare RegExps', () => {
      expect(() => assert.deepStrictEqual(/abc/i, /abc/i)).not.toThrow();
      expect(() => assert.deepStrictEqual(/abc/i, /abc/g)).toThrow(AssertionError);
    });

    it('should compare Dates', () => {
      const d1 = new Date('2024-01-01');
      const d2 = new Date('2024-01-01');
      const d3 = new Date('2024-01-02');
      expect(() => assert.deepStrictEqual(d1, d2)).not.toThrow();
      expect(() => assert.deepStrictEqual(d1, d3)).toThrow(AssertionError);
    });
  });

  describe('AssertionError branch coverage', () => {
    it('should auto-generate message when not provided', () => {
      const err = new AssertionError({ actual: 1, expected: 2, operator: '===' });
      expect(err.message).toContain('1');
      expect(err.message).toContain('2');
      expect(err.message).toContain('===');
    });

    it('should default operator to ==', () => {
      const err = new AssertionError({ actual: 'a', expected: 'b' });
      expect(err.operator).toBe('==');
    });
  });

  describe('fail branch coverage', () => {
    it('should throw Error directly when Error object passed', () => {
      const err = new Error('direct error');
      expect(() => assert.fail(err)).toThrow(err);
    });

    it('should throw AssertionError with default message', () => {
      expect(() => assert.fail()).toThrow('Failed');
    });
  });
});
