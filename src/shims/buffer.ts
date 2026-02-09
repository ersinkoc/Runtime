/**
 * Node.js `Buffer` shim — Uint8Array-based.
 * @module shims/buffer
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Buffer — Uint8Array subclass with Node.js-compatible encoding/decoding.
 *
 * @example
 * ```typescript
 * const buf = Buffer.from('Hello World');
 * buf.toString('base64'); // 'SGVsbG8gV29ybGQ='
 * Buffer.concat([buf, Buffer.from('!')]).toString(); // 'Hello World!'
 * ```
 */
export class Buffer extends Uint8Array {
  /**
   * Create a Buffer from various sources.
   *
   * @example
   * ```typescript
   * Buffer.from('hello');           // from UTF-8 string
   * Buffer.from('48656c6c6f', 'hex'); // from hex string
   * Buffer.from([0x48, 0x65]);      // from byte array
   * ```
   */
  static override from(value: any, encodingOrMapfn?: any, thisArg?: any): Buffer {
    if (typeof value === 'string') {
      const encoding = typeof encodingOrMapfn === 'string' ? encodingOrMapfn : 'utf8';
      return Buffer.fromString(value, encoding);
    }
    if (value instanceof ArrayBuffer) {
      return new Buffer(new Uint8Array(value));
    }
    if (value instanceof Uint8Array || Array.isArray(value)) {
      return new Buffer(value);
    }
    // Support Uint8Array.from(arrayLike, mapfn, thisArg) for compatibility
    if (typeof encodingOrMapfn === 'function') {
      const arr = Uint8Array.from(value, encodingOrMapfn, thisArg);
      return new Buffer(arr);
    }
    // ArrayLike / Iterable fallback
    if (value != null && (typeof value.length === 'number' || typeof value[Symbol.iterator] === 'function')) {
      return new Buffer(Uint8Array.from(value));
    }
    throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object');
  }

  private static fromString(str: string, encoding: string): Buffer {
    switch (encoding) {
      case 'utf8':
      case 'utf-8':
        return new Buffer(encoder.encode(str));
      case 'hex': {
        const bytes = new Uint8Array(str.length / 2);
        for (let i = 0; i < str.length; i += 2) {
          bytes[i / 2] = parseInt(str.slice(i, i + 2), 16);
        }
        return new Buffer(bytes);
      }
      case 'base64': {
        const binary = atob(str);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return new Buffer(bytes);
      }
      case 'ascii':
      case 'latin1':
      case 'binary': {
        const bytes = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) {
          bytes[i] = str.charCodeAt(i) & 0xFF;
        }
        return new Buffer(bytes);
      }
      default:
        return new Buffer(encoder.encode(str));
    }
  }

  /**
   * Allocate a zero-filled Buffer.
   */
  static alloc(size: number, fill?: number | string): Buffer {
    const buf = new Buffer(new Uint8Array(size));
    if (fill !== undefined) {
      if (typeof fill === 'number') {
        buf.fill(fill);
      } else if (typeof fill === 'string' && fill.length > 0) {
        const fillBuf = Buffer.from(fill);
        for (let i = 0; i < size; i++) {
          buf[i] = fillBuf[i % fillBuf.length]!;
        }
      }
    }
    return buf;
  }

  /**
   * Allocate an uninitialized Buffer.
   */
  static allocUnsafe(size: number): Buffer {
    return new Buffer(new Uint8Array(size));
  }

  /**
   * Concatenate Buffers.
   */
  static concat(list: (Buffer | Uint8Array)[], totalLength?: number): Buffer {
    const length = totalLength ?? list.reduce((sum, buf) => sum + buf.length, 0);
    const result = Buffer.alloc(length);
    let offset = 0;
    for (const buf of list) {
      result.set(buf, offset);
      offset += buf.length;
      if (offset >= length) break;
    }
    return result;
  }

  /**
   * Check if value is a Buffer.
   */
  static isBuffer(obj: unknown): obj is Buffer {
    return obj instanceof Buffer;
  }

  /**
   * Check if encoding is supported.
   */
  static isEncoding(encoding: string): boolean {
    return ['utf8', 'utf-8', 'hex', 'base64', 'ascii', 'latin1', 'binary'].includes(encoding.toLowerCase());
  }

  /**
   * Get byte length of a string.
   */
  static byteLength(str: string, encoding?: string): number {
    return Buffer.from(str, encoding).length;
  }

  /**
   * Convert buffer to string.
   */
  override toString(encoding?: string, start?: number, end?: number): string {
    const slice = this.subarray(start ?? 0, end ?? this.length);
    const enc = encoding ?? 'utf8';

    switch (enc) {
      case 'utf8':
      case 'utf-8':
        return decoder.decode(slice);
      case 'hex':
        return Array.from(slice).map((b) => b.toString(16).padStart(2, '0')).join('');
      case 'base64':
        return btoa(String.fromCharCode(...slice));
      case 'ascii':
      case 'latin1':
      case 'binary':
        return Array.from(slice).map((b) => String.fromCharCode(b)).join('');
      default:
        return decoder.decode(slice);
    }
  }

  /**
   * Write to buffer.
   */
  write(string: string, offset?: number, length?: number, encoding?: string): number {
    const buf = Buffer.from(string, encoding);
    const start = offset ?? 0;
    const maxLen = Math.min(buf.length, length ?? (this.length - start), this.length - start);
    this.set(buf.subarray(0, maxLen), start);
    return maxLen;
  }

  /**
   * Copy to target.
   */
  copy(target: Buffer | Uint8Array, targetStart?: number, sourceStart?: number, sourceEnd?: number): number {
    const ts = targetStart ?? 0;
    const ss = sourceStart ?? 0;
    const se = sourceEnd ?? this.length;
    const len = Math.min(se - ss, target.length - ts);
    target.set(this.subarray(ss, ss + len), ts);
    return len;
  }

  /**
   * Compare buffers.
   */
  compare(target: Buffer | Uint8Array): number {
    const len = Math.min(this.length, target.length);
    for (let i = 0; i < len; i++) {
      if (this[i]! < target[i]!) return -1;
      if (this[i]! > target[i]!) return 1;
    }
    if (this.length < target.length) return -1;
    if (this.length > target.length) return 1;
    return 0;
  }

  /**
   * Check equality.
   */
  equals(other: Buffer | Uint8Array): boolean {
    return this.compare(other) === 0;
  }

  /**
   * Find index of value.
   */
  override indexOf(value: number | string | Buffer | Uint8Array, byteOffset?: number): number {
    const start = byteOffset ?? 0;
    if (typeof value === 'number') {
      for (let i = start; i < this.length; i++) {
        if (this[i] === value) return i;
      }
      return -1;
    }
    const needle = typeof value === 'string' ? Buffer.from(value) : value;
    for (let i = start; i <= this.length - needle.length; i++) {
      let found = true;
      for (let j = 0; j < needle.length; j++) {
        if (this[i + j] !== needle[j]) {
          found = false;
          break;
        }
      }
      if (found) return i;
    }
    return -1;
  }

  /**
   * Check if buffer includes a value.
   */
  override includes(value: number | string | Buffer | Uint8Array, byteOffset?: number): boolean {
    return this.indexOf(value, byteOffset) !== -1;
  }

  /**
   * Slice (returns a Buffer, not Uint8Array).
   */
  override slice(start?: number, end?: number): Buffer {
    return new Buffer(super.slice(start, end));
  }

  /**
   * SubArray (returns a Buffer).
   */
  override subarray(start?: number, end?: number): Buffer {
    const sub = super.subarray(start, end);
    return new Buffer(sub);
  }

  /**
   * JSON representation.
   */
  toJSON(): { type: 'Buffer'; data: number[] } {
    return {
      type: 'Buffer',
      data: Array.from(this),
    };
  }

  // ─── Read/Write integers ────────────────────────────────

  readUInt8(offset: number = 0): number {
    return this[offset]!;
  }

  readUInt16LE(offset: number = 0): number {
    return this[offset]! | (this[offset + 1]! << 8);
  }

  readUInt16BE(offset: number = 0): number {
    return (this[offset]! << 8) | this[offset + 1]!;
  }

  readUInt32LE(offset: number = 0): number {
    return (this[offset]! | (this[offset + 1]! << 8) | (this[offset + 2]! << 16) | (this[offset + 3]! << 24)) >>> 0;
  }

  readUInt32BE(offset: number = 0): number {
    return ((this[offset]! << 24) | (this[offset + 1]! << 16) | (this[offset + 2]! << 8) | this[offset + 3]!) >>> 0;
  }

  readInt8(offset: number = 0): number {
    const val = this[offset]!;
    return val > 127 ? val - 256 : val;
  }

  readInt16LE(offset: number = 0): number {
    const val = this.readUInt16LE(offset);
    return val > 0x7FFF ? val - 0x10000 : val;
  }

  readInt16BE(offset: number = 0): number {
    const val = this.readUInt16BE(offset);
    return val > 0x7FFF ? val - 0x10000 : val;
  }

  readInt32LE(offset: number = 0): number {
    return this[offset]! | (this[offset + 1]! << 8) | (this[offset + 2]! << 16) | (this[offset + 3]! << 24);
  }

  readInt32BE(offset: number = 0): number {
    return (this[offset]! << 24) | (this[offset + 1]! << 16) | (this[offset + 2]! << 8) | this[offset + 3]!;
  }

  writeUInt8(value: number, offset: number = 0): number {
    this[offset] = value & 0xFF;
    return offset + 1;
  }

  writeUInt16LE(value: number, offset: number = 0): number {
    this[offset] = value & 0xFF;
    this[offset + 1] = (value >> 8) & 0xFF;
    return offset + 2;
  }

  writeUInt16BE(value: number, offset: number = 0): number {
    this[offset] = (value >> 8) & 0xFF;
    this[offset + 1] = value & 0xFF;
    return offset + 2;
  }

  writeUInt32LE(value: number, offset: number = 0): number {
    this[offset] = value & 0xFF;
    this[offset + 1] = (value >> 8) & 0xFF;
    this[offset + 2] = (value >> 16) & 0xFF;
    this[offset + 3] = (value >> 24) & 0xFF;
    return offset + 4;
  }

  writeUInt32BE(value: number, offset: number = 0): number {
    this[offset] = (value >> 24) & 0xFF;
    this[offset + 1] = (value >> 16) & 0xFF;
    this[offset + 2] = (value >> 8) & 0xFF;
    this[offset + 3] = value & 0xFF;
    return offset + 4;
  }
}

const bufferModule = { Buffer };
export default bufferModule;
