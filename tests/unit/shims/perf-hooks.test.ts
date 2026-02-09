import { describe, it, expect, vi } from 'vitest';
import perfHooksModule, { performance as namedPerf, PerformanceObserver, monitorEventLoopDelay } from '../../../src/shims/perf-hooks.js';

describe('perf_hooks shim', () => {
  it('should expose performance.now()', () => {
    expect(typeof perfHooksModule.performance.now).toBe('function');
    const now = perfHooksModule.performance.now();
    expect(typeof now).toBe('number');
    expect(now).toBeGreaterThanOrEqual(0);
  });

  it('should have PerformanceObserver', () => {
    const observer = new perfHooksModule.PerformanceObserver(() => {});
    expect(() => observer.observe({ entryTypes: ['measure'] })).not.toThrow();
    expect(() => observer.disconnect()).not.toThrow();
  });

  it('should have monitorEventLoopDelay', () => {
    const monitor = perfHooksModule.monitorEventLoopDelay();
    expect(typeof monitor.enable).toBe('function');
    expect(typeof monitor.disable).toBe('function');
    expect(monitor.min).toBe(0);
    expect(monitor.max).toBe(0);
    expect(monitor.mean).toBe(0);
  });

  it('should support monitorEventLoopDelay enable/disable', () => {
    const monitor = perfHooksModule.monitorEventLoopDelay();
    expect(() => monitor.enable()).not.toThrow();
    expect(() => monitor.disable()).not.toThrow();
  });

  it('should have performance.mark', () => {
    expect(typeof perfHooksModule.performance.mark).toBe('function');
    expect(() => perfHooksModule.performance.mark('test-mark')).not.toThrow();
  });

  it('should have performance.measure', () => {
    expect(typeof perfHooksModule.performance.measure).toBe('function');
    expect(() => perfHooksModule.performance.measure('test-measure')).not.toThrow();
  });

  it('should have performance.getEntries', () => {
    const entries = perfHooksModule.performance.getEntries();
    expect(Array.isArray(entries)).toBe(true);
  });

  it('should have performance.getEntriesByName', () => {
    const entries = perfHooksModule.performance.getEntriesByName('test');
    expect(Array.isArray(entries)).toBe(true);
  });

  it('should have performance.getEntriesByType', () => {
    const entries = perfHooksModule.performance.getEntriesByType('measure');
    expect(Array.isArray(entries)).toBe(true);
  });

  it('should have performance.clearMarks', () => {
    expect(() => perfHooksModule.performance.clearMarks()).not.toThrow();
  });

  it('should have performance.clearMeasures', () => {
    expect(() => perfHooksModule.performance.clearMeasures()).not.toThrow();
  });

  it('should export named performance', () => {
    expect(namedPerf).toBe(perfHooksModule.performance);
    expect(typeof namedPerf.now).toBe('function');
  });

  it('should export named PerformanceObserver', () => {
    expect(PerformanceObserver).toBe(perfHooksModule.PerformanceObserver);
    const obs = new PerformanceObserver(() => {});
    obs.observe();
    obs.disconnect();
  });

  it('should export named monitorEventLoopDelay', () => {
    expect(monitorEventLoopDelay).toBe(perfHooksModule.monitorEventLoopDelay);
  });

  it('should use fallback functions when performance is undefined', async () => {
    const origPerf = globalThis.performance;
    Object.defineProperty(globalThis, 'performance', { value: undefined, configurable: true });
    try {
      vi.resetModules();
      const freshModule = await import('../../../src/shims/perf-hooks.js');
      const perf = freshModule.performance;

      // now() falls back to Date.now()
      expect(typeof perf.now()).toBe('number');
      expect(perf.now()).toBeGreaterThan(0);

      // noop functions
      expect(perf.mark()).toBeUndefined();
      expect(perf.measure()).toBeUndefined();
      expect(perf.clearMarks()).toBeUndefined();
      expect(perf.clearMeasures()).toBeUndefined();

      // empty array functions
      expect(perf.getEntries()).toEqual([]);
      expect(perf.getEntriesByName()).toEqual([]);
      expect(perf.getEntriesByType()).toEqual([]);
    } finally {
      Object.defineProperty(globalThis, 'performance', { value: origPerf, configurable: true });
      vi.resetModules();
    }
  });
});
