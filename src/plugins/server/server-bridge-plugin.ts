/**
 * Server Bridge Plugin — virtual HTTP server via in-process routing.
 * Connects http.createServer() to fetch-like request handling.
 * @module plugins/server/server-bridge-plugin
 */

import type { RuntimePlugin, RuntimeKernel } from '../../types.js';
import { IncomingMessage, ServerResponse, Server } from '../../shims/http.js';

export interface ServerBridgeOptions {
  /** Base path prefix for virtual server URLs */
  basePath?: string;
}

interface VirtualServer {
  port: number;
  server: Server;
}

/**
 * Create a virtual HTTP server bridge for in-process request handling.
 *
 * @example
 * ```typescript
 * const runtime = createRuntime({
 *   plugins: [vfsPlugin(), shimsPlugin(), serverBridgePlugin()],
 * });
 * ```
 */
export function serverBridgePlugin(options?: ServerBridgeOptions): RuntimePlugin {
  const servers = new Map<number, VirtualServer>();
  const basePath = options?.basePath ?? '/__virtual__';

  return {
    name: 'server-bridge',
    version: '1.0.0',

    install(kernel: RuntimeKernel): void {
      // Register server when http.Server.listen is called
      kernel.on('__registerServer', (...args: unknown[]) => {
        const port = args[0] as number;
        const server = args[1] as Server;
        servers.set(port, { port, server });
      });

      kernel.on('__unregisterServer', (...args: unknown[]) => {
        const port = args[0] as number;
        servers.delete(port);
      });

      // Expose route handler
      const bridge = {
        async handleRequest(port: number, method: string, path: string, headers: Record<string, string> = {}, body?: string): Promise<{
          statusCode: number;
          headers: Record<string, string>;
          body: string;
        }> {
          const entry = servers.get(port);
          if (!entry) {
            return { statusCode: 502, headers: {}, body: `No server on port ${port}` };
          }

          const req = new IncomingMessage();
          req.method = method;
          req.url = path;
          req.headers = headers;
          if (body) {
            req._setBody(new TextEncoder().encode(body));
          }

          const res = new ServerResponse();

          return new Promise((resolve) => {
            res.on('finish', () => {
              resolve(res._getResponse());
            });

            entry.server._handleRequest(req, res);
            req._emitBody();
          });
        },

        getRegisteredPorts(): number[] {
          return Array.from(servers.keys());
        },

        basePath,
      };

      (kernel as any)._serverBridge = bridge;
    },

    async onDestroy(): Promise<void> {
      servers.clear();
    },
  };
}
