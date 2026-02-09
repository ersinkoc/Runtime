/**
 * Node.js `zlib` module shim — wraps CompressionStream/DecompressionStream.
 * @module shims/zlib
 */

import { Buffer } from './buffer.js';

async function compressWithStream(data: Uint8Array, format: CompressionFormat): Promise<Buffer> {
  const cs = new CompressionStream(format);
  const writer = cs.writable.getWriter();
  writer.write(new Uint8Array(data.buffer, data.byteOffset, data.byteLength) as unknown as BufferSource);
  writer.close();

  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return Buffer.from(result);
}

async function decompressWithStream(data: Uint8Array, format: CompressionFormat): Promise<Buffer> {
  const ds = new DecompressionStream(format);
  const writer = ds.writable.getWriter();
  writer.write(new Uint8Array(data.buffer, data.byteOffset, data.byteLength) as unknown as BufferSource);
  writer.close();

  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return Buffer.from(result);
}

function toBuffer(input: string | Uint8Array): Uint8Array {
  if (typeof input === 'string') return new TextEncoder().encode(input);
  return input;
}

function wrapCallback<T>(promise: Promise<T>, callback?: (err: Error | null, result?: T) => void): Promise<T> | void {
  if (callback) {
    promise.then(
      (result) => callback(null, result),
      (err) => callback(err instanceof Error ? err : new Error(String(err))),
    );
    return;
  }
  return promise;
}

export function gzip(input: string | Uint8Array, callback?: (err: Error | null, result?: Buffer) => void): Promise<Buffer> | void {
  return wrapCallback(compressWithStream(toBuffer(input), 'gzip'), callback);
}

export function gunzip(input: Uint8Array, callback?: (err: Error | null, result?: Buffer) => void): Promise<Buffer> | void {
  return wrapCallback(decompressWithStream(input, 'gzip'), callback);
}

export function deflate(input: string | Uint8Array, callback?: (err: Error | null, result?: Buffer) => void): Promise<Buffer> | void {
  return wrapCallback(compressWithStream(toBuffer(input), 'deflate'), callback);
}

export function inflate(input: Uint8Array, callback?: (err: Error | null, result?: Buffer) => void): Promise<Buffer> | void {
  return wrapCallback(decompressWithStream(input, 'deflate'), callback);
}

export function deflateRaw(input: string | Uint8Array, callback?: (err: Error | null, result?: Buffer) => void): Promise<Buffer> | void {
  return wrapCallback(compressWithStream(toBuffer(input), 'deflate-raw'), callback);
}

export function inflateRaw(input: Uint8Array, callback?: (err: Error | null, result?: Buffer) => void): Promise<Buffer> | void {
  return wrapCallback(decompressWithStream(input, 'deflate-raw'), callback);
}

// Brotli stubs — not available natively in all browsers
export function brotliCompress(_input: string | Uint8Array, callback?: (err: Error | null, result?: Buffer) => void): Promise<Buffer> | void {
  const err = new Error('Brotli compression is not supported in the browser runtime');
  if (callback) { callback(err); return; }
  return Promise.reject(err);
}

export function brotliDecompress(_input: Uint8Array, callback?: (err: Error | null, result?: Buffer) => void): Promise<Buffer> | void {
  const err = new Error('Brotli decompression is not supported in the browser runtime');
  if (callback) { callback(err); return; }
  return Promise.reject(err);
}

// Stream creators (stubs that return basic objects)
export function createGzip() { return { compress: (data: Uint8Array) => gzip(data) }; }
export function createGunzip() { return { decompress: (data: Uint8Array) => gunzip(data) }; }
export function createDeflate() { return { compress: (data: Uint8Array) => deflate(data) }; }
export function createInflate() { return { decompress: (data: Uint8Array) => inflate(data) }; }

const zlibModule = {
  gzip, gunzip, deflate, inflate, deflateRaw, inflateRaw,
  brotliCompress, brotliDecompress,
  createGzip, createGunzip, createDeflate, createInflate,
};

export default zlibModule;
