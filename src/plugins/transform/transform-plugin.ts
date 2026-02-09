/**
 * Transform Plugin — TypeScript/JSX compilation with FNV-1a caching.
 * Uses regex-based fallback for sync require(), lazy esbuild for async.
 * @module plugins/transform/transform-plugin
 */

import type { RuntimePlugin, RuntimeKernel } from '../../types.js';
import { fnv1a } from '../../utils/hash.js';
import { stripTypeAnnotations, esmToCjs } from '../../core/esm-to-cjs.js';

export interface TransformPluginOptions {
  /** Whether to attempt loading esbuild-wasm for async transforms */
  useEsbuild?: boolean;
  /** Custom transform function */
  transform?: (code: string, filename: string) => string;
}

interface CacheEntry {
  hash: number;
  code: string;
}

/**
 * Create a transform plugin for TypeScript/JSX compilation.
 *
 * @example
 * ```typescript
 * const runtime = createRuntime({
 *   plugins: [vfsPlugin(), shimsPlugin(), transformPlugin()],
 * });
 * runtime.vfs.writeFileSync('/app.ts', 'const x: number = 42; module.exports = x;');
 * runtime.runFile('/app.ts'); // TypeScript auto-stripped
 * ```
 */
export function transformPlugin(options?: TransformPluginOptions): RuntimePlugin {
  const cache = new Map<string, CacheEntry>();
  const customTransform = options?.transform;

  function transformSync(code: string, filename: string): string {
    // Check cache
    const hash = fnv1a(code);
    const cacheKey = `${filename}:cjs`;
    const cached = cache.get(cacheKey);
    if (cached && cached.hash === hash) {
      return cached.code;
    }

    let transformed = code;

    // Apply custom transform if provided
    if (customTransform) {
      transformed = customTransform(transformed, filename);
    } else {
      // TypeScript (.ts, .tsx) — strip type annotations
      if (filename.endsWith('.ts') || filename.endsWith('.tsx')) {
        transformed = stripTypeAnnotations(transformed);
      }

      // ESM → CJS conversion
      transformed = esmToCjs(transformed);

      // JSX transform (basic — converts JSX to React.createElement)
      if (filename.endsWith('.jsx') || filename.endsWith('.tsx')) {
        transformed = transformJsx(transformed);
      }
    }

    cache.set(cacheKey, { hash, code: transformed });
    return transformed;
  }

  return {
    name: 'transform',
    version: '1.0.0',

    install(kernel: RuntimeKernel): void {
      // Hook into module loader's transform flow:
      // module-loader emits 'beforeExecute' (code, filename)
      // and expects '__transformResult' (transformedCode) in response
      kernel.on('beforeExecute', (...args: unknown[]) => {
        const code = args[0];
        const filename = args[1];
        if (typeof code === 'string' && typeof filename === 'string') {
          const result = transformSync(code, filename);
          kernel.emit('__transformResult', result);
        }
      });

      // Register callback-style transform hook
      kernel.on('__transform', (...args: unknown[]) => {
        const code = args[0] as string;
        const filename = args[1] as string;
        const callback = args[2] as (result: string) => void;
        const result = transformSync(code, filename);
        callback(result);
      });

      // Store on kernel for direct access
      (kernel as any)._transform = {
        transform: transformSync,
        clearCache: () => cache.clear(),
        cacheSize: () => cache.size,
      };
    },
  };
}

/**
 * Basic JSX transform — converts JSX to createElement calls.
 * Handles: <div>, <Component>, self-closing, children, attributes.
 */
function transformJsx(code: string): string {
  // Simple regex-based JSX → createElement transform
  // This handles the most common patterns
  let result = code;

  // Self-closing tags: <Component prop="value" />
  result = result.replace(
    /<(\w+)((?:\s+[\w-]+(?:=(?:\{[^}]*\}|"[^"]*"|'[^']*'))?)*)\s*\/>/g,
    (_match, tag, attrs) => {
      const props = parseJsxAttrs(attrs);
      return `React.createElement(${isComponent(tag) ? tag : `"${tag}"`}, ${props})`;
    },
  );

  // Opening/closing tags with children (simplified — doesn't handle deep nesting well)
  result = result.replace(
    /<(\w+)((?:\s+[\w-]+(?:=(?:\{[^}]*\}|"[^"]*"|'[^']*'))?)*)\s*>([\s\S]*?)<\/\1>/g,
    (_match, tag, attrs, children) => {
      const props = parseJsxAttrs(attrs);
      const childExprs = children.trim() ? `, ${transformJsxChildren(children)}` : '';
      return `React.createElement(${isComponent(tag) ? tag : `"${tag}"`}, ${props}${childExprs})`;
    },
  );

  return result;
}

function isComponent(tag: string): boolean {
  return tag[0] === tag[0]!.toUpperCase();
}

function parseJsxAttrs(attrs: string): string {
  if (!attrs.trim()) return 'null';

  const pairs: string[] = [];
  const re = /([\w-]+)(?:=(?:\{([^}]*)\}|"([^"]*)"|'([^']*)'))?/g;
  let match;
  while ((match = re.exec(attrs)) !== null) {
    const key = match[1]!.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
    const value = match[2] ?? (match[3] !== undefined ? `"${match[3]}"` : (match[4] !== undefined ? `"${match[4]}"` : 'true'));
    pairs.push(`${key}: ${value}`);
  }

  return `{ ${pairs.join(', ')} }`;
}

function transformJsxChildren(children: string): string {
  return children
    .split(/(\{[^}]*\})/)
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith('{') && part.endsWith('}')) {
        return part.slice(1, -1); // Expression
      }
      const text = part.trim();
      return text ? `"${text}"` : '';
    })
    .filter(Boolean)
    .join(', ');
}
