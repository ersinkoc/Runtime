/**
 * Node.js `path` module shim — POSIX only.
 * @module shims/path
 */

const CHAR_FORWARD_SLASH = 47; // '/'
const CHAR_DOT = 46; // '.'

function assertPath(path: unknown): asserts path is string {
  if (typeof path !== 'string') {
    throw new TypeError(`Path must be a string. Received ${typeof path}`);
  }
}

export const sep = '/';
export const delimiter = ':';

export function normalize(path: string): string {
  assertPath(path);
  if (path.length === 0) return '.';

  const isAbsoluteVal = path.charCodeAt(0) === CHAR_FORWARD_SLASH;
  const trailingSlash = path.charCodeAt(path.length - 1) === CHAR_FORWARD_SLASH;

  const parts = path.split('/');
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (resolved.length > 0 && resolved[resolved.length - 1] !== '..') {
        resolved.pop();
      } else if (!isAbsoluteVal) {
        resolved.push('..');
      }
    } else {
      resolved.push(part);
    }
  }

  let result = resolved.join('/');
  if (isAbsoluteVal) result = '/' + result;
  if (trailingSlash && result.length > 0 && !result.endsWith('/')) result += '/';
  if (!result) return '.';

  return result;
}

export function join(...paths: string[]): string {
  if (paths.length === 0) return '.';
  let joined = '';
  for (const path of paths) {
    assertPath(path);
    if (path.length > 0) {
      if (joined.length === 0) {
        joined = path;
      } else {
        joined += '/' + path;
      }
    }
  }
  if (joined.length === 0) return '.';
  return normalize(joined);
}

export function resolve(...paths: string[]): string {
  let resolvedPath = '';
  let resolvedAbsolute = false;

  for (let i = paths.length - 1; i >= 0 && !resolvedAbsolute; i--) {
    const path = paths[i]!;
    assertPath(path);
    if (path.length === 0) continue;
    resolvedPath = resolvedPath ? path + '/' + resolvedPath : path;
    resolvedAbsolute = path.charCodeAt(0) === CHAR_FORWARD_SLASH;
  }

  if (!resolvedAbsolute) {
    resolvedPath = '/' + resolvedPath;
  }

  return normalize(resolvedPath);
}

export function isAbsolute(path: string): boolean {
  assertPath(path);
  return path.length > 0 && path.charCodeAt(0) === CHAR_FORWARD_SLASH;
}

export function dirname(path: string): string {
  assertPath(path);
  if (path.length === 0) return '.';

  const hasRoot = path.charCodeAt(0) === CHAR_FORWARD_SLASH;
  let end = -1;
  let matchedSlash = true;

  for (let i = path.length - 1; i >= 1; --i) {
    if (path.charCodeAt(i) === CHAR_FORWARD_SLASH) {
      if (!matchedSlash) {
        end = i;
        break;
      }
    } else {
      matchedSlash = false;
    }
  }

  if (end === -1) return hasRoot ? '/' : '.';
  if (hasRoot && end === 1) return '//';
  return path.slice(0, end);
}

export function basename(path: string, ext?: string): string {
  assertPath(path);
  let start = 0;
  let end = path.length;
  let matchedSlash = true;

  for (let i = path.length - 1; i >= 0; --i) {
    if (path.charCodeAt(i) === CHAR_FORWARD_SLASH) {
      if (!matchedSlash) {
        start = i + 1;
        break;
      }
    } else {
      matchedSlash = false;
    }
  }

  const base = path.slice(start, end);
  if (ext && base.endsWith(ext)) {
    return base.slice(0, base.length - ext.length);
  }
  return base;
}

export function extname(path: string): string {
  assertPath(path);
  let startDot = -1;
  let startPart = 0;
  let end = -1;
  let matchedSlash = true;
  let preDotState = 0;

  for (let i = path.length - 1; i >= 0; --i) {
    const code = path.charCodeAt(i);
    if (code === CHAR_FORWARD_SLASH) {
      if (!matchedSlash) {
        startPart = i + 1;
        break;
      }
      continue;
    }
    if (end === -1) {
      matchedSlash = false;
      end = i + 1;
    }
    if (code === CHAR_DOT) {
      if (startDot === -1) {
        startDot = i;
      } else if (preDotState !== 1) {
        preDotState = 1;
      }
    } else if (startDot !== -1) {
      preDotState = -1;
    }
  }

  if (
    startDot === -1 ||
    end === -1 ||
    preDotState === 0 ||
    (preDotState === 1 && startDot === end - 1 && startDot === startPart + 1)
  ) {
    return '';
  }
  return path.slice(startDot, end);
}

export function parse(path: string): { root: string; dir: string; base: string; ext: string; name: string } {
  assertPath(path);
  const root = isAbsolute(path) ? '/' : '';
  const dir = dirname(path);
  const base = basename(path);
  const ext = extname(path);
  const name = ext ? base.slice(0, base.length - ext.length) : base;
  return { root, dir, base, ext, name };
}

export function format(pathObj: { root?: string; dir?: string; base?: string; ext?: string; name?: string }): string {
  const dir = pathObj.dir || pathObj.root || '';
  const base = pathObj.base || ((pathObj.name || '') + (pathObj.ext || ''));
  if (!dir) return base;
  return dir === pathObj.root ? dir + base : dir + '/' + base;
}

export function relative(from: string, to: string): string {
  assertPath(from);
  assertPath(to);

  if (from === to) return '';

  const fromResolved = resolve(from);
  const toResolved = resolve(to);

  if (fromResolved === toResolved) return '';

  const fromParts = fromResolved.split('/').filter(Boolean);
  const toParts = toResolved.split('/').filter(Boolean);

  // Find common prefix
  let commonLength = 0;
  const minLength = Math.min(fromParts.length, toParts.length);
  for (let i = 0; i < minLength; i++) {
    if (fromParts[i] !== toParts[i]) break;
    commonLength++;
  }

  const ups = fromParts.length - commonLength;
  const remaining = toParts.slice(commonLength);

  const parts: string[] = [];
  for (let i = 0; i < ups; i++) parts.push('..');
  parts.push(...remaining);

  return parts.join('/');
}

export const posix = {
  sep, delimiter, normalize, join, resolve, isAbsolute,
  dirname, basename, extname, parse, format, relative,
};

const pathModule = {
  sep, delimiter, normalize, join, resolve, isAbsolute,
  dirname, basename, extname, parse, format, relative, posix,
};

export default pathModule;
