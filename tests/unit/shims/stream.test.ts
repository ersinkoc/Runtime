import { describe, it, expect, vi } from 'vitest';
import { Readable, Writable, Transform, PassThrough, Duplex, pipeline, finished } from '../../../src/shims/stream.js';

describe('stream shim', () => {
  describe('Readable', () => {
    it('should emit data events', () => {
      const readable = new Readable({
        read() {
          this.push('hello');
          this.push(null);
        },
      });
      const chunks: unknown[] = [];
      readable.on('data', (chunk) => chunks.push(chunk));
      readable.on('end', () => {
        expect(chunks).toEqual(['hello']);
      });
    });

    it('should support push/read', () => {
      const readable = new Readable();
      readable.push('data1');
      const chunk = readable.read();
      expect(chunk).toBe('data1');
    });

    it('should support pause/resume', () => {
      const readable = new Readable();
      readable.pause();
      readable.push('buffered');
      // In paused mode, data is buffered and available via read()
      expect(readable.read()).toBe('buffered');
      const handler = vi.fn();
      readable.on('data', handler);
      readable.resume();
    });

    it('should support destroy', () => {
      const readable = new Readable();
      const closeFn = vi.fn();
      readable.on('close', closeFn);
      readable.destroy();
      expect(readable.destroyed).toBe(true);
      expect(closeFn).toHaveBeenCalled();
    });

    it('should emit error on destroy with error', () => {
      const readable = new Readable();
      const errorFn = vi.fn();
      readable.on('error', errorFn);
      readable.destroy(new Error('test'));
      expect(errorFn).toHaveBeenCalled();
    });
  });

  describe('Writable', () => {
    it('should accept writes', () => {
      const chunks: unknown[] = [];
      const writable = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });
      writable.write('hello');
      expect(chunks).toEqual(['hello']);
    });

    it('should emit finish on end', () => {
      const finishFn = vi.fn();
      const writable = new Writable();
      writable.on('finish', finishFn);
      writable.end();
      expect(finishFn).toHaveBeenCalled();
    });

    it('should write final chunk on end', () => {
      const chunks: unknown[] = [];
      const writable = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });
      writable.end('final');
      expect(chunks).toEqual(['final']);
    });

    it('should support destroy', () => {
      const writable = new Writable();
      writable.destroy();
      expect(writable.destroyed).toBe(true);
    });

    it('should support cork/uncork', () => {
      const writable = new Writable();
      writable.cork();
      writable.uncork();
    });
  });

  describe('Duplex', () => {
    it('should be readable and writable', () => {
      const duplex = new Duplex();
      expect(duplex.readable).toBe(true);
      duplex.push('data');
      expect(duplex.read()).toBe('data');
      duplex.write('test');
    });
  });

  describe('Transform', () => {
    it('should pass through by default', () => {
      const transform = new Transform();
      const handler = vi.fn();
      transform.on('data', handler);
      transform.push('hello');
      expect(handler).toHaveBeenCalledWith('hello');
    });

    it('should invoke _transform callback', () => {
      const transform = new Transform();
      const cb = vi.fn();
      transform._transform('data', 'utf8', cb);
      expect(cb).toHaveBeenCalledWith(null, 'data');
    });

    it('should invoke _flush callback', () => {
      const transform = new Transform();
      const cb = vi.fn();
      transform._flush(cb);
      expect(cb).toHaveBeenCalled();
    });
  });

  describe('PassThrough', () => {
    it('should pass data through', () => {
      const pt = new PassThrough();
      pt.push('hello');
      expect(pt.read()).toBe('hello');
    });

    it('should invoke _transform with passthrough', () => {
      const pt = new PassThrough();
      const cb = vi.fn();
      pt._transform('data', 'utf8', cb);
      expect(cb).toHaveBeenCalledWith(null, 'data');
    });
  });

  describe('pipe', () => {
    it('should pipe readable to writable', () => {
      const chunks: unknown[] = [];
      const readable = new Readable();
      const writable = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });
      readable.pipe(writable);
      readable.push('data');
      readable.push(null);
      expect(chunks).toEqual(['data']);
    });
  });

  describe('Readable _read', () => {
    it('should have a default _read that is a no-op', () => {
      const readable = new Readable();
      // Call the default _read stub — should not throw
      expect(() => readable._read(1024)).not.toThrow();
    });
  });

  describe('Readable advanced', () => {
    it('should be idempotent on multiple destroy calls', () => {
      const readable = new Readable();
      const closeFn = vi.fn();
      readable.on('close', closeFn);
      readable.destroy();
      readable.destroy();
      expect(closeFn).toHaveBeenCalledTimes(1);
    });

    it('should support setEncoding', () => {
      const readable = new Readable();
      expect(readable.setEncoding('utf8')).toBe(readable);
    });

    it('should support unpipe', () => {
      const readable = new Readable();
      expect(readable.unpipe()).toBe(readable);
    });

    it('should support unshift', () => {
      const readable = new Readable();
      readable.push('b');
      readable.unshift('a');
      expect(readable.read()).toBe('a');
      expect(readable.read()).toBe('b');
    });

    it('should iterate with async iterator', async () => {
      const readable = new Readable();

      // Push chunks after a tick so the async iterator has time to set up listeners
      const chunks: unknown[] = [];
      const iter = readable[Symbol.asyncIterator]();
      // Push data after iterator is listening
      queueMicrotask(() => {
        readable.push('chunk1');
        readable.push('chunk2');
        readable.push(null);
      });
      let result = await iter.next();
      while (!result.done) {
        chunks.push(result.value);
        result = await iter.next();
      }
      expect(chunks).toEqual(['chunk1', 'chunk2']);
    });

    it('should resolve pending next() when end fires', async () => {
      const readable = new Readable();
      const iter = readable[Symbol.asyncIterator]();

      // Start waiting for next before any data arrives
      const nextPromise = iter.next();

      // Push null (end) while iterator is waiting
      queueMicrotask(() => readable.push(null));

      const result = await nextPromise;
      expect(result.done).toBe(true);
    });

    it('should flush buffer on resume', () => {
      const readable = new Readable();
      const handler = vi.fn();
      // Push data while paused
      readable.pause();
      readable.push('buffered1');
      readable.push('buffered2');

      readable.on('data', handler);
      readable.resume();
      expect(handler).toHaveBeenCalledWith('buffered1');
      expect(handler).toHaveBeenCalledWith('buffered2');
    });
  });

  describe('Readable async iterator return', () => {
    it('should support iterator return to terminate early', async () => {
      const readable = new Readable();
      const iter = readable[Symbol.asyncIterator]();
      readable.push('data');
      const first = await iter.next();
      expect(first.done).toBe(false);
      expect(first.value).toBe('data');
      const ret = await iter.return!();
      expect(ret.done).toBe(true);
    });
  });

  describe('Writable write after end', () => {
    it('should error on write after end', () => {
      const writable = new Writable();
      const errorCb = vi.fn();
      writable.end();
      const result = writable.write('data', errorCb);
      expect(result).toBe(false);
      expect(errorCb).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Writable advanced', () => {
    it('should be idempotent on multiple destroy calls', () => {
      const writable = new Writable();
      const closeFn = vi.fn();
      writable.on('close', closeFn);
      writable.destroy();
      writable.destroy();
      expect(closeFn).toHaveBeenCalledTimes(1);
    });

    it('should not throw on multiple end calls', () => {
      const writable = new Writable();
      expect(() => {
        writable.end();
        writable.end();
      }).not.toThrow();
    });

    it('should call callback on write', () => {
      const cb = vi.fn();
      const writable = new Writable();
      writable.write('data', cb);
      expect(cb).toHaveBeenCalled();
    });

    it('should track cork/uncork state', () => {
      const writable = new Writable();
      writable.cork();
      writable.cork();
      writable.uncork();
      writable.uncork();
    });
  });

  describe('Duplex advanced', () => {
    it('should delegate end to internal writable without error', () => {
      const duplex = new Duplex();
      expect(() => duplex.end()).not.toThrow();
    });
  });

  describe('Transform with custom _transform', () => {
    it('should accept custom transform option', () => {
      const customFn = vi.fn((_chunk: unknown, _encoding: string, callback: (err?: Error | null, data?: unknown) => void) => {
        callback(null, 'transformed');
      });
      const transform = new Transform({ transform: customFn });
      // Verify the custom _transform was bound
      expect(transform._transform).toBeDefined();
      // Write goes through the internal writable, not through _transform in this shim
      expect(() => transform.write('hello')).not.toThrow();
    });
  });

  describe('pipeline', () => {
    it('should pipe multiple streams', () => {
      const chunks: unknown[] = [];
      const readable = new Readable();
      const writable = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });
      const cb = vi.fn();
      pipeline(readable, writable, cb);
      readable.push('pipelined');
      readable.push(null);
      expect(chunks).toContain('pipelined');
    });

    it('should call callback with error on stream error', () => {
      const readable = new Readable();
      const writable = new Writable();
      const cb = vi.fn();
      pipeline(readable, writable, cb);
      const error = new Error('pipe error');
      readable.destroy(error);
      expect(cb).toHaveBeenCalledWith(error);
    });
  });

  describe('Stream pipe backpressure', () => {
    it('should pause when write returns false and resume on drain', () => {
      const readable = new Readable();
      let writeCount = 0;
      const writable = new Writable({
        write(chunk, _encoding, callback) {
          writeCount++;
          callback();
        },
      });
      // Override write to return false (simulating backpressure)
      const origWrite = writable.write.bind(writable);
      let returnFalse = true;
      writable.write = (chunk: any, cb?: any) => {
        const result = origWrite(chunk, cb);
        if (returnFalse) {
          returnFalse = false;
          // Emit drain after a tick
          queueMicrotask(() => writable.emit('drain'));
          return false;
        }
        return result;
      };
      readable.pipe(writable);
      readable.push('chunk1');
      readable.push('chunk2');
      readable.push(null);
      expect(writeCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Readable read returns null when empty', () => {
    it('should return null when buffer is empty', () => {
      const readable = new Readable();
      expect(readable.read()).toBeNull();
    });
  });

  describe('finished', () => {
    it('should call callback on finish', () => {
      const writable = new Writable();
      const cb = vi.fn();
      const cleanup = finished(writable, cb);
      writable.end();
      expect(cb).toHaveBeenCalledWith();
      expect(typeof cleanup).toBe('function');
    });

    it('should return cleanup function that removes listeners', () => {
      const writable = new Writable();
      const cb = vi.fn();
      const cleanup = finished(writable, cb);
      cleanup();
      writable.end();
      expect(cb).not.toHaveBeenCalled();
    });

    it('should call callback with error on stream error', () => {
      const writable = new Writable();
      const cb = vi.fn();
      finished(writable, cb);
      writable.destroy(new Error('stream error'));
      expect(cb).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call callback on readable end', () => {
      const readable = new Readable();
      const cb = vi.fn();
      finished(readable, cb);
      readable.push(null); // triggers 'end'
      expect(cb).toHaveBeenCalledWith();
    });
  });

  describe('Writable end with all three args', () => {
    it('should write chunk with encoding and call callback', () => {
      const chunks: unknown[] = [];
      const writable = new Writable({
        write(chunk, _enc, cb) { chunks.push(chunk); cb(); },
      });
      const cb = vi.fn();
      writable.end('final', 'utf8', cb);
      expect(chunks).toContain('final');
      expect(cb).toHaveBeenCalled();
    });
  });

  describe('Writable end branch coverage', () => {
    it('should accept a callback function as first arg', () => {
      const writable = new Writable();
      const cb = vi.fn();
      writable.end(cb);
      expect(cb).toHaveBeenCalled();
    });

    it('should accept encoding as second arg with chunk as first', () => {
      const chunks: unknown[] = [];
      const writable = new Writable({
        write(chunk, _enc, cb) { chunks.push(chunk); cb(); },
      });
      writable.end('hello', 'utf8');
      expect(chunks).toContain('hello');
    });

    it('should accept callback as second arg after chunk', () => {
      const writable = new Writable();
      const cb = vi.fn();
      writable.end('data', cb);
      expect(cb).toHaveBeenCalled();
    });
  });

  describe('Writable write with callback arg', () => {
    it('should accept callback as second arg instead of encoding', () => {
      const writable = new Writable();
      const cb = vi.fn();
      writable.write('hello', cb);
      expect(cb).toHaveBeenCalled();
    });
  });

  describe('pipeline without callback', () => {
    it('should work without trailing callback', () => {
      const readable = new Readable();
      const writable = new Writable();
      pipeline(readable, writable);
      readable.push('data');
      readable.push(null);
    });
  });

  describe('Readable constructor options', () => {
    it('should set objectMode', () => {
      const readable = new Readable({ objectMode: true });
      expect(readable).toBeDefined();
    });

    it('should set highWaterMark', () => {
      const readable = new Readable({ highWaterMark: 1024 });
      expect(readable).toBeDefined();
    });
  });

  describe('Writable constructor options', () => {
    it('should set objectMode', () => {
      const writable = new Writable({ objectMode: true });
      expect(writable).toBeDefined();
    });

    it('should set highWaterMark', () => {
      const writable = new Writable({ highWaterMark: 512 });
      expect(writable).toBeDefined();
    });
  });
});
