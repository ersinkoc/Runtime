/**
 * Module resolution algorithm — Node.js compatible.
 * @module core/module-resolver
 */

import type { VirtualFS } from '../types.js';
import { RuntimeError } from '../errors.js';
import { normalizePath, dirname, joinPath } from '../vfs/path-utils.js';

/**
 * File extensions to try when resolving modules.
 */
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.mjs', '.cjs'];

/**
 * Index files to try when resolving directories.
 */
const INDEX_FILES = ['index.ts', 'index.tsx', 'index.js', 'index.jsx', 'index.mjs', 'index.cjs'];

/**
 * Resolution cache — avoids redundant VFS lookups for repeated resolutions.
 * Key format: `${specifier}\0${parentPath}`
 */
const resolutionCache = new Map<string, string>();

/**
 * Clear the resolution cache. Called when VFS state may have changed.
 */
export function clearResolutionCache(): void {
  resolutionCache.clear();
}

/**
 * Resolve a module specifier to an absolute VFS path.
 *
 * @example
 * ```typescript
 * const path = resolveModule('./utils', '/app/src/index.js', vfs, builtins);
 * // '/app/src/utils.ts'
 * ```
 */
export function resolveModule(
  specifier: string,
  parentPath: string,
  vfs: VirtualFS,
  builtins: Set<string>,
): string {
  // 1. Built-in modules (no caching needed — instant lookup)
  if (builtins.has(specifier)) {
    return `__builtin__:${specifier}`;
  }

  // Strip node: prefix
  if (specifier.startsWith('node:')) {
    const name = specifier.slice(5);
    if (builtins.has(name)) {
      return `__builtin__:${name}`;
    }
  }

  // 2. Check resolution cache
  const cacheKey = specifier + '\0' + parentPath;
  const cached = resolutionCache.get(cacheKey);
  if (cached) return cached;

  // 3. Relative or absolute paths
  if (specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/')) {
    const base = specifier.startsWith('/') ? specifier : joinPath(dirname(parentPath), specifier);
    const resolved = tryResolveFile(normalizePath(base), vfs);
    if (resolved) {
      resolutionCache.set(cacheKey, resolved);
      return resolved;
    }

    throw new RuntimeError(
      `Cannot find module '${specifier}' from '${parentPath}'`,
      'MODULE_NOT_FOUND',
      parentPath,
    );
  }

  // 4. Bare specifier — node_modules traversal
  const resolved = resolveFromNodeModules(specifier, parentPath, vfs);
  resolutionCache.set(cacheKey, resolved);
  return resolved;
}

/**
 * Try to resolve a file path, trying extensions and index files.
 */
function tryResolveFile(path: string, vfs: VirtualFS): string | null {
  // Exact match
  if (vfs.existsSync(path)) {
    const stat = vfs.statSync(path);
    if (stat.isFile()) return path;
    if (stat.isDirectory()) {
      // Try index files
      return tryIndexFile(path, vfs);
    }
  }

  // Try with extensions
  for (const ext of EXTENSIONS) {
    const withExt = path + ext;
    if (vfs.existsSync(withExt) && vfs.statSync(withExt).isFile()) {
      return withExt;
    }
  }

  // Try as directory with index
  return tryIndexFile(path, vfs);
}

/**
 * Try to find an index file in a directory.
 */
function tryIndexFile(dirPath: string, vfs: VirtualFS): string | null {
  for (const indexFile of INDEX_FILES) {
    const indexPath = joinPath(dirPath, indexFile);
    if (vfs.existsSync(indexPath) && vfs.statSync(indexPath).isFile()) {
      return indexPath;
    }
  }
  return null;
}

/**
 * Resolve a bare specifier by walking up node_modules directories.
 */
function resolveFromNodeModules(specifier: string, parentPath: string, vfs: VirtualFS): string {
  // Handle scoped packages and subpath imports
  let packageName: string;
  let subpath: string;

  if (specifier.startsWith('@')) {
    // @scope/package or @scope/package/sub
    const parts = specifier.split('/');
    packageName = parts.slice(0, 2).join('/');
    subpath = parts.length > 2 ? './' + parts.slice(2).join('/') : '.';
  } else {
    const slashIdx = specifier.indexOf('/');
    if (slashIdx === -1) {
      packageName = specifier;
      subpath = '.';
    } else {
      packageName = specifier.slice(0, slashIdx);
      subpath = './' + specifier.slice(slashIdx + 1);
    }
  }

  // Walk up from parent directory
  let current = dirname(parentPath);
  while (true) {
    const nodeModulesDir = joinPath(current, 'node_modules', packageName);

    if (vfs.existsSync(nodeModulesDir)) {
      const resolved = resolvePackage(nodeModulesDir, subpath, vfs);
      if (resolved) return resolved;
    }

    if (current === '/') break;
    current = dirname(current);
  }

  throw new RuntimeError(
    `Cannot find module '${specifier}' from '${parentPath}'`,
    'MODULE_NOT_FOUND',
    parentPath,
  );
}

/**
 * Resolve a package directory — check exports, main, index.
 */
function resolvePackage(packageDir: string, subpath: string, vfs: VirtualFS): string | null {
  const pkgJsonPath = joinPath(packageDir, 'package.json');

  if (vfs.existsSync(pkgJsonPath)) {
    try {
      const pkgJsonStr = vfs.readFileSync(pkgJsonPath, 'utf8') as string;
      const pkgJson = JSON.parse(pkgJsonStr);

      // 1. Check "exports" field
      if (pkgJson.exports) {
        const resolved = resolveExports(pkgJson.exports, subpath, ['browser', 'import', 'require', 'default']);
        if (resolved) {
          const fullPath = joinPath(packageDir, resolved);
          if (vfs.existsSync(fullPath) && vfs.statSync(fullPath).isFile()) {
            return fullPath;
          }
        }
      }

      // 2. Check "main" field (only for root subpath)
      if (subpath === '.' && pkgJson.main) {
        const mainPath = joinPath(packageDir, pkgJson.main);
        const resolved = tryResolveFile(mainPath, vfs);
        if (resolved) return resolved;
      }

      // 3. Check "module" field (ESM entry)
      if (subpath === '.' && pkgJson.module) {
        const modulePath = joinPath(packageDir, pkgJson.module);
        const resolved = tryResolveFile(modulePath, vfs);
        if (resolved) return resolved;
      }
    } catch {
      // Invalid package.json — continue to fallback
    }
  }

  // 4. Fallback: try file resolution
  if (subpath === '.') {
    return tryResolveFile(packageDir, vfs);
  }
  const subpathFull = joinPath(packageDir, subpath.slice(2)); // remove './'
  return tryResolveFile(subpathFull, vfs);
}

/**
 * Resolve package.json "exports" field.
 * Implements the Node.js conditional exports algorithm from scratch.
 *
 * @example
 * ```typescript
 * resolveExports({ ".": { "import": "./index.mjs", "require": "./index.cjs" } }, '.', ['require']);
 * // './index.cjs'
 * ```
 */
export function resolveExports(
  exports: unknown,
  subpath: string,
  conditions: string[],
): string | null {
  if (typeof exports === 'string') {
    return subpath === '.' ? exports : null;
  }

  if (Array.isArray(exports)) {
    for (const item of exports) {
      const resolved = resolveExports(item, subpath, conditions);
      if (resolved) return resolved;
    }
    return null;
  }

  if (typeof exports === 'object' && exports !== null) {
    const exportsObj = exports as Record<string, unknown>;

    // Check if this is a conditions object (keys don't start with '.')
    const keys = Object.keys(exportsObj);
    const isConditionsMap = keys.length > 0 && !keys[0]!.startsWith('.');

    if (isConditionsMap) {
      // Conditions map: { "import": "...", "require": "...", "default": "..." }
      if (subpath !== '.') return null;

      for (const condition of conditions) {
        if (condition in exportsObj) {
          const value = exportsObj[condition];
          if (typeof value === 'string') return value;
          const resolved = resolveExports(value, '.', conditions);
          if (resolved) return resolved;
        }
      }
      return null;
    }

    // Subpath map: { ".": "...", "./utils": "..." }
    if (subpath in exportsObj) {
      const value = exportsObj[subpath];
      if (typeof value === 'string') return value;
      return resolveExports(value, '.', conditions);
    }

    // Pattern matching: { "./*": "./src/*.js" }
    for (const [pattern, value] of Object.entries(exportsObj)) {
      if (pattern.includes('*')) {
        const [prefix, suffix] = pattern.split('*');
        if (prefix && subpath.startsWith(prefix) && (!suffix || subpath.endsWith(suffix))) {
          const match = suffix
            ? subpath.slice(prefix.length, -suffix.length)
            : subpath.slice(prefix.length);
          if (typeof value === 'string') {
            return value.replace('*', match);
          }
        }
      }
    }

    return null;
  }

  return null;
}

/**
 * Detect the module format of a file.
 *
 * @example
 * ```typescript
 * getModuleFormat('/app.mjs', vfs); // 'esm'
 * getModuleFormat('/app.js', vfs);  // 'cjs' (default)
 * ```
 */
export function getModuleFormat(filePath: string, vfs: VirtualFS): 'cjs' | 'esm' {
  if (filePath.endsWith('.mjs') || filePath.endsWith('.mts')) return 'esm';
  if (filePath.endsWith('.cjs') || filePath.endsWith('.cts')) return 'cjs';

  // Check nearest package.json for "type" field
  let current = dirname(filePath);
  while (true) {
    const pkgPath = joinPath(current, 'package.json');
    if (vfs.existsSync(pkgPath)) {
      try {
        const content = vfs.readFileSync(pkgPath, 'utf8') as string;
        const pkg = JSON.parse(content);
        if (pkg.type === 'module') return 'esm';
        return 'cjs';
      } catch {
        return 'cjs';
      }
    }
    if (current === '/') break;
    current = dirname(current);
  }

  return 'cjs';
}
