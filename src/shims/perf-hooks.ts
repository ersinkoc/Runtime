/**
 * Node.js `perf_hooks` module shim — wraps Performance API.
 * @module shims/perf-hooks
 */

const _performance = typeof performance !== 'undefined' ? performance : {
  now: () => Date.now(),
  mark: () => {},
  measure: () => {},
  getEntries: () => [],
  getEntriesByName: () => [],
  getEntriesByType: () => [],
  clearMarks: () => {},
  clearMeasures: () => {},
};

export { _performance as performance };

export class PerformanceObserver {
  private callback: (list: any) => void;

  constructor(callback: (list: any) => void) {
    this.callback = callback;
  }

  observe(_options?: { entryTypes?: string[] }): void {
    // Browser PerformanceObserver would be used here in a real impl
  }

  disconnect(): void {}
}

export function monitorEventLoopDelay(): { enable: () => void; disable: () => void; min: number; max: number; mean: number } {
  return { enable: () => {}, disable: () => {}, min: 0, max: 0, mean: 0 };
}

const perfHooksModule = {
  performance: _performance,
  PerformanceObserver,
  monitorEventLoopDelay,
};

export default perfHooksModule;
