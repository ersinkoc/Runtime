/**
 * All public type definitions for @oxog/runtime.
 * @module types
 */

// ─── Plugin System ───────────────────────────────────────────────

/**
 * A composable plugin that extends the runtime with new capabilities.
 *
 * @example
 * ```typescript
 * const myPlugin: RuntimePlugin = {
 *   name: 'my-plugin',
 *   version: '1.0.0',
 *   install(kernel) {
 *     kernel.on('beforeExecute', (code) => console.log('Executing...'));
 *   }
 * };
 * ```
 */
export interface RuntimePlugin {
  /** Unique plugin identifier (kebab-case) */
  readonly name: string;
  /** Semantic version */
  readonly version: string;
  /** Other plugin names this depends on */
  readonly dependencies?: readonly string[];
  /** Called when plugin is registered — set up hooks and services */
  install(kernel: RuntimeKernel): void;
  /** Called after all initial plugins are installed */
  onReady?(): void | Promise<void>;
  /** Called when plugin is unregistered — clean up resources */
  onDestroy?(): void | Promise<void>;
  /** Called when an error occurs in this plugin's scope */
  onError?(error: Error): void;
}

// ─── Kernel ──────────────────────────────────────────────────────

/**
 * The micro kernel — provides plugin registry, event bus, and core services.
 */
export interface RuntimeKernel {
  // Plugin lifecycle
  use(plugin: RuntimePlugin): void;
  unregister(name: string): void;
  getPlugin<T = RuntimePlugin>(name: string): T | undefined;
  listPlugins(): string[];

  // Event bus
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;

  // Core services (set by plugins)
  readonly vfs: VirtualFS;
  readonly config: RuntimeConfig;
}

/**
 * Runtime configuration.
 */
export interface RuntimeConfig {
  readonly cwd: string;
  readonly env: Record<string, string>;
  readonly mode: RuntimeMode;
}

export type RuntimeMode = 'trusted' | 'worker' | 'sandbox' | 'csp-safe';

// ─── Runtime ─────────────────────────────────────────────────────

/**
 * Options for creating a runtime.
 *
 * @example
 * ```typescript
 * const runtime = createRuntime({
 *   cwd: '/app',
 *   plugins: [vfsPlugin(), shimsPlugin()],
 * });
 * ```
 */
export interface RuntimeOptions {
  /** Working directory. Default: '/' */
  cwd?: string;
  /** Environment variables. Default: {} */
  env?: Record<string, string>;
  /** Plugins to load. Default: [] */
  plugins?: RuntimePlugin[];
  /** Security mode. Default: 'trusted' */
  mode?: RuntimeMode;
  /** Required when mode='sandbox' */
  sandboxUrl?: string;
  /** Callback for console output from executed code */
  onConsole?: (method: string, args: unknown[]) => void;
}

/**
 * Options for the convenience createContainer function.
 *
 * @example
 * ```typescript
 * const container = createContainer({ shimTier: 'minimal', cwd: '/app' });
 * ```
 */
export interface ContainerOptions extends Omit<RuntimeOptions, 'plugins'> {
  /** Enable OPFS persistence. Default: false */
  persistence?: boolean | 'opfs';
  /** Shim tier. Default: 'full' */
  shimTier?: 'full' | 'minimal';
  /** Enable OPFS npm cache. Default: false */
  npmCache?: boolean | 'opfs';
}

/**
 * The main runtime interface — execute Node.js code in the browser.
 *
 * @example
 * ```typescript
 * const runtime = createRuntime({ plugins: [vfsPlugin()] });
 * runtime.vfs.writeFileSync('/hello.js', 'module.exports = "world";');
 * const result = runtime.execute('module.exports = require("./hello");', '/index.js');
 * console.log(result.exports); // 'world'
 * ```
 */
export interface Runtime {
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

/**
 * Result of code execution.
 *
 * @example
 * ```typescript
 * const result = runtime.execute('module.exports = 42;');
 * console.log(result.exports); // 42
 * console.log(result.console); // captured console output
 * ```
 */
export interface ExecuteResult {
  /** The module.exports value */
  exports: unknown;
  /** Captured console output */
  console: ConsoleEntry[];
}

/**
 * A captured console call.
 */
export interface ConsoleEntry {
  method: 'log' | 'warn' | 'error' | 'info' | 'debug';
  args: unknown[];
  timestamp: number;
}

// ─── Virtual File System ─────────────────────────────────────────

/**
 * VFS tree node types.
 */
export interface FileNode {
  readonly kind: 'file';
  content: Uint8Array;
  meta: FSMetadata;
}

export interface DirNode {
  readonly kind: 'dir';
  children: Map<string, FSTreeNode>;
  meta: FSMetadata;
}

export interface SymlinkNode {
  readonly kind: 'symlink';
  target: string;
  meta: FSMetadata;
}

export type FSTreeNode = FileNode | DirNode | SymlinkNode;

/**
 * File system metadata.
 */
export interface FSMetadata {
  mode: number;
  size: number;
  atimeMs: number;
  mtimeMs: number;
  ctimeMs: number;
  birthtimeMs: number;
  ino: number;
}

/**
 * File system stats returned by statSync/lstatSync.
 */
export interface FSStats {
  readonly size: number;
  readonly mode: number;
  readonly atimeMs: number;
  readonly mtimeMs: number;
  readonly ctimeMs: number;
  readonly birthtimeMs: number;
  readonly ino: number;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}

/**
 * Directory entry returned by readdirSync with withFileTypes.
 */
export interface Dirent {
  readonly name: string;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}

/**
 * Watch options for VFS.
 */
export interface WatchOptions {
  recursive?: boolean;
}

/**
 * Watch listener callback.
 */
export type WatchListener = (event: 'change' | 'rename', filename: string) => void;

/**
 * File system watcher handle.
 */
export interface FSWatcher {
  close(): void;
}

/**
 * Virtual file system interface.
 *
 * @example
 * ```typescript
 * vfs.mkdirSync('/src', { recursive: true });
 * vfs.writeFileSync('/src/index.ts', 'export const x = 42;');
 * const content = vfs.readFileSync('/src/index.ts', 'utf8');
 * ```
 */
export interface VirtualFS {
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
  fromSnapshot?(snapshot: Uint8Array): void;
}

// ─── Package Manager ─────────────────────────────────────────────

/**
 * Browser-based npm client.
 *
 * @example
 * ```typescript
 * await runtime.npm.install('lodash');
 * runtime.execute("const _ = require('lodash'); console.log(_.capitalize('hello'));");
 * ```
 */
export interface PackageManager {
  /** Install one or more packages */
  install(packages: string | string[]): Promise<void>;
  /** List installed packages */
  list(): Array<{ name: string; version: string }>;
}

// ─── Plugin Options ──────────────────────────────────────────────

/**
 * VFS plugin options.
 */
export interface VFSPluginOptions {
  /** Enable OPFS persistence. Default: false */
  persistence?: boolean | 'opfs';
}

/**
 * Shims plugin options.
 */
export interface ShimsPluginOptions {
  /** Shim tier. Default: 'full' */
  tier?: 'full' | 'minimal' | 'custom';
  /** Include specific shims (when tier='custom') */
  include?: string[];
  /** Exclude specific shims */
  exclude?: string[];
}

/**
 * npm plugin options.
 */
export interface NpmPluginOptions {
  /** npm cache strategy. Default: 'memory' */
  cache?: 'memory' | 'opfs';
  /** Custom CDN URL order */
  cdns?: string[];
}

/**
 * Transform plugin options.
 */
export interface TransformPluginOptions {
  /** Transform engine. Default: 'esbuild' */
  engine?: 'esbuild' | 'simple';
  /** esbuild WASM CDN URL */
  esbuildWasmUrl?: string;
}

/**
 * Sandbox plugin options.
 */
export interface SandboxPluginOptions {
  /** URL of the cross-origin sandbox iframe */
  sandboxUrl: string;
}

/**
 * Persistence plugin options.
 */
export interface PersistencePluginOptions {
  /** Paths to persist. Default: all */
  paths?: string[];
  /** Debounce interval in ms. Default: 100 */
  debounceMs?: number;
}

// ─── Module Loader (internal, exported for plugin access) ────────

/**
 * Module loader interface exposed on the kernel for plugin hooks.
 */
export interface ModuleLoader {
  /** Synchronous CJS require */
  require(specifier: string, parentPath: string): unknown;
  /** Async ESM import */
  import(specifier: string, parentPath: string): Promise<unknown>;
  /** Register a built-in module (shim) */
  registerBuiltin(name: string, exports: unknown): void;
  /** Clear all module caches */
  clearCache(): void;
}
