# @oxog/runtime

**Browser-Native Node.js Runtime** — Zero-dependency, plugin-based Node.js runtime that runs entirely in the browser.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](tsconfig.json)
[![Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen.svg)](vitest.config.ts)
[![Tests](https://img.shields.io/badge/Tests-1267_passing-brightgreen.svg)](tests/)

## Features

- **Zero Runtime Dependencies** — Everything implemented from scratch
- **Plugin Architecture** — Composable micro-kernel with hot-swap plugins
- **Virtual File System** — Full POSIX-like VFS with symlinks, snapshots, and OPFS persistence
- **40+ Node.js Shims** — path, buffer, events, fs, stream, crypto, http, and more
- **Hybrid Module Loader** — CJS `require()` + ESM `import()` with full node_modules resolution
- **Browser npm Client** — Install packages from CDN directly into VFS
- **Transform Pipeline** — TypeScript/JSX compilation with FNV-1a caching
- **Virtual HTTP Server** — Run Express-like servers in the browser
- **4 Security Modes** — unrestricted, worker, sandbox, locked
- **TypeScript Strict** — Full type safety with 100% test coverage

## Installation

```bash
npm install @oxog/runtime
```

## Quick Start

```typescript
import { createContainer } from '@oxog/runtime';

const container = createContainer();

// Write and run Node.js code in the browser
container.vfs.writeFileSync('/app.js', `
  const path = require('path');
  const { Buffer } = require('buffer');

  const greeting = Buffer.from('Hello World').toString('base64');
  console.log(path.join('/hello', 'world'));

  module.exports = greeting;
`);

const result = container.runFile('/app.js');
console.log(result.exports); // 'SGVsbG8gV29ybGQ='
```

## Custom Runtime

Pick only the plugins you need:

```typescript
import { createRuntime } from '@oxog/runtime';
import {
  vfsPlugin, shimsPlugin, transformPlugin,
  npmPlugin, securityPlugin
} from '@oxog/runtime/plugins';

// Minimal — just VFS
const minimal = createRuntime({
  plugins: [vfsPlugin()],
});

// Full — everything
const full = createRuntime({
  cwd: '/app',
  env: { NODE_ENV: 'production' },
  plugins: [
    vfsPlugin(),
    shimsPlugin({ tier: 'full' }),
    transformPlugin(),
    npmPlugin(),
    securityPlugin({ mode: 'sandbox' }),
  ],
});
```

## API

### `createContainer(options?)`

Create a full runtime with all plugins pre-loaded.

```typescript
const container = createContainer({
  cwd: '/app',
  env: { NODE_ENV: 'development' },
});
```

### `createRuntime(options?)`

Create a runtime with specific plugins.

```typescript
const runtime = createRuntime({
  cwd: '/',
  env: {},
  plugins: [vfsPlugin(), shimsPlugin()],
});
```

### Runtime Methods

| Method | Description |
|--------|-------------|
| `runtime.vfs` | Virtual file system instance |
| `runtime.npm` | Package manager (when npmPlugin loaded) |
| `runtime.execute(code, filename?)` | Execute code string, returns `{ exports, console }` |
| `runtime.runFile(path)` | Execute file from VFS |
| `runtime.require(specifier)` | Synchronous CJS require |
| `runtime.import(specifier)` | Async ESM import |
| `runtime.use(plugin)` | Add plugin at runtime |
| `runtime.clearCache()` | Clear module cache |
| `runtime.destroy()` | Cleanup and release resources |

## Plugins

| Plugin | Description |
|--------|-------------|
| `vfsPlugin()` | Virtual POSIX file system with symlinks, watchers, snapshots |
| `shimsPlugin(options?)` | Node.js API shims — 40+ modules, configurable tier |
| `npmPlugin()` | Browser-based npm client with multi-CDN resolution |
| `transformPlugin()` | TypeScript/JSX compilation with FNV-1a caching |
| `serverBridgePlugin()` | Virtual HTTP server via Service Worker bridge |
| `securityPlugin(options?)` | Execution sandboxing (4 modes) |
| `persistencePlugin()` | OPFS-backed VFS persistence |

### Custom Plugins

```typescript
import type { RuntimePlugin } from '@oxog/runtime';

const myPlugin: RuntimePlugin = {
  name: 'my-plugin',
  version: '1.0.0',
  install(kernel) {
    kernel.on('beforeExecute', (code, filename) => {
      console.log(`Executing: ${filename}`);
    });
  },
};

runtime.use(myPlugin);
```

## Node.js Module Shims

### Tier 1 — Full Implementation
`path`, `buffer`, `events`, `fs`, `stream`, `http`/`https`, `url`, `crypto`, `util`, `os`, `process`, `querystring`, `zlib`, `assert`, `string_decoder`, `timers`, `console`, `tty`, `perf_hooks`

### Tier 2 — Partial Implementation
`net`, `child_process`, `worker_threads`

### Tier 3 — Stubs
`tls`, `dns`, `dgram`, `cluster`, `vm`, `v8`, `inspector`, `async_hooks`, `readline`, `repl`, `domain`, `punycode`, `sys`, `constants`, `module`, `trace_events`, `wasi`

### Shim Configuration

```typescript
// All shims (default)
shimsPlugin({ tier: 'full' })

// Core only: path, buffer, events, process, util, os
shimsPlugin({ tier: 'minimal' })

// Cherry-pick specific modules
shimsPlugin({ tier: 'custom', include: ['fs', 'path', 'http'] })
```

## npm in the Browser

```typescript
const runtime = createRuntime({
  plugins: [vfsPlugin(), shimsPlugin(), npmPlugin()],
});

// Install packages from CDN
await runtime.npm.install('lodash');
await runtime.npm.install(['react', 'react-dom']);

// Use them immediately
const result = runtime.execute(`
  const _ = require('lodash');
  module.exports = _.capitalize('hello world');
`);
console.log(result.exports); // 'Hello world'
```

## TypeScript Support

```typescript
const runtime = createRuntime({
  plugins: [vfsPlugin(), shimsPlugin(), transformPlugin()],
});

runtime.vfs.writeFileSync('/app.ts', `
  interface User { name: string; age: number }
  const user: User = { name: 'Ersin', age: 30 };
  module.exports = user;
`);

const result = runtime.runFile('/app.ts'); // Just works
```

## Architecture

```
User Code -> createRuntime({ plugins: [...] })
  -> Micro Kernel (~4KB)
     -> Plugin Registry (use/unregister/get/list)
     -> Event Bus (on/off/emit)
     -> Module Loader (require/import)
  -> Plugins
     -> VFS, Shims, npm, Transform, Server Bridge, Security, Persistence
```

## Browser Compatibility

| Browser | Minimum Version |
|---------|----------------|
| Chrome | 90+ |
| Firefox | 113+ |
| Safari | 16.4+ |
| Edge | 90+ |

## Development

```bash
npm install          # Install dev dependencies
npm test             # Run 1267 tests
npm run test:coverage # Run with 100% coverage enforcement
npm run build        # Build CJS + ESM + .d.ts
npm run typecheck    # TypeScript strict check
```

## Project Structure

```
src/               # Source code (52 files, ~8K lines)
  kernel.ts        # Micro-kernel: plugin registry + event bus
  index.ts         # createRuntime, createContainer exports
  types.ts         # Public type definitions
  errors.ts        # RuntimeError with contextual suggestions
  core/            # Hybrid CJS + ESM module loader
  vfs/             # Tree-based virtual POSIX filesystem
  shims/           # 40+ Node.js API shims
  npm/             # Browser npm client (CDN, tar, semver)
  plugins/         # Plugin implementations
  server/          # Virtual HTTP server + Service Worker bridge
  transform/       # TypeScript/JSX compilation pipeline
  security/        # Worker + sandbox executors
  utils/           # FNV-1a hash, encoding helpers
tests/             # 1267 tests across 52 files
examples/          # 6 example projects + interactive web demos
docs/              # Specification, architecture, references
```

## Examples

See the [examples/](examples/) directory:

- **[01-basic](examples/01-basic/)** — Creating containers, running files, multi-file projects
- **[02-plugins](examples/02-plugins/)** — Custom plugins, minimal runtimes, plugin composition
- **[03-npm](examples/03-npm/)** — Installing and using npm packages from CDN
- **[04-typescript](examples/04-typescript/)** — TypeScript/JSX transforms
- **[05-http-server](examples/05-http-server/)** — Virtual HTTP servers
- **[06-real-world](examples/06-real-world/)** — Code playground implementation

### Interactive Web Demos

Open `examples/web/index.html` in a browser (via local server) to try live demos:

- **Code Playground** — Write and run Node.js code with 10 preset examples
- **Virtual File System** — Explore the VFS with a file tree, in-place editing, create/delete
- **TypeScript Execution** — 3-pane editor with TS source, transformed JS preview, and output
- **Multi-File Project** — IDE-like experience with file tabs, tree, and 5 project presets

```bash
npx serve .
# Open http://localhost:3000/examples/web/
```

## License

[MIT](LICENSE) - Ersin Koc
