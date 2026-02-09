import { describe, it, expect, beforeEach } from 'vitest';
import { VirtualFS } from '../../../src/vfs/virtual-fs.js';
import fsModule from '../../../src/shims/fs.js';

describe('fs shim', () => {
  let vfs: VirtualFS;

  beforeEach(() => {
    vfs = new VirtualFS();
    fsModule._bindVFS(vfs);
    vfs.mkdirSync('/test', { recursive: true });
  });

  describe('readFileSync / writeFileSync', () => {
    it('should write and read a file', () => {
      fsModule.writeFileSync('/test/hello.txt', 'Hello World');
      expect(fsModule.readFileSync('/test/hello.txt', 'utf8')).toBe('Hello World');
    });

    it('should read as Uint8Array without encoding', () => {
      fsModule.writeFileSync('/test/data.bin', new Uint8Array([1, 2, 3]));
      const data = fsModule.readFileSync('/test/data.bin');
      expect(data).toBeInstanceOf(Uint8Array);
    });
  });

  describe('appendFileSync', () => {
    it('should append to file', () => {
      fsModule.writeFileSync('/test/log.txt', 'line1\n');
      fsModule.appendFileSync('/test/log.txt', 'line2\n');
      expect(fsModule.readFileSync('/test/log.txt', 'utf8')).toBe('line1\nline2\n');
    });
  });

  describe('existsSync', () => {
    it('should check file existence', () => {
      expect(fsModule.existsSync('/test/nope.txt')).toBe(false);
      fsModule.writeFileSync('/test/exists.txt', 'x');
      expect(fsModule.existsSync('/test/exists.txt')).toBe(true);
    });
  });

  describe('mkdirSync / readdirSync', () => {
    it('should create and list directories', () => {
      fsModule.mkdirSync('/test/sub');
      const entries = fsModule.readdirSync('/test');
      expect(entries).toContain('sub');
    });
  });

  describe('statSync', () => {
    it('should stat a file', () => {
      fsModule.writeFileSync('/test/stat.txt', 'data');
      const stat = fsModule.statSync('/test/stat.txt');
      expect(stat.isFile()).toBe(true);
      expect(stat.isDirectory()).toBe(false);
    });

    it('should stat a directory', () => {
      fsModule.mkdirSync('/test/dir');
      const stat = fsModule.statSync('/test/dir');
      expect(stat.isDirectory()).toBe(true);
    });
  });

  describe('unlinkSync', () => {
    it('should remove a file', () => {
      fsModule.writeFileSync('/test/rm.txt', 'delete me');
      fsModule.unlinkSync('/test/rm.txt');
      expect(fsModule.existsSync('/test/rm.txt')).toBe(false);
    });
  });

  describe('renameSync', () => {
    it('should rename a file', () => {
      fsModule.writeFileSync('/test/old.txt', 'data');
      fsModule.renameSync('/test/old.txt', '/test/new.txt');
      expect(fsModule.existsSync('/test/old.txt')).toBe(false);
      expect(fsModule.readFileSync('/test/new.txt', 'utf8')).toBe('data');
    });
  });

  describe('copyFileSync', () => {
    it('should copy a file', () => {
      fsModule.writeFileSync('/test/src.txt', 'content');
      fsModule.copyFileSync('/test/src.txt', '/test/dst.txt');
      expect(fsModule.readFileSync('/test/dst.txt', 'utf8')).toBe('content');
    });
  });

  describe('promises', () => {
    it('should read file async', async () => {
      fsModule.writeFileSync('/test/async.txt', 'async data');
      const data = await fsModule.promises.readFile('/test/async.txt', 'utf8');
      expect(data).toBe('async data');
    });

    it('should write file async', async () => {
      await fsModule.promises.writeFile('/test/async-w.txt', 'written');
      expect(fsModule.readFileSync('/test/async-w.txt', 'utf8')).toBe('written');
    });

    it('should check access', async () => {
      fsModule.writeFileSync('/test/acc.txt', 'x');
      await expect(fsModule.promises.access('/test/acc.txt')).resolves.toBeUndefined();
      await expect(fsModule.promises.access('/test/nope.txt')).rejects.toThrow('ENOENT');
    });
  });

  describe('callback API', () => {
    it('should read file with callback', async () => {
      fsModule.writeFileSync('/test/cb.txt', 'callback data');
      const result = await new Promise<string>((resolve, reject) => {
        fsModule.readFile('/test/cb.txt', 'utf8', (err: Error | null, data?: string) => {
          if (err) reject(err);
          else resolve(data!);
        });
      });
      expect(result).toBe('callback data');
    });

    it('should write file with callback', async () => {
      await new Promise<void>((resolve, reject) => {
        fsModule.writeFile('/test/cb-w.txt', 'written', (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
      expect(fsModule.readFileSync('/test/cb-w.txt', 'utf8')).toBe('written');
    });

    it('should pass error to callback for non-existent file', async () => {
      const err = await new Promise<Error | null>((resolve) => {
        fsModule.readFile('/non-existent/path.txt', 'utf8', (e: Error | null) => {
          resolve(e);
        });
      });
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('rmdirSync', () => {
    it('should remove an empty directory', () => {
      fsModule.mkdirSync('/test/rmdir-test');
      fsModule.rmdirSync('/test/rmdir-test');
      expect(fsModule.existsSync('/test/rmdir-test')).toBe(false);
    });
  });

  describe('lstatSync', () => {
    it('should stat a file', () => {
      fsModule.writeFileSync('/test/lstat.txt', 'data');
      const stat = fsModule.lstatSync('/test/lstat.txt');
      expect(stat.isFile()).toBe(true);
    });
  });

  describe('chmodSync', () => {
    it('should change file mode', () => {
      fsModule.writeFileSync('/test/chmod.txt', 'x');
      expect(() => fsModule.chmodSync('/test/chmod.txt', 0o755)).not.toThrow();
    });
  });

  describe('realpathSync', () => {
    it('should return the real path', () => {
      fsModule.writeFileSync('/test/real.txt', 'data');
      const real = fsModule.realpathSync('/test/real.txt');
      expect(real).toBe('/test/real.txt');
    });
  });

  describe('symlinkSync / readlinkSync', () => {
    it('should create and read symlinks', () => {
      fsModule.writeFileSync('/test/target.txt', 'content');
      fsModule.symlinkSync('/test/target.txt', '/test/link.txt');
      const target = fsModule.readlinkSync('/test/link.txt');
      expect(target).toBe('/test/target.txt');
    });
  });

  describe('mkdirSync recursive', () => {
    it('should create nested directories', () => {
      fsModule.mkdirSync('/test/deep/nested/path', { recursive: true });
      expect(fsModule.existsSync('/test/deep/nested/path')).toBe(true);
    });
  });

  describe('readFileSync with options object', () => {
    it('should accept encoding in options object', () => {
      fsModule.writeFileSync('/test/enc.txt', 'hello');
      const data = fsModule.readFileSync('/test/enc.txt', { encoding: 'utf8' });
      expect(data).toBe('hello');
    });
  });

  describe('createReadStream', () => {
    it('should emit data and end events', async () => {
      fsModule.writeFileSync('/test/stream.txt', 'stream data');
      const stream = fsModule.createReadStream('/test/stream.txt');
      const chunks: unknown[] = [];
      await new Promise<void>((resolve) => {
        stream.on('data', (chunk: unknown) => chunks.push(chunk));
        stream.on('end', () => resolve());
      });
      // createReadStream returns raw Uint8Array when no encoding is specified
      expect(chunks.length).toBe(1);
      expect(chunks[0]).toBeInstanceOf(Uint8Array);
    });

    it('should support pipe', async () => {
      fsModule.writeFileSync('/test/pipe.txt', 'piped data');
      const stream = fsModule.createReadStream('/test/pipe.txt');
      const target = { write: vi.fn(), end: vi.fn() };
      const result = stream.pipe(target);
      expect(result).toBe(target);
      await new Promise((r) => setTimeout(r, 20));
      expect(target.write).toHaveBeenCalled();
      expect(target.end).toHaveBeenCalled();
    });

    it('should support custom highWaterMark for chunked reads', async () => {
      fsModule.writeFileSync('/test/chunked.txt', 'abcdefghij'); // 10 bytes
      const stream = fsModule.createReadStream('/test/chunked.txt', { highWaterMark: 4 });
      const chunks: Uint8Array[] = [];
      await new Promise<void>((resolve) => {
        stream.on('data', (chunk: Uint8Array) => chunks.push(chunk));
        stream.on('end', () => resolve());
      });
      expect(chunks.length).toBe(3); // 4 + 4 + 2
      expect(chunks[0]!.length).toBe(4);
      expect(chunks[1]!.length).toBe(4);
      expect(chunks[2]!.length).toBe(2);
    });

    it('should handle stream with only end listener (no data listener)', async () => {
      fsModule.writeFileSync('/test/endonly.txt', 'hello');
      const stream = fsModule.createReadStream('/test/endonly.txt');
      await new Promise<void>((resolve) => {
        stream.on('end', () => resolve());
      });
    });
  });

  describe('createWriteStream', () => {
    it('should write and finalize data', () => {
      const stream = fsModule.createWriteStream('/test/ws.txt');
      stream.write('chunk1');
      stream.write('chunk2');
      stream.end();
      expect(fsModule.readFileSync('/test/ws.txt', 'utf8')).toBe('chunk1chunk2');
    });

    it('should write data passed to end', () => {
      const stream = fsModule.createWriteStream('/test/ws-end.txt');
      stream.write('first');
      stream.end('last');
      expect(fsModule.readFileSync('/test/ws-end.txt', 'utf8')).toBe('firstlast');
    });

    it('should have on method that returns this', () => {
      const stream = fsModule.createWriteStream('/test/ws-on.txt');
      const result = stream.on('finish', () => {});
      expect(result).toBe(stream);
    });
  });

  describe('watch', () => {
    it('should return a watcher object', () => {
      fsModule.writeFileSync('/test/watched.txt', 'initial');
      const watcher = fsModule.watch('/test/watched.txt', () => {});
      expect(watcher).toBeDefined();
      expect(typeof watcher.close).toBe('function');
    });
  });

  describe('callback API extended', () => {
    it('should mkdir with callback', async () => {
      await new Promise<void>((resolve, reject) => {
        fsModule.mkdir('/test/cb-mkdir', (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
      expect(fsModule.existsSync('/test/cb-mkdir')).toBe(true);
    });

    it('should readdir with callback', async () => {
      const entries = await new Promise<string[]>((resolve, reject) => {
        fsModule.readdir('/test', (err: Error | null, files?: string[]) => {
          if (err) reject(err);
          else resolve(files!);
        });
      });
      expect(Array.isArray(entries)).toBe(true);
    });

    it('should stat with callback', async () => {
      fsModule.writeFileSync('/test/cb-stat.txt', 'x');
      const stat = await new Promise<any>((resolve, reject) => {
        fsModule.stat('/test/cb-stat.txt', (err: Error | null, s?: any) => {
          if (err) reject(err);
          else resolve(s);
        });
      });
      expect(stat.isFile()).toBe(true);
    });

    it('should unlink with callback', async () => {
      fsModule.writeFileSync('/test/cb-rm.txt', 'x');
      await new Promise<void>((resolve, reject) => {
        fsModule.unlink('/test/cb-rm.txt', (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
      expect(fsModule.existsSync('/test/cb-rm.txt')).toBe(false);
    });

    it('should rename with callback', async () => {
      fsModule.writeFileSync('/test/cb-old.txt', 'data');
      await new Promise<void>((resolve, reject) => {
        fsModule.rename('/test/cb-old.txt', '/test/cb-new.txt', (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
      expect(fsModule.existsSync('/test/cb-new.txt')).toBe(true);
    });
  });

  describe('promises extended', () => {
    it('should appendFile async', async () => {
      fsModule.writeFileSync('/test/p-append.txt', 'line1\n');
      await fsModule.promises.appendFile('/test/p-append.txt', 'line2\n');
      expect(fsModule.readFileSync('/test/p-append.txt', 'utf8')).toBe('line1\nline2\n');
    });

    it('should mkdir async', async () => {
      await fsModule.promises.mkdir('/test/p-mkdir');
      expect(fsModule.existsSync('/test/p-mkdir')).toBe(true);
    });

    it('should readdir async', async () => {
      const entries = await fsModule.promises.readdir('/test');
      expect(Array.isArray(entries)).toBe(true);
    });

    it('should stat async', async () => {
      fsModule.writeFileSync('/test/p-stat.txt', 'x');
      const stat = await fsModule.promises.stat('/test/p-stat.txt');
      expect(stat.isFile()).toBe(true);
    });

    it('should unlink async', async () => {
      fsModule.writeFileSync('/test/p-rm.txt', 'x');
      await fsModule.promises.unlink('/test/p-rm.txt');
      expect(fsModule.existsSync('/test/p-rm.txt')).toBe(false);
    });

    it('should rename async', async () => {
      fsModule.writeFileSync('/test/p-old.txt', 'data');
      await fsModule.promises.rename('/test/p-old.txt', '/test/p-new.txt');
      expect(fsModule.existsSync('/test/p-new.txt')).toBe(true);
    });

    it('should copyFile async', async () => {
      fsModule.writeFileSync('/test/p-src.txt', 'copy');
      await fsModule.promises.copyFile('/test/p-src.txt', '/test/p-dst.txt');
      expect(fsModule.readFileSync('/test/p-dst.txt', 'utf8')).toBe('copy');
    });

    it('should lstat async', async () => {
      fsModule.writeFileSync('/test/p-lstat.txt', 'x');
      const stat = await fsModule.promises.lstat('/test/p-lstat.txt');
      expect(stat.isFile()).toBe(true);
    });

    it('should rmdir async', async () => {
      fsModule.mkdirSync('/test/p-rmdir');
      await fsModule.promises.rmdir('/test/p-rmdir');
      expect(fsModule.existsSync('/test/p-rmdir')).toBe(false);
    });

    it('should chmod async', async () => {
      fsModule.writeFileSync('/test/p-chmod.txt', 'x');
      await expect(fsModule.promises.chmod('/test/p-chmod.txt', 0o755)).resolves.toBeUndefined();
    });

    it('should realpath async', async () => {
      fsModule.writeFileSync('/test/p-real.txt', 'x');
      const real = await fsModule.promises.realpath('/test/p-real.txt');
      expect(real).toBe('/test/p-real.txt');
    });
  });

  describe('without VFS', () => {
    it('should throw when VFS not bound', () => {
      fsModule._bindVFS(null as any);
      expect(() => fsModule.readFileSync('/test')).toThrow('not connected');
      fsModule._bindVFS(vfs);
    });
  });

  describe('callback-style branch coverage', () => {
    it('should mkdir with options object', async () => {
      const result = await new Promise<Error | null>((resolve) => {
        fsModule.mkdir('/test/cb-dir', { recursive: true }, (err: Error | null) => {
          resolve(err);
        });
      });
      expect(result).toBeNull();
      expect(fsModule.existsSync('/test/cb-dir')).toBe(true);
    });

    it('should readdir with options object', async () => {
      fsModule.mkdirSync('/test/cb-readdir');
      fsModule.writeFileSync('/test/cb-readdir/a.txt', 'a');
      const result = await new Promise<string[]>((resolve) => {
        fsModule.readdir('/test/cb-readdir', { withFileTypes: false }, (err: Error | null, files: string[]) => {
          resolve(files);
        });
      });
      expect(result).toContain('a.txt');
    });
  });

  describe('createWriteStream branch coverage', () => {
    it('should end with data argument', () => {
      const ws = fsModule.createWriteStream('/test/ws-end.txt');
      ws.write('first');
      ws.end(' second');
      expect(fsModule.readFileSync('/test/ws-end.txt', 'utf8')).toBe('first second');
    });

    it('should handle Uint8Array chunks', () => {
      const ws = fsModule.createWriteStream('/test/ws-binary.txt');
      ws.write(new Uint8Array([72, 105])); // "Hi"
      ws.end();
      expect(fsModule.readFileSync('/test/ws-binary.txt', 'utf8')).toBe('Hi');
    });
  });

  describe('readFile callback with options', () => {
    it('should readFile with encoding option object', async () => {
      fsModule.writeFileSync('/test/rf-opts.txt', 'hello');
      const result = await new Promise<string>((resolve) => {
        fsModule.readFile('/test/rf-opts.txt', { encoding: 'utf8' }, (err: Error | null, data: string) => {
          resolve(data);
        });
      });
      expect(result).toBe('hello');
    });
  });

  describe('writeFile callback with options', () => {
    it('should writeFile with options object', async () => {
      const result = await new Promise<Error | null>((resolve) => {
        fsModule.writeFile('/test/wf-opts.txt', 'data', { encoding: 'utf8' }, (err: Error | null) => {
          resolve(err);
        });
      });
      expect(result).toBeNull();
      expect(fsModule.readFileSync('/test/wf-opts.txt', 'utf8')).toBe('data');
    });
  });

  describe('callback error path', () => {
    it('should pass error to callback when readFile fails', async () => {
      const result = await new Promise<Error | null>((resolve) => {
        fsModule.readFile('/nonexistent', (err: Error | null) => {
          resolve(err);
        });
      });
      expect(result).toBeInstanceOf(Error);
    });

    it('should wrap non-Error throws in callback', async () => {
      const fakeVfs = { readFileSync: () => { throw 'string error'; } } as any;
      fsModule._bindVFS(fakeVfs);
      const result = await new Promise<Error | null>((resolve) => {
        fsModule.readFile('/any-path', (err: Error | null) => {
          resolve(err);
        });
      });
      expect(result).toBeInstanceOf(Error);
      expect(result!.message).toBe('string error');
      fsModule._bindVFS(vfs);
    });
  });
});
