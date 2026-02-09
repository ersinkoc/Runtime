import { describe, it, expect } from 'vitest';
import ttyModule from '../../../src/shims/tty.js';

describe('tty shim', () => {
  it('should return false for isatty', () => {
    expect(ttyModule.isatty()).toBe(false);
  });

  it('should have ReadStream', () => {
    const rs = new ttyModule.ReadStream();
    expect(rs.isTTY).toBe(false);
  });

  it('should have WriteStream', () => {
    const ws = new ttyModule.WriteStream();
    expect(ws.isTTY).toBe(false);
    expect(ws.columns).toBe(80);
    expect(ws.rows).toBe(24);
  });
});
