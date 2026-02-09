/**
 * Zero-dependency tar parser.
 * Supports USTAR and basic POSIX tar format.
 * @module npm/tarball
 */

export interface TarEntry {
  name: string;
  size: number;
  mode: number;
  type: 'file' | 'directory' | 'symlink';
  data: Uint8Array;
  linkname?: string;
}

/**
 * Decompress gzip data using native DecompressionStream API.
 */
export async function decompressGzip(data: ArrayBuffer): Promise<ArrayBuffer> {
  const ds = new DecompressionStream('gzip');
  const blob = new Blob([data]);
  return new Response(blob.stream().pipeThrough(ds)).arrayBuffer();
}

/**
 * Parse a tar archive buffer into entries.
 */
export function parseTar(buffer: ArrayBuffer): TarEntry[] {
  const view = new Uint8Array(buffer);
  const entries: TarEntry[] = [];
  let offset = 0;

  while (offset + 512 <= view.length) {
    // Read 512-byte header
    const header = view.subarray(offset, offset + 512);

    // Check for end-of-archive (two zero blocks)
    if (isZeroBlock(header)) break;

    const name = readString(header, 0, 100);
    if (!name) break;

    const mode = parseInt(readString(header, 100, 8), 8) || 0o644;
    const size = parseInt(readString(header, 124, 12), 8) || 0;
    const typeFlag = String.fromCharCode(header[156] || 48); // '0' = file
    const linkname = readString(header, 157, 100);

    // USTAR prefix
    const prefix = readString(header, 345, 155);
    const fullName = prefix ? `${prefix}/${name}` : name;

    // Strip leading 'package/' from npm tarballs
    const cleanName = fullName.replace(/^package\//, '');

    let type: 'file' | 'directory' | 'symlink';
    if (typeFlag === '5') {
      type = 'directory';
    } else if (typeFlag === '2') {
      type = 'symlink';
    } else {
      type = 'file';
    }

    offset += 512; // Move past header

    // Read data blocks
    const data = type === 'file' ? new Uint8Array(view.buffer, offset, size) : new Uint8Array(0);
    const dataBlocks = Math.ceil(size / 512) * 512;
    offset += dataBlocks;

    if (cleanName && cleanName !== '.' && cleanName !== './') {
      entries.push({
        name: cleanName.startsWith('/') ? cleanName : '/' + cleanName,
        size,
        mode,
        type,
        data: type === 'file' ? new Uint8Array(data) : new Uint8Array(0), // Copy the data
        linkname: type === 'symlink' ? linkname : undefined,
      });
    }
  }

  return entries;
}

function readString(buf: Uint8Array, offset: number, length: number): string {
  let end = offset;
  while (end < offset + length && buf[end] !== 0) end++;
  return new TextDecoder().decode(buf.subarray(offset, end));
}

function isZeroBlock(block: Uint8Array): boolean {
  for (let i = 0; i < block.length; i++) {
    if (block[i] !== 0) return false;
  }
  return true;
}

/**
 * Extract a gzipped tar (.tgz) archive into a Map of path → Uint8Array.
 */
export async function extractTgz(data: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const decompressed = await decompressGzip(data);
  const entries = parseTar(decompressed);
  const files = new Map<string, Uint8Array>();

  for (const entry of entries) {
    if (entry.type === 'file') {
      files.set(entry.name, entry.data);
    }
  }

  return files;
}
