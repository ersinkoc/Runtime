/**
 * Node.js `timers` module shim.
 * @module shims/timers
 */

const _setTimeout = globalThis.setTimeout;
const _clearTimeout = globalThis.clearTimeout;
const _setInterval = globalThis.setInterval;
const _clearInterval = globalThis.clearInterval;

export { _setTimeout as setTimeout, _clearTimeout as clearTimeout, _setInterval as setInterval, _clearInterval as clearInterval };

export function setImmediate(callback: (...args: any[]) => void, ...args: any[]): ReturnType<typeof _setTimeout> {
  return _setTimeout(callback, 0, ...args);
}

export function clearImmediate(id: ReturnType<typeof _setTimeout>): void {
  _clearTimeout(id);
}

export const promises = {
  setTimeout: (ms: number, value?: unknown) =>
    new Promise((resolve) => _setTimeout(() => resolve(value), ms)),
  setInterval: async function* (ms: number, value?: unknown) {
    while (true) {
      await new Promise((resolve) => _setTimeout(resolve, ms));
      yield value;
    }
  },
};

const timersModule = {
  setTimeout: _setTimeout, clearTimeout: _clearTimeout,
  setInterval: _setInterval, clearInterval: _clearInterval,
  setImmediate, clearImmediate, promises,
};

export default timersModule;
