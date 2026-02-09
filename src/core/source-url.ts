/**
 * Source URL injection for browser DevTools stack traces.
 * @module core/source-url
 */

/**
 * Append a sourceURL comment to code for DevTools identification.
 *
 * @example
 * ```typescript
 * const enhanced = injectSourceURL('console.log("hi")', '/app/index.js');
 * // 'console.log("hi")\n//# sourceURL=vfs:///app/index.js'
 * ```
 */
export function injectSourceURL(code: string, filePath: string): string {
  // Don't add if already present
  if (code.includes('//# sourceURL=')) {
    return code;
  }
  return code + '\n//# sourceURL=vfs://' + filePath;
}
