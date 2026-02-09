import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from '../../../src/shims/events.js';

describe('EventEmitter', () => {
  it('should add and emit listeners', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();
    emitter.on('test', handler);
    emitter.emit('test', 'arg1', 'arg2');
    expect(handler).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('should support addListener alias', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();
    emitter.addListener('test', handler);
    emitter.emit('test');
    expect(handler).toHaveBeenCalled();
  });

  it('should return false when no listeners', () => {
    const emitter = new EventEmitter();
    expect(emitter.emit('test')).toBe(false);
  });

  it('should return true when listeners exist', () => {
    const emitter = new EventEmitter();
    emitter.on('test', () => {});
    expect(emitter.emit('test')).toBe(true);
  });

  it('should support once listeners', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();
    emitter.once('test', handler);
    emitter.emit('test');
    emitter.emit('test');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should remove specific listeners', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();
    emitter.on('test', handler);
    emitter.off('test', handler);
    emitter.emit('test');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should remove once listener by original function', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();
    emitter.once('test', handler);
    emitter.removeListener('test', handler);
    emitter.emit('test');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should removeAllListeners for event', () => {
    const emitter = new EventEmitter();
    emitter.on('test', vi.fn());
    emitter.on('test', vi.fn());
    emitter.removeAllListeners('test');
    expect(emitter.listenerCount('test')).toBe(0);
  });

  it('should removeAllListeners for all events', () => {
    const emitter = new EventEmitter();
    emitter.on('a', vi.fn());
    emitter.on('b', vi.fn());
    emitter.removeAllListeners();
    expect(emitter.eventNames()).toEqual([]);
  });

  it('should track listener count', () => {
    const emitter = new EventEmitter();
    expect(emitter.listenerCount('test')).toBe(0);
    emitter.on('test', vi.fn());
    expect(emitter.listenerCount('test')).toBe(1);
    emitter.on('test', vi.fn());
    expect(emitter.listenerCount('test')).toBe(2);
  });

  it('should return listener copies', () => {
    const emitter = new EventEmitter();
    const h1 = vi.fn();
    const h2 = vi.fn();
    emitter.on('test', h1);
    emitter.on('test', h2);
    const listeners = emitter.listeners('test');
    expect(listeners).toHaveLength(2);
    expect(listeners[0]).toBe(h1);
  });

  it('should return empty array for no listeners', () => {
    const emitter = new EventEmitter();
    expect(emitter.listeners('test')).toEqual([]);
  });

  it('should prepend listeners', () => {
    const emitter = new EventEmitter();
    const order: number[] = [];
    emitter.on('test', () => order.push(1));
    emitter.prependListener('test', () => order.push(0));
    emitter.emit('test');
    expect(order).toEqual([0, 1]);
  });

  it('should prependListener on new event with no existing handlers', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();
    emitter.prependListener('brand-new', handler);
    emitter.emit('brand-new', 'data');
    expect(handler).toHaveBeenCalledWith('data');
  });

  it('should prepend once listeners', () => {
    const emitter = new EventEmitter();
    const order: number[] = [];
    emitter.on('test', () => order.push(1));
    emitter.prependOnceListener('test', () => order.push(0));
    emitter.emit('test');
    emitter.emit('test');
    expect(order).toEqual([0, 1, 1]);
  });

  it('should list event names', () => {
    const emitter = new EventEmitter();
    emitter.on('a', vi.fn());
    emitter.on('b', vi.fn());
    expect(emitter.eventNames()).toEqual(['a', 'b']);
  });

  it('should set and get max listeners', () => {
    const emitter = new EventEmitter();
    expect(emitter.getMaxListeners()).toBe(10);
    emitter.setMaxListeners(5);
    expect(emitter.getMaxListeners()).toBe(5);
  });

  it('should handle removeListener for non-existent event', () => {
    const emitter = new EventEmitter();
    emitter.removeListener('nope', vi.fn());
    expect(emitter.listenerCount('nope')).toBe(0);
  });

  it('should handle rawListeners', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();
    emitter.on('test', handler);
    expect(emitter.rawListeners('test')).toHaveLength(1);
  });

  it('should support chaining', () => {
    const emitter = new EventEmitter();
    const result = emitter.on('a', vi.fn()).on('b', vi.fn()).off('a', vi.fn());
    expect(result).toBe(emitter);
  });

  it('should support symbol events', () => {
    const emitter = new EventEmitter();
    const sym = Symbol('test');
    const handler = vi.fn();
    emitter.on(sym, handler);
    emitter.emit(sym, 'data');
    expect(handler).toHaveBeenCalledWith('data');
  });
});
