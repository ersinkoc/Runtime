/**
 * Node.js `worker_threads` module shim — wraps Web Workers.
 * @module shims/worker_threads
 */

import { EventEmitter } from './events.js';

export const isMainThread = true;
export let threadId = 0;
export let workerData: unknown = null;

export class MessageChannel {
  readonly port1: MessagePort;
  readonly port2: MessagePort;

  constructor() {
    const channel = new globalThis.MessageChannel();
    this.port1 = new MessagePort(channel.port1);
    this.port2 = new MessagePort(channel.port2);
  }
}

export class MessagePort extends EventEmitter {
  private _port: globalThis.MessagePort | null;

  constructor(port?: globalThis.MessagePort) {
    super();
    this._port = port ?? null;
    if (this._port) {
      this._port.onmessage = (event: globalThis.MessageEvent) => {
        this.emit('message', event.data);
      };
    }
  }

  postMessage(value: unknown, transferList?: Transferable[]): void {
    if (this._port) {
      this._port.postMessage(value, transferList ?? []);
    }
  }

  close(): void {
    this._port?.close();
    this.emit('close');
  }

  start(): void {
    this._port?.start();
  }

  ref(): this { return this; }
  unref(): this { return this; }
}

export let parentPort: MessagePort | null = null;

export class Worker extends EventEmitter {
  readonly threadId: number;
  private _worker: globalThis.Worker | null = null;

  constructor(filename: string | URL, options?: { workerData?: unknown }) {
    super();
    this.threadId = ++threadId;

    // In browser, we'd need to create a Blob URL or use a Worker-compatible URL
    try {
      const url = typeof filename === 'string' ? filename : filename.href;
      this._worker = new globalThis.Worker(url, { type: 'module' });

      this._worker.onmessage = (event: globalThis.MessageEvent) => {
        this.emit('message', event.data);
      };

      this._worker.onerror = (event: ErrorEvent) => {
        this.emit('error', new Error(event.message));
      };
    } catch {
      // Worker creation may fail in some environments
      queueMicrotask(() => {
        this.emit('error', new Error(`Cannot create Worker for: ${filename}`));
      });
    }
  }

  postMessage(value: unknown, transferList?: Transferable[]): void {
    this._worker?.postMessage(value, transferList ?? []);
  }

  terminate(): Promise<number> {
    this._worker?.terminate();
    this.emit('exit', 0);
    return Promise.resolve(0);
  }

  ref(): this { return this; }
  unref(): this { return this; }
}

const workerThreadsModule = {
  isMainThread, threadId, workerData, parentPort,
  Worker, MessageChannel, MessagePort,
};

export default workerThreadsModule;
