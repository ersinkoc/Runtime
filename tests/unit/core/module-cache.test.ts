import { describe, it, expect } from 'vitest';
import { ModuleCache } from '../../../src/core/module-cache.js';

describe('ModuleCache', () => {
  it('should store and retrieve modules', () => {
    const cache = new ModuleCache();
    const mod = { exports: { hello: 'world' }, id: '/test.js', loaded: true };
    cache.set('/test.js', mod);
    expect(cache.get('/test.js')).toBe(mod);
  });

  it('should return undefined for missing modules', () => {
    const cache = new ModuleCache();
    expect(cache.get('/missing')).toBeUndefined();
  });

  it('should check existence with has()', () => {
    const cache = new ModuleCache();
    cache.set('/test.js', { exports: {}, id: '/test.js', loaded: true });
    expect(cache.has('/test.js')).toBe(true);
    expect(cache.has('/missing')).toBe(false);
  });

  it('should delete modules', () => {
    const cache = new ModuleCache();
    cache.set('/test.js', { exports: {}, id: '/test.js', loaded: true });
    expect(cache.delete('/test.js')).toBe(true);
    expect(cache.has('/test.js')).toBe(false);
    expect(cache.delete('/missing')).toBe(false);
  });

  it('should clear all modules', () => {
    const cache = new ModuleCache();
    cache.set('/a.js', { exports: {}, id: '/a.js', loaded: true });
    cache.set('/b.js', { exports: {}, id: '/b.js', loaded: true });
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('should track size', () => {
    const cache = new ModuleCache();
    expect(cache.size).toBe(0);
    cache.set('/a.js', { exports: {}, id: '/a.js', loaded: true });
    expect(cache.size).toBe(1);
    cache.set('/b.js', { exports: {}, id: '/b.js', loaded: true });
    expect(cache.size).toBe(2);
  });
});
