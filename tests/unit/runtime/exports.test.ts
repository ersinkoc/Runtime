import { describe, it, expect } from 'vitest';
import * as mainExports from '../../../src/index.js';
import * as pluginExports from '../../../src/plugins/index.js';

describe('main module exports', () => {
  it('should export createRuntime', () => {
    expect(typeof mainExports.createRuntime).toBe('function');
  });

  it('should export createContainer', () => {
    expect(typeof mainExports.createContainer).toBe('function');
  });

  it('should export RuntimeError', () => {
    expect(typeof mainExports.RuntimeError).toBe('function');
  });

  it('should export createError', () => {
    expect(typeof mainExports.createError).toBe('function');
  });
});

describe('plugins module exports', () => {
  it('should export vfsPlugin', () => {
    expect(typeof pluginExports.vfsPlugin).toBe('function');
  });

  it('should export shimsPlugin', () => {
    expect(typeof pluginExports.shimsPlugin).toBe('function');
  });

  it('should export npmPlugin', () => {
    expect(typeof pluginExports.npmPlugin).toBe('function');
  });

  it('should export transformPlugin', () => {
    expect(typeof pluginExports.transformPlugin).toBe('function');
  });

  it('should export serverBridgePlugin', () => {
    expect(typeof pluginExports.serverBridgePlugin).toBe('function');
  });

  it('should export securityPlugin', () => {
    expect(typeof pluginExports.securityPlugin).toBe('function');
  });

  it('should export persistencePlugin', () => {
    expect(typeof pluginExports.persistencePlugin).toBe('function');
  });

  it('should export exactly 7 plugins', () => {
    const fns = Object.values(pluginExports).filter((v) => typeof v === 'function');
    expect(fns.length).toBe(7);
  });
});
