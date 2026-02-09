/**
 * Node.js `string_decoder` module shim.
 * @module shims/string-decoder
 */

export class StringDecoder {
  private encoding: string;
  private decoder: TextDecoder;
  private buffer: Uint8Array;

  constructor(encoding?: string) {
    this.encoding = encoding ?? 'utf8';
    this.decoder = new TextDecoder(this.encoding === 'utf8' ? 'utf-8' : this.encoding);
    this.buffer = new Uint8Array(0);
  }

  write(buf: Uint8Array): string {
    const combined = new Uint8Array(this.buffer.length + buf.length);
    combined.set(this.buffer, 0);
    combined.set(buf, this.buffer.length);

    // Try to decode, keeping incomplete multi-byte sequences
    try {
      const result = this.decoder.decode(combined, { stream: true });
      this.buffer = new Uint8Array(0);
      return result;
    } catch {
      // If decoding fails, keep the buffer for next write
      this.buffer = combined;
      return '';
    }
  }

  end(buf?: Uint8Array): string {
    if (buf) {
      const combined = new Uint8Array(this.buffer.length + buf.length);
      combined.set(this.buffer, 0);
      combined.set(buf, this.buffer.length);
      this.buffer = new Uint8Array(0);
      return this.decoder.decode(combined);
    }
    const result = this.decoder.decode(this.buffer);
    this.buffer = new Uint8Array(0);
    return result;
  }
}

const stringDecoderModule = { StringDecoder };
export default stringDecoderModule;
