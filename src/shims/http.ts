/**
 * Node.js `http`/`https` module shim — wraps fetch() + virtual server.
 * @module shims/http
 */

import { EventEmitter } from './events.js';

export const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
export const STATUS_CODES: Record<number, string> = {
  200: 'OK', 201: 'Created', 204: 'No Content',
  301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
  404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict',
  500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable',
};

export class IncomingMessage extends EventEmitter {
  headers: Record<string, string> = {};
  method = 'GET';
  url = '/';
  statusCode = 200;
  statusMessage = 'OK';
  httpVersion = '1.1';
  private _body: Uint8Array | null = null;

  /** @internal */
  _setBody(body: Uint8Array | null): void {
    this._body = body;
  }

  /** @internal */
  _emitBody(): void {
    if (this._body) {
      queueMicrotask(() => {
        this.emit('data', this._body);
        this.emit('end');
      });
    } else {
      queueMicrotask(() => this.emit('end'));
    }
  }
}

export class ServerResponse extends EventEmitter {
  statusCode = 200;
  statusMessage = 'OK';
  private _headers: Record<string, string> = {};
  private _body: string[] = [];
  headersSent = false;

  setHeader(name: string, value: string): this {
    this._headers[name.toLowerCase()] = value;
    return this;
  }

  getHeader(name: string): string | undefined {
    return this._headers[name.toLowerCase()];
  }

  removeHeader(name: string): void {
    delete this._headers[name.toLowerCase()];
  }

  writeHead(statusCode: number, statusMessage?: string | Record<string, string>, headers?: Record<string, string>): this {
    this.statusCode = statusCode;
    if (typeof statusMessage === 'string') {
      this.statusMessage = statusMessage;
    } else if (typeof statusMessage === 'object') {
      headers = statusMessage;
    }
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        this._headers[key.toLowerCase()] = value;
      }
    }
    this.headersSent = true;
    return this;
  }

  write(chunk: string | Uint8Array): boolean {
    this._body.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk));
    return true;
  }

  end(data?: string | Uint8Array): void {
    if (data) this.write(data);
    this.headersSent = true;
    this.emit('finish');
  }

  /** @internal */
  _getResponse(): { statusCode: number; headers: Record<string, string>; body: string } {
    return {
      statusCode: this.statusCode,
      headers: { ...this._headers },
      body: this._body.join(''),
    };
  }
}

export class Server extends EventEmitter {
  private _listening = false;
  private _address: { port: number; address: string } | null = null;

  listen(port?: number, hostnameOrCallback?: string | (() => void), callback?: () => void): this {
    const cb = typeof hostnameOrCallback === 'function' ? hostnameOrCallback : callback;
    this._listening = true;
    this._address = { port: port ?? 3000, address: '127.0.0.1' };
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

  address(): { port: number; address: string } | null {
    return this._address;
  }

  get listening(): boolean {
    return this._listening;
  }

  /** @internal — used by ServerBridge */
  _handleRequest(req: IncomingMessage, res: ServerResponse): void {
    this.emit('request', req, res);
  }
}

export function createServer(requestListener?: (req: IncomingMessage, res: ServerResponse) => void): Server {
  const server = new Server();
  if (requestListener) {
    server.on('request', requestListener);
  }
  return server;
}

// Client-side — fetch wrapper
export interface RequestOptions {
  hostname?: string;
  host?: string;
  port?: number;
  path?: string;
  method?: string;
  headers?: Record<string, string>;
  protocol?: string;
}

export class ClientRequest extends EventEmitter {
  private _options: RequestOptions;
  private _body: string[] = [];

  constructor(options: RequestOptions | string) {
    super();
    if (typeof options === 'string') {
      const url = new URL(options);
      this._options = {
        hostname: url.hostname,
        port: url.port ? parseInt(url.port) : undefined,
        path: url.pathname + url.search,
        method: 'GET',
        protocol: url.protocol,
      };
    } else {
      this._options = options;
    }
  }

  write(data: string): void {
    this._body.push(data);
  }

  end(data?: string): void {
    if (data) this._body.push(data);

    const proto = this._options.protocol || 'http:';
    const host = this._options.hostname || this._options.host || 'localhost';
    const port = this._options.port ? `:${this._options.port}` : '';
    const path = this._options.path || '/';
    const url = `${proto}//${host}${port}${path}`;

    const fetchOptions: RequestInit = {
      method: this._options.method || 'GET',
      headers: this._options.headers,
    };
    if (this._body.length > 0 && fetchOptions.method !== 'GET' && fetchOptions.method !== 'HEAD') {
      fetchOptions.body = this._body.join('');
    }

    fetch(url, fetchOptions)
      .then(async (response) => {
        const res = new IncomingMessage();
        res.statusCode = response.status;
        res.statusMessage = response.statusText;
        response.headers.forEach((value, key) => {
          res.headers[key] = value;
        });

        const body = await response.arrayBuffer();
        res._setBody(new Uint8Array(body));
        this.emit('response', res);
        res._emitBody();
      })
      .catch((err) => {
        this.emit('error', err);
      });
  }

  setHeader(name: string, value: string): void {
    if (!this._options.headers) this._options.headers = {};
    this._options.headers[name] = value;
  }

  abort(): void {
    this.emit('abort');
  }

  setTimeout(timeout: number, callback?: () => void): this {
    if (callback) this.on('timeout', callback);
    return this;
  }
}

export function request(optionsOrUrl: RequestOptions | string, callback?: (res: IncomingMessage) => void): ClientRequest {
  const req = new ClientRequest(optionsOrUrl);
  if (callback) {
    req.on('response', callback);
  }
  return req;
}

export function get(optionsOrUrl: RequestOptions | string, callback?: (res: IncomingMessage) => void): ClientRequest {
  const opts = typeof optionsOrUrl === 'string' ? optionsOrUrl : { ...optionsOrUrl, method: 'GET' };
  const req = request(opts, callback);
  req.end();
  return req;
}

const httpModule = {
  METHODS, STATUS_CODES,
  IncomingMessage, ServerResponse, Server, ClientRequest,
  createServer, request, get,
};

export default httpModule;
