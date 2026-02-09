/**
 * Example 05 — Virtual HTTP Server
 *
 * Demonstrates running an Express-like server entirely in-process.
 */
import { createRuntime } from '@oxog/runtime';
import {
  vfsPlugin,
  shimsPlugin,
  serverBridgePlugin,
} from '@oxog/runtime/plugins';

// 1. Create runtime with server bridge
const runtime = createRuntime({
  plugins: [
    vfsPlugin(),
    shimsPlugin({ tier: 'full' }),
    serverBridgePlugin({ basePath: '/__api__' }),
  ],
});

// 2. Write a simple server
runtime.vfs.writeFileSync('/server.js', `
  const http = require('http');

  const server = http.createServer((req, res) => {
    if (req.url === '/api/hello') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Hello from virtual server!' }));
    } else if (req.url === '/api/time') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ time: new Date().toISOString() }));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  server.listen(3000, () => {
    console.log('Virtual server running on port 3000');
  });

  module.exports = server;
`);

// 3. Start the server
runtime.runFile('/server.js');

// 4. Make requests via the server bridge
// The server bridge allows in-process request handling
// without actual network activity
console.log('Server is running in-process');

runtime.destroy();
