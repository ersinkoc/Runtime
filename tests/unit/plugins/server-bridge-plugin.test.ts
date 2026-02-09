import { describe, it, expect, vi } from 'vitest';
import { serverBridgePlugin } from '../../../src/plugins/server/server-bridge-plugin.js';
import { createKernel } from '../../../src/kernel.js';
import { vfsPlugin } from '../../../src/plugins/core/vfs-plugin.js';
import { createServer } from '../../../src/shims/http.js';

describe('serverBridgePlugin', () => {
  function setup(options?: Parameters<typeof serverBridgePlugin>[0]) {
    const kernel = createKernel();
    kernel.use(vfsPlugin());
    kernel.use(serverBridgePlugin(options));
    return kernel;
  }

  it('should install successfully', () => {
    const kernel = setup();
    expect(kernel.listPlugins()).toContain('server-bridge');
  });

  it('should register and handle requests', async () => {
    const kernel = setup();
    const bridge = (kernel as any)._serverBridge;

    const server = createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('Hello World');
    });

    kernel.emit('__registerServer', 3000, server);

    const response = await bridge.handleRequest(3000, 'GET', '/');
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('Hello World');
  });

  it('should return 502 for unregistered port', async () => {
    const kernel = setup();
    const bridge = (kernel as any)._serverBridge;

    const response = await bridge.handleRequest(9999, 'GET', '/');
    expect(response.statusCode).toBe(502);
  });

  it('should track registered ports', () => {
    const kernel = setup();
    const bridge = (kernel as any)._serverBridge;

    const server = createServer();
    kernel.emit('__registerServer', 3000, server);
    kernel.emit('__registerServer', 8080, server);

    expect(bridge.getRegisteredPorts()).toContain(3000);
    expect(bridge.getRegisteredPorts()).toContain(8080);
  });

  it('should unregister servers', () => {
    const kernel = setup();
    const bridge = (kernel as any)._serverBridge;

    const server = createServer();
    kernel.emit('__registerServer', 3000, server);
    kernel.emit('__unregisterServer', 3000);

    expect(bridge.getRegisteredPorts()).not.toContain(3000);
  });

  it('should have configurable basePath', () => {
    const kernel = setup({ basePath: '/api' });
    const bridge = (kernel as any)._serverBridge;
    expect(bridge.basePath).toBe('/api');
  });

  it('should handle request with body', async () => {
    const kernel = setup();
    const bridge = (kernel as any)._serverBridge;

    const server = createServer((req, res) => {
      const chunks: Uint8Array[] = [];
      req.on('data', (chunk: Uint8Array) => { chunks.push(chunk); });
      req.on('end', () => {
        const body = new TextDecoder().decode(chunks[0]);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(body);
      });
    });

    kernel.emit('__registerServer', 4000, server);

    const response = await bridge.handleRequest(4000, 'POST', '/data', { 'content-type': 'application/json' }, '{"key":"value"}');
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('{"key":"value"}');
  });

  it('should clear servers on destroy', () => {
    const kernel = setup();
    const bridge = (kernel as any)._serverBridge;

    const server = createServer();
    kernel.emit('__registerServer', 5000, server);
    expect(bridge.getRegisteredPorts()).toContain(5000);

    kernel.unregister('server-bridge');
    expect(bridge.getRegisteredPorts()).toHaveLength(0);
  });
});
