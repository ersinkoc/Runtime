/**
 * FNV-1a hash implementation for transform cache keys.
 * @module utils/hash
 */

/**
 * Compute a 32-bit FNV-1a hash of a string.
 *
 * @example
 * ```typescript
 * const hash = fnv1a('hello world');
 * // Returns a consistent unsigned 32-bit integer
 * ```
 */
export function fnv1a(str: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return hash >>> 0; // unsigned 32-bit
}
