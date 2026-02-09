import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { persistencePlugin } from '../../../src/plugins/persistence/persistence-plugin.js';
import { vfsPlugin } from '../../../src/plugins/core/vfs-plugin.js';
import { createKernel } from '../../../src/kernel.js';

describe('persistencePlugin', () => {
  function setup(options?: Parameters<typeof persistencePlugin>[0]) {
    const kernel = createKernel();
    kernel.use(vfsPlugin());
    kernel.use(persistencePlugin(options));
    return kernel;
  }

  it('should install successfully', () => {
    const kernel = setup();
    expect(kernel.listPlugins()).toContain('persistence');
  });

  it('should expose persistence object on kernel', () => {
    const kernel = setup();
    const persistence = (kernel as any)._persistence;
    expect(persistence).toBeDefined();
    expect(typeof persistence.save).toBe('function');
    expect(typeof persistence.restore).toBe('function');
    expect(typeof persistence.clear).toBe('function');
    expect(typeof persistence.scheduleSave).toBe('function');
  });

  it('should use default options', () => {
    // No options — should not throw
    const kernel = setup();
    expect(kernel.listPlugins()).toContain('persistence');
  });

  it('should accept custom storageName', () => {
    const kernel = setup({ storageName: 'custom-storage' });
    expect((kernel as any)._persistence).toBeDefined();
  });

  it('should accept custom debounceMs', () => {
    const kernel = setup({ debounceMs: 500 });
    expect((kernel as any)._persistence).toBeDefined();
  });

  it('should handle save gracefully when OPFS is unavailable', async () => {
    const kernel = setup();
    const persistence = (kernel as any)._persistence;
    // In test env, navigator.storage is likely undefined
    // save() should catch and warn, not throw
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await persistence.save();
    warnSpy.mockRestore();
  });

  it('should handle restore gracefully when OPFS is unavailable', async () => {
    const kernel = setup();
    const persistence = (kernel as any)._persistence;
    // Should return false when OPFS is unavailable
    const result = await persistence.restore();
    expect(result).toBe(false);
  });

  it('should handle clear gracefully when OPFS is unavailable', async () => {
    const kernel = setup();
    const persistence = (kernel as any)._persistence;
    // Should not throw when OPFS is unavailable
    await expect(persistence.clear()).resolves.toBeUndefined();
  });

  it('should debounce scheduleSave calls', () => {
    vi.useFakeTimers();
    const kernel = setup({ debounceMs: 100 });
    const persistence = (kernel as any)._persistence;
    const saveSpy = vi.spyOn(persistence, 'save').mockResolvedValue(undefined);

    persistence.scheduleSave();
    persistence.scheduleSave();
    persistence.scheduleSave();

    // Not called yet — debounced
    expect(saveSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(saveSpy).toHaveBeenCalledTimes(1);

    saveSpy.mockRestore();
    vi.useRealTimers();
  });

  it('should set up auto-save when interval is configured', () => {
    vi.useFakeTimers();
    const kernel = setup({ autoSaveInterval: 200 });
    const persistence = (kernel as any)._persistence;
    const saveSpy = vi.spyOn(persistence, 'save').mockResolvedValue(undefined);

    vi.advanceTimersByTime(600);
    expect(saveSpy).toHaveBeenCalledTimes(3);

    saveSpy.mockRestore();
    kernel.unregister('persistence');
    vi.useRealTimers();
  });

  it('should clean up timers on unregister', () => {
    vi.useFakeTimers();
    const kernel = setup({ autoSaveInterval: 100 });
    const persistence = (kernel as any)._persistence;
    const saveSpy = vi.spyOn(persistence, 'save').mockResolvedValue(undefined);

    vi.advanceTimersByTime(100);
    expect(saveSpy).toHaveBeenCalledTimes(1);

    // Unregistering triggers onDestroy which clears timers
    kernel.unregister('persistence');

    saveSpy.mockClear();
    vi.advanceTimersByTime(300);
    expect(saveSpy).not.toHaveBeenCalled();

    saveSpy.mockRestore();
    vi.useRealTimers();
  });

  describe('with mocked OPFS', () => {
    let origStorage: unknown;

    function mockOPFS() {
      const writtenData: Uint8Array[] = [];
      const mockRemoveEntry = vi.fn().mockResolvedValue(undefined);
      const mockWritable = {
        write: vi.fn().mockImplementation((data: Uint8Array) => { writtenData.push(data); }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const mockFileHandle = {
        createWritable: vi.fn().mockResolvedValue(mockWritable),
        getFile: vi.fn().mockResolvedValue({
          arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
        }),
      };
      const mockDirHandle = {
        getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
      };
      const mockRoot = {
        getDirectoryHandle: vi.fn().mockResolvedValue(mockDirHandle),
        removeEntry: mockRemoveEntry,
      };
      const mockStorage = {
        getDirectory: vi.fn().mockResolvedValue(mockRoot),
      };
      origStorage = (navigator as any).storage;
      Object.defineProperty(navigator, 'storage', { value: mockStorage, configurable: true });
      return { writtenData, mockRemoveEntry, mockRoot, mockDirHandle, mockFileHandle, mockWritable };
    }

    afterEach(() => {
      if (origStorage !== undefined) {
        Object.defineProperty(navigator, 'storage', { value: origStorage, configurable: true });
      }
    });

    it('should save VFS snapshot to OPFS', async () => {
      const { writtenData } = mockOPFS();
      const kernel = setup();
      kernel.vfs.writeFileSync('/test.txt', 'hello');
      const persistence = (kernel as any)._persistence;
      await persistence.save();
      expect(writtenData.length).toBe(1);
      expect(writtenData[0]).toBeInstanceOf(Uint8Array);
    });

    it('should restore VFS snapshot from OPFS', async () => {
      mockOPFS();
      const kernel = setup();
      // Add fromSnapshot to VFS instance so the ?. call executes
      const fromSnapshotSpy = vi.fn();
      (kernel.vfs as any).fromSnapshot = fromSnapshotSpy;
      const persistence = (kernel as any)._persistence;
      const result = await persistence.restore();
      expect(result).toBe(true);
      expect(fromSnapshotSpy).toHaveBeenCalledWith(expect.any(Uint8Array));
    });

    it('should clear OPFS storage', async () => {
      const { mockRemoveEntry } = mockOPFS();
      const kernel = setup();
      const persistence = (kernel as any)._persistence;
      await persistence.clear();
      expect(mockRemoveEntry).toHaveBeenCalledWith('@oxog-runtime', { recursive: true });
    });
  });

  it('should clear saveTimer on destroy when scheduled', () => {
    vi.useFakeTimers();
    const kernel = setup({ debounceMs: 500 });
    const persistence = (kernel as any)._persistence;
    vi.spyOn(persistence, 'save').mockResolvedValue(undefined);

    // Schedule a save — sets saveTimer
    persistence.scheduleSave();

    // Destroy before the debounce timer fires
    kernel.unregister('persistence');

    // Advance past the debounce — save should NOT fire (timer was cleared)
    const saveSpy = persistence.save;
    saveSpy.mockClear();
    vi.advanceTimersByTime(600);
    expect(saveSpy).not.toHaveBeenCalled();

    saveSpy.mockRestore();
    vi.useRealTimers();
  });
});
