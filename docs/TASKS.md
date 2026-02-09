# @oxog/runtime — Task List

> Tasks are ordered by dependency. Each task must be completed (with tests passing) before moving to the next.

---

## Phase 0: Project Setup

- [x] **T-000** Initialize project (package.json, .gitignore, LICENSE)
- [x] **T-001** Configure TypeScript (tsconfig.json)
- [x] **T-002** Configure Vitest (vitest.config.ts)
- [x] **T-003** Configure tsup (tsup.config.ts)
- [x] **T-004** Create src directory structure
- [x] **T-005** Create types.ts (all public type definitions)
- [x] **T-006** Create errors.ts (RuntimeError class)

## Phase 1: Kernel

- [x] **T-010** Implement event bus (on/off/emit)
- [x] **T-011** Implement plugin registry (use/unregister/get/list)
- [x] **T-012** Implement dependency validation + topological sort
- [x] **T-013** Implement kernel class (combines event bus + plugin registry)
- [x] **T-014** Write kernel tests (100% coverage)

## Phase 2: Utilities

- [x] **T-020** Implement FNV-1a hash (utils/hash.ts)
- [x] **T-021** Implement encoding helpers (utils/encoding.ts)
- [x] **T-022** Write utility tests

## Phase 3: VFS Core

- [x] **T-030** Implement FSNode types (fs-node.ts)
- [x] **T-031** Implement path utilities (path-utils.ts)
- [x] **T-032** Implement VirtualFS class — file CRUD
- [x] **T-033** Implement VirtualFS — directory operations
- [x] **T-034** Implement VirtualFS — symlink support
- [x] **T-035** Implement VirtualFS — metadata (stat, chmod, timestamps)
- [x] **T-036** Implement watcher (watch, event batching)
- [x] **T-037** Implement snapshot (serialize/deserialize)
- [x] **T-038** Implement vfsPlugin (wraps VirtualFS as plugin)
- [x] **T-039** Write VFS tests (100% coverage)

## Phase 4: Module System

- [x] **T-040** Implement module cache (module-cache.ts)
- [x] **T-041** Implement source URL injection (source-url.ts)
- [x] **T-042** Implement ESM-to-CJS regex converter (esm-to-cjs.ts)
- [x] **T-043** Implement module resolver (module-resolver.ts)
- [x] **T-044** Implement package.json "exports" resolver
- [x] **T-045** Implement CJS loader (Function() wrapper)
- [x] **T-046** Implement ESM loader (Blob URL + import())
- [x] **T-047** Implement module loader integration (module-loader.ts)
- [x] **T-048** Write module system tests (100% coverage)

## Phase 5: Core Shims (Foundation)

- [x] **T-050** Implement path shim
- [x] **T-051** Implement buffer shim
- [x] **T-052** Implement events shim (EventEmitter)
- [x] **T-053** Implement process shim
- [x] **T-054** Implement util shim
- [x] **T-055** Implement os shim
- [x] **T-056** Implement timers shim
- [x] **T-057** Implement console shim
- [x] **T-058** Implement string_decoder shim
- [x] **T-059** Write core shims tests

## Phase 6: Remaining Tier 1 Shims

- [x] **T-060** Implement stream shim (Readable, Writable, Duplex, Transform, PassThrough)
- [x] **T-061** Implement fs shim (delegates to VFS)
- [x] **T-062** Implement url shim
- [x] **T-063** Implement querystring shim
- [x] **T-064** Implement crypto shim
- [x] **T-065** Implement http shim (client: fetch wrapper)
- [x] **T-066** Implement https shim
- [x] **T-067** Implement zlib shim
- [x] **T-068** Implement assert shim
- [x] **T-069** Implement tty shim
- [x] **T-070** Implement perf_hooks shim
- [x] **T-071** Implement shimsPlugin (registry + configuration)
- [x] **T-072** Write Tier 1 shims tests

## Phase 7: Tier 2 + 3 Shims

- [x] **T-080** Implement net shim (virtual sockets)
- [x] **T-081** Implement child_process shim (Worker-based)
- [x] **T-082** Implement worker_threads shim
- [x] **T-083** Implement all Tier 3 stubs (stubs.ts)
- [x] **T-084** Write Tier 2 + 3 tests

## Phase 8: Runtime Integration

- [x] **T-090** Implement createRuntime (index.ts)
- [x] **T-091** Implement createContainer (index.ts)
- [x] **T-092** Implement Runtime.execute()
- [x] **T-093** Implement Runtime.runFile()
- [x] **T-094** Implement Runtime.require() / Runtime.import()
- [x] **T-095** Write runtime integration tests

## Phase 9: npm Plugin

- [x] **T-100** Implement gzip decompress (decompress.ts)
- [x] **T-101** Implement tar parser (tarball.ts)
- [x] **T-102** Implement semver parser + matcher (semver.ts)
- [x] **T-103** Implement CDN resolver (cdn-resolver.ts)
- [x] **T-104** Implement dependency resolver (dependency-resolver.ts)
- [x] **T-105** Implement package manager (package-manager.ts)
- [x] **T-106** Implement npmPlugin
- [x] **T-107** Write npm plugin tests

## Phase 10: Transform Plugin

- [x] **T-110** Implement simple ESM→CJS regex (simple-esm-cjs.ts)
- [x] **T-111** Implement FNV-1a transform cache (cache.ts)
- [x] **T-112** Implement esbuild lazy loader (esbuild-loader.ts)
- [x] **T-113** Implement transform pipeline (pipeline.ts)
- [x] **T-114** Implement transformPlugin
- [x] **T-115** Write transform plugin tests

## Phase 11: Server Bridge Plugin

- [x] **T-120** Implement virtual HTTP server (virtual-http-server.ts)
- [x] **T-121** Implement server bridge (server-bridge.ts)
- [x] **T-122** Implement service worker script generator (service-worker.ts)
- [x] **T-123** Implement serverBridgePlugin
- [x] **T-124** Write server bridge tests

## Phase 12: Security Plugins

- [x] **T-130** Implement worker RPC (worker-rpc.ts)
- [x] **T-131** Implement worker executor (worker-executor.ts)
- [x] **T-132** Implement sandbox executor (sandbox-executor.ts)
- [x] **T-133** Implement workerPlugin
- [x] **T-134** Implement sandboxPlugin
- [x] **T-135** Write security plugin tests

## Phase 13: Persistence Plugin

- [x] **T-140** Implement OPFS backend (opfs-backend.ts)
- [x] **T-141** Implement persistencePlugin
- [x] **T-142** Write persistence plugin tests

## Phase 14: Documentation & Examples

- [x] **T-150** Create README.md
- [x] **T-151** Create CHANGELOG.md
- [x] **T-152** Create llms.txt
- [x] **T-153** Create examples/01-basic/
- [x] **T-154** Create examples/02-plugins/
- [x] **T-155** Create examples/03-npm/
- [x] **T-156** Create examples/04-typescript/
- [x] **T-157** Create examples/05-http-server/
- [x] **T-158** Create examples/06-real-world/
- [x] **T-159** Add JSDoc @example to all public APIs

## Phase 15: Final Verification

- [x] **T-160** Run full test suite — 748 tests across 45 files ✓
- [x] **T-161** Run build — ~149 KB ESM, ~150 KB CJS ✓
- [x] **T-162** Run typecheck — zero errors ✓
- [x] **T-163** Verify zero runtime dependencies ✓
- [x] **T-164** Manual smoke test with real use cases — 15 scenarios ✓
