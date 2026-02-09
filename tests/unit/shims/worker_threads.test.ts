import { describe, it, expect, vi } from 'vitest';
import workerThreadsModule from '../../../src/shims/worker_threads.js';

describe('worker_threads shim', () => {
  it('should report isMainThread as true', () => {
    expect(workerThreadsModule.isMainThread).toBe(true);
  });

  it('should have threadId', () => {
    expect(typeof workerThreadsModule.threadId).toBe('number');
  });

  it('should have null workerData', () => {
    expect(workerThreadsModule.workerData).toBeNull();
  });

  it('should have null parentPort', () => {
    expect(workerThreadsModule.parentPort).toBeNull();
  });

  describe('MessageChannel', () => {
    it('should create port pair', () => {
      const channel = new workerThreadsModule.MessageChannel();
      expect(channel.port1).toBeDefined();
      expect(channel.port2).toBeDefined();
    });
  });

  describe('MessagePort', () => {
    it('should support close', () => {
      const channel = new workerThreadsModule.MessageChannel();
      expect(() => channel.port1.close()).not.toThrow();
    });

    it('should support ref/unref', () => {
      const channel = new workerThreadsModule.MessageChannel();
      expect(channel.port1.ref()).toBe(channel.port1);
      expect(channel.port1.unref()).toBe(channel.port1);
    });

    it('should support start', () => {
      const channel = new workerThreadsModule.MessageChannel();
      expect(() => channel.port1.start()).not.toThrow();
    });

    it('should support postMessage', () => {
      const channel = new workerThreadsModule.MessageChannel();
      expect(() => channel.port1.postMessage('test')).not.toThrow();
    });

    it('should emit close event', () => {
      const channel = new workerThreadsModule.MessageChannel();
      const closeFn = vi.fn();
      channel.port1.on('close', closeFn);
      channel.port1.close();
      expect(closeFn).toHaveBeenCalled();
    });
  });

  describe('MessagePort without native port', () => {
    it('should handle postMessage when no native port', () => {
      const port = new workerThreadsModule.MessagePort();
      expect(() => port.postMessage('hello')).not.toThrow();
    });

    it('should handle start when no native port', () => {
      const port = new workerThreadsModule.MessagePort();
      expect(() => port.start()).not.toThrow();
    });

    it('should handle close when no native port', () => {
      const closeFn = vi.fn();
      const port = new workerThreadsModule.MessagePort();
      port.on('close', closeFn);
      port.close();
      expect(closeFn).toHaveBeenCalled();
    });
  });

  describe('Worker', () => {
    it('should create a worker with threadId', () => {
      const worker = new workerThreadsModule.Worker('/worker.js');
      expect(typeof worker.threadId).toBe('number');
      expect(worker.threadId).toBeGreaterThan(0);
    });

    it('should increment threadId for each worker', () => {
      const w1 = new workerThreadsModule.Worker('/w1.js');
      const w2 = new workerThreadsModule.Worker('/w2.js');
      expect(w2.threadId).toBeGreaterThan(w1.threadId);
    });

    it('should support postMessage', () => {
      const worker = new workerThreadsModule.Worker('/worker.js');
      expect(() => worker.postMessage({ data: 'test' })).not.toThrow();
    });

    it('should support postMessage with transferList', () => {
      const worker = new workerThreadsModule.Worker('/worker.js');
      const buffer = new ArrayBuffer(8);
      expect(() => worker.postMessage(buffer, [buffer])).not.toThrow();
    });

    it('should support terminate returning Promise', async () => {
      const worker = new workerThreadsModule.Worker('/worker.js');
      const code = await worker.terminate();
      expect(code).toBe(0);
    });

    it('should emit exit on terminate', async () => {
      const worker = new workerThreadsModule.Worker('/worker.js');
      const exitFn = vi.fn();
      worker.on('exit', exitFn);
      await worker.terminate();
      expect(exitFn).toHaveBeenCalledWith(0);
    });

    it('should support ref/unref', () => {
      const worker = new workerThreadsModule.Worker('/worker.js');
      expect(worker.ref()).toBe(worker);
      expect(worker.unref()).toBe(worker);
    });

    it('should accept URL object as filename', () => {
      const url = new URL('file:///worker.js');
      const worker = new workerThreadsModule.Worker(url);
      expect(typeof worker.threadId).toBe('number');
    });
  });

  describe('MessagePort with transferList', () => {
    it('should support postMessage with transferList', () => {
      const channel = new workerThreadsModule.MessageChannel();
      const buffer = new ArrayBuffer(8);
      expect(() => channel.port1.postMessage(buffer, [buffer])).not.toThrow();
    });
  });

  describe('Worker with successful native Worker', () => {
    it('should forward onmessage events', () => {
      const mockWorkerInstance: any = {
        onmessage: null,
        onerror: null,
        postMessage: vi.fn(),
        terminate: vi.fn(),
      };
      const OriginalWorker = globalThis.Worker;
      globalThis.Worker = vi.fn(() => mockWorkerInstance) as any;
      try {
        const worker = new workerThreadsModule.Worker('/test.js');
        const msgHandler = vi.fn();
        worker.on('message', msgHandler);
        mockWorkerInstance.onmessage({ data: 'hello' });
        expect(msgHandler).toHaveBeenCalledWith('hello');
      } finally {
        globalThis.Worker = OriginalWorker;
      }
    });

    it('should forward onerror events', () => {
      const mockWorkerInstance: any = {
        onmessage: null,
        onerror: null,
        postMessage: vi.fn(),
        terminate: vi.fn(),
      };
      const OriginalWorker = globalThis.Worker;
      globalThis.Worker = vi.fn(() => mockWorkerInstance) as any;
      try {
        const worker = new workerThreadsModule.Worker('/test.js');
        const errHandler = vi.fn();
        worker.on('error', errHandler);
        mockWorkerInstance.onerror({ message: 'test error' });
        expect(errHandler).toHaveBeenCalledWith(expect.any(Error));
      } finally {
        globalThis.Worker = OriginalWorker;
      }
    });

    it('should postMessage through native worker', () => {
      const mockWorkerInstance: any = {
        onmessage: null,
        onerror: null,
        postMessage: vi.fn(),
        terminate: vi.fn(),
      };
      const OriginalWorker = globalThis.Worker;
      globalThis.Worker = vi.fn(() => mockWorkerInstance) as any;
      try {
        const worker = new workerThreadsModule.Worker('/test.js');
        worker.postMessage('data', []);
        expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith('data', []);
      } finally {
        globalThis.Worker = OriginalWorker;
      }
    });

    it('should postMessage without transferList (uses ?? fallback)', () => {
      const mockWorkerInstance: any = {
        onmessage: null,
        onerror: null,
        postMessage: vi.fn(),
        terminate: vi.fn(),
      };
      const OriginalWorker = globalThis.Worker;
      globalThis.Worker = vi.fn(() => mockWorkerInstance) as any;
      try {
        const worker = new workerThreadsModule.Worker('/test.js');
        worker.postMessage('data');
        expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith('data', []);
      } finally {
        globalThis.Worker = OriginalWorker;
      }
    });

    it('should terminate native worker', async () => {
      const mockWorkerInstance: any = {
        onmessage: null,
        onerror: null,
        postMessage: vi.fn(),
        terminate: vi.fn(),
      };
      const OriginalWorker = globalThis.Worker;
      globalThis.Worker = vi.fn(() => mockWorkerInstance) as any;
      try {
        const worker = new workerThreadsModule.Worker('/test.js');
        const code = await worker.terminate();
        expect(code).toBe(0);
        expect(mockWorkerInstance.terminate).toHaveBeenCalled();
      } finally {
        globalThis.Worker = OriginalWorker;
      }
    });
  });
});
