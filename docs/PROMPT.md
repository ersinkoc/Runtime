# @oxog/runtime — Browser-Native Node.js Runtime

## Package Identity

| Field | Value |
|-------|-------|
| **NPM Package** | `@oxog/runtime` |
| **GitHub Repository** | `https://github.com/ersinkoc/runtime` |
| **Documentation Site** | `https://runtime.oxog.dev` |
| **License** | MIT |
| **Author** | Ersin Koç (ersinkoc) |

> **NO social media, Discord, email, or external links allowed.**

---

## Package Description

**One-line:** Zero-dependency, plugin-based Node.js runtime that runs entirely in the browser — virtual filesystem, hybrid CJS+ESM module loader, npm client, and 40+ Node.js API shims.

This package enables running real Node.js code in the browser without any backend server. It provides an in-memory POSIX filesystem with OPFS persistence, a hybrid CommonJS + ES Module loader, browser-based npm package installation with multi-CDN caching, virtual HTTP servers via Service Workers, and 40+ Node.js API shims. Built with a micro-kernel architecture where every capability is a composable plugin, achieving zero npm dependencies.

### Use Cases
- **Interactive code playgrounds** — Run Node.js instantly with live feedback
- **AI agent code execution** — Safe sandbox for AI-generated code
- **Interactive documentation** — Working code examples without a backend
- **Education tools** — Teach Node.js concepts with live execution
- **Lightweight dev environments** — Prototype without server setup

### What Makes This Different

| Feature | almostnode | WebContainers | **@oxog/runtime** |
|---------|-----------|---------------|-------------------|
| Bundle size | ~50KB | ~2MB | **<30KB core** |
| Runtime deps | 11 | Proprietary | **0** |
| Module system | CJS only | Full | **CJS + ESM hybrid** |
| Persistence | None | IndexedDB | **OPFS** |
| npm cache | None | Yes | **OPFS (zero network 2nd load)** |
| Plugin system | None | N/A | **Micro-kernel** |
| License | MIT | Proprietary | **MIT** |

---

## REFERENCE FILES — READ BEFORE CODING

Three reference files are provided alongside this prompt. **Read them all before writing any code:**

1. **`REFERENCE-architecture.md`** — Detailed system architecture, data flows, kernel design, module loader algorithm, every plugin's internal mechanism, bundle size strategy.

2. **`REFERENCE-shims.md`** — Complete specification for 40+ Node.js shims. Tier 1 (full), Tier 2 (partial), Tier 3 (stub). API surfaces, browser API mappings, estimated line counts.

3. **`REFERENCE-almostnode-analysis.md`** — Analysis of almostnode (competing project). What to keep (tree-based VFS, SW interception, Function() CJS), what to fix (no ESM, 11 deps, no persistence, no cache, weak errors, no plugins).

---

## NON-NEGOTIABLE RULES

### 1. ZERO RUNTIME DEPENDENCIES

```json
{
  "dependencies": {}
}
```

- Implement EVERYTHING from scratch: tar parser, semver resolver, exports resolver, gzip decompression, Worker RPC, CSS transforms
- WASM files (esbuild-wasm) are loaded from CDN at runtime — they are NOT npm dependencies
- Use native browser APIs: `DecompressionStream` (not pako), `crypto.subtle` (not crypto libs), `URL` (not url libs)

**Allowed devDependencies only:**
```json
{
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^2.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "tsup": "^8.0.0",
    "@types/node": "^20.0.0",
    "prettier": "^3.0.0",
    "eslint": "^9.0.0",
    "happy-dom": "^15.0.0"
  }
}
```

### 2. 100% TEST COVERAGE

- Every line, branch, function tested
- All tests must pass
- Vitest with `happy-dom` environment (browser-targeted package)
- Mock browser APIs (Service Worker, OPFS, Web Worker) in tests
- Coverage thresholds enforced

### 3. MICRO-KERNEL ARCHITECTURE

```
User Code → createRuntime({ plugins: [...] })
  → Plugin Registry (use/unregister/get/list)
    → Core Plugins: vfsPlugin, shimsPlugin
    → Optional Plugins: npmPlugin, transformPlugin, serverBridgePlugin, ...
      → Micro Kernel (event bus, module loader, error boundary)
```

Every feature is a plugin. Kernel is < 5KB. Users compose what they need.

### 4. DEVELOPMENT WORKFLOW

Create in order, BEFORE any code:
1. **SPECIFICATION.md** — Complete spec
2. **IMPLEMENTATION.md** — Architecture decisions
3. **TASKS.md** — Ordered task list

Then implement following TASKS.md sequentially.

### 5. TYPESCRIPT STRICT MODE

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noEmit": true,
    "declaration": true,
    "declarationMap": true,
    "moduleResolution": "bundler",
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"]
  }
}
```

### 6. LLM-NATIVE DESIGN

- `llms.txt` file (< 2000 tokens)
- Predictable API naming: `create`, `use`, `get`, `set`, `remove`
- JSDoc with `@example` on every public API
- 15+ examples in organized folders
- README optimized for LLM consumption

### 7. NO EXTERNAL LINKS

- ✅ GitHub repo, npm package, runtime.oxog.dev
- ❌ Social media, Discord, email, donation links

---

## CORE FEATURES

### 1. Micro Kernel + Plugin System

```typescript
import { createRuntime } from '@oxog/runtime';
import { vfsPlugin, shimsPlugin, npmPlugin, transformPlugin } from '@oxog/runtime/plugins';

// Minimal — just VFS + module loading
const minimal = createRuntime({
  plugins: [vfsPlugin()]
});

// Full — everything
const full = createRuntime({
  plugins: [
    vfsPlugin({ persistence: 'opfs' }),
    shimsPlugin({ tier: 'full' }),
    npmPlugin({ cache: 'opfs' }),
    transformPlugin({ engine: 'esbuild' }),
  ]
});

// Convenience shorthand for all plugins
import { createContainer } from '@oxog/runtime';
const container = createContainer(); // everything included

// Custom plugin
full.use({
  name: 'my-plugin',
  version: '1.0.0',
  install(kernel) {
    kernel.on('beforeExecute', (code, filename) => {
      console.log(`Executing: ${filename}`);
    });
  }
});
```

### 2. Virtual File System

```typescript
const runtime = createRuntime({ plugins: [vfsPlugin()] });

runtime.vfs.mkdirSync('/src', { recursive: true });
runtime.vfs.writeFileSync('/src/index.ts', 'export const x = 42;');
runtime.vfs.readFileSync('/src/index.ts', 'utf8'); // 'export const x = 42;'
runtime.vfs.readdirSync('/src'); // ['index.ts']
runtime.vfs.statSync('/src/index.ts'); // { size, mtime, ... }

// Watch for HMR
runtime.vfs.watch('/src', { recursive: true }, (event, filename) => {
  console.log(`${event}: ${filename}`);
});

// Snapshot — transfer to Worker/Sandbox
const snapshot = runtime.vfs.toSnapshot(); // Uint8Array (transferable)
```

**Implementation:** Tree-based FSNode (file/dir/symlink), O(1) readdir, file descriptor table, symlink resolution, metadata (mode, ino, timestamps). OPFS persistence via optional plugin. ~400 lines VFS core.

### 3. Hybrid CJS + ESM Module Loader

```typescript
// CJS — synchronous require()
const result = runtime.execute(`
  const path = require('path');
  const fs = require('fs');
  fs.writeFileSync('/test.txt', 'hello');
  module.exports = path.join('/foo', 'bar');
`);
console.log(result.exports); // '/foo/bar'

// File execution
runtime.vfs.writeFileSync('/app.js', 'module.exports = require("events").EventEmitter;');
const mod = runtime.runFile('/app.js');

// ESM (when transform plugin loaded)
runtime.vfs.writeFileSync('/app.mjs', 'export default 42;');
const esm = await runtime.import('/app.mjs');
```

**Implementation:** `Function()` constructor for CJS sync, Blob URL + `import()` for ESM async. Format detection via extension + `package.json` type field. `package.json` "exports" resolver from scratch. Circular dependency handling. Transform cache with FNV-1a hash. `//# sourceURL` injection.

### 4. Node.js API Shims (40+ Modules)

```typescript
import { shimsPlugin } from '@oxog/runtime/plugins';

// Full — all tiers
createRuntime({ plugins: [shimsPlugin({ tier: 'full' })] });

// Minimal — core only
createRuntime({ plugins: [shimsPlugin({ tier: 'minimal' })] });

// Custom — cherry-pick
createRuntime({ plugins: [shimsPlugin({ include: ['fs', 'path', 'http'] })] });
```

**Tier 1 (Full):** fs, path, buffer, events, stream, http/https, url, querystring, crypto, util, os, process, zlib, assert, string_decoder, tty, perf_hooks, timers, console
**Tier 2 (Partial):** net (virtual sockets), child_process (Worker-based), worker_threads
**Tier 3 (Stub):** tls, dns, dgram, cluster, vm, v8, inspector, async_hooks

See `REFERENCE-shims.md` for complete API surfaces.

### 5. npm Package Manager

```typescript
import { npmPlugin } from '@oxog/runtime/plugins';

const runtime = createRuntime({ plugins: [vfsPlugin(), shimsPlugin(), npmPlugin()] });

await runtime.npm.install('lodash');
await runtime.npm.install(['react', 'react-dom']);
await runtime.npm.install('express@4');

runtime.execute(`
  const _ = require('lodash');
  console.log(_.capitalize('hello'));
`);

runtime.npm.list(); // [{ name: 'lodash', version: '4.17.21' }, ...]
```

**Implementation:** Multi-CDN strategy (esm.sh → jsdelivr → unpkg), pre-bundled popular packages, OPFS package cache, native `DecompressionStream` for gzip, custom tar parser (~100 lines), semver resolver from scratch.

### 6. Transform Pipeline

```typescript
import { transformPlugin } from '@oxog/runtime/plugins';

const runtime = createRuntime({ plugins: [vfsPlugin(), shimsPlugin(), transformPlugin()] });

// TypeScript just works
runtime.vfs.writeFileSync('/app.ts', `
  interface User { name: string }
  const user: User = { name: 'Ersin' };
  module.exports = user;
`);
runtime.runFile('/app.ts'); // Works!

// JSX/TSX just works
runtime.vfs.writeFileSync('/App.tsx', `
  export default function App() { return <h1>Hello!</h1>; }
`);
```

**Implementation:** esbuild-wasm lazy-loaded from CDN on first use (NOT at startup). Transform cache with FNV-1a hash. Sync fallback: simple regex ESM→CJS for require() chains. Inline source maps.

### 7. Virtual HTTP Server + Service Worker Bridge

```typescript
import { serverBridgePlugin } from '@oxog/runtime/plugins';

const runtime = createRuntime({
  plugins: [vfsPlugin(), shimsPlugin(), serverBridgePlugin()]
});

runtime.execute(`
  const http = require('http');
  http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Browser server!</h1>');
  }).listen(3000);
`);

// Access: /__virtual__/3000/ via Service Worker
```

### 8. Security Modes

```typescript
// Level 1: Trusted (main thread)
createRuntime({ mode: 'trusted', plugins: [...] });

// Level 2: Worker (isolated thread)
createRuntime({ mode: 'worker', plugins: [...] });

// Level 3: Sandbox (cross-origin iframe)
createRuntime({ mode: 'sandbox', sandboxUrl: 'https://sandbox.example.com', plugins: [...] });

// Level 4: CSP-safe (no eval — all ESM via Blob URL)
createRuntime({ mode: 'csp-safe', plugins: [...] });
```

---

## PLUGIN INTERFACE

```typescript
export interface RuntimePlugin {
  /** Unique plugin identifier (kebab-case) */
  name: string;
  /** Semantic version */
  version: string;
  /** Other plugins this depends on */
  dependencies?: string[];
  /** Called when plugin is registered — set up hooks and services */
  install: (kernel: RuntimeKernel) => void;
  /** Called after all plugins installed */
  onReady?: () => void | Promise<void>;
  /** Called when plugin is unregistered */
  onDestroy?: () => void | Promise<void>;
  /** Called on error in this plugin */
  onError?: (error: Error) => void;
}
```

### Core Plugins

| Plugin | Description |
|--------|-------------|
| `vfsPlugin(options?)` | Virtual File System — in-memory POSIX with watch, snapshot, optional OPFS persistence |
| `shimsPlugin(options?)` | Node.js API shims — 40+ modules, configurable tier (full/minimal/custom) |

### Optional Plugins

| Plugin | Description |
|--------|-------------|
| `npmPlugin(options?)` | Browser npm client — multi-CDN, OPFS cache, tarball extraction |
| `transformPlugin(options?)` | esbuild-wasm transform — TS/JSX/TSX, lazy-loaded, cached |
| `serverBridgePlugin()` | Virtual HTTP server + Service Worker bridge |
| `workerPlugin()` | Web Worker execution mode |
| `sandboxPlugin(options)` | Cross-origin iframe sandbox |
| `persistencePlugin(options?)` | OPFS-based persistent storage for VFS |

---

## TYPE DEFINITIONS

```typescript
export interface RuntimeOptions {
  cwd?: string;
  env?: Record<string, string>;
  plugins?: RuntimePlugin[];
  mode?: 'trusted' | 'worker' | 'sandbox' | 'csp-safe';
  sandboxUrl?: string;
  onConsole?: (method: string, args: unknown[]) => void;
}

export interface Runtime {
  readonly vfs: VirtualFS;
  readonly npm: PackageManager | null;
  execute(code: string, filename?: string): ExecuteResult;
  runFile(path: string): ExecuteResult;
  require(specifier: string): unknown;
  import(specifier: string): Promise<unknown>;
  use(plugin: RuntimePlugin): void;
  clearCache(): void;
  destroy(): void;
}

export interface ExecuteResult {
  exports: unknown;
  console: ConsoleEntry[];
}

export interface ConsoleEntry {
  method: 'log' | 'warn' | 'error' | 'info' | 'debug';
  args: unknown[];
  timestamp: number;
}

export interface VirtualFS {
  readFileSync(path: string, encoding?: string): string | Uint8Array;
  writeFileSync(path: string, content: string | Uint8Array): void;
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
  readdirSync(path: string): string[];
  statSync(path: string): FSStats;
  existsSync(path: string): boolean;
  unlinkSync(path: string): void;
  rmdirSync(path: string, options?: { recursive?: boolean }): void;
  renameSync(oldPath: string, newPath: string): void;
  watch(path: string, options: WatchOptions, listener: WatchListener): FSWatcher;
  toSnapshot(): Uint8Array;
}

export interface PackageManager {
  install(packages: string | string[]): Promise<void>;
  list(): Array<{ name: string; version: string }>;
}
```

---

## TECHNICAL REQUIREMENTS

| Requirement | Value |
|-------------|-------|
| **Runtime** | Browser only (Chrome 90+, Firefox 113+, Safari 16.4+, Edge 90+) |
| **Module Format** | ESM + CJS dual output |
| **TypeScript** | >= 5.0, strict mode |
| **Kernel bundle** | < 5KB gzipped |
| **Core plugins (vfs + shims)** | < 25KB gzipped |
| **All plugins** | < 40KB gzipped |
| **WASM assets** | Lazy-loaded from CDN, NOT bundled |

---

## PROJECT STRUCTURE

```
runtime/
├── .github/workflows/deploy.yml
├── src/
│   ├── index.ts                      # createRuntime, createContainer exports
│   ├── kernel.ts                     # Micro kernel: plugin registry, event bus
│   ├── types.ts                      # All public type definitions
│   ├── errors.ts                     # RuntimeError + contextual suggestions
│   ├── core/
│   │   ├── module-loader.ts          # Hybrid CJS + ESM loader
│   │   ├── module-resolver.ts        # Resolution algorithm + exports field
│   │   ├── module-cache.ts           # FNV-1a hash-based cache
│   │   ├── esm-to-cjs.ts            # Regex-based ESM→CJS (sync fallback)
│   │   └── source-url.ts            # sourceURL + inline source map
│   ├── plugins/
│   │   ├── index.ts                  # All plugin exports
│   │   ├── core/
│   │   │   ├── vfs-plugin.ts
│   │   │   └── shims-plugin.ts
│   │   └── optional/
│   │       ├── npm-plugin.ts
│   │       ├── transform-plugin.ts
│   │       ├── server-bridge-plugin.ts
│   │       ├── worker-plugin.ts
│   │       ├── sandbox-plugin.ts
│   │       └── persistence-plugin.ts
│   ├── vfs/
│   │   ├── virtual-fs.ts            # VirtualFS class
│   │   ├── fs-node.ts               # FSNode types
│   │   ├── path-utils.ts            # Path normalization
│   │   ├── watcher.ts               # File watch + event batching
│   │   ├── snapshot.ts              # Binary serialize/deserialize
│   │   └── opfs-backend.ts          # OPFS persistence
│   ├── npm/
│   │   ├── package-manager.ts
│   │   ├── cdn-resolver.ts          # Multi-CDN strategy
│   │   ├── tarball.ts               # Tar parser (from scratch)
│   │   ├── semver.ts                # Semver parser + matcher
│   │   ├── dependency-resolver.ts
│   │   └── decompress.ts            # Native DecompressionStream
│   ├── shims/                        # 40+ Node.js module shims
│   │   ├── index.ts                 # Shim registry
│   │   ├── fs.ts, path.ts, buffer.ts, events.ts, stream.ts,
│   │   ├── http.ts, https.ts, url.ts, querystring.ts, crypto.ts,
│   │   ├── util.ts, os.ts, process.ts, zlib.ts, assert.ts,
│   │   ├── string-decoder.ts, tty.ts, perf-hooks.ts, timers.ts,
│   │   ├── console.ts, net.ts, child-process.ts, worker-threads.ts,
│   │   └── stubs.ts                 # All Tier 3 stubs
│   ├── server/
│   │   ├── server-bridge.ts
│   │   ├── virtual-http-server.ts
│   │   └── service-worker.ts        # SW script generator
│   ├── transform/
│   │   ├── pipeline.ts
│   │   ├── esbuild-loader.ts        # Lazy CDN loader
│   │   ├── cache.ts                 # FNV-1a transform cache
│   │   └── simple-esm-cjs.ts        # Regex ESM→CJS
│   ├── security/
│   │   ├── worker-executor.ts
│   │   ├── sandbox-executor.ts
│   │   └── worker-rpc.ts            # Minimal postMessage RPC
│   └── utils/
│       ├── hash.ts                   # FNV-1a
│       └── encoding.ts              # TextEncoder/Decoder helpers
├── tests/
│   ├── unit/
│   │   ├── kernel.test.ts
│   │   ├── vfs/*.test.ts
│   │   ├── core/*.test.ts
│   │   ├── npm/*.test.ts
│   │   ├── shims/*.test.ts           # Her shim için ayrı test
│   │   ├── transform/*.test.ts
│   │   └── utils/*.test.ts
│   ├── integration/
│   │   ├── runtime.test.ts
│   │   ├── npm-install.test.ts
│   │   ├── plugin-system.test.ts
│   │   ├── cjs-esm-hybrid.test.ts
│   │   └── express-compat.test.ts
│   └── fixtures/
├── examples/
│   ├── 01-basic/
│   │   ├── hello-world.ts
│   │   ├── file-system.ts
│   │   └── require-modules.ts
│   ├── 02-plugins/
│   │   ├── minimal-runtime.ts
│   │   ├── custom-plugin.ts
│   │   └── plugin-composition.ts
│   ├── 03-npm/
│   │   ├── install-packages.ts
│   │   └── offline-cache.ts
│   ├── 04-typescript/
│   │   ├── ts-execution.ts
│   │   └── tsx-react.ts
│   ├── 05-http-server/
│   │   ├── basic-server.ts
│   │   └── express-app.ts
│   └── 06-real-world/
│       ├── code-playground.ts
│       ├── ai-agent-sandbox.ts
│       └── interactive-docs.ts
├── website/
│   ├── public/
│   │   ├── CNAME                     # runtime.oxog.dev
│   │   └── llms.txt
│   └── src/
├── llms.txt
├── SPECIFICATION.md
├── IMPLEMENTATION.md
├── TASKS.md
├── README.md
├── CHANGELOG.md
├── LICENSE
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
└── .gitignore
```

---

## CONFIG FILES

### tsup.config.ts

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'plugins/index': 'src/plugins/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  target: 'es2022',
  platform: 'browser',
});
```

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/', 'website/', 'examples/', '*.config.*'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
```

### package.json

```json
{
  "name": "@oxog/runtime",
  "version": "1.0.0",
  "description": "Zero-dependency browser-native Node.js runtime with plugin architecture — virtual filesystem, module loader, npm client, and 40+ API shims",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    },
    "./plugins": {
      "import": { "types": "./dist/plugins/index.d.ts", "default": "./dist/plugins/index.js" },
      "require": { "types": "./dist/plugins/index.d.cts", "default": "./dist/plugins/index.cjs" }
    }
  },
  "files": ["dist"],
  "sideEffects": false,
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src/",
    "format": "prettier --write .",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run build && npm run test:coverage"
  },
  "keywords": ["nodejs", "browser", "runtime", "virtual-filesystem", "webcontainers", "sandbox", "npm", "typescript", "playground", "code-execution", "zero-dependency", "plugin"],
  "author": "Ersin Koç",
  "license": "MIT",
  "repository": { "type": "git", "url": "git+https://github.com/ersinkoc/runtime.git" },
  "bugs": { "url": "https://github.com/ersinkoc/runtime/issues" },
  "homepage": "https://runtime.oxog.dev",
  "engines": { "node": ">=18" },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "eslint": "^9.0.0",
    "happy-dom": "^15.0.0",
    "prettier": "^3.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0"
  }
}
```

---

## GITHUB ACTIONS

```yaml
# .github/workflows/deploy.yml
name: Deploy Website

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:coverage
      - run: npm run build
      - working-directory: ./website
        run: npm ci && npm run build
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: './website/dist'

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

---

## IMPLEMENTATION CHECKLIST

### Before Starting
- [ ] Read ALL 3 reference files thoroughly
- [ ] Create SPECIFICATION.md
- [ ] Create IMPLEMENTATION.md
- [ ] Create TASKS.md

### Core Implementation
- [ ] Kernel (plugin registry + event bus)
- [ ] VFS (tree structure, CRUD, watch, snapshot)
- [ ] Module loader (CJS require + ESM import + resolver)
- [ ] Path shim (first shim — many things depend on it)
- [ ] Buffer shim
- [ ] Events shim (EventEmitter)
- [ ] Process shim
- [ ] fs shim (delegates to VFS)
- [ ] All remaining Tier 1 shims
- [ ] Tier 2 + 3 shims
- [ ] npm plugin (multi-CDN, tarball, semver)
- [ ] Transform plugin (esbuild lazy, cache, sync fallback)
- [ ] Server bridge plugin (virtual HTTP, SW)
- [ ] Security plugins (worker, sandbox)
- [ ] Persistence plugin (OPFS)
- [ ] Error DX (source URLs, suggestions)

### Quality
- [ ] 100% test coverage maintained throughout
- [ ] JSDoc + @example on every public API
- [ ] Zero runtime dependencies at ALL times
- [ ] Bundle size within budgets

### Deliverables
- [ ] 15+ examples in organized folders
- [ ] llms.txt (< 2000 tokens)
- [ ] README.md
- [ ] CHANGELOG.md
- [ ] Documentation website
- [ ] `npm run build` succeeds
- [ ] `npm run test:coverage` shows 100%

---

## BEGIN IMPLEMENTATION

1. Read reference files
2. Create SPECIFICATION.md
3. Create IMPLEMENTATION.md
4. Create TASKS.md
5. Implement following TASKS.md sequentially

**Remember:**
- Browser-targeted package — test with happy-dom
- WASM loaded from CDN lazily — NOT npm dependencies
- Every shim from scratch using browser APIs
- Zero dependencies — no exceptions
- Production-ready quality
