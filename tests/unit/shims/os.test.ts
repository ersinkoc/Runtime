import { describe, it, expect } from 'vitest';
import osModule from '../../../src/shims/os.js';

describe('os shim', () => {
  it('should have EOL', () => {
    expect(osModule.EOL).toBe('\n');
  });

  it('should return platform', () => {
    expect(osModule.platform()).toBe('browser');
  });

  it('should return arch', () => {
    expect(osModule.arch()).toBe('wasm');
  });

  it('should return type', () => {
    expect(osModule.type()).toBe('Browser');
  });

  it('should return release', () => {
    expect(typeof osModule.release()).toBe('string');
  });

  it('should return hostname', () => {
    expect(osModule.hostname()).toBe('localhost');
  });

  it('should return homedir', () => {
    expect(osModule.homedir()).toBe('/home/user');
  });

  it('should return tmpdir', () => {
    expect(osModule.tmpdir()).toBe('/tmp');
  });

  it('should return cpus array', () => {
    const cpus = osModule.cpus();
    expect(Array.isArray(cpus)).toBe(true);
    expect(cpus.length).toBeGreaterThanOrEqual(1);
    expect(cpus[0]).toHaveProperty('model');
    expect(cpus[0]).toHaveProperty('speed');
  });

  it('should fallback to 1 cpu when hardwareConcurrency is undefined', () => {
    const orig = navigator.hardwareConcurrency;
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: undefined, configurable: true });
    const cpus = osModule.cpus();
    expect(cpus).toHaveLength(1);
    expect(cpus[0]!.model).toBe('Virtual CPU');
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: orig, configurable: true });
  });

  it('should return totalmem', () => {
    expect(osModule.totalmem()).toBe(4 * 1024 * 1024 * 1024);
  });

  it('should return freemem', () => {
    expect(osModule.freemem()).toBe(2 * 1024 * 1024 * 1024);
  });

  it('should return uptime', () => {
    expect(typeof osModule.uptime()).toBe('number');
    expect(osModule.uptime()).toBeGreaterThanOrEqual(0);
  });

  it('should return loadavg', () => {
    const avg = osModule.loadavg();
    expect(avg).toHaveLength(3);
  });

  it('should return endianness', () => {
    const result = osModule.endianness();
    expect(['LE', 'BE']).toContain(result);
  });

  it('should return networkInterfaces', () => {
    const ifaces = osModule.networkInterfaces();
    expect(ifaces).toHaveProperty('lo');
    expect(ifaces.lo[0]!.address).toBe('127.0.0.1');
  });

  it('should return userInfo', () => {
    const info = osModule.userInfo();
    expect(info.username).toBe('user');
    expect(info.uid).toBe(1000);
    expect(info.homedir).toBe('/home/user');
  });

  it('should return 1 cpu when navigator is undefined', () => {
    const orig = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', { value: undefined, configurable: true });
    try {
      const cpus = osModule.cpus();
      expect(cpus).toHaveLength(1);
      expect(cpus[0]!.model).toBe('Virtual CPU');
    } finally {
      Object.defineProperty(globalThis, 'navigator', { value: orig, configurable: true });
    }
  });

  it('should return 0 uptime when performance is undefined', () => {
    const orig = globalThis.performance;
    Object.defineProperty(globalThis, 'performance', { value: undefined, configurable: true });
    try {
      expect(osModule.uptime()).toBe(0);
    } finally {
      Object.defineProperty(globalThis, 'performance', { value: orig, configurable: true });
    }
  });

  it('should return BE when byte order is big-endian', () => {
    const origSetInt16 = DataView.prototype.setInt16;
    DataView.prototype.setInt16 = function (offset: number, value: number) {
      return origSetInt16.call(this, offset, value, false);
    };
    try {
      expect(osModule.endianness()).toBe('BE');
    } finally {
      DataView.prototype.setInt16 = origSetInt16;
    }
  });
});
