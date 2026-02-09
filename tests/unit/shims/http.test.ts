import { describe, it, expect, vi } from 'vitest';
import httpModule from '../../../src/shims/http.js';

describe('http shim', () => {
  describe('STATUS_CODES', () => {
    it('should have common status codes', () => {
      expect(httpModule.STATUS_CODES[200]).toBe('OK');
      expect(httpModule.STATUS_CODES[404]).toBe('Not Found');
      expect(httpModule.STATUS_CODES[500]).toBe('Internal Server Error');
    });
  });

  describe('METHODS', () => {
    it('should have common methods', () => {
      expect(httpModule.METHODS).toContain('GET');
      expect(httpModule.METHODS).toContain('POST');
      expect(httpModule.METHODS).toContain('PUT');
      expect(httpModule.METHODS).toContain('DELETE');
    });
  });

  describe('Server', () => {
    it('should create server', () => {
      const server = httpModule.createServer();
      expect(server).toBeDefined();
      expect(server.listening).toBe(false);
    });

    it('should listen', async () => {
      const server = httpModule.createServer();
      const listening = vi.fn();
      server.on('listening', listening);
      server.listen(3000);
      await new Promise((r) => setTimeout(r, 10));
      expect(server.listening).toBe(true);
      expect(listening).toHaveBeenCalled();
      expect(server.address()?.port).toBe(3000);
      server.close();
    });

    it('should close', async () => {
      const server = httpModule.createServer();
      const closeFn = vi.fn();
      server.listen(3000);
      await new Promise((r) => setTimeout(r, 10));
      server.close(closeFn);
      await new Promise((r) => setTimeout(r, 10));
      expect(server.listening).toBe(false);
      expect(closeFn).toHaveBeenCalled();
    });

    it('should handle requests internally', () => {
      const handler = vi.fn();
      const server = httpModule.createServer(handler);
      const req = new httpModule.IncomingMessage();
      const res = new httpModule.ServerResponse();
      server._handleRequest(req, res);
      expect(handler).toHaveBeenCalledWith(req, res);
    });
  });

  describe('IncomingMessage', () => {
    it('should have default properties', () => {
      const msg = new httpModule.IncomingMessage();
      expect(msg.method).toBe('GET');
      expect(msg.url).toBe('/');
      expect(msg.statusCode).toBe(200);
      expect(msg.httpVersion).toBe('1.1');
    });
  });

  describe('ServerResponse', () => {
    it('should set headers', () => {
      const res = new httpModule.ServerResponse();
      res.setHeader('Content-Type', 'text/plain');
      expect(res.getHeader('content-type')).toBe('text/plain');
    });

    it('should remove headers', () => {
      const res = new httpModule.ServerResponse();
      res.setHeader('X-Custom', 'value');
      res.removeHeader('X-Custom');
      expect(res.getHeader('x-custom')).toBeUndefined();
    });

    it('should writeHead', () => {
      const res = new httpModule.ServerResponse();
      res.writeHead(404, { 'Content-Type': 'text/html' });
      expect(res.statusCode).toBe(404);
      expect(res.headersSent).toBe(true);
    });

    it('should write and end', () => {
      const res = new httpModule.ServerResponse();
      const finishFn = vi.fn();
      res.on('finish', finishFn);
      res.write('hello');
      res.end(' world');
      const response = res._getResponse();
      expect(response.body).toBe('hello world');
      expect(finishFn).toHaveBeenCalled();
    });
  });

  describe('ServerResponse writeHead variants', () => {
    it('should accept statusMessage string', () => {
      const res = new httpModule.ServerResponse();
      res.writeHead(200, 'Custom OK');
      expect(res.statusCode).toBe(200);
      expect(res.statusMessage).toBe('Custom OK');
      expect(res.headersSent).toBe(true);
    });

    it('should accept headers as second arg (no statusMessage)', () => {
      const res = new httpModule.ServerResponse();
      res.writeHead(201, { 'X-Custom': 'val' });
      expect(res.statusCode).toBe(201);
      expect(res.getHeader('x-custom')).toBe('val');
    });

    it('should accept statusMessage and headers', () => {
      const res = new httpModule.ServerResponse();
      res.writeHead(404, 'Not Found', { 'Content-Type': 'text/plain' });
      expect(res.statusCode).toBe(404);
      expect(res.statusMessage).toBe('Not Found');
      expect(res.getHeader('content-type')).toBe('text/plain');
    });

    it('should write Uint8Array body', () => {
      const res = new httpModule.ServerResponse();
      res.write(new TextEncoder().encode('binary'));
      res.end();
      expect(res._getResponse().body).toBe('binary');
    });
  });

  describe('IncomingMessage body', () => {
    it('should emit body data via _emitBody', async () => {
      const msg = new httpModule.IncomingMessage();
      msg._setBody(new TextEncoder().encode('test body'));
      const chunks: unknown[] = [];
      msg.on('data', (c: unknown) => chunks.push(c));
      await new Promise<void>((resolve) => {
        msg.on('end', () => resolve());
        msg._emitBody();
      });
      expect(chunks.length).toBe(1);
    });

    it('should emit end without body when null', async () => {
      const msg = new httpModule.IncomingMessage();
      msg._setBody(null);
      const endFn = vi.fn();
      msg.on('end', endFn);
      msg._emitBody();
      await new Promise((r) => setTimeout(r, 10));
      expect(endFn).toHaveBeenCalled();
    });
  });

  describe('ClientRequest', () => {
    it('should parse string URL', () => {
      const req = new httpModule.ClientRequest('https://example.com/path');
      expect(req).toBeDefined();
    });

    it('should set headers', () => {
      const req = new httpModule.ClientRequest({ hostname: 'example.com' });
      req.setHeader('X-Custom', 'value');
    });

    it('should write body data', () => {
      const req = new httpModule.ClientRequest({ hostname: 'example.com', method: 'POST' });
      expect(() => req.write('body data')).not.toThrow();
    });

    it('should support abort', () => {
      const req = new httpModule.ClientRequest({ hostname: 'example.com' });
      const abortFn = vi.fn();
      req.on('abort', abortFn);
      req.abort();
      expect(abortFn).toHaveBeenCalled();
    });

    it('should support setTimeout', () => {
      const req = new httpModule.ClientRequest({ hostname: 'example.com' });
      const timeoutFn = vi.fn();
      const result = req.setTimeout(5000, timeoutFn);
      expect(result).toBe(req);
    });
  });

  describe('request and get functions', () => {
    it('should create request with options', () => {
      const req = httpModule.request({ hostname: 'example.com', path: '/api' });
      expect(req).toBeInstanceOf(httpModule.ClientRequest);
    });

    it('should create request with callback', () => {
      const cb = vi.fn();
      const req = httpModule.request({ hostname: 'example.com' }, cb);
      expect(req).toBeInstanceOf(httpModule.ClientRequest);
    });

    it('should create get request', () => {
      const req = httpModule.get({ hostname: 'example.com', path: '/' });
      expect(req).toBeInstanceOf(httpModule.ClientRequest);
    });

    it('should accept string URL in get', () => {
      const req = httpModule.get('https://example.com/test');
      expect(req).toBeInstanceOf(httpModule.ClientRequest);
    });
  });

  describe('ClientRequest fetch integration', () => {
    it('should call fetch on end and emit response', async () => {
      const responseHeaders = new Headers({ 'content-type': 'text/plain' });
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: responseHeaders,
        arrayBuffer: () => Promise.resolve(new TextEncoder().encode('response body').buffer),
      };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse as any);

      const req = new httpModule.ClientRequest({ hostname: 'example.com', method: 'POST', path: '/api' });
      const responseFn = vi.fn();
      req.on('response', responseFn);
      req.write('post body');
      req.end();

      await new Promise((r) => setTimeout(r, 50));
      expect(fetchSpy).toHaveBeenCalled();
      const [url, opts] = fetchSpy.mock.calls[0]!;
      expect(url).toContain('example.com');
      expect((opts as RequestInit).body).toBe('post body');
      expect(responseFn).toHaveBeenCalled();
      const res = responseFn.mock.calls[0]![0];
      expect(res.statusCode).toBe(200);
      fetchSpy.mockRestore();
    });

    it('should emit error when fetch fails', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network error'));

      const req = new httpModule.ClientRequest({ hostname: 'example.com', path: '/test' });
      const errorFn = vi.fn();
      req.on('error', errorFn);
      req.end();

      await new Promise((r) => setTimeout(r, 50));
      expect(errorFn).toHaveBeenCalled();
      expect(errorFn.mock.calls[0]![0].message).toBe('network error');
      fetchSpy.mockRestore();
    });

    it('should not include body for GET requests', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      } as any);

      const req = new httpModule.ClientRequest({ hostname: 'example.com', method: 'GET' });
      req.write('ignored body');
      req.end();

      await new Promise((r) => setTimeout(r, 50));
      const opts = fetchSpy.mock.calls[0]![1] as RequestInit;
      expect(opts.body).toBeUndefined();
      fetchSpy.mockRestore();
    });
  });

  describe('Server listen variants', () => {
    it('should listen with callback as second arg', async () => {
      const server = httpModule.createServer();
      const cb = vi.fn();
      server.listen(8080, cb);
      await new Promise((r) => setTimeout(r, 10));
      expect(cb).toHaveBeenCalled();
      expect(server.address()?.port).toBe(8080);
      server.close();
    });

    it('should return null address when not listening', () => {
      const server = httpModule.createServer();
      expect(server.address()).toBeNull();
    });
  });

  describe('ClientRequest branch coverage', () => {
    it('should parse URL string with port', () => {
      const req = new httpModule.ClientRequest('http://localhost:9090/api');
      // Should not throw; internals parse the URL
      expect(req).toBeDefined();
    });

    it('should send body with end(data) for POST', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      } as any);

      const req = new httpModule.ClientRequest({ hostname: 'example.com', method: 'POST' });
      req.end('body-data');
      await new Promise((r) => setTimeout(r, 50));

      const opts = fetchSpy.mock.calls[0]![1] as RequestInit;
      expect(opts.body).toBe('body-data');
      fetchSpy.mockRestore();
    });

    it('should use host when hostname is not set', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      } as any);

      const req = new httpModule.ClientRequest({ host: 'myhost.com', path: '/test' });
      req.end();
      await new Promise((r) => setTimeout(r, 50));

      const url = fetchSpy.mock.calls[0]![0] as string;
      expect(url).toContain('myhost.com');
      fetchSpy.mockRestore();
    });

    it('should include port in URL when specified', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      } as any);

      const req = new httpModule.ClientRequest({ hostname: 'example.com', port: 8080 });
      req.end();
      await new Promise((r) => setTimeout(r, 50));

      const url = fetchSpy.mock.calls[0]![0] as string;
      expect(url).toContain(':8080');
      fetchSpy.mockRestore();
    });

    it('should default to localhost when no hostname or host', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      } as any);

      const req = new httpModule.ClientRequest({ method: 'GET', path: '/test' });
      req.end();
      await new Promise((r) => setTimeout(r, 50));

      const url = fetchSpy.mock.calls[0]![0] as string;
      expect(url).toContain('localhost');
      fetchSpy.mockRestore();
    });
  });

  describe('Server listen with hostname and callback', () => {
    it('should listen with hostname and third arg callback', async () => {
      const server = httpModule.createServer();
      const cb = vi.fn();
      server.listen(7000, '0.0.0.0', cb);
      await new Promise((r) => setTimeout(r, 10));
      expect(cb).toHaveBeenCalled();
      server.close();
    });

    it('should default to port 3000 when no port specified', async () => {
      const server = httpModule.createServer();
      server.listen();
      await new Promise((r) => setTimeout(r, 10));
      expect(server.address()?.port).toBe(3000);
      server.close();
    });
  });

  describe('ClientRequest setTimeout without callback', () => {
    it('should return this without registering listener', () => {
      const req = new httpModule.ClientRequest({ hostname: 'example.com' });
      const result = req.setTimeout(5000);
      expect(result).toBe(req);
    });
  });

  describe('Server close without callback', () => {
    it('should close without callback', async () => {
      const server = httpModule.createServer();
      server.listen(4000);
      await new Promise((r) => setTimeout(r, 10));
      server.close();
      await new Promise((r) => setTimeout(r, 10));
      expect(server.listening).toBe(false);
    });
  });

  describe('get with response callback', () => {
    it('should register response callback via get', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      } as any);

      const cb = vi.fn();
      httpModule.get({ hostname: 'example.com', path: '/' }, cb);
      await new Promise((r) => setTimeout(r, 50));
      expect(cb).toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });

  describe('ServerResponse end without data', () => {
    it('should end without data', () => {
      const res = new httpModule.ServerResponse();
      const finishFn = vi.fn();
      res.on('finish', finishFn);
      res.end();
      expect(finishFn).toHaveBeenCalled();
      expect(res._getResponse().body).toBe('');
    });
  });

  describe('ClientRequest end without data', () => {
    it('should not include body when end called without data', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      } as any);

      const req = new httpModule.ClientRequest({ hostname: 'example.com', method: 'POST' });
      req.end();
      await new Promise((r) => setTimeout(r, 50));
      const opts = fetchSpy.mock.calls[0]![1] as RequestInit;
      expect(opts.body).toBeUndefined();
      fetchSpy.mockRestore();
    });
  });
});
