/**
 * Node.js `crypto` module shim — wraps Web Crypto API.
 * @module shims/crypto
 */

import { Buffer } from './buffer.js';

export function randomBytes(size: number): Buffer {
  const buf = new Uint8Array(size);
  crypto.getRandomValues(buf);
  return Buffer.from(buf);
}

export function randomUUID(): string {
  return crypto.randomUUID();
}

export function randomInt(min: number, max?: number): number {
  if (max === undefined) {
    max = min;
    min = 0;
  }
  const range = max - min;
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return min + (array[0]! % range);
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    throw new RangeError('Input buffers must have the same byte length');
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i]! ^ b[i]!;
  }
  return result === 0;
}

// Pure JS hash implementations for sync usage

function md5(data: Uint8Array): Uint8Array {
  // MD5 pure-JS implementation
  const K = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a,
    0xa8304613, 0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
    0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340,
    0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8,
    0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
    0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa,
    0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92,
    0xffeff47d, 0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
    0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
  ];
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];

  // Pre-processing: pad message
  const msgLen = data.length;
  const bitLen = msgLen * 8;
  const paddingLen = ((56 - (msgLen + 1) % 64) + 64) % 64;
  const padded = new Uint8Array(msgLen + 1 + paddingLen + 8);
  padded.set(data);
  padded[msgLen] = 0x80;
  // Length in bits (little-endian)
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, bitLen >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(bitLen / 0x100000000), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let offset = 0; offset < padded.length; offset += 64) {
    const M = new Uint32Array(16);
    for (let j = 0; j < 16; j++) {
      M[j] = view.getUint32(offset + j * 4, true);
    }

    let A = a0, B = b0, C = c0, D = d0;

    for (let i = 0; i < 64; i++) {
      let F: number, g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + K[i]! + M[g]!) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + ((F << S[i]!) | (F >>> (32 - S[i]!)))) >>> 0;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const result = new Uint8Array(16);
  const rv = new DataView(result.buffer);
  rv.setUint32(0, a0, true);
  rv.setUint32(4, b0, true);
  rv.setUint32(8, c0, true);
  rv.setUint32(12, d0, true);
  return result;
}

function sha1(data: Uint8Array): Uint8Array {
  const msgLen = data.length;
  const bitLen = msgLen * 8;
  const paddingLen = ((55 - msgLen % 64) + 64) % 64;
  const padded = new Uint8Array(msgLen + 1 + paddingLen + 8);
  padded.set(data);
  padded[msgLen] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen >>> 0, false);

  let h0 = 0x67452301;
  let h1 = 0xEFCDAB89;
  let h2 = 0x98BADCFE;
  let h3 = 0x10325476;
  let h4 = 0xC3D2E1F0;

  for (let offset = 0; offset < padded.length; offset += 64) {
    const W = new Uint32Array(80);
    for (let i = 0; i < 16; i++) {
      W[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 80; i++) {
      const val = W[i - 3]! ^ W[i - 8]! ^ W[i - 14]! ^ W[i - 16]!;
      W[i] = (val << 1) | (val >>> 31);
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4;

    for (let i = 0; i < 80; i++) {
      let f: number, k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5A827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ED9EBA1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8F1BBCDC;
      } else {
        f = b ^ c ^ d;
        k = 0xCA62C1D6;
      }
      const temp = (((a << 5) | (a >>> 27)) + f + e + k + W[i]!) >>> 0;
      e = d;
      d = c;
      c = ((b << 30) | (b >>> 2)) >>> 0;
      b = a;
      a = temp;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const result = new Uint8Array(20);
  const rv = new DataView(result.buffer);
  rv.setUint32(0, h0, false);
  rv.setUint32(4, h1, false);
  rv.setUint32(8, h2, false);
  rv.setUint32(12, h3, false);
  rv.setUint32(16, h4, false);
  return result;
}

function sha256(data: Uint8Array): Uint8Array {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const msgLen = data.length;
  const bitLen = msgLen * 8;
  const paddingLen = ((55 - msgLen % 64) + 64) % 64;
  const padded = new Uint8Array(msgLen + 1 + paddingLen + 8);
  padded.set(data);
  padded[msgLen] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen >>> 0, false);

  let H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  for (let offset = 0; offset < padded.length; offset += 64) {
    const W = new Uint32Array(64);
    for (let i = 0; i < 16; i++) {
      W[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = ((W[i-15]! >>> 7) | (W[i-15]! << 25)) ^ ((W[i-15]! >>> 18) | (W[i-15]! << 14)) ^ (W[i-15]! >>> 3);
      const s1 = ((W[i-2]! >>> 17) | (W[i-2]! << 15)) ^ ((W[i-2]! >>> 19) | (W[i-2]! << 13)) ^ (W[i-2]! >>> 10);
      W[i] = (W[i-16]! + s0 + W[i-7]! + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;

    for (let i = 0; i < 64; i++) {
      const S1 = ((e! >>> 6) | (e! << 26)) ^ ((e! >>> 11) | (e! << 21)) ^ ((e! >>> 25) | (e! << 7));
      const ch = (e! & f!) ^ (~e! & g!);
      const temp1 = (h! + S1 + ch + K[i]! + W[i]!) >>> 0;
      const S0 = ((a! >>> 2) | (a! << 30)) ^ ((a! >>> 13) | (a! << 19)) ^ ((a! >>> 22) | (a! << 10));
      const maj = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d! + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H = [
      (H[0]! + a!) >>> 0, (H[1]! + b!) >>> 0, (H[2]! + c!) >>> 0, (H[3]! + d!) >>> 0,
      (H[4]! + e!) >>> 0, (H[5]! + f!) >>> 0, (H[6]! + g!) >>> 0, (H[7]! + h!) >>> 0,
    ];
  }

  const result = new Uint8Array(32);
  const rv = new DataView(result.buffer);
  for (let i = 0; i < 8; i++) {
    rv.setUint32(i * 4, H[i]!, false);
  }
  return result;
}

type HashAlgorithm = 'md5' | 'sha1' | 'sha256';

const hashFns: Record<HashAlgorithm, (data: Uint8Array) => Uint8Array> = {
  md5,
  sha1,
  sha256,
};

export class Hash {
  private algorithm: HashAlgorithm;
  private data: Uint8Array[] = [];

  constructor(algorithm: string) {
    const alg = algorithm.toLowerCase().replace('-', '') as HashAlgorithm;
    if (!hashFns[alg]) {
      throw new Error(`Unsupported hash algorithm: ${algorithm}`);
    }
    this.algorithm = alg;
  }

  update(data: string | Uint8Array, encoding?: string): this {
    if (typeof data === 'string') {
      if (encoding === 'hex') {
        const bytes = new Uint8Array(data.length / 2);
        for (let i = 0; i < data.length; i += 2) {
          bytes[i / 2] = parseInt(data.substring(i, i + 2), 16);
        }
        this.data.push(bytes);
      } else {
        this.data.push(new TextEncoder().encode(data));
      }
    } else {
      this.data.push(data);
    }
    return this;
  }

  digest(encoding?: 'hex' | 'base64' | 'buffer'): string | Uint8Array {
    // Concatenate all data
    const totalLen = this.data.reduce((sum, d) => sum + d.length, 0);
    const combined = new Uint8Array(totalLen);
    let offset = 0;
    for (const d of this.data) {
      combined.set(d, offset);
      offset += d.length;
    }

    const hash = hashFns[this.algorithm]!(combined);

    if (!encoding || encoding === 'buffer') return hash;
    return Buffer.from(hash).toString(encoding);
  }
}

export class Hmac {
  private algorithm: HashAlgorithm;
  private key: Uint8Array;
  private data: Uint8Array[] = [];

  constructor(algorithm: string, key: string | Uint8Array) {
    const alg = algorithm.toLowerCase().replace('-', '') as HashAlgorithm;
    if (!hashFns[alg]) {
      throw new Error(`Unsupported hash algorithm: ${algorithm}`);
    }
    this.algorithm = alg;
    this.key = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  }

  update(data: string | Uint8Array): this {
    if (typeof data === 'string') {
      this.data.push(new TextEncoder().encode(data));
    } else {
      this.data.push(data);
    }
    return this;
  }

  digest(encoding?: 'hex' | 'base64' | 'buffer'): string | Uint8Array {
    const blockSize = 64; // MD5 and SHA1/256 block size
    let key = this.key;

    // Key longer than block size -> hash it
    if (key.length > blockSize) {
      key = hashFns[this.algorithm]!(key);
    }

    // Pad key to block size
    const paddedKey = new Uint8Array(blockSize);
    paddedKey.set(key);

    const ipad = new Uint8Array(blockSize);
    const opad = new Uint8Array(blockSize);
    for (let i = 0; i < blockSize; i++) {
      ipad[i] = paddedKey[i]! ^ 0x36;
      opad[i] = paddedKey[i]! ^ 0x5c;
    }

    // Concatenate data
    const totalLen = this.data.reduce((sum, d) => sum + d.length, 0);
    const combined = new Uint8Array(totalLen);
    let offset = 0;
    for (const d of this.data) {
      combined.set(d, offset);
      offset += d.length;
    }

    // inner hash = hash(ipad + data)
    const inner = new Uint8Array(blockSize + combined.length);
    inner.set(ipad);
    inner.set(combined, blockSize);
    const innerHash = hashFns[this.algorithm]!(inner);

    // outer hash = hash(opad + innerHash)
    const outer = new Uint8Array(blockSize + innerHash.length);
    outer.set(opad);
    outer.set(innerHash, blockSize);
    const result = hashFns[this.algorithm]!(outer);

    if (!encoding || encoding === 'buffer') return result;
    return Buffer.from(result).toString(encoding);
  }
}

export function createHash(algorithm: string): Hash {
  return new Hash(algorithm);
}

export function createHmac(algorithm: string, key: string | Uint8Array): Hmac {
  return new Hmac(algorithm, key);
}

const cryptoModule = {
  randomBytes, randomUUID, randomInt, timingSafeEqual,
  createHash, createHmac, Hash, Hmac,
};

export default cryptoModule;
