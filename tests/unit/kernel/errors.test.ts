import { describe, it, expect } from 'vitest';
import { RuntimeError, createError } from '../../../src/errors.js';

describe('RuntimeError', () => {
  it('should create error with all fields', () => {
    const err = new RuntimeError('test message', 'MODULE_NOT_FOUND', '/app.js', 'install it');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(RuntimeError);
    expect(err.message).toBe('test message');
    expect(err.name).toBe('RuntimeError');
    expect(err.code).toBe('MODULE_NOT_FOUND');
    expect(err.context).toBe('/app.js');
    expect(err.suggestion).toBe('install it');
  });

  it('should work without optional fields', () => {
    const err = new RuntimeError('test', 'FS_ERROR');
    expect(err.message).toBe('test');
    expect(err.code).toBe('FS_ERROR');
    expect(err.context).toBeUndefined();
    expect(err.suggestion).toBeUndefined();
  });

  it('should have correct stack trace', () => {
    const err = new RuntimeError('test', 'PARSE_ERROR');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('RuntimeError');
  });
});

describe('createError', () => {
  it('should create error with provided suggestion', () => {
    const err = createError('some error', 'FS_ERROR', '/file', 'custom suggestion');
    expect(err.suggestion).toBe('custom suggestion');
  });

  it('should auto-detect MODULE_NOT_FOUND suggestion', () => {
    const err = createError("Cannot find module 'lodash'", 'MODULE_NOT_FOUND', '/app.js');
    expect(err.suggestion).toBe("Install with: runtime.npm.install('lodash')");
  });

  it('should auto-detect "is not a function" suggestion', () => {
    const err = createError('foo.bar is not a function', 'EXECUTION_ERROR');
    expect(err.suggestion).toBe('Check: are you using default export vs named export?');
  });

  it('should auto-detect Buffer suggestion', () => {
    const err = createError('Buffer is not defined', 'EXECUTION_ERROR');
    expect(err.suggestion).toBe("Add: const { Buffer } = require('buffer')");
  });

  it('should auto-detect import statement suggestion', () => {
    const err = createError('Cannot use import statement', 'PARSE_ERROR');
    expect(err.suggestion).toBe('Rename file to .mjs or set "type": "module" in package.json');
  });

  it('should auto-detect Unexpected token suggestion', () => {
    const err = createError('Unexpected token <', 'PARSE_ERROR');
    expect(err.suggestion).toBe('This may be TypeScript or JSX — ensure transformPlugin is loaded');
  });

  it('should return no suggestion when no pattern matches', () => {
    const err = createError('Unknown error', 'EXECUTION_ERROR');
    expect(err.suggestion).toBeUndefined();
  });

  it('should preserve all RuntimeError fields', () => {
    const err = createError('test', 'NETWORK_ERROR', 'cdn');
    expect(err).toBeInstanceOf(RuntimeError);
    expect(err.code).toBe('NETWORK_ERROR');
    expect(err.context).toBe('cdn');
  });
});
