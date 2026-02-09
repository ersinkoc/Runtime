/**
 * Multi-CDN resolver for npm packages.
 * Resolution order: esm.sh → jsdelivr → unpkg
 * @module npm/cdn-resolver
 */

export interface CDNResult {
  source: string;
  url: string;
  content: string | ArrayBuffer;
  format: 'esm' | 'cjs' | 'tarball';
}

export interface CDNOptions {
  cdns?: string[];
  timeout?: number;
}

const DEFAULT_CDNS = ['esm.sh', 'jsdelivr', 'unpkg'];

/**
 * Resolve a package from CDN.
 * Tries each CDN in order until one succeeds.
 */
export async function resolveFromCDN(
  packageName: string,
  version: string = 'latest',
  options?: CDNOptions,
): Promise<CDNResult> {
  const cdns = options?.cdns ?? DEFAULT_CDNS;
  const timeout = options?.timeout ?? 15000;

  let lastError: Error | null = null;

  for (const cdn of cdns) {
    try {
      const result = await fetchFromCDN(cdn, packageName, version, timeout);
      if (result) return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error(`Failed to resolve ${packageName}@${version} from CDN`);
}

async function fetchFromCDN(
  cdn: string,
  packageName: string,
  version: string,
  timeout: number,
): Promise<CDNResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    switch (cdn) {
      case 'esm.sh': {
        const url = `https://esm.sh/${packageName}@${version}?bundle-deps`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return null;
        const content = await res.text();
        return { source: 'esm.sh', url, content, format: 'esm' };
      }

      case 'jsdelivr': {
        // Try ESM first
        const esmUrl = `https://cdn.jsdelivr.net/npm/${packageName}@${version}/+esm`;
        const esmRes = await fetch(esmUrl, { signal: controller.signal });
        if (esmRes.ok) {
          const content = await esmRes.text();
          return { source: 'jsdelivr', url: esmUrl, content, format: 'esm' };
        }
        return null;
      }

      case 'unpkg': {
        const url = `https://unpkg.com/${packageName}@${version}?module`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return null;
        const content = await res.text();
        return { source: 'unpkg', url, content, format: 'esm' };
      }

      default:
        return null;
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch package metadata from registry.
 */
export async function fetchPackageMetadata(
  packageName: string,
  timeout: number = 10000,
): Promise<{ versions: Record<string, unknown>; 'dist-tags': Record<string, string> }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const url = `https://registry.npmjs.org/${packageName}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.npm.install-v1+json' },
    });
    if (!res.ok) {
      throw new Error(`Package not found: ${packageName} (${res.status})`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}
