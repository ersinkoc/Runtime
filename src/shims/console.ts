/**
 * Node.js `console` module shim with capture capability.
 * @module shims/console
 */

import type { ConsoleEntry } from '../types.js';

/**
 * Create a console that captures output.
 */
export function createConsoleCapture(onEntry?: (entry: ConsoleEntry) => void) {
  const entries: ConsoleEntry[] = [];
  const timers = new Map<string, number>();
  const counters = new Map<string, number>();

  function capture(method: ConsoleEntry['method'], args: unknown[]): void {
    const entry: ConsoleEntry = { method, args, timestamp: Date.now() };
    entries.push(entry);
    onEntry?.(entry);
  }

  return {
    entries,
    console: {
      log: (...args: unknown[]) => capture('log', args),
      warn: (...args: unknown[]) => capture('warn', args),
      error: (...args: unknown[]) => capture('error', args),
      info: (...args: unknown[]) => capture('info', args),
      debug: (...args: unknown[]) => capture('debug', args),
      trace: (...args: unknown[]) => capture('debug', ['Trace:', ...args]),
      dir: (obj: unknown) => capture('log', [obj]),
      time: (label: string = 'default') => { timers.set(label, performance.now()); },
      timeEnd: (label: string = 'default') => {
        const start = timers.get(label);
        if (start !== undefined) {
          const duration = performance.now() - start;
          capture('log', [`${label}: ${duration.toFixed(3)}ms`]);
          timers.delete(label);
        }
      },
      timeLog: (label: string = 'default', ...args: unknown[]) => {
        const start = timers.get(label);
        if (start !== undefined) {
          const duration = performance.now() - start;
          capture('log', [`${label}: ${duration.toFixed(3)}ms`, ...args]);
        }
      },
      count: (label: string = 'default') => {
        const count = (counters.get(label) ?? 0) + 1;
        counters.set(label, count);
        capture('log', [`${label}: ${count}`]);
      },
      countReset: (label: string = 'default') => { counters.delete(label); },
      group: (..._args: unknown[]) => {},
      groupEnd: () => {},
      table: (data: unknown) => capture('log', [data]),
      clear: () => { entries.length = 0; },
      assert: (condition: boolean, ...args: unknown[]) => {
        if (!condition) capture('error', ['Assertion failed:', ...args]);
      },
    },
  };
}

const consoleModule = {
  createConsoleCapture,
  ...console,
};

export default consoleModule;
