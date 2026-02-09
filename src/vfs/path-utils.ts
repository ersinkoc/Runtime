/**
 * POSIX path utilities for the virtual filesystem.
 * @module vfs/path-utils
 */

/**
 * Normalize a path to POSIX format.
 * - Converts backslashes to forward slashes
 * - Resolves `.` and `..` segments
 * - Collapses multiple slashes
 * - Ensures leading `/`
 * - Removes trailing `/` (except root)
 *
 * @example
 * ```typescript
 * normalizePath('/foo/../bar/./baz//qux'); // '/bar/baz/qux'
 * normalizePath('relative/path'); // '/relative/path'
 * ```
 */
export function normalizePath(path: string): string {
  // Convert backslashes
  let p = path.replace(/\\/g, '/');

  // Ensure leading slash
  if (!p.startsWith('/')) {
    p = '/' + p;
  }

  const parts = p.split('/');
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === '' || part === '.') {
      continue;
    }
    if (part === '..') {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }

  const result = '/' + resolved.join('/');
  return result;
}

/**
 * Get the directory name of a path.
 *
 * @example
 * ```typescript
 * dirname('/foo/bar/baz.txt'); // '/foo/bar'
 * dirname('/foo'); // '/'
 * ```
 */
export function dirname(path: string): string {
  const normalized = normalizePath(path);
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash <= 0) return '/';
  return normalized.slice(0, lastSlash);
}

/**
 * Get the base name of a path.
 *
 * @example
 * ```typescript
 * basename('/foo/bar/baz.txt'); // 'baz.txt'
 * basename('/foo/bar/baz.txt', '.txt'); // 'baz'
 * ```
 */
export function basename(path: string, ext?: string): string {
  const normalized = normalizePath(path);
  const lastSlash = normalized.lastIndexOf('/');
  const base = normalized.slice(lastSlash + 1);
  if (ext && base.endsWith(ext)) {
    return base.slice(0, -ext.length);
  }
  return base;
}

/**
 * Join path segments.
 *
 * @example
 * ```typescript
 * joinPath('/foo', 'bar', 'baz'); // '/foo/bar/baz'
 * ```
 */
export function joinPath(...segments: string[]): string {
  return normalizePath(segments.join('/'));
}

/**
 * Split a path into its parent directory and name components.
 *
 * @example
 * ```typescript
 * splitPath('/foo/bar/baz'); // { parent: '/foo/bar', name: 'baz' }
 * splitPath('/foo'); // { parent: '/', name: 'foo' }
 * ```
 */
export function splitPath(path: string): { parent: string; name: string } {
  const normalized = normalizePath(path);
  if (normalized === '/') {
    return { parent: '/', name: '' };
  }
  return { parent: dirname(normalized), name: basename(normalized) };
}

/**
 * Check if a path is absolute.
 *
 * @example
 * ```typescript
 * isAbsolute('/foo/bar'); // true
 * isAbsolute('relative'); // false
 * ```
 */
export function isAbsolute(path: string): boolean {
  return path.startsWith('/') || path.startsWith('\\');
}

/**
 * Resolve a path relative to a base directory.
 *
 * @example
 * ```typescript
 * resolvePath('/app/src', '../lib/utils'); // '/app/lib/utils'
 * resolvePath('/app', '/absolute'); // '/absolute'
 * ```
 */
export function resolvePath(base: string, relative: string): string {
  if (isAbsolute(relative)) {
    return normalizePath(relative);
  }
  return normalizePath(base + '/' + relative);
}
