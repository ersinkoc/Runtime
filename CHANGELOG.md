# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-02-08

### Added
- **Micro-kernel** with plugin registry, event bus, and topological plugin sorting
- **Virtual File System (VFS)** — tree-based POSIX file system with symlinks, watchers, binary snapshots
- **Hybrid Module Loader** — CJS `require()` + ESM `import()` with full node_modules resolution and package.json exports support
- **40+ Node.js API shims**:
  - Tier 1 (full): path, buffer, events, fs, stream, http/https, url, crypto, util, os, process, querystring, zlib, assert, string_decoder, timers, console, tty, perf_hooks
  - Tier 2 (partial): net, child_process, worker_threads
  - Tier 3 (stubs): 17 additional modules
- **npm Plugin** — browser-based package manager with multi-CDN resolution, zero-dep tar parser, semver resolver
- **Transform Plugin** — TypeScript/JSX compilation with FNV-1a cached transforms
- **Server Bridge Plugin** — virtual HTTP server for in-process request handling
- **Security Plugin** — 4 execution modes (unrestricted, worker, sandbox, locked)
- **Persistence Plugin** — OPFS-backed VFS state persistence
- **Runtime API** — `createRuntime()` and `createContainer()` factory functions
- **Pure-JS crypto** — MD5, SHA-1, SHA-256 hash implementations + HMAC
- **Zero runtime dependencies** — everything from scratch
- **1267 tests** across 52 test files — 100% coverage (statements, branches, functions, lines)
