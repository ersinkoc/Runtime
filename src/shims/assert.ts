/**
 * Node.js `assert` module shim.
 * @module shims/assert
 */

export class AssertionError extends Error {
  actual: unknown;
  expected: unknown;
  operator: string;

  constructor(options: { message?: string; actual?: unknown; expected?: unknown; operator?: string }) {
    super(options.message || `AssertionError: ${JSON.stringify(options.actual)} ${options.operator ?? '=='} ${JSON.stringify(options.expected)}`);
    this.name = 'AssertionError';
    this.actual = options.actual;
    this.expected = options.expected;
    this.operator = options.operator ?? '==';
  }
}

function fail(message?: string | Error): never {
  if (message instanceof Error) throw message;
  throw new AssertionError({ message: message || 'Failed' });
}

function ok(value: unknown, message?: string): void {
  if (!value) {
    throw new AssertionError({ message: message || `Expected truthy, got ${JSON.stringify(value)}`, actual: value, expected: true, operator: '==' });
  }
}

function equal(actual: unknown, expected: unknown, message?: string): void {
  if (actual != expected) {
    throw new AssertionError({ message, actual, expected, operator: '==' });
  }
}

function notEqual(actual: unknown, expected: unknown, message?: string): void {
  if (actual == expected) {
    throw new AssertionError({ message, actual, expected, operator: '!=' });
  }
}

function strictEqual(actual: unknown, expected: unknown, message?: string): void {
  if (!Object.is(actual, expected)) {
    throw new AssertionError({ message, actual, expected, operator: '===' });
  }
}

function notStrictEqual(actual: unknown, expected: unknown, message?: string): void {
  if (Object.is(actual, expected)) {
    throw new AssertionError({ message, actual, expected, operator: '!==' });
  }
}

function deepEqual(actual: unknown, expected: unknown, message?: string): void {
  if (!isDeepEqual(actual, expected, false)) {
    throw new AssertionError({ message, actual, expected, operator: 'deepEqual' });
  }
}

function notDeepEqual(actual: unknown, expected: unknown, message?: string): void {
  if (isDeepEqual(actual, expected, false)) {
    throw new AssertionError({ message, actual, expected, operator: 'notDeepEqual' });
  }
}

function deepStrictEqual(actual: unknown, expected: unknown, message?: string): void {
  if (!isDeepEqual(actual, expected, true)) {
    throw new AssertionError({ message, actual, expected, operator: 'deepStrictEqual' });
  }
}

function notDeepStrictEqual(actual: unknown, expected: unknown, message?: string): void {
  if (isDeepEqual(actual, expected, true)) {
    throw new AssertionError({ message, actual, expected, operator: 'notDeepStrictEqual' });
  }
}

function isDeepEqual(a: unknown, b: unknown, strict: boolean): boolean {
  if (strict ? Object.is(a, b) : a == b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;

  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp) return a.toString() === b.toString();

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => isDeepEqual(v, b[i], strict));
  }

  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [key, val] of a) {
      if (!b.has(key) || !isDeepEqual(val, b.get(key), strict)) return false;
    }
    return true;
  }

  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const val of a) {
      if (!b.has(val)) return false;
    }
    return true;
  }

  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) return false;

  return aKeys.every((key) =>
    isDeepEqual(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
      strict,
    ),
  );
}

function throws(fn: () => void, messageOrError?: string | RegExp | (new (...args: any[]) => Error)): void {
  let threw = false;
  try {
    fn();
  } catch (err) {
    threw = true;
    if (typeof messageOrError === 'string') {
      if (!(err instanceof Error) || !err.message.includes(messageOrError)) {
        throw new AssertionError({ message: `Expected error message to include "${messageOrError}"` });
      }
    } else if (messageOrError instanceof RegExp) {
      if (!(err instanceof Error) || !messageOrError.test(err.message)) {
        throw new AssertionError({ message: `Expected error message to match ${messageOrError}` });
      }
    } else if (typeof messageOrError === 'function') {
      if (!(err instanceof messageOrError)) {
        throw new AssertionError({ message: `Expected error to be instance of ${messageOrError.name}` });
      }
    }
  }
  if (!threw) {
    throw new AssertionError({ message: 'Expected function to throw' });
  }
}

function doesNotThrow(fn: () => void, message?: string): void {
  try {
    fn();
  } catch (err) {
    throw new AssertionError({ message: message || `Expected function not to throw, but it threw: ${err}` });
  }
}

async function rejects(fn: (() => Promise<unknown>) | Promise<unknown>, messageOrError?: string | RegExp | (new (...args: any[]) => Error)): Promise<void> {
  const promise = typeof fn === 'function' ? fn() : fn;
  let threw = false;
  try {
    await promise;
  } catch (err) {
    threw = true;
    if (typeof messageOrError === 'string') {
      if (!(err instanceof Error) || !err.message.includes(messageOrError)) {
        throw new AssertionError({ message: `Expected rejection message to include "${messageOrError}"` });
      }
    } else if (messageOrError instanceof RegExp) {
      if (!(err instanceof Error) || !messageOrError.test(err.message)) {
        throw new AssertionError({ message: `Expected rejection message to match ${messageOrError}` });
      }
    } else if (typeof messageOrError === 'function') {
      if (!(err instanceof messageOrError)) {
        throw new AssertionError({ message: `Expected rejection to be instance of ${messageOrError.name}` });
      }
    }
  }
  if (!threw) {
    throw new AssertionError({ message: 'Expected promise to reject' });
  }
}

async function doesNotReject(fn: (() => Promise<unknown>) | Promise<unknown>, message?: string): Promise<void> {
  const promise = typeof fn === 'function' ? fn() : fn;
  try {
    await promise;
  } catch (err) {
    throw new AssertionError({ message: message || `Expected promise not to reject, but it rejected: ${err}` });
  }
}

function ifError(value: unknown): void {
  if (value !== null && value !== undefined) {
    throw value instanceof Error ? value : new AssertionError({ message: `ifError got unwanted value: ${value}` });
  }
}

function match(actual: string, regexp: RegExp, message?: string): void {
  if (!regexp.test(actual)) {
    throw new AssertionError({ message: message || `Expected "${actual}" to match ${regexp}`, actual, expected: regexp, operator: 'match' });
  }
}

function doesNotMatch(actual: string, regexp: RegExp, message?: string): void {
  if (regexp.test(actual)) {
    throw new AssertionError({ message: message || `Expected "${actual}" not to match ${regexp}`, actual, expected: regexp, operator: 'doesNotMatch' });
  }
}

// Main export is a function (ok alias)
const assert = Object.assign(ok, {
  ok, equal, notEqual, strictEqual, notStrictEqual,
  deepEqual, notDeepEqual, deepStrictEqual, notDeepStrictEqual,
  throws, doesNotThrow, rejects, doesNotReject,
  fail, ifError, match, doesNotMatch, AssertionError,
});

export {
  ok, equal, notEqual, strictEqual, notStrictEqual,
  deepEqual, notDeepEqual, deepStrictEqual, notDeepStrictEqual,
  throws, doesNotThrow, rejects, doesNotReject,
  fail, ifError, match, doesNotMatch,
};

export default assert;
