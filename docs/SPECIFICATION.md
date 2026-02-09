# @oxog/runtime — Specification

## 1. Overview

**@oxog/runtime** is a zero-dependency, plugin-based Node.js runtime that runs entirely in the browser. It provides a virtual POSIX filesystem, hybrid CJS+ESM module loader, browser-based npm client, and 40+ Node.js API shims — all implemented from scratch using native browser APIs.

### Design Principles

1. **Zero runtime dependencies** — Everything implemented from scratch
2. **Micro-kernel architecture** — Every capability is a composable plugin
3. **Browser-native** — Uses DecompressionStream, crypto.subtle, OPFS, Service Workers
4. **TypeScript-strict** — Full strict mode, no `any` leaks in public API
5. **LLM-native** — Predictable naming, JSDoc with @example on every public API

### Target Browsers

| Browser | Minimum Version |
|---------|----------------|
| Chrome | 90+ |
| Firefox | 113+ |
| Safari | 16.4+ |
| Edge | 90+ |

---

## 2. Public API Surface

### 2.1 Entry Points

```typescript
// Main entry — minimal runtime
import { createRuntime } from '@oxog/runtime';

// Plugin exports
import {
  vfsPlugin,
  shimsPlugin,
  npmPlugin,
  transformPlugin,
  serverBridgePlugin,
  workerPlugin,
  sandboxPlugin,
  persistencePlugin
} from '@oxog/runtime/plugins';

// Convenience — all plugins included
import { createContainer } from '@oxog/runtime';
```

### 2.2 createRuntime(options?)

Creates a runtime instance with specified plugins.

```typescript
function createRuntime(options?: RuntimeOptions): Runtime;

interface RuntimeOptions {
  cwd?: string;                    // Default: '/'
  env?: Record<string, string>;    // Default: {}
  plugins?: RuntimePlugin[];       // Default: []
  mode?: 'trusted' | 'worker' | 'sandbox' | 'csp-safe'; // Default: 'trusted'
  sandboxUrl?: string;             // Required when mode='sandbox'
  onConsole?: (method: string, args: unknown[]) => void;
}
```

### 2.3 createContainer(options?)

Convenience function that creates a runtime with all plugins pre-loaded.

```typescript
function createContainer(options?: ContainerOptions): Runtime;

interface ContainerOptions extends Omit<RuntimeOptions, 'plugins'> {
  persistence?: boolean | 'opfs';  // Default: false
  shimTier?: 'full' | 'minimal';  // Default: 'full'
  npmCache?: boolean | 'opfs';    // Default: false
}
```

### 2.4 Runtime Interface

```typescript
interface Runtime {
  /** Virtual filesystem (available when vfsPlugin is loaded) */
  readonly vfs: VirtualFS;

  /** Package manager (available when npmPlugin is loaded, null otherwise) */
  readonly npm: PackageManager | null;

  /** Execute code string as CJS module */
  execute(code: string, filename?: string): ExecuteResult;

  /** Execute a file from VFS */
  runFile(path: string): ExecuteResult;

  /** Synchronous CJS require */
  require(specifier: string): unknown;

  /** Async ESM import */
  import(specifier: string): Promise<unknown>;

  /** Register a plugin at runtime */
  use(plugin: RuntimePlugin): void;

  /** Clear module and transform caches */
  clearCache(): void;

  /** Destroy runtime, release all resources */
  destroy(): void;
}

interface ExecuteResult {
  exports: unknown;
  console: ConsoleEntry[];
}

interface ConsoleEntry {
  method: 'log' | 'warn' | 'error' | 'info' | 'debug';
  args: unknown[];
  timestamp: number;
}
```

---

## 3. Micro Kernel

The kernel is the minimal, immutable core (~4KB gzipped). It provides:

### 3.1 Plugin Registry

```typescript
interface RuntimeKernel {
  use(plugin: RuntimePlugin): void;
  unregister(name: string): void;
  getPlugin<T>(name: string): T | undefined;
  listPlugins(): string[];
}
```

**Lifecycle:** `use()` → validate dependencies → `plugin.install(kernel)` → add to registry → call `onReady()` after all initial plugins installed.

**Dependency resolution:** Plugins declare `dependencies: string[]`. The kernel topologically sorts and validates before installation. Missing dependency → `RuntimeError` with suggestion.

### 3.2 Event Bus

```typescript
interface EventBus {
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
}
```

**Core Events:**

| Event | Args | Description |
|-------|------|-------------|
| `beforeExecute` | `(code, filename)` | Before code execution, can transform code |
| `afterExecute` | `(result, filename)` | After successful execution |
| `moduleResolve` | `(specifier, parent)` | Custom module resolution hook |
| `fileChange` | `(path, event)` | VFS file change notification |
| `error` | `(error, context)` | Error in any plugin |
| `console` | `(method, args)` | Console output capture |
| `ready` | `()` | All initial plugins loaded |
| `destroy` | `()` | Runtime being destroyed |

### 3.3 Plugin Interface

```typescript
interface RuntimePlugin {
  name: string;              // kebab-case identifier
  version: string;           // semver
  dependencies?: string[];   // other plugin names
  install(kernel: RuntimeKernel): void;
  onReady?(): void | Promise<void>;
  onDestroy?(): void | Promise<void>;
  onError?(error: Error): void;
}
```

---

## 4. Virtual File System (VFS)

### 4.1 Data Structure

Tree-based with three node types:

```typescript
type FSTreeNode = FileNode | DirNode | SymlinkNode;

interface FileNode {
  kind: 'file';
  content: Uint8Array;
  meta: FSMetadata;
}

interface DirNode {
  kind: 'dir';
  children: Map<string, FSTreeNode>;
  meta: FSMetadata;
}

interface SymlinkNode {
  kind: 'symlink';
  target: string;
  meta: FSMetadata;
}

interface FSMetadata {
  mode: number;
  size: number;
  atimeMs: number;
  mtimeMs: number;
  ctimeMs: number;
  birthtimeMs: number;
  ino: number;
}
```

### 4.2 VirtualFS API

```typescript
interface VirtualFS {
  // File operations
  readFileSync(path: string, encoding?: string): string | Uint8Array;
  writeFileSync(path: string, content: string | Uint8Array): void;
  appendFileSync(path: string, content: string | Uint8Array): void;
  copyFileSync(src: string, dest: string): void;

  // Directory operations
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
  readdirSync(path: string, options?: { withFileTypes?: boolean }): string[] | Dirent[];
  rmdirSync(path: string, options?: { recursive?: boolean }): void;

  // Metadata
  statSync(path: string): FSStats;
  lstatSync(path: string): FSStats;
  existsSync(path: string): boolean;
  chmodSync(path: string, mode: number): void;
  realpathSync(path: string): string;

  // Manipulation
  unlinkSync(path: string): void;
  renameSync(oldPath: string, newPath: string): void;

  // Symlinks
  symlinkSync(target: string, path: string): void;
  readlinkSync(path: string): string;

  // Watch
  watch(path: string, options: WatchOptions, listener: WatchListener): FSWatcher;

  // Serialization
  toSnapshot(): Uint8Array;
  static fromSnapshot(data: Uint8Array): VirtualFS;
}
```

### 4.3 Path Normalization

All paths normalized to POSIX format:
- `\` → `/`
- Remove trailing `/` (except root)
- Resolve `.` and `..`
- Collapse `//`
- Always absolute (prefix `/` if missing)

### 4.4 Inode Counter

Auto-incrementing `ino` per VFS instance. Starts at 1. Root dir = ino 1.

### 4.5 Watch System

- `watch()` returns `FSWatcher` with `close()` method
- Events batched via microtask queue (not per-write)
- Recursive watch with `{ recursive: true }`
- Events: `'change'` (content modified), `'rename'` (created/deleted/renamed)

### 4.6 Snapshot Format

Binary format for Worker/Sandbox transfer:

```
[entry_count: uint32]
For each entry:
  [path_length: uint16] [path_bytes: utf8]
  [kind: uint8] (0=file, 1=dir, 2=symlink)
  [mode: uint16]
  If file: [content_length: uint32] [content_bytes]
  If symlink: [target_length: uint16] [target_bytes]
```

Transferable via `postMessage` with zero-copy.

---

## 5. Hybrid Module Loader

### 5.1 Format Detection

| Extension | Format |
|-----------|--------|
| `.mjs`, `.mts` | ESM |
| `.cjs`, `.cts` | CJS |
| `.js`, `.ts`, `.jsx`, `.tsx` | Check nearest `package.json` `"type"` field |
| No match | Default CJS |

### 5.2 CJS Loader (Synchronous)

1. Check built-in modules (shims)
2. Resolve file path
3. Check module cache (by resolved path)
4. Read file from VFS
5. Transform if needed (TS/JSX via transform plugin hook)
6. Create module object `{ exports: {}, id, loaded: false }`
7. Cache module BEFORE execution (circular dependency support)
8. Wrap in `Function()` with `(exports, require, module, __filename, __dirname)`
9. Execute with `//# sourceURL=vfs://` injection
10. Mark `loaded = true`
11. Return `module.exports`

### 5.3 ESM Loader (Async)

1. Resolve file path
2. Read file from VFS
3. Transform (async — esbuild available)
4. Rewrite import specifiers to Blob URLs
5. Create Blob with `type: 'text/javascript'`
6. `URL.createObjectURL(blob)` → `import(url)` → `URL.revokeObjectURL(url)`

### 5.4 Module Resolution Algorithm

```
resolve(specifier, parentPath):
  1. If built-in → return built-in
  2. If starts with './' or '../' or '/' → resolve relative to parent
     a. Try exact path
     b. Try + '.ts', '.tsx', '.js', '.jsx', '.json', '.mjs', '.cjs'
     c. Try + '/index.ts', '/index.js', '/index.mjs', '/index.cjs'
  3. If bare specifier → node_modules traversal
     a. Walk up from parent: /app/src/ → /app/ → /
     b. At each level try: node_modules/<specifier>/
     c. In package dir:
        i.   package.json "exports" field → resolveExports()
        ii.  package.json "main" field
        iii. index.js fallback
  4. Not found → ModuleNotFoundError with suggestion
```

### 5.5 Package.json "exports" Resolver

Implements full Node.js conditional exports spec:
- String shorthand: `"exports": "./lib/index.js"`
- Object conditions: `{ "import": "...", "require": "...", "default": "..." }`
- Subpath exports: `{ "./utils": "..." }`
- Subpath patterns: `{ "./*": "./src/*.js" }`
- Nested conditions
- Condition priority: `browser` > `import`/`require` > `default`

### 5.6 Transform Cache

- Key: `${filePath}:${format}`
- Value: `{ hash: number, code: string }`
- Hash: FNV-1a of source content
- On require/import: compare hash → if match, return cached → else re-transform

---

## 6. Node.js Shims

### 6.1 Tier 1 — Full Implementation (20 modules, ~3000 lines)

`path`, `buffer`, `events`, `fs`, `stream`, `http`, `https`, `url`, `querystring`, `crypto`, `util`, `os`, `process`, `zlib`, `assert`, `string_decoder`, `timers`, `console`, `perf_hooks`, `tty`

### 6.2 Tier 2 — Partial Implementation (3 modules, ~400 lines)

`net` (virtual sockets), `child_process` (Worker-based), `worker_threads`

### 6.3 Tier 3 — Stub Only (15+ modules, ~100 lines)

`tls`, `dns`, `dgram`, `cluster`, `vm`, `v8`, `inspector`, `async_hooks`, `readline`, `repl`, `domain`, `punycode`, `sys`, `constants`, `module`, `trace_events`, `wasi`

### 6.4 Shim Configuration

```typescript
shimsPlugin({
  tier: 'full' | 'minimal' | 'custom',
  include?: string[],
  exclude?: string[],
})
```

- `full`: All tiers (default)
- `minimal`: path, buffer, events, process, util, os only
- `custom`: Manual include/exclude

---

## 7. npm Plugin

### 7.1 Installation Flow

```
npm.install('lodash')
  → 1. Check OPFS cache (if enabled)
  → 2. Fetch package metadata from registry
  → 3. Resolve version (semver)
  → 4. Resolve dependency tree
  → 5. For each package:
       a. Check OPFS cache
       b. Fetch tarball from CDN
       c. Decompress (native DecompressionStream)
       d. Parse tar (custom parser)
       e. Write to VFS at /node_modules/<name>/
       f. Cache in OPFS (if enabled)
```

### 7.2 Multi-CDN Strategy

1. **esm.sh** (primary) — Pre-bundled ESM, includes deps
2. **jsdelivr** (fallback) — Standard npm tarball
3. **unpkg** (last resort) — Standard npm tarball

### 7.3 Custom Implementations

| Component | Lines | Replaces |
|-----------|-------|----------|
| Tar parser | ~100 | tar-stream |
| Semver resolver | ~150 | semver |
| Gzip decompress | ~20 | pako |
| Exports resolver | ~80 | resolve.exports |

### 7.4 PackageManager API

```typescript
interface PackageManager {
  install(packages: string | string[]): Promise<void>;
  list(): Array<{ name: string; version: string }>;
}
```

---

## 8. Transform Plugin

### 8.1 Lazy Loading

esbuild-wasm is loaded from CDN on first transform call, NOT at startup.

```
First .ts/.tsx require():
  → Check if esbuild initialized
  → If not: fetch esbuild.wasm from jsdelivr CDN → initialize()
  → Transform source → return result
  → All subsequent calls: instant (already initialized)
```

### 8.2 Sync Fallback

When esbuild is not yet loaded and sync `require()` hits a `.ts` file:
- Simple regex-based ESM→CJS conversion
- Strip TypeScript type annotations (basic patterns)
- `import { x } from 'y'` → `const { x } = require('y')`
- `export default` → `module.exports =`
- `export const/function` → `exports.name = ...`

### 8.3 Transform Cache

- FNV-1a hash of source content
- Keyed by `path:format` (same file may be transformed for CJS and ESM differently)
- Cache hit = zero CPU cost

---

## 9. Server Bridge Plugin

### 9.1 Architecture

```
Browser fetch('/__virtual__/3000/api/users')
  → Service Worker intercepts
  → Extracts port (3000) and path (/api/users)
  → Routes to VirtualHTTPServer via BroadcastChannel/MessageChannel
  → Server handler processes request
  → Response flows back through SW to browser
```

### 9.2 Components

- **VirtualHTTPServer** — Node.js-compatible http.Server
- **ServerBridge** — Routes requests to correct virtual server
- **Service Worker Script** — Generated at runtime, handles fetch interception

---

## 10. Security Modes

| Level | Mode | Execution | DOM Access | Isolation |
|-------|------|-----------|------------|-----------|
| 1 | `trusted` | `Function()` on main thread | Yes | None |
| 2 | `worker` | Web Worker | No | Thread |
| 3 | `sandbox` | Cross-origin iframe | No | Full origin |
| 4 | `csp-safe` | Blob URL + `import()` only | Yes* | No eval |

### 10.1 Worker RPC

Custom postMessage-based RPC (~50 lines), replacing Comlink dependency:

```typescript
createWorkerProxy<T>(worker: Worker): AsyncProxy<T>
```

Auto-generates async proxy from method calls → `postMessage` → result promise.

---

## 11. Error System

### 11.1 RuntimeError

```typescript
class RuntimeError extends Error {
  code: string;           // e.g. 'MODULE_NOT_FOUND'
  context?: string;       // e.g. file path
  suggestion?: string;    // e.g. "Run npm.install('lodash')"
}
```

### 11.2 Contextual Suggestions

| Error Pattern | Suggestion |
|--------------|------------|
| `Cannot find module 'x'` | `"Install with: runtime.npm.install('x')"` |
| `is not a function` | `"Check: default export vs named export"` |
| `Buffer is not defined` | `"Add: const { Buffer } = require('buffer')"` |
| `Cannot use import statement` | `"Rename file to .mjs or set type:module in package.json"` |

### 11.3 Source URL Injection

All executed code gets `//# sourceURL=vfs:///path/to/file.ext` appended for browser DevTools stack traces.

---

## 12. Bundle Size Budget

| Component | Target (gzipped) |
|-----------|-------------------|
| Kernel | < 5KB |
| + VFS Plugin | < 10KB |
| + Shims Plugin | < 25KB |
| + npm Plugin | < 30KB |
| + All Plugins | < 40KB |

---

## 13. Utilities

### 13.1 FNV-1a Hash

32-bit FNV-1a for transform cache keys. ~10 lines.

### 13.2 TextEncoder/Decoder Helpers

Convenience wrappers for UTF-8 encode/decode with type safety.

---

## 14. File Structure

```
src/
├── index.ts                    # createRuntime, createContainer
├── kernel.ts                   # Micro kernel
├── types.ts                    # All public types
├── errors.ts                   # RuntimeError
├── core/
│   ├── module-loader.ts        # Hybrid CJS + ESM
│   ├── module-resolver.ts      # Resolution algorithm
│   ├── module-cache.ts         # FNV-1a cache
│   ├── esm-to-cjs.ts          # Regex fallback
│   └── source-url.ts          # sourceURL injection
├── plugins/
│   ├── index.ts                # All exports
│   ├── core/
│   │   ├── vfs-plugin.ts
│   │   └── shims-plugin.ts
│   └── optional/
│       ├── npm-plugin.ts
│       ├── transform-plugin.ts
│       ├── server-bridge-plugin.ts
│       ├── worker-plugin.ts
│       ├── sandbox-plugin.ts
│       └── persistence-plugin.ts
├── vfs/
│   ├── virtual-fs.ts
│   ├── fs-node.ts
│   ├── path-utils.ts
│   ├── watcher.ts
│   ├── snapshot.ts
│   └── opfs-backend.ts
├── npm/
│   ├── package-manager.ts
│   ├── cdn-resolver.ts
│   ├── tarball.ts
│   ├── semver.ts
│   ├── dependency-resolver.ts
│   └── decompress.ts
├── shims/
│   ├── index.ts
│   ├── path.ts, buffer.ts, events.ts, ...
│   └── stubs.ts
├── server/
│   ├── server-bridge.ts
│   ├── virtual-http-server.ts
│   └── service-worker.ts
├── transform/
│   ├── pipeline.ts
│   ├── esbuild-loader.ts
│   ├── cache.ts
│   └── simple-esm-cjs.ts
├── security/
│   ├── worker-executor.ts
│   ├── sandbox-executor.ts
│   └── worker-rpc.ts
└── utils/
    ├── hash.ts
    └── encoding.ts
```
