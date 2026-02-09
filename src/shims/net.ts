/**
 * Node.js `net` module shim — virtual sockets for same-runtime connections.
 * @module shims/net
 */

import { EventEmitter } from './events.js';
import { Duplex } from './stream.js';

export function isIP(input: string): 0 | 4 | 6 {
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(input)) {
    const parts = input.split('.').map(Number);
    if (parts.every((p) => p >= 0 && p <= 255)) return 4;
  }
  if (/^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(input) || input === '::1' || input === '::') return 6;
  return 0;
}

export function isIPv4(input: string): boolean {
  return isIP(input) === 4;
}

export function isIPv6(input: string): boolean {
  return isIP(input) === 6;
}

export class Socket extends Duplex {
  remoteAddress?: string;
  remotePort?: number;
  localAddress = '127.0.0.1';
  localPort = 0;
  connecting = false;
  private _connected = false;

  constructor() {
    super();
  }

  connect(port: number, host?: string, callback?: () => void): this {
    this.connecting = true;
    this.remoteAddress = host || '127.0.0.1';
    this.remotePort = port;

    queueMicrotask(() => {
      this.connecting = false;
      this._connected = true;
      this.emit('connect');
      callback?.();
    });

    return this;
  }

  setKeepAlive(_enable?: boolean, _delay?: number): this {
    return this;
  }

  setNoDelay(_noDelay?: boolean): this {
    return this;
  }

  setTimeout(timeout: number, callback?: () => void): this {
    if (callback) this.on('timeout', callback);
    return this;
  }

  address(): { port: number; family: string; address: string } {
    return { port: this.localPort, family: 'IPv4', address: this.localAddress };
  }

  get readyState(): string {
    if (this.connecting) return 'opening';
    if (this._connected) return 'open';
    return 'closed';
  }
}

export class Server extends EventEmitter {
  private _listening = false;
  private _address: { port: number; address: string; family: string } | null = null;

  listen(port?: number, hostOrCallback?: string | (() => void), callback?: () => void): this {
    const cb = typeof hostOrCallback === 'function' ? hostOrCallback : callback;
    this._listening = true;
    this._address = { port: port ?? 0, address: '127.0.0.1', family: 'IPv4' };

    queueMicrotask(() => {
      this.emit('listening');
      cb?.();
    });

    return this;
  }

  close(callback?: (err?: Error) => void): this {
    this._listening = false;
    this._address = null;
    queueMicrotask(() => {
      this.emit('close');
      callback?.();
    });
    return this;
  }

  address(): { port: number; address: string; family: string } | null {
    return this._address;
  }

  get listening(): boolean {
    return this._listening;
  }
}

export function createServer(connectionListener?: (socket: Socket) => void): Server {
  const server = new Server();
  if (connectionListener) {
    server.on('connection', connectionListener);
  }
  return server;
}

export function createConnection(port: number, host?: string, callback?: () => void): Socket {
  const socket = new Socket();
  socket.connect(port, host, callback);
  return socket;
}

export const connect = createConnection;

const netModule = {
  isIP, isIPv4, isIPv6,
  Socket, Server,
  createServer, createConnection, connect,
};

export default netModule;
