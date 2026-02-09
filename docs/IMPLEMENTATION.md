# @oxog/runtime — Implementation Decisions

## 1. Architecture Decision Records

### ADR-001: Micro-Kernel vs Monolithic

**Decision:** Micro-kernel with plugin architecture.

**Rationale:**
- Users who only need VFS shouldn't pay for npm, transforms, HTTP server
- Tree-shaking at the plugin level — unused plugins are never imported
- Extensible — third-party plugins possible
- Each plugin testable in isolation

**Trade-off:** Slightly more boilerplate for plugin authors. Mitigated by clear `RuntimePlugin` interface.

### ADR-002: CJS via Function() Constructor

**Decision:** Use `new Function('exports', 'require', 'module', '__filename', '__dirname', code)` for CJS.

**Rationale:**
- `require()` must be synchronous — this is the only way in browsers
- Same approach as almostnode, Webpack, and other bundlers
- Allows full CJS semantics (module.exports, exports.x, circular deps)

**Trade-off:** Requires `unsafe-eval` CSP. Mitigated by `csp-safe` mode using Blob URL + import().

### ADR-003: ESM via Blob URL + import()

**Decision:** For ESM files, create a Blob URL and use native `import()`.

**Rationale:**
- Native ESM semantics (top-level await, live bindings)
- No need to implement ESM spec in userland
- Browser handles module graph

**Trade-off:** Async only. Import specifiers must be rewritten to Blob URLs.

### ADR-004: Tree-based VFS (not flat Map)

**Decision:** Tree structure with FileNode/DirNode/SymlinkNode.

**Rationale (from almostnode analysis):**
- O(1) readdir (flat Map requires O(n) prefix scan)
- Natural directory traversal
- Symlink resolution by node type
- Snapshot/restore preserves structure

### ADR-005: OPFS over IndexedDB for Persistence

**Decision:** Use Origin Private File System (OPFS) for persistence.

**Rationale:**
- 10-100x faster than IndexedDB for file operations
- Sync access via `FileSystemSyncAccessHandle` in Workers
- Native filesystem semantics (directories, files)
- Better fit for VFS persistence model

**Trade-off:** Slightly newer API (Safari 16.4+). Acceptable given our browser targets.

### ADR-006: Native DecompressionStream over pako

**Decision:** Use `DecompressionStream('gzip')` for gzip decompression.

**Rationale:**
- Zero bundle size impact (browser-native)
- Performance: native C++ vs JS implementation
- Streaming support built-in

**Trade-off:** No Brotli support (browser `DecompressionStream` doesn't support it). Acceptable — gzip is sufficient for npm tarballs.

### ADR-007: FNV-1a for Transform Cache

**Decision:** Use FNV-1a hash (32-bit) for cache keys.

**Rationale:**
- ~10 lines of code, zero dependencies
- Fast: single pass, simple math
- Good distribution for our use case (source code strings)
- Not cryptographic — only used for cache invalidation

### ADR-008: Custom Tar Parser

**Decision:** Implement tar parser from scratch (~100 lines).

**Rationale:**
- USTAR format is simple: 512-byte headers + data blocks
- We only need read (extract), not create
- Eliminates tar-stream dependency

### ADR-009: Custom Semver Resolver

**Decision:** Implement semver resolution from scratch (~150 lines).

**Rationale:**
- We need: `satisfies()`, `maxSatisfying()`, comparison operators
- Range syntax is well-specified: `^`, `~`, `>=`, `x`, `*`, `-`
- Eliminates semver package dependency

### ADR-010: Lazy esbuild-wasm Loading

**Decision:** Load esbuild-wasm from CDN on first use, not at startup.

**Rationale:**
- esbuild.wasm is ~8MB — loading at startup is unacceptable
- Many use cases don't need transforms (pure JS projects)
- CDN caching makes subsequent loads instant
- Singleton pattern: initialize once, reuse forever

**Trade-off:** First transform has latency. Mitigated by sync regex fallback for simple cases.

### ADR-011: Event Bus for Plugin Communication

**Decision:** Simple event emitter built into kernel for inter-plugin communication.

**Rationale:**
- Plugins need to hook into lifecycle events (beforeExecute, fileChange, etc.)
- Decoupled communication — plugins don't reference each other directly
- Transform plugin hooks into `beforeExecute` to transform TS/JSX
- NPM plugin hooks into `moduleResolve` for auto-install

### ADR-012: Worker RPC over Comlink

**Decision:** Custom postMessage RPC (~50 lines) instead of Comlink.

**Rationale:**
- Comlink is only ~4KB but adds a dependency
- Our RPC needs are simple: method call → result/error
- Proxy-based approach is elegant and type-safe
- Full control over serialization

---

## 2. Module System Design

### Format Detection Priority

```
1. File extension (.mjs → ESM, .cjs → CJS)
2. Nearest package.json "type" field
3. Default: CJS
```

### Circular Dependency Handling

CJS circular deps work because we cache the module object BEFORE execution:

```
A requires B → B's module cached (empty exports) → B requires A → A found in cache (partial exports) → B finishes → A finishes
```

This matches Node.js behavior exactly.

### Transform Pipeline Integration

```
require('app.ts')
  → Module Loader calls kernel.emit('beforeExecute', code, 'app.ts')
  → Transform Plugin intercepts:
    - Check transform cache (FNV-1a hash)
    - If cached: return cached code
    - If not: esbuild.transform() or regex fallback
  → Transformed code returned to Module Loader
  → Module Loader executes transformed code
```

---

## 3. Error Handling Strategy

### Error Categories

| Code | Category | Example |
|------|----------|---------|
| `MODULE_NOT_FOUND` | Resolution | `require('nonexistent')` |
| `PARSE_ERROR` | Syntax | Invalid JS/TS |
| `TYPE_ERROR` | Runtime | Calling non-function |
| `FS_ERROR` | VFS | File not found, permission denied |
| `PLUGIN_ERROR` | Plugin | Missing dependency, install failure |
| `NETWORK_ERROR` | npm | CDN unreachable |
| `TRANSFORM_ERROR` | Transform | esbuild compilation error |

### Error Enhancement

Every error from user code gets:
1. `RuntimeError` wrapper with `code` field
2. `context` — file path, plugin name
3. `suggestion` — actionable fix message
4. `//# sourceURL` for stack trace mapping

---

## 4. Performance Considerations

### Module Cache

- CJS modules cached by resolved absolute path
- Cache shared across all `require()` calls in same runtime
- `clearCache()` invalidates all — used for HMR

### Transform Cache

- Keyed by `path:format` (CJS and ESM transforms differ)
- FNV-1a hash of source content
- Cache hit = zero CPU cost
- Persistent across runs if OPFS persistence enabled

### VFS Watch Batching

- File changes queued in microtask
- Batch all changes within single microtask into one event
- Prevents event storms during bulk writes (e.g., npm install writing hundreds of files)

### npm Install Optimization

1. OPFS cache check first (zero network)
2. esm.sh preference (pre-bundled, fewer requests)
3. Parallel dependency fetching
4. Stream-based tarball extraction

---

## 5. Testing Strategy

### Environment

- **Vitest** with `happy-dom` environment
- Provides browser APIs: `URL`, `Blob`, `TextEncoder`, `crypto`, etc.
- Mock Service Worker, OPFS, Web Workers where needed

### Test Organization

```
tests/
├── unit/           # Individual modules in isolation
├── integration/    # Multi-module interactions
└── fixtures/       # Test data (sample packages, files)
```

### Coverage

- Target: 100% lines, branches, functions, statements
- Enforced via vitest coverage thresholds
- Every public API method has explicit tests
- Edge cases: empty strings, unicode, large files, circular deps

### Mocking Strategy

| Browser API | Mock Approach |
|-------------|---------------|
| `DecompressionStream` | Custom class returning decompressed data |
| `crypto.subtle` | Simple hash implementations |
| `OPFS` | In-memory FileSystemDirectoryHandle mock |
| `Service Worker` | Event-based mock |
| `Web Worker` | Inline function execution mock |
| `fetch` | MSW-style handler or simple mock |
| `import()` | Module mock |
| `URL.createObjectURL` | Pass-through mock |

---

## 6. Build Configuration

### tsup

- Dual output: ESM (`index.js`) + CJS (`index.cjs`)
- Two entry points: `src/index.ts` and `src/plugins/index.ts`
- Tree-shaking enabled
- Source maps enabled
- Target: ES2022 (browser)

### TypeScript

- Strict mode with all additional checks
- `noUncheckedIndexedAccess` — safe Map/Array access
- `moduleResolution: bundler` — modern resolution
- `lib: ["ES2022", "DOM", "DOM.Iterable", "WebWorker"]`

---

## 7. Browser API Usage Map

| Our Feature | Browser API |
|-------------|-------------|
| Gzip decompression | `DecompressionStream` |
| Gzip compression | `CompressionStream` |
| Crypto hashing | `crypto.subtle.digest()` |
| Random bytes | `crypto.getRandomValues()` |
| UUID generation | `crypto.randomUUID()` |
| File persistence | OPFS (`navigator.storage.getDirectory()`) |
| ESM loading | `Blob` + `URL.createObjectURL` + `import()` |
| HTTP server | Service Worker fetch event |
| Worker isolation | `Web Worker` |
| Sandbox isolation | Cross-origin `<iframe>` |
| Text encoding | `TextEncoder` / `TextDecoder` |
| Performance timing | `performance.now()` |
| Microtasks | `queueMicrotask()` |
| URL parsing | `URL` / `URLSearchParams` |

---

## 8. Version Strategy

- Start at `1.0.0` — production-ready from day one
- Semver: breaking changes = major, features = minor, fixes = patch
- Changelog maintained manually per release
