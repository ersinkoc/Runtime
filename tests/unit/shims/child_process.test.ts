import { describe, it, expect, vi } from 'vitest';
import childProcessModule from '../../../src/shims/child_process.js';

describe('child_process shim', () => {
  describe('ChildProcess', () => {
    it('should have pid', () => {
      const cp = new childProcessModule.ChildProcess();
      expect(cp.pid).toBeGreaterThan(0);
    });

    it('should have stdin/stdout/stderr', () => {
      const cp = new childProcessModule.ChildProcess();
      expect(cp.stdin).toBeDefined();
      expect(cp.stdout).toBeDefined();
      expect(cp.stderr).toBeDefined();
    });

    it('should support kill', async () => {
      const cp = new childProcessModule.ChildProcess();
      const exitFn = vi.fn();
      cp.on('exit', exitFn);
      cp.kill();
      expect(cp.killed).toBe(true);
      await new Promise((r) => setTimeout(r, 10));
      expect(exitFn).toHaveBeenCalled();
    });

    it('should support disconnect', () => {
      const cp = new childProcessModule.ChildProcess();
      cp.disconnect();
      expect(cp.connected).toBe(false);
    });
  });

  describe('exec', () => {
    it('should call callback with error', async () => {
      const result = await new Promise<{ err: Error | null; stdout: string; stderr: string }>((resolve) => {
        childProcessModule.exec('echo hello', (err, stdout, stderr) => {
          resolve({ err, stdout, stderr });
        });
      });
      expect(result.err).toBeDefined();
    });

    it('should return ChildProcess', () => {
      const cp = childProcessModule.exec('ls');
      expect(cp).toBeInstanceOf(childProcessModule.ChildProcess);
    });
  });

  describe('execSync', () => {
    it('should throw', () => {
      expect(() => childProcessModule.execSync('ls')).toThrow('not supported');
    });
  });

  describe('spawn', () => {
    it('should return ChildProcess', async () => {
      const cp = childProcessModule.spawn('node', ['test.js']);
      expect(cp).toBeInstanceOf(childProcessModule.ChildProcess);
      const exitFn = vi.fn();
      cp.on('exit', exitFn);
      await new Promise((r) => setTimeout(r, 10));
      expect(exitFn).toHaveBeenCalled();
    });
  });

  describe('fork', () => {
    it('should return ChildProcess', async () => {
      const cp = childProcessModule.fork('./worker.js');
      expect(cp).toBeInstanceOf(childProcessModule.ChildProcess);
      const errorFn = vi.fn();
      cp.on('error', errorFn);
      await new Promise((r) => setTimeout(r, 10));
      expect(errorFn).toHaveBeenCalled();
    });
  });
});
