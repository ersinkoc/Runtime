/**
 * Node.js `child_process` module shim — Worker-based simulation.
 * @module shims/child_process
 */

import { EventEmitter } from './events.js';

export class ChildProcess extends EventEmitter {
  pid = Math.floor(Math.random() * 10000) + 1000;
  exitCode: number | null = null;
  signalCode: string | null = null;
  killed = false;
  connected = true;

  readonly stdin = {
    write: (_data: string) => true,
    end: () => {},
  };
  readonly stdout = new EventEmitter();
  readonly stderr = new EventEmitter();

  kill(_signal?: string): boolean {
    this.killed = true;
    this.connected = false;
    queueMicrotask(() => {
      this.exitCode = 1;
      this.emit('exit', 1, null);
      this.emit('close', 1, null);
    });
    return true;
  }

  disconnect(): void {
    this.connected = false;
    this.emit('disconnect');
  }

  send(message: unknown, _callback?: (err: Error | null) => void): boolean {
    // In browser, we can't actually send to a child process
    return false;
  }
}

export function exec(
  command: string,
  optionsOrCallback?: Record<string, unknown> | ((err: Error | null, stdout: string, stderr: string) => void),
  callback?: (err: Error | null, stdout: string, stderr: string) => void,
): ChildProcess {
  const cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
  const child = new ChildProcess();

  queueMicrotask(() => {
    // Simple command parsing for basic commands
    const err = new Error(`child_process.exec is not fully supported in browser runtime. Command: ${command}`);
    child.exitCode = 1;
    cb?.(err, '', err.message);
    child.emit('exit', 1, null);
    child.emit('close', 1, null);
  });

  return child;
}

export function execSync(_command: string): never {
  throw new Error('child_process.execSync is not supported in browser runtime');
}

export function spawn(command: string, args?: string[]): ChildProcess {
  const child = new ChildProcess();

  queueMicrotask(() => {
    child.stderr.emit('data', `spawn is not fully supported in browser runtime. Command: ${command} ${(args || []).join(' ')}`);
    child.exitCode = 1;
    child.emit('exit', 1, null);
    child.emit('close', 1, null);
  });

  return child;
}

export function fork(_modulePath: string): ChildProcess {
  const child = new ChildProcess();

  queueMicrotask(() => {
    child.exitCode = 1;
    child.emit('error', new Error('child_process.fork is not fully supported in browser runtime'));
    child.emit('exit', 1, null);
  });

  return child;
}

export function execFile(
  file: string,
  argsOrCallback?: string[] | ((err: Error | null, stdout: string, stderr: string) => void),
  optionsOrCallback?: Record<string, unknown> | ((err: Error | null, stdout: string, stderr: string) => void),
  callback?: (err: Error | null, stdout: string, stderr: string) => void,
): ChildProcess {
  const cb = typeof argsOrCallback === 'function' ? argsOrCallback
    : typeof optionsOrCallback === 'function' ? optionsOrCallback
    : callback;
  return exec(file, cb);
}

const childProcessModule = {
  ChildProcess, exec, execSync, spawn, fork, execFile,
};

export default childProcessModule;
