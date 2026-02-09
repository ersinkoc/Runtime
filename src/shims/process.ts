/**
 * Node.js `process` module shim.
 * @module shims/process
 */

import { EventEmitter } from './events.js';

class Process extends EventEmitter {
  readonly platform = 'browser';
  readonly arch = 'wasm';
  readonly version = 'v20.0.0';
  readonly versions: Record<string, string> = {
    node: '20.0.0',
    v8: '0.0.0',
    modules: '0',
  };
  readonly pid = 1;
  readonly ppid = 0;
  title = '@oxog/runtime';
  argv: string[] = ['/usr/local/bin/node', '/app/index.js'];
  argv0 = 'node';
  execArgv: string[] = [];
  execPath = '/usr/local/bin/node';

  private _cwd = '/';
  private _env: Record<string, string> = {};
  private _startTime = Date.now();

  readonly stdout = {
    write: (data: string): boolean => { console.log(data); return true; },
    isTTY: false,
    columns: 80,
    rows: 24,
  };

  readonly stderr = {
    write: (data: string): boolean => { console.error(data); return true; },
    isTTY: false,
    columns: 80,
    rows: 24,
  };

  readonly stdin = {
    isTTY: false,
    read: () => null,
    on: () => {},
    resume: () => {},
    pause: () => {},
  };

  get env(): Record<string, string> {
    return this._env;
  }

  set env(value: Record<string, string>) {
    this._env = value;
  }

  cwd(): string {
    return this._cwd;
  }

  chdir(directory: string): void {
    this._cwd = directory;
  }

  exit(code?: number): never {
    this.emit('exit', code ?? 0);
    throw new Error(`process.exit(${code ?? 0})`);
  }

  abort(): never {
    throw new Error('process.abort()');
  }

  nextTick(callback: (...args: any[]) => void, ...args: any[]): void {
    queueMicrotask(() => callback(...args));
  }

  hrtime(time?: [number, number]): [number, number] {
    const now = performance.now();
    const seconds = Math.floor(now / 1000);
    const nanoseconds = Math.floor((now % 1000) * 1e6);

    if (time) {
      let diffSeconds = seconds - time[0];
      let diffNano = nanoseconds - time[1];
      if (diffNano < 0) {
        diffSeconds--;
        diffNano += 1e9;
      }
      return [diffSeconds, diffNano];
    }

    return [seconds, nanoseconds];
  }

  memoryUsage(): { rss: number; heapTotal: number; heapUsed: number; external: number; arrayBuffers: number } {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const mem = (performance as any).memory;
      return {
        rss: mem.totalJSHeapSize ?? 0,
        heapTotal: mem.totalJSHeapSize ?? 0,
        heapUsed: mem.usedJSHeapSize ?? 0,
        external: 0,
        arrayBuffers: 0,
      };
    }
    return { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 };
  }

  uptime(): number {
    return (Date.now() - this._startTime) / 1000;
  }

  emitWarning(warning: string | Error, name?: string): void {
    const msg = typeof warning === 'string' ? warning : warning.message;
    console.warn(`${name ?? 'Warning'}: ${msg}`);
    this.emit('warning', typeof warning === 'string' ? new Error(warning) : warning);
  }

  /** @internal — used by kernel to set cwd/env */
  _configure(cwd: string, env: Record<string, string>): void {
    this._cwd = cwd;
    this._env = env;
  }
}

const processShim = new Process();
export { processShim as process };
export default processShim;
