import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveFromCDN, fetchPackageMetadata, type CDNResult } from '../../../src/npm/cdn-resolver.js';

describe('resolveFromCDN', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should resolve from esm.sh successfully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('export default {}', { status: 200 }),
    );

    const result = await resolveFromCDN('lodash', 'latest', { cdns: ['esm.sh'] });
    expect(result.source).toBe('esm.sh');
    expect(result.format).toBe('esm');
    expect(result.content).toBe('export default {}');
    expect(result.url).toContain('esm.sh');
  });

  it('should resolve from jsdelivr', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('export const x = 1;', { status: 200 }),
    );

    const result = await resolveFromCDN('lodash', '4.17.21', { cdns: ['jsdelivr'] });
    expect(result.source).toBe('jsdelivr');
    expect(result.format).toBe('esm');
    expect(result.url).toContain('jsdelivr');
  });

  it('should resolve from unpkg', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('export default 1;', { status: 200 }),
    );

    const result = await resolveFromCDN('lodash', '4.17.21', { cdns: ['unpkg'] });
    expect(result.source).toBe('unpkg');
    expect(result.format).toBe('esm');
  });

  it('should try next CDN on failure', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('esm.sh failed'))
      .mockResolvedValueOnce(new Response('fallback', { status: 200 }));

    const result = await resolveFromCDN('pkg', 'latest', { cdns: ['esm.sh', 'unpkg'] });
    expect(result.source).toBe('unpkg');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('should try next CDN on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response('found', { status: 200 }));

    const result = await resolveFromCDN('pkg', 'latest', { cdns: ['esm.sh', 'unpkg'] });
    expect(result.source).toBe('unpkg');
  });

  it('should throw when all CDNs fail', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'));

    await expect(resolveFromCDN('pkg', 'latest', { cdns: ['esm.sh'] }))
      .rejects.toThrow('network error');
  });

  it('should throw generic error when all CDNs return null', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 404 }));

    await expect(resolveFromCDN('pkg', 'latest', { cdns: ['esm.sh'] }))
      .rejects.toThrow('Failed to resolve');
  });

  it('should skip unknown CDN names', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    // 'custom-cdn' is unknown, should skip and try next
    const result = await resolveFromCDN('pkg', 'latest', { cdns: ['custom-cdn', 'unpkg'] });
    expect(result.source).toBe('unpkg');
  });

  it('should try next CDN when jsdelivr returns non-ok', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response('fallback content', { status: 200 }));

    const result = await resolveFromCDN('pkg', 'latest', { cdns: ['jsdelivr', 'unpkg'] });
    expect(result.source).toBe('unpkg');
  });

  it('should use default CDN list when none specified', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('export default {}', { status: 200 }),
    );

    const result = await resolveFromCDN('lodash');
    expect(result.source).toBe('esm.sh');
  });

  it('should handle non-Error throw from CDN', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue('string error');

    await expect(resolveFromCDN('pkg', 'latest', { cdns: ['esm.sh'] }))
      .rejects.toThrow('string error');
  });

  it('should handle unpkg returning non-ok', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 404 }));

    await expect(resolveFromCDN('pkg', 'latest', { cdns: ['unpkg'] }))
      .rejects.toThrow('Failed to resolve');
  });
});

describe('fetchPackageMetadata', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch package metadata', async () => {
    const mockData = { versions: { '1.0.0': {} }, 'dist-tags': { latest: '1.0.0' } };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 }),
    );

    const result = await fetchPackageMetadata('lodash');
    expect(result.versions).toBeDefined();
    expect(result['dist-tags']).toBeDefined();
  });

  it('should throw on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('', { status: 404 }),
    );

    await expect(fetchPackageMetadata('nonexistent'))
      .rejects.toThrow('Package not found');
  });
});
