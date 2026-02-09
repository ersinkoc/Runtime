import { describe, it, expect } from 'vitest';
import { createConsoleCapture } from '../../../src/shims/console.js';

describe('console shim', () => {
  it('should capture log entries', () => {
    const { console: con, entries } = createConsoleCapture();
    con.log('hello', 'world');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.method).toBe('log');
    expect(entries[0]!.args).toEqual(['hello', 'world']);
  });

  it('should capture warn entries', () => {
    const { console: con, entries } = createConsoleCapture();
    con.warn('warning');
    expect(entries[0]!.method).toBe('warn');
  });

  it('should capture error entries', () => {
    const { console: con, entries } = createConsoleCapture();
    con.error('error');
    expect(entries[0]!.method).toBe('error');
  });

  it('should capture info entries', () => {
    const { console: con, entries } = createConsoleCapture();
    con.info('info');
    expect(entries[0]!.method).toBe('info');
  });

  it('should capture debug entries', () => {
    const { console: con, entries } = createConsoleCapture();
    con.debug('debug');
    expect(entries[0]!.method).toBe('debug');
  });

  it('should capture trace as debug', () => {
    const { console: con, entries } = createConsoleCapture();
    con.trace('trace');
    expect(entries[0]!.method).toBe('debug');
    expect(entries[0]!.args[0]).toBe('Trace:');
  });

  it('should capture dir as log', () => {
    const { console: con, entries } = createConsoleCapture();
    con.dir({ a: 1 });
    expect(entries[0]!.method).toBe('log');
  });

  it('should support time/timeEnd', () => {
    const { console: con, entries } = createConsoleCapture();
    con.time('test');
    con.timeEnd('test');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.args[0]).toContain('test:');
  });

  it('should support timeLog', () => {
    const { console: con, entries } = createConsoleCapture();
    con.time('test');
    con.timeLog('test', 'extra');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.args[0]).toContain('test:');
    expect(entries[0]!.args[1]).toBe('extra');
  });

  it('should support count', () => {
    const { console: con, entries } = createConsoleCapture();
    con.count('myCounter');
    con.count('myCounter');
    expect(entries).toHaveLength(2);
    expect(entries[0]!.args[0]).toBe('myCounter: 1');
    expect(entries[1]!.args[0]).toBe('myCounter: 2');
  });

  it('should support countReset', () => {
    const { console: con, entries } = createConsoleCapture();
    con.count('c');
    con.count('c');
    con.countReset('c');
    con.count('c');
    expect(entries[2]!.args[0]).toBe('c: 1');
  });

  it('should capture table as log', () => {
    const { console: con, entries } = createConsoleCapture();
    con.table([1, 2, 3]);
    expect(entries[0]!.method).toBe('log');
  });

  it('should clear entries', () => {
    const { console: con, entries } = createConsoleCapture();
    con.log('a');
    con.log('b');
    expect(entries).toHaveLength(2);
    con.clear();
    expect(entries).toHaveLength(0);
  });

  it('should capture assert failures', () => {
    const { console: con, entries } = createConsoleCapture();
    con.assert(true, 'should not appear');
    expect(entries).toHaveLength(0);
    con.assert(false, 'failed');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.method).toBe('error');
    expect(entries[0]!.args).toContain('Assertion failed:');
  });

  it('should call onEntry callback', () => {
    const received: any[] = [];
    const { console: con } = createConsoleCapture((entry) => received.push(entry));
    con.log('test');
    expect(received).toHaveLength(1);
    expect(received[0].args).toEqual(['test']);
  });

  it('should have timestamps', () => {
    const { console: con, entries } = createConsoleCapture();
    con.log('test');
    expect(typeof entries[0]!.timestamp).toBe('number');
    expect(entries[0]!.timestamp).toBeGreaterThan(0);
  });

  it('should handle group/groupEnd without error', () => {
    const { console: con } = createConsoleCapture();
    expect(() => {
      con.group('group');
      con.groupEnd();
    }).not.toThrow();
  });
});
