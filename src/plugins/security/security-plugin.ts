/**
 * Security Plugin — execution modes and sandboxing.
 * Supports: unrestricted, worker, sandbox, locked modes.
 * @module plugins/security/security-plugin
 */

import type { RuntimePlugin, RuntimeKernel } from '../../types.js';

export type SecurityMode = 'unrestricted' | 'worker' | 'sandbox' | 'locked';

export interface SecurityPluginOptions {
  mode?: SecurityMode;
  /** Allowed global APIs in sandbox mode */
  allowedGlobals?: string[];
  /** Maximum execution time in ms */
  timeout?: number;
  /** Maximum memory in bytes */
  maxMemory?: number;
}

export interface SecurityContext {
  mode: SecurityMode;
  canAccessNetwork: boolean;
  canAccessDOM: boolean;
  canEval: boolean;
  timeout: number;
}

/**
 * Create a security plugin with execution modes and sandboxing.
 *
 * @example
 * ```typescript
 * const runtime = createRuntime({
 *   plugins: [vfsPlugin(), shimsPlugin(), securityPlugin({ mode: 'sandbox' })],
 * });
 * ```
 */
export function securityPlugin(options?: SecurityPluginOptions): RuntimePlugin {
  const mode = options?.mode ?? 'unrestricted';
  const timeout = options?.timeout ?? 30000;

  const context: SecurityContext = {
    mode,
    canAccessNetwork: mode !== 'locked',
    canAccessDOM: mode === 'unrestricted',
    canEval: mode !== 'locked' && mode !== 'sandbox',
    timeout,
  };

  // Default safe globals for sandbox mode
  const DEFAULT_ALLOWED_GLOBALS = [
    'Object', 'Array', 'String', 'Number', 'Boolean', 'Symbol', 'BigInt',
    'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Proxy', 'Reflect',
    'JSON', 'Math', 'Date', 'RegExp', 'Error', 'TypeError', 'RangeError',
    'URIError', 'SyntaxError', 'ReferenceError', 'EvalError',
    'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'NaN', 'Infinity', 'undefined',
    'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
    'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
    'queueMicrotask', 'structuredClone',
    'ArrayBuffer', 'Uint8Array', 'Uint16Array', 'Uint32Array',
    'Int8Array', 'Int16Array', 'Int32Array', 'Float32Array', 'Float64Array',
    'DataView', 'TextEncoder', 'TextDecoder',
    'atob', 'btoa', 'URL', 'URLSearchParams',
    'crypto', 'performance',
  ];

  const allowedGlobals = new Set(options?.allowedGlobals ?? DEFAULT_ALLOWED_GLOBALS);

  return {
    name: 'security',
    version: '1.0.0',

    install(kernel: RuntimeKernel): void {
      (kernel as any)._security = {
        context,
        allowedGlobals: Array.from(allowedGlobals),
        checkAccess(api: string): boolean {
          if (mode === 'unrestricted') return true;
          if (mode === 'locked') return false;
          if (mode === 'sandbox') return allowedGlobals.has(api);
          return true; // worker mode
        },
        createSandboxGlobals(): Record<string, unknown> {
          const globals: Record<string, unknown> = {};
          for (const name of allowedGlobals) {
            if (name in globalThis) {
              globals[name] = (globalThis as any)[name];
            }
          }
          return globals;
        },
      };

      // Intercept module execution for security checks
      kernel.on('__beforeExecute', (...args: unknown[]) => {
        const callback = args[1] as (allowed: boolean) => void;
        if (mode === 'locked') {
          callback(false);
          return;
        }
        callback(true);
      });
    },
  };
}
