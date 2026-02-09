/**
 * Node.js `stream` module shim — event-based streams.
 * @module shims/stream
 */

import { EventEmitter } from './events.js';

export class Stream extends EventEmitter {
  pipe<T extends Writable>(destination: T): T {
    this.on('data', (chunk: unknown) => {
      const canContinue = destination.write(chunk);
      if (!canContinue) {
        this.pause?.();
        destination.once('drain', () => this.resume?.());
      }
    });
    this.on('end', () => destination.end());
    this.on('error', (err: Error) => destination.emit('error', err));
    return destination;
  }

  pause?(): this;
  resume?(): this;
}

export class Readable extends Stream {
  private _readableState = {
    flowing: false as boolean | null,
    ended: false,
    destroyed: false,
    buffer: [] as unknown[],
    reading: false,
    objectMode: false,
    highWaterMark: 16384,
  };

  readable = true;

  constructor(options?: { objectMode?: boolean; highWaterMark?: number; read?: (size: number) => void }) {
    super();
    if (options?.objectMode) this._readableState.objectMode = true;
    if (options?.highWaterMark !== undefined) this._readableState.highWaterMark = options.highWaterMark;
    if (options?.read) this._read = options.read.bind(this);
  }

  _read(_size: number): void {
    // Override in subclass
  }

  push(chunk: unknown): boolean {
    if (chunk === null) {
      this._readableState.ended = true;
      this.emit('end');
      return false;
    }

    if (this._readableState.flowing) {
      this.emit('data', chunk);
    } else {
      this._readableState.buffer.push(chunk);
    }
    return true;
  }

  read(_size?: number): unknown {
    if (this._readableState.buffer.length > 0) {
      return this._readableState.buffer.shift();
    }
    return null;
  }

  override pause(): this {
    this._readableState.flowing = false;
    this.emit('pause');
    return this;
  }

  override resume(): this {
    this._readableState.flowing = true;
    // Flush buffer
    while (this._readableState.buffer.length > 0) {
      this.emit('data', this._readableState.buffer.shift());
    }
    this.emit('resume');
    return this;
  }

  override on(event: string | symbol, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    if (event === 'data') {
      this._readableState.flowing = true;
    }
    return this;
  }

  destroy(error?: Error): this {
    if (this._readableState.destroyed) return this;
    this._readableState.destroyed = true;
    if (error) this.emit('error', error);
    this.emit('close');
    return this;
  }

  setEncoding(_encoding: string): this {
    return this;
  }

  unpipe(_destination?: Writable): this {
    return this;
  }

  unshift(chunk: unknown): void {
    this._readableState.buffer.unshift(chunk);
  }

  get destroyed(): boolean {
    return this._readableState.destroyed;
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<unknown> {
    const self = this;
    const buffer: unknown[] = [];
    let resolve: ((value: IteratorResult<unknown>) => void) | null = null;
    let done = false;

    self.on('data', (chunk) => {
      if (resolve) {
        const r = resolve;
        resolve = null;
        r({ value: chunk, done: false });
      } else {
        buffer.push(chunk);
      }
    });

    self.on('end', () => {
      done = true;
      if (resolve) {
        const r = resolve;
        resolve = null;
        r({ value: undefined, done: true });
      }
    });

    return {
      next(): Promise<IteratorResult<unknown>> {
        if (buffer.length > 0) {
          return Promise.resolve({ value: buffer.shift(), done: false });
        }
        if (done) return Promise.resolve({ value: undefined, done: true });
        return new Promise((r) => { resolve = r; });
      },
      return(): Promise<IteratorResult<unknown>> {
        done = true;
        return Promise.resolve({ value: undefined, done: true });
      },
      [Symbol.asyncIterator]() { return this; },
    };
  }
}

export class Writable extends Stream {
  private _writableState = {
    ended: false,
    destroyed: false,
    writing: false,
    corked: 0,
    buffer: [] as Array<{ chunk: unknown; encoding: string; callback: (err?: Error | null) => void }>,
    objectMode: false,
    highWaterMark: 16384,
  };

  writable = true;

  constructor(options?: { objectMode?: boolean; highWaterMark?: number; write?: (chunk: unknown, encoding: string, callback: (err?: Error | null) => void) => void }) {
    super();
    if (options?.objectMode) this._writableState.objectMode = true;
    if (options?.highWaterMark !== undefined) this._writableState.highWaterMark = options.highWaterMark;
    if (options?.write) this._write = options.write.bind(this);
  }

  _write(chunk: unknown, _encoding: string, callback: (err?: Error | null) => void): void {
    callback();
  }

  write(chunk: unknown, encodingOrCallback?: string | ((err?: Error | null) => void), callback?: (err?: Error | null) => void): boolean {
    const encoding = typeof encodingOrCallback === 'string' ? encodingOrCallback : 'utf8';
    const cb = typeof encodingOrCallback === 'function' ? encodingOrCallback : (callback || (() => {}));

    if (this._writableState.ended) {
      cb(new Error('write after end'));
      return false;
    }

    this._write(chunk, encoding, cb);
    return true;
  }

  end(chunkOrCallback?: unknown, encodingOrCallback?: string | (() => void), callback?: () => void): this {
    const cb = typeof chunkOrCallback === 'function' ? chunkOrCallback as () => void
      : typeof encodingOrCallback === 'function' ? encodingOrCallback
      : callback || (() => {});

    if (typeof chunkOrCallback !== 'function' && chunkOrCallback !== undefined) {
      this.write(chunkOrCallback, typeof encodingOrCallback === 'string' ? encodingOrCallback : undefined);
    }

    this._writableState.ended = true;
    this.emit('finish');
    cb();
    return this;
  }

  destroy(error?: Error): this {
    if (this._writableState.destroyed) return this;
    this._writableState.destroyed = true;
    if (error) this.emit('error', error);
    this.emit('close');
    return this;
  }

  cork(): void {
    this._writableState.corked++;
  }

  uncork(): void {
    this._writableState.corked = Math.max(0, this._writableState.corked - 1);
  }

  get destroyed(): boolean {
    return this._writableState.destroyed;
  }
}

export class Duplex extends Readable {
  private _writable: Writable;

  constructor(options?: any) {
    super(options);
    this._writable = new Writable(options);
  }

  write(chunk: unknown, encodingOrCallback?: string | ((err?: Error | null) => void), callback?: (err?: Error | null) => void): boolean {
    return this._writable.write(chunk, encodingOrCallback as any, callback);
  }

  end(chunkOrCallback?: unknown, encodingOrCallback?: string | (() => void), callback?: () => void): this {
    this._writable.end(chunkOrCallback, encodingOrCallback as any, callback);
    return this;
  }
}

export class Transform extends Duplex {
  constructor(options?: any) {
    super(options);
    if (options?.transform) this._transform = options.transform.bind(this);
  }

  _transform(chunk: unknown, _encoding: string, callback: (err?: Error | null, data?: unknown) => void): void {
    callback(null, chunk);
  }

  _flush(callback: (err?: Error | null, data?: unknown) => void): void {
    callback();
  }
}

export class PassThrough extends Transform {
  override _transform(chunk: unknown, _encoding: string, callback: (err?: Error | null, data?: unknown) => void): void {
    callback(null, chunk);
  }
}

export function pipeline(...args: any[]): void {
  const callback = typeof args[args.length - 1] === 'function' ? args.pop() : () => {};
  const streams = args as Stream[];

  let current: Stream = streams[0]!;
  for (let i = 1; i < streams.length; i++) {
    current = (current as Readable).pipe(streams[i] as Writable);
  }

  streams[streams.length - 1]!.on('finish', () => callback());
  streams[streams.length - 1]!.on('error', (err: Error) => callback(err));
}

export function finished(stream: Stream, callback: (err?: Error | null) => void): () => void {
  const onEnd = () => { cleanup(); callback(); };
  const onFinish = () => { cleanup(); callback(); };
  const onError = (err: Error) => { cleanup(); callback(err); };

  stream.on('end', onEnd);
  stream.on('finish', onFinish);
  stream.on('error', onError);

  function cleanup() {
    stream.off('end', onEnd);
    stream.off('finish', onFinish);
    stream.off('error', onError);
  }

  return cleanup;
}

const streamModule = {
  Stream, Readable, Writable, Duplex, Transform, PassThrough,
  pipeline, finished,
};

export default streamModule;
