/**
 * TextEncoder/TextDecoder convenience helpers.
 * @module utils/encoding
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Encode a string to UTF-8 bytes.
 *
 * @example
 * ```typescript
 * const bytes = encodeUTF8('hello');
 * // Uint8Array([104, 101, 108, 108, 111])
 * ```
 */
export function encodeUTF8(str: string): Uint8Array {
  return encoder.encode(str);
}

/**
 * Decode UTF-8 bytes to a string.
 *
 * @example
 * ```typescript
 * const str = decodeUTF8(new Uint8Array([104, 101, 108, 108, 111]));
 * // 'hello'
 * ```
 */
export function decodeUTF8(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}
