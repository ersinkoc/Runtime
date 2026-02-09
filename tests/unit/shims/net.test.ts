import { describe, it, expect, vi } from 'vitest';
import netModule from '../../../src/shims/net.js';

describe('net shim', () => {
  describe('isIP', () => {
    it('should detect IPv4', () => {
      expect(netModule.isIP('127.0.0.1')).toBe(4);
      expect(netModule.isIP('192.168.1.1')).toBe(4);
    });

    it('should detect IPv6', () => {
      expect(netModule.isIP('::1')).toBe(6);
    });

    it('should return 0 for non-IP', () => {
      expect(netModule.isIP('hello')).toBe(0);
      expect(netModule.isIP('')).toBe(0);
    });

    it('should return 0 for out-of-range IPv4 octets', () => {
      expect(netModule.isIP('999.0.0.1')).toBe(0);
      expect(netModule.isIP('0.0.0.256')).toBe(0);
    });
  });

  describe('isIPv4 / isIPv6', () => {
    it('should check IPv4', () => {
      expect(netModule.isIPv4('127.0.0.1')).toBe(true);
      expect(netModule.isIPv4('::1')).toBe(false);
    });

    it('should check IPv6', () => {
      expect(netModule.isIPv6('::1')).toBe(true);
      expect(netModule.isIPv6('127.0.0.1')).toBe(false);
    });
  });

  describe('Socket', () => {
    it('should create socket', () => {
      const socket = new netModule.Socket();
      expect(socket.readyState).toBe('closed');
    });

    it('should connect', async () => {
      const socket = new netModule.Socket();
      const connectFn = vi.fn();
      socket.on('connect', connectFn);
      socket.connect(8080, '127.0.0.1');
      expect(socket.connecting).toBe(true);
      await new Promise((r) => setTimeout(r, 10));
      expect(connectFn).toHaveBeenCalled();
      expect(socket.readyState).toBe('open');
    });

    it('should have address', () => {
      const socket = new netModule.Socket();
      const addr = socket.address();
      expect(addr.family).toBe('IPv4');
    });

    it('should support setKeepAlive/setNoDelay', () => {
      const socket = new netModule.Socket();
      expect(socket.setKeepAlive(true)).toBe(socket);
      expect(socket.setNoDelay(true)).toBe(socket);
    });

    it('should support setTimeout with callback', () => {
      const socket = new netModule.Socket();
      const cb = vi.fn();
      const result = socket.setTimeout(5000, cb);
      expect(result).toBe(socket);
    });

    it('should support setTimeout without callback', () => {
      const socket = new netModule.Socket();
      const result = socket.setTimeout(1000);
      expect(result).toBe(socket);
    });
  });

  describe('Server', () => {
    it('should create server', () => {
      const server = netModule.createServer();
      expect(server.listening).toBe(false);
    });

    it('should listen', async () => {
      const server = netModule.createServer();
      server.listen(9000);
      await new Promise((r) => setTimeout(r, 10));
      expect(server.listening).toBe(true);
      expect(server.address()?.port).toBe(9000);
      server.close();
    });

    it('should close', async () => {
      const server = netModule.createServer();
      server.listen(9000);
      await new Promise((r) => setTimeout(r, 10));
      const closeFn = vi.fn();
      server.close(closeFn);
      await new Promise((r) => setTimeout(r, 10));
      expect(server.listening).toBe(false);
      expect(closeFn).toHaveBeenCalled();
    });
  });

  describe('createConnection', () => {
    it('should create and connect socket', async () => {
      const socket = netModule.createConnection(8080, '127.0.0.1');
      expect(socket.connecting).toBe(true);
      await new Promise((r) => setTimeout(r, 10));
      expect(socket.remotePort).toBe(8080);
    });
  });

  describe('createServer with listener', () => {
    it('should register connection listener', () => {
      const listener = vi.fn();
      const server = netModule.createServer(listener);
      expect(server.listening).toBe(false);
      server.emit('connection', new netModule.Socket());
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('Socket branch coverage', () => {
    it('should connect without host (defaults to 127.0.0.1)', async () => {
      const socket = new netModule.Socket();
      socket.connect(3000);
      expect(socket.remoteAddress).toBe('127.0.0.1');
      await new Promise((r) => setTimeout(r, 10));
    });

    it('should connect without callback', async () => {
      const socket = new netModule.Socket();
      socket.connect(3000, '10.0.0.1');
      await new Promise((r) => setTimeout(r, 10));
      expect(socket.remoteAddress).toBe('10.0.0.1');
    });

    it('should show opening readyState while connecting', () => {
      const socket = new netModule.Socket();
      expect(socket.readyState).toBe('closed');
      socket.connect(3000);
      expect(socket.readyState).toBe('opening');
    });

    it('should show open readyState after connected', async () => {
      const socket = new netModule.Socket();
      socket.connect(3000);
      await new Promise((r) => setTimeout(r, 10));
      expect(socket.readyState).toBe('open');
    });
  });

  describe('Server listen branch coverage', () => {
    it('should listen with callback as second arg', async () => {
      const server = netModule.createServer();
      const cb = vi.fn();
      server.listen(5000, cb);
      await new Promise((r) => setTimeout(r, 10));
      expect(cb).toHaveBeenCalled();
      server.close();
    });

    it('should listen without callback', async () => {
      const server = netModule.createServer();
      server.listen(5001, '0.0.0.0');
      await new Promise((r) => setTimeout(r, 10));
      expect(server.listening).toBe(true);
      server.close();
    });

    it('should close without callback', async () => {
      const server = netModule.createServer();
      server.listen(5002);
      await new Promise((r) => setTimeout(r, 10));
      server.close();
      await new Promise((r) => setTimeout(r, 10));
      expect(server.listening).toBe(false);
    });

    it('should listen without any args (defaults port to 0)', async () => {
      const server = netModule.createServer();
      server.listen();
      await new Promise((r) => setTimeout(r, 10));
      expect(server.listening).toBe(true);
      expect(server.address()?.port).toBe(0);
      server.close();
    });

    it('should listen with host and callback as third arg', async () => {
      const server = netModule.createServer();
      const cb = vi.fn();
      server.listen(6000, '0.0.0.0', cb);
      await new Promise((r) => setTimeout(r, 10));
      expect(cb).toHaveBeenCalled();
      server.close();
    });
  });

  describe('Socket connect with callback', () => {
    it('should call callback on connect', async () => {
      const cb = vi.fn();
      const socket = new netModule.Socket();
      socket.connect(4000, '127.0.0.1', cb);
      await new Promise((r) => setTimeout(r, 10));
      expect(cb).toHaveBeenCalled();
    });
  });
});
