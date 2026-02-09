/**
 * Node.js `events` module shim — EventEmitter.
 * @module shims/events
 */

/**
 * Full EventEmitter implementation matching Node.js semantics.
 *
 * @example
 * ```typescript
 * const emitter = new EventEmitter();
 * emitter.on('data', (msg) => console.log(msg));
 * emitter.emit('data', 'hello'); // logs 'hello'
 * ```
 */
export class EventEmitter {
  private _events = new Map<string | symbol, Array<(...args: any[]) => void>>();
  private _maxListeners = 10;

  static defaultMaxListeners = 10;

  addListener(event: string | symbol, listener: (...args: any[]) => void): this {
    return this.on(event, listener);
  }

  on(event: string | symbol, listener: (...args: any[]) => void): this {
    let handlers = this._events.get(event);
    if (!handlers) {
      handlers = [];
      this._events.set(event, handlers);
    }
    handlers.push(listener);
    return this;
  }

  off(event: string | symbol, listener: (...args: any[]) => void): this {
    return this.removeListener(event, listener);
  }

  once(event: string | symbol, listener: (...args: any[]) => void): this {
    const wrapper = (...args: any[]) => {
      this.removeListener(event, wrapper);
      listener.apply(this, args);
    };
    (wrapper as any).listener = listener;
    return this.on(event, wrapper);
  }

  emit(event: string | symbol, ...args: any[]): boolean {
    const handlers = this._events.get(event);
    if (!handlers || handlers.length === 0) return false;
    for (const handler of [...handlers]) {
      handler.apply(this, args);
    }
    return true;
  }

  removeListener(event: string | symbol, listener: (...args: any[]) => void): this {
    const handlers = this._events.get(event);
    if (!handlers) return this;
    const idx = handlers.findIndex(
      (h) => h === listener || (h as any).listener === listener,
    );
    if (idx !== -1) {
      handlers.splice(idx, 1);
    }
    if (handlers.length === 0) {
      this._events.delete(event);
    }
    return this;
  }

  removeAllListeners(event?: string | symbol): this {
    if (event !== undefined) {
      this._events.delete(event);
    } else {
      this._events.clear();
    }
    return this;
  }

  listenerCount(event: string | symbol): number {
    const handlers = this._events.get(event);
    return handlers ? handlers.length : 0;
  }

  listeners(event: string | symbol): Array<(...args: any[]) => void> {
    const handlers = this._events.get(event);
    return handlers ? [...handlers] : [];
  }

  rawListeners(event: string | symbol): Array<(...args: any[]) => void> {
    return this.listeners(event);
  }

  prependListener(event: string | symbol, listener: (...args: any[]) => void): this {
    let handlers = this._events.get(event);
    if (!handlers) {
      handlers = [];
      this._events.set(event, handlers);
    }
    handlers.unshift(listener);
    return this;
  }

  prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this {
    const wrapper = (...args: any[]) => {
      this.removeListener(event, wrapper);
      listener.apply(this, args);
    };
    (wrapper as any).listener = listener;
    return this.prependListener(event, wrapper);
  }

  eventNames(): Array<string | symbol> {
    return Array.from(this._events.keys());
  }

  setMaxListeners(n: number): this {
    this._maxListeners = n;
    return this;
  }

  getMaxListeners(): number {
    return this._maxListeners;
  }
}

const eventsModule = { EventEmitter, default: EventEmitter };
export default eventsModule;
