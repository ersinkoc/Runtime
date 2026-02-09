import { describe, it, expect, vi } from 'vitest';
import { WatcherManager } from '../../../src/vfs/watcher.js';

describe('WatcherManager', () => {
  it('should notify watchers on matching path', async () => {
    const manager = new WatcherManager();
    const listener = vi.fn();
    manager.watch('/src', {}, listener);
    manager.notify('/src/app.ts', 'change');
    await new Promise((r) => setTimeout(r, 10));
    expect(listener).toHaveBeenCalledWith('change', '/src/app.ts');
  });

  it('should not notify unrelated watchers', async () => {
    const manager = new WatcherManager();
    const listener = vi.fn();
    manager.watch('/other', {}, listener);
    manager.notify('/src/app.ts', 'change');
    await new Promise((r) => setTimeout(r, 10));
    expect(listener).not.toHaveBeenCalled();
  });

  it('should handle recursive watchers', async () => {
    const manager = new WatcherManager();
    const listener = vi.fn();
    manager.watch('/src', { recursive: true }, listener);
    manager.notify('/src/deep/nested/file.ts', 'change');
    await new Promise((r) => setTimeout(r, 10));
    expect(listener).toHaveBeenCalled();
  });

  it('should not notify non-recursive watchers for deep paths', async () => {
    const manager = new WatcherManager();
    const listener = vi.fn();
    manager.watch('/src', { recursive: false }, listener);
    manager.notify('/src/deep/nested/file.ts', 'change');
    await new Promise((r) => setTimeout(r, 10));
    expect(listener).not.toHaveBeenCalled();
  });

  it('should notify non-recursive watchers for immediate children', async () => {
    const manager = new WatcherManager();
    const listener = vi.fn();
    manager.watch('/src', {}, listener);
    manager.notify('/src/file.ts', 'change');
    await new Promise((r) => setTimeout(r, 10));
    expect(listener).toHaveBeenCalledWith('change', '/src/file.ts');
  });

  it('should notify when path matches exactly', async () => {
    const manager = new WatcherManager();
    const listener = vi.fn();
    manager.watch('/src/app.ts', {}, listener);
    manager.notify('/src/app.ts', 'change');
    await new Promise((r) => setTimeout(r, 10));
    expect(listener).toHaveBeenCalled();
  });

  it('should close watcher', async () => {
    const manager = new WatcherManager();
    const listener = vi.fn();
    const watcher = manager.watch('/src', {}, listener);
    watcher.close();
    manager.notify('/src/app.ts', 'change');
    await new Promise((r) => setTimeout(r, 10));
    expect(listener).not.toHaveBeenCalled();
  });

  it('should batch multiple events', async () => {
    const manager = new WatcherManager();
    const listener = vi.fn();
    manager.watch('/', { recursive: true }, listener);

    manager.notify('/a.ts', 'change');
    manager.notify('/b.ts', 'change');
    manager.notify('/c.ts', 'rename');

    await new Promise((r) => setTimeout(r, 10));
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('should deduplicate events for same path (rename wins)', async () => {
    const manager = new WatcherManager();
    const listener = vi.fn();
    manager.watch('/', { recursive: true }, listener);

    manager.notify('/a.ts', 'change');
    manager.notify('/a.ts', 'rename');

    await new Promise((r) => setTimeout(r, 10));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('rename', '/a.ts');
  });

  it('should track watcher count', () => {
    const manager = new WatcherManager();
    expect(manager.watcherCount).toBe(0);
    const w1 = manager.watch('/a', {}, vi.fn());
    expect(manager.watcherCount).toBe(1);
    manager.watch('/b', {}, vi.fn());
    expect(manager.watcherCount).toBe(2);
    w1.close();
    expect(manager.watcherCount).toBe(1);
  });

  it('should remove all watchers', () => {
    const manager = new WatcherManager();
    manager.watch('/a', {}, vi.fn());
    manager.watch('/b', {}, vi.fn());
    manager.removeAll();
    expect(manager.watcherCount).toBe(0);
  });

  it('should handle watcher errors silently', async () => {
    const manager = new WatcherManager();
    manager.watch('/', { recursive: true }, () => { throw new Error('fail'); });
    manager.notify('/test', 'change');
    // Should not throw
    await new Promise((r) => setTimeout(r, 10));
  });

  it('should handle double close gracefully', () => {
    const manager = new WatcherManager();
    const watcher = manager.watch('/', {}, vi.fn());
    watcher.close();
    watcher.close(); // Should not throw
    expect(manager.watcherCount).toBe(0);
  });

  it('should not notify recursive watcher for unrelated paths', async () => {
    const manager = new WatcherManager();
    const listener = vi.fn();
    manager.watch('/src', { recursive: true }, listener);
    manager.notify('/lib/file.ts', 'change');
    await new Promise((r) => setTimeout(r, 10));
    expect(listener).not.toHaveBeenCalled();
  });
});
