import { describe, it, expect, beforeEach } from 'vitest';
import { VirtualFS } from '../../../src/vfs/virtual-fs.js';
import { resetInodeCounter } from '../../../src/vfs/fs-node.js';
import { RuntimeError } from '../../../src/errors.js';

describe('VirtualFS', () => {
  let vfs: VirtualFS;

  beforeEach(() => {
    resetInodeCounter();
    vfs = new VirtualFS();
  });

  // ─── File Operations ─────────────────────────────────────

  describe('writeFileSync / readFileSync', () => {
    it('should write and read a string file', () => {
      vfs.writeFileSync('/test.txt', 'hello world');
      const content = vfs.readFileSync('/test.txt', 'utf8');
      expect(content).toBe('hello world');
    });

    it('should write and read binary content', () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      vfs.writeFileSync('/binary', data);
      const result = vfs.readFileSync('/binary');
      expect(result).toBeInstanceOf(Uint8Array);
      expect(Array.from(result as Uint8Array)).toEqual([1, 2, 3, 4]);
    });

    it('should return Uint8Array when no encoding specified', () => {
      vfs.writeFileSync('/test.txt', 'hello');
      const result = vfs.readFileSync('/test.txt');
      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('should support utf-8 encoding alias', () => {
      vfs.writeFileSync('/test.txt', 'hello');
      expect(vfs.readFileSync('/test.txt', 'utf-8')).toBe('hello');
    });

    it('should overwrite existing file', () => {
      vfs.writeFileSync('/test.txt', 'first');
      vfs.writeFileSync('/test.txt', 'second');
      expect(vfs.readFileSync('/test.txt', 'utf8')).toBe('second');
    });

    it('should throw on reading non-existent file', () => {
      expect(() => vfs.readFileSync('/nope')).toThrow(RuntimeError);
      expect(() => vfs.readFileSync('/nope')).toThrow('ENOENT');
    });

    it('should throw on reading a directory', () => {
      vfs.mkdirSync('/dir');
      expect(() => vfs.readFileSync('/dir')).toThrow('EISDIR');
    });

    it('should throw on writing to root', () => {
      expect(() => vfs.writeFileSync('/', 'data')).toThrow('EISDIR');
    });

    it('should throw on writing without parent directory', () => {
      expect(() => vfs.writeFileSync('/nodir/file.txt', 'data')).toThrow('ENOENT');
    });

    it('should throw on writing to a path where a directory exists', () => {
      vfs.mkdirSync('/dir');
      expect(() => vfs.writeFileSync('/dir', 'data')).toThrow('EISDIR');
    });
  });

  describe('appendFileSync', () => {
    it('should append to existing file', () => {
      vfs.writeFileSync('/test.txt', 'hello');
      vfs.appendFileSync('/test.txt', ' world');
      expect(vfs.readFileSync('/test.txt', 'utf8')).toBe('hello world');
    });

    it('should create file if it does not exist', () => {
      vfs.appendFileSync('/new.txt', 'created');
      expect(vfs.readFileSync('/new.txt', 'utf8')).toBe('created');
    });

    it('should throw on appending to a directory', () => {
      vfs.mkdirSync('/dir');
      expect(() => vfs.appendFileSync('/dir', 'data')).toThrow('EISDIR');
    });
  });

  describe('copyFileSync', () => {
    it('should copy a file', () => {
      vfs.writeFileSync('/src.txt', 'content');
      vfs.copyFileSync('/src.txt', '/dest.txt');
      expect(vfs.readFileSync('/dest.txt', 'utf8')).toBe('content');
    });

    it('should throw when source does not exist', () => {
      expect(() => vfs.copyFileSync('/nope', '/dest')).toThrow('ENOENT');
    });
  });

  // ─── Directory Operations ─────────────────────────────────

  describe('mkdirSync', () => {
    it('should create a directory', () => {
      vfs.mkdirSync('/newdir');
      expect(vfs.statSync('/newdir').isDirectory()).toBe(true);
    });

    it('should create nested directories with recursive', () => {
      vfs.mkdirSync('/a/b/c', { recursive: true });
      expect(vfs.statSync('/a').isDirectory()).toBe(true);
      expect(vfs.statSync('/a/b').isDirectory()).toBe(true);
      expect(vfs.statSync('/a/b/c').isDirectory()).toBe(true);
    });

    it('should throw without recursive when parent missing', () => {
      expect(() => vfs.mkdirSync('/a/b')).toThrow('ENOENT');
    });

    it('should throw when directory already exists', () => {
      vfs.mkdirSync('/dir');
      expect(() => vfs.mkdirSync('/dir')).toThrow('EEXIST');
    });

    it('should be no-op for root', () => {
      vfs.mkdirSync('/');
      expect(vfs.statSync('/').isDirectory()).toBe(true);
    });

    it('should throw on recursive mkdir through a file', () => {
      vfs.writeFileSync('/file', 'data');
      expect(() => vfs.mkdirSync('/file/sub', { recursive: true })).toThrow('ENOTDIR');
    });
  });

  describe('readdirSync', () => {
    it('should list directory contents', () => {
      vfs.writeFileSync('/a.txt', 'a');
      vfs.writeFileSync('/b.txt', 'b');
      vfs.mkdirSync('/c');
      const entries = vfs.readdirSync('/') as string[];
      expect(entries).toContain('a.txt');
      expect(entries).toContain('b.txt');
      expect(entries).toContain('c');
    });

    it('should return Dirent objects with withFileTypes', () => {
      vfs.writeFileSync('/file.txt', 'data');
      vfs.mkdirSync('/dir');
      const entries = vfs.readdirSync('/', { withFileTypes: true }) as any[];
      const file = entries.find((e: any) => e.name === 'file.txt');
      const dir = entries.find((e: any) => e.name === 'dir');
      expect(file?.isFile()).toBe(true);
      expect(file?.isDirectory()).toBe(false);
      expect(file?.isSymbolicLink()).toBe(false);
      expect(dir?.isFile()).toBe(false);
      expect(dir?.isDirectory()).toBe(true);
      expect(dir?.isSymbolicLink()).toBe(false);
    });

    it('should throw on non-existent directory', () => {
      expect(() => vfs.readdirSync('/nope')).toThrow('ENOENT');
    });

    it('should throw on file', () => {
      vfs.writeFileSync('/file', 'data');
      expect(() => vfs.readdirSync('/file')).toThrow('ENOTDIR');
    });
  });

  describe('rmdirSync', () => {
    it('should remove empty directory', () => {
      vfs.mkdirSync('/dir');
      vfs.rmdirSync('/dir');
      expect(vfs.existsSync('/dir')).toBe(false);
    });

    it('should throw on non-empty directory without recursive', () => {
      vfs.mkdirSync('/dir');
      vfs.writeFileSync('/dir/file', 'data');
      expect(() => vfs.rmdirSync('/dir')).toThrow('ENOTEMPTY');
    });

    it('should remove non-empty directory with recursive', () => {
      vfs.mkdirSync('/dir');
      vfs.writeFileSync('/dir/file', 'data');
      vfs.rmdirSync('/dir', { recursive: true });
      expect(vfs.existsSync('/dir')).toBe(false);
    });

    it('should clear root contents with recursive', () => {
      vfs.writeFileSync('/a', 'data');
      vfs.mkdirSync('/b');
      vfs.rmdirSync('/', { recursive: true });
      expect((vfs.readdirSync('/') as string[]).length).toBe(0);
    });

    it('should throw on removing root without recursive', () => {
      expect(() => vfs.rmdirSync('/')).toThrow('EPERM');
    });

    it('should throw on non-existent path', () => {
      expect(() => vfs.rmdirSync('/nope')).toThrow('ENOENT');
    });

    it('should throw on file', () => {
      vfs.writeFileSync('/file', 'data');
      expect(() => vfs.rmdirSync('/file')).toThrow('ENOTDIR');
    });

    it('should throw when parent does not exist', () => {
      expect(() => vfs.rmdirSync('/a/b')).toThrow('ENOENT');
    });
  });

  // ─── Metadata ─────────────────────────────────────────────

  describe('statSync', () => {
    it('should return stats for a file', () => {
      vfs.writeFileSync('/test.txt', 'hello');
      const stats = vfs.statSync('/test.txt');
      expect(stats.isFile()).toBe(true);
      expect(stats.isDirectory()).toBe(false);
      expect(stats.isSymbolicLink()).toBe(false);
      expect(stats.size).toBe(5);
    });

    it('should return stats for a directory', () => {
      vfs.mkdirSync('/dir');
      const stats = vfs.statSync('/dir');
      expect(stats.isFile()).toBe(false);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should follow symlinks', () => {
      vfs.writeFileSync('/target.txt', 'hello');
      vfs.symlinkSync('/target.txt', '/link');
      const stats = vfs.statSync('/link');
      expect(stats.isFile()).toBe(true);
      expect(stats.isSymbolicLink()).toBe(false);
    });

    it('should throw on non-existent path', () => {
      expect(() => vfs.statSync('/nope')).toThrow('ENOENT');
    });
  });

  describe('lstatSync', () => {
    it('should not follow symlinks', () => {
      vfs.writeFileSync('/target.txt', 'hello');
      vfs.symlinkSync('/target.txt', '/link');
      const stats = vfs.lstatSync('/link');
      expect(stats.isSymbolicLink()).toBe(true);
      expect(stats.isFile()).toBe(false);
    });

    it('should throw on non-existent path', () => {
      expect(() => vfs.lstatSync('/nope')).toThrow('ENOENT');
    });
  });

  describe('existsSync', () => {
    it('should return true for existing file', () => {
      vfs.writeFileSync('/exists.txt', 'data');
      expect(vfs.existsSync('/exists.txt')).toBe(true);
    });

    it('should return false for non-existent file', () => {
      expect(vfs.existsSync('/nope')).toBe(false);
    });

    it('should return true for root', () => {
      expect(vfs.existsSync('/')).toBe(true);
    });
  });

  describe('chmodSync', () => {
    it('should change file mode', () => {
      vfs.writeFileSync('/test.txt', 'data');
      vfs.chmodSync('/test.txt', 0o755);
      expect(vfs.statSync('/test.txt').mode).toBe(0o755);
    });

    it('should throw on non-existent path', () => {
      expect(() => vfs.chmodSync('/nope', 0o755)).toThrow('ENOENT');
    });
  });

  describe('realpathSync', () => {
    it('should resolve simple path', () => {
      vfs.writeFileSync('/test.txt', 'data');
      expect(vfs.realpathSync('/test.txt')).toBe('/test.txt');
    });

    it('should resolve through symlinks', () => {
      vfs.mkdirSync('/real');
      vfs.writeFileSync('/real/file.txt', 'data');
      vfs.symlinkSync('/real', '/link');
      expect(vfs.realpathSync('/link/file.txt')).toBe('/real/file.txt');
    });

    it('should throw on non-existent path', () => {
      expect(() => vfs.realpathSync('/nope')).toThrow('ENOENT');
    });
  });

  // ─── Manipulation ─────────────────────────────────────────

  describe('unlinkSync', () => {
    it('should remove a file', () => {
      vfs.writeFileSync('/test.txt', 'data');
      vfs.unlinkSync('/test.txt');
      expect(vfs.existsSync('/test.txt')).toBe(false);
    });

    it('should throw on directory', () => {
      vfs.mkdirSync('/dir');
      expect(() => vfs.unlinkSync('/dir')).toThrow('EPERM');
    });

    it('should throw on non-existent file', () => {
      expect(() => vfs.unlinkSync('/nope')).toThrow('ENOENT');
    });

    it('should throw when parent does not exist', () => {
      expect(() => vfs.unlinkSync('/nodir/file')).toThrow('ENOENT');
    });

    it('should remove symlinks without following', () => {
      vfs.writeFileSync('/target', 'data');
      vfs.symlinkSync('/target', '/link');
      vfs.unlinkSync('/link');
      expect(vfs.existsSync('/link')).toBe(false);
      expect(vfs.existsSync('/target')).toBe(true);
    });
  });

  describe('renameSync', () => {
    it('should rename a file', () => {
      vfs.writeFileSync('/old.txt', 'data');
      vfs.renameSync('/old.txt', '/new.txt');
      expect(vfs.existsSync('/old.txt')).toBe(false);
      expect(vfs.readFileSync('/new.txt', 'utf8')).toBe('data');
    });

    it('should move a file to different directory', () => {
      vfs.mkdirSync('/dest');
      vfs.writeFileSync('/file.txt', 'data');
      vfs.renameSync('/file.txt', '/dest/file.txt');
      expect(vfs.existsSync('/file.txt')).toBe(false);
      expect(vfs.readFileSync('/dest/file.txt', 'utf8')).toBe('data');
    });

    it('should throw on non-existent source', () => {
      expect(() => vfs.renameSync('/nope', '/new')).toThrow('ENOENT');
    });

    it('should throw on non-existent destination parent', () => {
      vfs.writeFileSync('/file.txt', 'data');
      expect(() => vfs.renameSync('/file.txt', '/nodir/file.txt')).toThrow('ENOENT');
    });

    it('should throw when source parent does not exist', () => {
      expect(() => vfs.renameSync('/nodir/file', '/new')).toThrow('ENOENT');
    });
  });

  // ─── Symlinks ─────────────────────────────────────────────

  describe('symlinkSync / readlinkSync', () => {
    it('should create and read a symlink', () => {
      vfs.writeFileSync('/target.txt', 'data');
      vfs.symlinkSync('/target.txt', '/link');
      expect(vfs.readlinkSync('/link')).toBe('/target.txt');
    });

    it('should read through symlinks', () => {
      vfs.writeFileSync('/target.txt', 'hello');
      vfs.symlinkSync('/target.txt', '/link');
      expect(vfs.readFileSync('/link', 'utf8')).toBe('hello');
    });

    it('should write through symlinks', () => {
      vfs.writeFileSync('/target.txt', 'old');
      vfs.symlinkSync('/target.txt', '/link');
      vfs.writeFileSync('/link', 'new');
      expect(vfs.readFileSync('/target.txt', 'utf8')).toBe('new');
    });

    it('should throw on duplicate symlink', () => {
      vfs.writeFileSync('/target', 'data');
      vfs.symlinkSync('/target', '/link');
      expect(() => vfs.symlinkSync('/target', '/link')).toThrow('EEXIST');
    });

    it('should throw readlink on non-symlink', () => {
      vfs.writeFileSync('/file', 'data');
      expect(() => vfs.readlinkSync('/file')).toThrow('EINVAL');
    });

    it('should throw readlink on non-existent path', () => {
      expect(() => vfs.readlinkSync('/nope')).toThrow('ENOENT');
    });

    it('should throw on symlink with missing parent', () => {
      expect(() => vfs.symlinkSync('/target', '/nodir/link')).toThrow('ENOENT');
    });

    it('should handle chained symlinks', () => {
      vfs.writeFileSync('/real.txt', 'data');
      vfs.symlinkSync('/real.txt', '/link1');
      vfs.symlinkSync('/link1', '/link2');
      expect(vfs.readFileSync('/link2', 'utf8')).toBe('data');
    });

    it('should detect symlink loops', () => {
      vfs.symlinkSync('/b', '/a');
      vfs.symlinkSync('/a', '/b');
      expect(() => vfs.readFileSync('/a', 'utf8')).toThrow('ELOOP');
    });
  });

  // ─── Watch ────────────────────────────────────────────────

  describe('watch', () => {
    it('should notify on file write', async () => {
      const events: Array<[string, string]> = [];
      vfs.watch('/', {}, (event, filename) => {
        events.push([event, filename]);
      });
      vfs.writeFileSync('/test.txt', 'data');
      // Wait for microtask flush
      await new Promise((r) => setTimeout(r, 10));
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]![0]).toBe('rename'); // new file = rename
    });

    it('should notify on file change', async () => {
      vfs.writeFileSync('/test.txt', 'old');
      await new Promise((r) => setTimeout(r, 10));

      const events: Array<[string, string]> = [];
      vfs.watch('/', {}, (event, filename) => {
        events.push([event, filename]);
      });
      vfs.writeFileSync('/test.txt', 'new');
      await new Promise((r) => setTimeout(r, 10));
      expect(events.some((e) => e[0] === 'change')).toBe(true);
    });

    it('should close watcher', async () => {
      const events: Array<[string, string]> = [];
      const watcher = vfs.watch('/', {}, (event, filename) => {
        events.push([event, filename]);
      });
      watcher.close();
      vfs.writeFileSync('/test.txt', 'data');
      await new Promise((r) => setTimeout(r, 10));
      expect(events.length).toBe(0);
    });

    it('should handle recursive watch', async () => {
      vfs.mkdirSync('/src', { recursive: true });
      const events: Array<[string, string]> = [];
      vfs.watch('/', { recursive: true }, (event, filename) => {
        events.push([event, filename]);
      });
      vfs.writeFileSync('/src/app.ts', 'code');
      await new Promise((r) => setTimeout(r, 10));
      expect(events.length).toBeGreaterThan(0);
    });
  });

  // ─── Snapshot ─────────────────────────────────────────────

  describe('toSnapshot / fromSnapshot', () => {
    it('should serialize and deserialize files', () => {
      vfs.writeFileSync('/hello.txt', 'world');
      vfs.mkdirSync('/dir');
      vfs.writeFileSync('/dir/nested.txt', 'nested');

      const snapshot = vfs.toSnapshot();
      expect(snapshot).toBeInstanceOf(Uint8Array);

      const restored = VirtualFS.fromSnapshot(snapshot);
      expect(restored.readFileSync('/hello.txt', 'utf8')).toBe('world');
      expect(restored.readFileSync('/dir/nested.txt', 'utf8')).toBe('nested');
    });

    it('should preserve symlinks in snapshot', () => {
      vfs.writeFileSync('/target', 'data');
      vfs.symlinkSync('/target', '/link');

      const snapshot = vfs.toSnapshot();
      const restored = VirtualFS.fromSnapshot(snapshot);
      expect(restored.readlinkSync('/link')).toBe('/target');
    });

    it('should handle empty VFS', () => {
      const snapshot = vfs.toSnapshot();
      const restored = VirtualFS.fromSnapshot(snapshot);
      expect((restored.readdirSync('/') as string[]).length).toBe(0);
    });

    it('should handle binary content', () => {
      const binary = new Uint8Array([0, 1, 2, 255, 254, 253]);
      vfs.writeFileSync('/binary', binary);

      const snapshot = vfs.toSnapshot();
      const restored = VirtualFS.fromSnapshot(snapshot);
      const result = restored.readFileSync('/binary') as Uint8Array;
      expect(Array.from(result)).toEqual([0, 1, 2, 255, 254, 253]);
    });
  });

  // ─── Symlink resolution ──────────────────────────────────

  describe('realpathSync with symlinks', () => {
    it('should resolve relative symlink target', () => {
      vfs.mkdirSync('/dir');
      vfs.writeFileSync('/dir/real.txt', 'content');
      // Create symlink with relative target
      vfs.symlinkSync('real.txt', '/dir/link');
      // realpathSync should follow the symlink
      const resolved = vfs.realpathSync('/dir/link');
      expect(resolved).toContain('real.txt');
    });

    it('should resolve chained symlinks via realpathSync', () => {
      vfs.writeFileSync('/actual.txt', 'data');
      vfs.symlinkSync('/actual.txt', '/link1');
      vfs.symlinkSync('/link1', '/link2');
      const resolved = vfs.realpathSync('/link2');
      expect(resolved).toBe('/actual.txt');
    });
  });

  // ─── Write through symlinks (resolveWritePath) ──────────

  describe('write through relative symlinks', () => {
    it('should write through symlink with relative target', () => {
      vfs.mkdirSync('/d');
      vfs.writeFileSync('/d/real.txt', 'original');
      vfs.symlinkSync('real.txt', '/d/rel-link');
      // Write through relative symlink triggers resolveWritePath relative branch
      vfs.writeFileSync('/d/rel-link', 'updated');
      expect(vfs.readFileSync('/d/real.txt', 'utf8')).toBe('updated');
    });

    it('should write through chained symlinks', () => {
      vfs.writeFileSync('/final.txt', 'original');
      vfs.symlinkSync('/final.txt', '/mid-link');
      vfs.mkdirSync('/d2');
      vfs.symlinkSync('/mid-link', '/d2/chain');
      // Writing through chain: /d2/chain -> /mid-link -> /final.txt
      vfs.writeFileSync('/d2/chain', 'chained-write');
      expect(vfs.readFileSync('/final.txt', 'utf8')).toBe('chained-write');
    });

    it('should write through chained symlinks with relative target in chain', () => {
      vfs.mkdirSync('/d3');
      vfs.writeFileSync('/d3/end.txt', 'start');
      // Create relative symlink: /d3/rel -> end.txt (relative)
      vfs.symlinkSync('end.txt', '/d3/rel');
      // Chain: /chain-start -> /d3/rel -> end.txt
      vfs.symlinkSync('/d3/rel', '/chain-start');
      vfs.writeFileSync('/chain-start', 'final');
      expect(vfs.readFileSync('/d3/end.txt', 'utf8')).toBe('final');
    });
  });

  describe('appendFileSync with Uint8Array', () => {
    it('should append Uint8Array to existing file', () => {
      vfs.writeFileSync('/append-bin.txt', 'Hello');
      vfs.appendFileSync('/append-bin.txt', new Uint8Array([32, 87, 111, 114, 108, 100])); // " World"
      expect(vfs.readFileSync('/append-bin.txt', 'utf8')).toBe('Hello World');
    });
  });

  describe('getNodeAt deep path', () => {
    it('should find node in deeply nested directory', () => {
      vfs.mkdirSync('/a/b/c', { recursive: true });
      vfs.writeFileSync('/a/b/c/file.txt', 'deep');
      expect(vfs.readFileSync('/a/b/c/file.txt', 'utf8')).toBe('deep');
    });
  });

  describe('mkdirRecursive existing dirs', () => {
    it('should not fail when recursive dirs already exist', () => {
      vfs.mkdirSync('/x/y', { recursive: true });
      vfs.mkdirSync('/x/y/z', { recursive: true });
      expect(vfs.statSync('/x/y/z').isDirectory()).toBe(true);
    });
  });

  describe('getNodeAt with non-dir intermediate', () => {
    it('should throw for path through a file', () => {
      vfs.writeFileSync('/regular-file', 'data');
      expect(() => vfs.statSync('/regular-file/child')).toThrow();
    });
  });

  describe('realpathSync on root', () => {
    it('should resolve root path to /', () => {
      expect(vfs.realpathSync('/')).toBe('/');
    });
  });
});
