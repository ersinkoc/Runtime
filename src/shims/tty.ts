/**
 * Node.js `tty` module shim — browser stub.
 * @module shims/tty
 */

export function isatty(): boolean { return false; }

export class ReadStream {
  readonly isTTY = false;
}

export class WriteStream {
  readonly isTTY = false;
  readonly columns = 80;
  readonly rows = 24;
}

const ttyModule = { isatty, ReadStream, WriteStream };
export default ttyModule;
