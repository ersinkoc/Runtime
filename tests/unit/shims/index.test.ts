import { describe, it, expect } from 'vitest';
import { getShims } from '../../../src/shims/index.js';

describe('shim registry', () => {
  it('should return all tier 1 shims for full tier', () => {
    const shims = getShims({ tier: 'full' });
    expect(shims.has('path')).toBe(true);
    expect(shims.has('buffer')).toBe(true);
    expect(shims.has('events')).toBe(true);
    expect(shims.has('process')).toBe(true);
    expect(shims.has('util')).toBe(true);
    expect(shims.has('os')).toBe(true);
    expect(shims.has('timers')).toBe(true);
    expect(shims.has('console')).toBe(true);
    expect(shims.has('string_decoder')).toBe(true);
    expect(shims.has('tty')).toBe(true);
    expect(shims.has('perf_hooks')).toBe(true);
  });

  it('should include stub modules for full tier', () => {
    const shims = getShims({ tier: 'full' });
    expect(shims.has('tls')).toBe(true);
    expect(shims.has('dns')).toBe(true);
    expect(shims.has('vm')).toBe(true);
  });

  it('should return minimal set', () => {
    const shims = getShims({ tier: 'minimal' });
    expect(shims.has('path')).toBe(true);
    expect(shims.has('buffer')).toBe(true);
    expect(shims.has('events')).toBe(true);
    expect(shims.has('process')).toBe(true);
    expect(shims.has('util')).toBe(true);
    expect(shims.has('os')).toBe(true);
    expect(shims.has('timers')).toBe(false);
    expect(shims.has('tls')).toBe(false);
  });

  it('should support custom tier with include', () => {
    const shims = getShims({ tier: 'custom', include: ['path', 'buffer'] });
    expect(shims.size).toBe(2);
    expect(shims.has('path')).toBe(true);
    expect(shims.has('buffer')).toBe(true);
  });

  it('should support exclude', () => {
    const shims = getShims({ tier: 'minimal', exclude: ['os'] });
    expect(shims.has('os')).toBe(false);
    expect(shims.has('path')).toBe(true);
  });

  it('should create stubs that throw on access', () => {
    const shims = getShims({ tier: 'full' });
    const tls = shims.get('tls') as any;
    expect(() => tls.connect()).toThrow('not supported');
  });

  it('should default to full tier', () => {
    const shims = getShims();
    expect(shims.has('path')).toBe(true);
    expect(shims.has('tls')).toBe(true);
  });

  it('should alias https to http module', () => {
    const shims = getShims({ tier: 'full' });
    expect(shims.has('https')).toBe(true);
    expect(shims.get('https')).toBe(shims.get('http'));
  });

  it('should include all tier 3 stub modules', () => {
    const shims = getShims({ tier: 'full' });
    const stubs = ['tls', 'dns', 'dgram', 'cluster', 'vm', 'v8', 'inspector',
      'async_hooks', 'readline', 'repl', 'domain', 'punycode', 'module'];
    for (const name of stubs) {
      expect(shims.has(name)).toBe(true);
    }
  });

  it('should exclude stub modules when specified', () => {
    const shims = getShims({ tier: 'full', exclude: ['tls', 'dns'] });
    expect(shims.has('tls')).toBe(false);
    expect(shims.has('dns')).toBe(false);
    expect(shims.has('vm')).toBe(true);
  });

  it('should have stubs with toString', () => {
    const shims = getShims({ tier: 'full' });
    const stub = shims.get('tls') as any;
    expect(stub.toString()).toContain('[stub: tls]');
  });

  it('should include stream, fs, crypto in full tier', () => {
    const shims = getShims({ tier: 'full' });
    expect(shims.has('stream')).toBe(true);
    expect(shims.has('fs')).toBe(true);
    expect(shims.has('crypto')).toBe(true);
    expect(shims.has('zlib')).toBe(true);
    expect(shims.has('assert')).toBe(true);
    expect(shims.has('net')).toBe(true);
    expect(shims.has('worker_threads')).toBe(true);
  });

  it('should not include stub modules for minimal tier', () => {
    const shims = getShims({ tier: 'minimal' });
    expect(shims.has('tls')).toBe(false);
    expect(shims.has('dns')).toBe(false);
    expect(shims.has('vm')).toBe(false);
  });

  it('should ignore unknown shim names in custom tier', () => {
    const shims = getShims({ tier: 'custom', include: ['path', 'nonexistent_module'] });
    expect(shims.has('path')).toBe(true);
    expect(shims.has('nonexistent_module')).toBe(false);
    expect(shims.size).toBe(1);
  });

  it('should return undefined for non-string Symbol prop on stub', () => {
    const shims = getShims({ tier: 'full' });
    const stub = shims.get('tls') as any;
    const customSymbol = Symbol('custom');
    expect(stub[customSymbol]).toBeUndefined();
  });
});
