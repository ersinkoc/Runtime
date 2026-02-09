/**
 * Node.js `util` module shim.
 * @module shims/util
 */

export function format(fmt: unknown, ...args: unknown[]): string {
  if (typeof fmt !== 'string') {
    return [fmt, ...args].map((a) => inspect(a)).join(' ');
  }

  let i = 0;
  const result = fmt.replace(/%[sdjifoO%]/g, (match: string) => {
    if (match === '%%') return '%';
    if (i >= args.length) return match;
    const arg = args[i++];
    if (match === '%s') return String(arg);
    if (match === '%d') return String(Number(arg));
    if (match === '%i') return String(parseInt(String(arg), 10));
    if (match === '%f') return String(parseFloat(String(arg)));
    if (match === '%j') {
      try { return JSON.stringify(arg); } catch { return '[Circular]'; }
    }
    // %o, %O
    return inspect(arg);
  });

  // Append remaining args
  const rest = args.slice(i).map(a => typeof a === 'object' && a !== null ? inspect(a) : String(a));
  return rest.length > 0 ? result + ' ' + rest.join(' ') : result;
}

export function inspect(obj: unknown, opts?: { depth?: number; colors?: boolean }): string {
  return inspectValue(obj, opts?.depth ?? 2, 0);
}

function inspectValue(val: unknown, maxDepth: number, currentDepth: number): string {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (typeof val === 'string') return currentDepth > 0 ? `'${val}'` : val;
  if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'bigint') return String(val);
  if (typeof val === 'symbol') return val.toString();
  if (typeof val === 'function') return `[Function: ${val.name || 'anonymous'}]`;

  if (val instanceof Date) return val.toISOString();
  if (val instanceof RegExp) return val.toString();
  if (val instanceof Error) return `${val.name}: ${val.message}`;

  if (Array.isArray(val)) {
    if (currentDepth >= maxDepth) return '[Array]';
    const items = val.map((v) => inspectValue(v, maxDepth, currentDepth + 1));
    return `[ ${items.join(', ')} ]`;
  }

  if (val instanceof Map) {
    if (currentDepth >= maxDepth) return 'Map(...)';
    const entries = Array.from(val.entries()).map(
      ([k, v]) => `${inspectValue(k, maxDepth, currentDepth + 1)} => ${inspectValue(v, maxDepth, currentDepth + 1)}`,
    );
    return `Map(${val.size}) { ${entries.join(', ')} }`;
  }

  if (val instanceof Set) {
    if (currentDepth >= maxDepth) return 'Set(...)';
    const items = Array.from(val).map((v) => inspectValue(v, maxDepth, currentDepth + 1));
    return `Set(${val.size}) { ${items.join(', ')} }`;
  }

  if (currentDepth >= maxDepth) return '[Object]';
  const entries = Object.entries(val as Record<string, unknown>).map(
    ([k, v]) => `${k}: ${inspectValue(v, maxDepth, currentDepth + 1)}`,
  );
  return `{ ${entries.join(', ')} }`;
}

export function deprecate<T extends (...args: any[]) => any>(fn: T, msg: string): T {
  let warned = false;
  return function (this: unknown, ...args: any[]) {
    if (!warned) {
      console.warn(`DeprecationWarning: ${msg}`);
      warned = true;
    }
    return fn.apply(this, args);
  } as unknown as T;
}

export function promisify<T>(fn: (...args: any[]) => void): (...args: any[]) => Promise<T> {
  return (...args: any[]) =>
    new Promise<T>((resolve, reject) => {
      fn(...args, (err: Error | null, result: T) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
}

export function callbackify<T>(fn: (...args: any[]) => Promise<T>): (...args: any[]) => void {
  return (...args: any[]) => {
    const callback = args.pop();
    fn(...args).then(
      (result) => callback(null, result),
      (err) => callback(err),
    );
  };
}

export function inherits(
  ctor: new (...args: any[]) => any,
  superCtor: new (...args: any[]) => any,
): void {
  Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
  Object.setPrototypeOf(ctor, superCtor);
}

export function debuglog(set: string): (...args: any[]) => void {
  const enabled = typeof process !== 'undefined' && process.env?.NODE_DEBUG?.includes(set);
  if (enabled) {
    return (...args: any[]) => console.error(`${set.toUpperCase()}: ${format(args[0], ...args.slice(1))}`);
  }
  return () => {};
}

export const types = {
  isDate: (val: unknown): val is Date => val instanceof Date,
  isRegExp: (val: unknown): val is RegExp => val instanceof RegExp,
  isMap: (val: unknown): val is Map<unknown, unknown> => val instanceof Map,
  isSet: (val: unknown): val is Set<unknown> => val instanceof Set,
  isPromise: (val: unknown): val is Promise<unknown> => val instanceof Promise,
  isArrayBuffer: (val: unknown): val is ArrayBuffer => val instanceof ArrayBuffer,
  isTypedArray: (val: unknown): boolean =>
    val instanceof Int8Array || val instanceof Uint8Array || val instanceof Float64Array,
  isNativeError: (val: unknown): val is Error => val instanceof Error,
};

const _TextEncoder = globalThis.TextEncoder;
const _TextDecoder = globalThis.TextDecoder;
export { _TextEncoder as TextEncoder, _TextDecoder as TextDecoder };

const utilModule = {
  format, inspect, deprecate, promisify, callbackify,
  inherits, debuglog, types, TextEncoder: _TextEncoder, TextDecoder: _TextDecoder,
};

export default utilModule;
