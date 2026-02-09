/**
 * Error types with contextual suggestions for @oxog/runtime.
 * @module errors
 */

/** Error codes used throughout the runtime */
export type RuntimeErrorCode =
  | 'MODULE_NOT_FOUND'
  | 'PARSE_ERROR'
  | 'EXECUTION_ERROR'
  | 'FS_ERROR'
  | 'FS_PERMISSION_ERROR'
  | 'PLUGIN_ERROR'
  | 'PLUGIN_DEPENDENCY_ERROR'
  | 'PLUGIN_DUPLICATE_ERROR'
  | 'NETWORK_ERROR'
  | 'TRANSFORM_ERROR'
  | 'INVALID_ARGUMENT'
  | 'NOT_SUPPORTED';

/**
 * Enhanced error class with contextual information and suggestions.
 *
 * @example
 * ```typescript
 * throw new RuntimeError(
 *   "Cannot find module 'lodash'",
 *   'MODULE_NOT_FOUND',
 *   '/app/index.js',
 *   "Install with: runtime.npm.install('lodash')"
 * );
 * ```
 */
export class RuntimeError extends Error {
  /** Machine-readable error code */
  readonly code: RuntimeErrorCode;
  /** Context where the error occurred (e.g., file path, plugin name) */
  readonly context?: string;
  /** Actionable fix suggestion */
  readonly suggestion?: string;

  constructor(
    message: string,
    code: RuntimeErrorCode,
    context?: string,
    suggestion?: string,
  ) {
    super(message);
    this.name = 'RuntimeError';
    this.code = code;
    this.context = context;
    this.suggestion = suggestion;
  }
}

/**
 * Suggestions map for common error patterns.
 * @internal
 */
const ERROR_SUGGESTIONS: Array<{ pattern: RegExp; suggest: (match: RegExpMatchArray) => string }> = [
  {
    pattern: /Cannot find module '([^']+)'/,
    suggest: (m) => `Install with: runtime.npm.install('${m[1]!}')`,
  },
  {
    pattern: /is not a function/,
    suggest: () => 'Check: are you using default export vs named export?',
  },
  {
    pattern: /Buffer is not defined/,
    suggest: () => "Add: const { Buffer } = require('buffer')",
  },
  {
    pattern: /Cannot use import statement/,
    suggest: () => 'Rename file to .mjs or set "type": "module" in package.json',
  },
  {
    pattern: /Unexpected token/,
    suggest: () => 'This may be TypeScript or JSX — ensure transformPlugin is loaded',
  },
];

/**
 * Create a RuntimeError with automatic suggestion detection.
 *
 * @example
 * ```typescript
 * throw createError("Cannot find module 'lodash'", 'MODULE_NOT_FOUND', '/app/index.js');
 * // suggestion is auto-detected: "Install with: runtime.npm.install('lodash')"
 * ```
 */
export function createError(
  message: string,
  code: RuntimeErrorCode,
  context?: string,
  suggestion?: string,
): RuntimeError {
  if (!suggestion) {
    for (const entry of ERROR_SUGGESTIONS) {
      const match = message.match(entry.pattern);
      if (match) {
        suggestion = entry.suggest(match);
        break;
      }
    }
  }
  return new RuntimeError(message, code, context, suggestion);
}
