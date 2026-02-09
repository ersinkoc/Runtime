/**
 * Hybrid CJS + ESM module loader.
 * CJS via Function() constructor, ESM via Blob URL + import().
 * @module core/module-loader
 */

import type { VirtualFS, ModuleLoader as IModuleLoader, RuntimeKernel, ConsoleEntry } from '../types.js';
import { RuntimeError, createError } from '../errors.js';
import { ModuleCache } from './module-cache.js';
import { injectSourceURL } from './source-url.js';
import { resolveModule, getModuleFormat } from './module-resolver.js';
import { dirname } from '../vfs/path-utils.js';

/**
 * Create a hybrid CJS + ESM module loader.
 *
 * @example
 * ```typescript
 * const loader = createModuleLoader(kernel);
 * const result = loader.require('./app', '/index.js');
 * ```
 */
export function createModuleLoader(kernel: RuntimeKernel): IModuleLoader {
  const cjsCache = new ModuleCache();
  const builtins = new Map<string, unknown>();
  const builtinNames = new Set<string>();

  function getVfs(): VirtualFS {
    return kernel.vfs;
  }

  function transformCode(code: string, filename: string): string {
    // Emit beforeExecute event — transform plugin hooks here
    const handlers: Array<(code: string, filename: string) => string | void> = [];
    kernel.on('__getTransformHandlers', (h: unknown) => {
      if (Array.isArray(h)) handlers.push(...h);
    });
    kernel.emit('__getTransformHandlers', handlers);
    kernel.off('__getTransformHandlers', () => {});

    // Simple approach: emit and check if any listener returns transformed code
    let result: string | undefined;
    const handler = (returnCode: unknown) => {
      if (typeof returnCode === 'string') {
        result = returnCode;
      }
    };
    kernel.on('__transformResult', handler);
    kernel.emit('beforeExecute', code, filename);
    kernel.off('__transformResult', handler);

    return result ?? code;
  }

  const loader: IModuleLoader = {
    require(specifier: string, parentPath: string): unknown {
      const vfs = getVfs();

      // Resolve the module
      const resolved = resolveModule(specifier, parentPath, vfs, builtinNames);

      // Built-in check
      if (resolved.startsWith('__builtin__:')) {
        const name = resolved.slice(12);
        return builtins.get(name);
      }

      // Cache check
      const cached = cjsCache.get(resolved);
      if (cached) return cached.exports;

      // Read file
      let code: string;
      try {
        const content = vfs.readFileSync(resolved, 'utf8');
        code = content as string;
      } catch (err) {
        throw createError(
          `Cannot find module '${specifier}'`,
          'MODULE_NOT_FOUND',
          parentPath,
        );
      }

      // Handle JSON files
      if (resolved.endsWith('.json')) {
        try {
          const parsed = JSON.parse(code);
          const mod = { exports: parsed, id: resolved, loaded: true };
          cjsCache.set(resolved, mod);
          return parsed;
        } catch {
          throw new RuntimeError(
            `Cannot parse JSON module '${resolved}'`,
            'PARSE_ERROR',
            resolved,
          );
        }
      }

      // Transform if needed (TS/JSX)
      const format = getModuleFormat(resolved, vfs);
      if (needsTransform(resolved)) {
        code = transformCode(code, resolved);
      }

      // Create module object BEFORE execution (circular dep support)
      const mod = { exports: {} as any, id: resolved, loaded: false };
      cjsCache.set(resolved, mod);

      // Add sourceURL for DevTools
      const codeWithSourceURL = injectSourceURL(code, resolved);

      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function(
          'exports', 'require', 'module', '__filename', '__dirname',
          codeWithSourceURL,
        );

        const requireFn = (spec: string) => loader.require(spec, resolved);
        fn(mod.exports, requireFn, mod, resolved, dirname(resolved));
        mod.loaded = true;
      } catch (err) {
        cjsCache.delete(resolved);
        if (err instanceof RuntimeError) throw err;
        throw createError(
          err instanceof Error ? err.message : String(err),
          'EXECUTION_ERROR',
          resolved,
        );
      }

      return mod.exports;
    },

    async import(specifier: string, parentPath: string): Promise<unknown> {
      const vfs = getVfs();
      const resolved = resolveModule(specifier, parentPath, vfs, builtinNames);

      // Built-in check
      if (resolved.startsWith('__builtin__:')) {
        const name = resolved.slice(12);
        return builtins.get(name);
      }

      // Check if Blob URL import is available (browser environment)
      if (typeof Blob === 'undefined' || typeof URL?.createObjectURL !== 'function') {
        return loader.require(specifier, parentPath);
      }

      // Expose builtins on globalThis for ESM Blob access
      const builtinKey = '__oxog_esm_b__';
      (globalThis as any)[builtinKey] = Object.fromEntries(builtins);

      const blobUrlCache = new Map<string, string>();
      const builtinBlobCache = new Map<string, string>();

      async function buildBlobUrl(filePath: string): Promise<string> {
        const cached = blobUrlCache.get(filePath);
        if (cached) return cached;

        // Sentinel for circular deps (return empty — will be left as-is)
        blobUrlCache.set(filePath, '');

        let code: string;
        try {
          const content = vfs.readFileSync(filePath, 'utf8');
          code = content as string;
        } catch {
          throw createError(`Cannot find module '${filePath}'`, 'MODULE_NOT_FOUND', parentPath);
        }

        // JSON → ESM wrapper
        if (filePath.endsWith('.json')) {
          code = `export default ${code};`;
        } else if (needsTransform(filePath)) {
          code = transformCode(code, filePath);
        }

        // Rewrite import specifiers to Blob URLs
        const specs = findImportSpecifiers(code);
        for (const spec of specs) {
          try {
            const depResolved = resolveModule(spec, filePath, vfs, builtinNames);
            if (depResolved.startsWith('__builtin__:')) {
              const bName = depResolved.slice(12);
              if (!builtinBlobCache.has(bName)) {
                const mod = builtins.get(bName);
                const keys = mod && typeof mod === 'object'
                  ? Object.keys(mod as object).filter(k => /^[a-zA-Z_$][\w$]*$/.test(k))
                  : [];
                const lines = [
                  `const __m = globalThis['${builtinKey}']['${bName}'];`,
                  'export default __m;',
                  ...keys.map(k => `export const ${k} = __m['${k}'];`),
                ];
                const bBlob = new Blob([lines.join('\n')], { type: 'text/javascript' });
                builtinBlobCache.set(bName, URL.createObjectURL(bBlob));
              }
              code = replaceSpecifier(code, spec, builtinBlobCache.get(bName)!);
            } else {
              const depUrl = await buildBlobUrl(depResolved);
              if (depUrl) {
                code = replaceSpecifier(code, spec, depUrl);
              }
            }
          } catch {
            // Can't resolve dependency — leave specifier as-is
          }
        }

        code = injectSourceURL(code, filePath);
        const blob = new Blob([code], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        blobUrlCache.set(filePath, url);
        return url;
      }

      let importedModule: unknown;
      let importSuccess = false;
      try {
        const entryUrl = await buildBlobUrl(resolved);
        importedModule = await import(/* @vite-ignore */ entryUrl);
        importSuccess = true;
      } catch {
        // Fall back to CJS below
      }

      for (const url of blobUrlCache.values()) {
        if (url) URL.revokeObjectURL(url);
      }
      for (const url of builtinBlobCache.values()) {
        URL.revokeObjectURL(url);
      }
      delete (globalThis as any)[builtinKey];

      return importSuccess ? importedModule : loader.require(specifier, parentPath);
    },

    registerBuiltin(name: string, exports: unknown): void {
      builtins.set(name, exports);
      builtinNames.add(name);
    },

    clearCache(): void {
      cjsCache.clear();
    },
  };

  return loader;
}

/**
 * Check if a file needs transformation (TS, TSX, JSX).
 */
function needsTransform(filePath: string): boolean {
  return (
    filePath.endsWith('.ts') ||
    filePath.endsWith('.tsx') ||
    filePath.endsWith('.jsx') ||
    filePath.endsWith('.mts') ||
    filePath.endsWith('.cts')
  );
}

/**
 * Find all import/export specifiers in ESM code.
 */
export function findImportSpecifiers(code: string): string[] {
  const specifiers = new Set<string>();

  // from 'specifier' or from "specifier" (covers import/export ... from '...')
  for (const m of code.matchAll(/\bfrom\s+(['"])([^'"]+)\1/g)) {
    specifiers.add(m[2]!);
  }

  // side-effect: import 'specifier' (only matches when import is followed directly by a string)
  for (const m of code.matchAll(/\bimport\s+(['"])([^'"]+)\1/g)) {
    specifiers.add(m[2]!);
  }

  // dynamic: import('specifier')
  for (const m of code.matchAll(/\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g)) {
    specifiers.add(m[2]!);
  }

  return Array.from(specifiers);
}

/**
 * Replace an import specifier in ESM code with a new URL.
 */
export function replaceSpecifier(code: string, oldSpec: string, newSpec: string): string {
  const escaped = oldSpec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return code
    .replace(new RegExp(`(\\bfrom\\s+)(['"])${escaped}\\2`, 'g'), `$1$2${newSpec}$2`)
    .replace(new RegExp(`(\\bimport\\s+)(['"])${escaped}\\2`, 'g'), `$1$2${newSpec}$2`)
    .replace(new RegExp(`(\\bimport\\s*\\(\\s*)(['"])${escaped}\\2(\\s*\\))`, 'g'), `$1$2${newSpec}$2$3`);
}
