/**
 * Browser-based npm package manager.
 * Resolves packages from CDNs, extracts tarballs, writes to VFS.
 * @module npm/package-manager
 */

import type { VirtualFS } from '../types.js';
import { resolveFromCDN, type CDNOptions } from './cdn-resolver.js';
import { maxSatisfying, valid } from './semver.js';
import { extractTgz } from './tarball.js';

export interface PackageManagerOptions {
  cdns?: string[];
  cacheDir?: string;
  timeout?: number;
}

export interface InstalledPackage {
  name: string;
  version: string;
  path: string;
  dependencies: Record<string, string>;
}

export class PackageManager {
  private vfs: VirtualFS;
  private options: PackageManagerOptions;
  private installed = new Map<string, InstalledPackage>();
  private installing = new Map<string, Promise<InstalledPackage>>();

  constructor(vfs: VirtualFS, options?: PackageManagerOptions) {
    this.vfs = vfs;
    this.options = {
      cdns: options?.cdns,
      cacheDir: options?.cacheDir ?? '/node_modules',
      timeout: options?.timeout ?? 15000,
    };
  }

  /**
   * Install a package and its dependencies.
   */
  async install(packageSpec: string): Promise<InstalledPackage> {
    const { name, version } = parsePackageSpec(packageSpec);

    // Check if already installed
    const key = `${name}@${version}`;
    if (this.installed.has(key)) {
      return this.installed.get(key)!;
    }

    // Check if currently installing (dedup)
    if (this.installing.has(key)) {
      return this.installing.get(key)!;
    }

    const promise = this._doInstall(name, version);
    this.installing.set(key, promise);

    try {
      const result = await promise;
      this.installed.set(key, result);
      return result;
    } finally {
      this.installing.delete(key);
    }
  }

  private async _doInstall(name: string, version: string): Promise<InstalledPackage> {
    const cdnOptions: CDNOptions = {
      cdns: this.options.cdns,
      timeout: this.options.timeout,
    };

    const result = await resolveFromCDN(name, version, cdnOptions);
    const pkgDir = `${this.options.cacheDir}/${name}`;

    // Ensure directory exists
    this.ensureDir(pkgDir);

    if (result.format === 'esm' || result.format === 'cjs') {
      // Single-file bundle from CDN
      const content = result.content as string;
      this.vfs.writeFileSync(`${pkgDir}/index.js`, content);

      // Create a basic package.json
      const pkg = {
        name,
        version: version === 'latest' ? '0.0.0' : version,
        main: './index.js',
        type: result.format === 'esm' ? 'module' : undefined,
      };
      this.vfs.writeFileSync(`${pkgDir}/package.json`, JSON.stringify(pkg, null, 2));

      return {
        name,
        version: pkg.version,
        path: pkgDir,
        dependencies: {},
      };
    }

    if (result.format === 'tarball') {
      // Extract tarball to VFS
      const files = await extractTgz(result.content as ArrayBuffer);

      for (const [filePath, data] of files) {
        const fullPath = `${pkgDir}${filePath}`;
        this.ensureDir(fullPath.substring(0, fullPath.lastIndexOf('/')));
        this.vfs.writeFileSync(fullPath, data);
      }

      // Read package.json for metadata
      let dependencies: Record<string, string> = {};
      let resolvedVersion = version;
      try {
        const pkgJson = JSON.parse(
          this.vfs.readFileSync(`${pkgDir}/package.json`, 'utf8') as string,
        );
        dependencies = pkgJson.dependencies ?? {};
        resolvedVersion = pkgJson.version ?? version;
      } catch {
        // No package.json in tarball
      }

      return {
        name,
        version: resolvedVersion,
        path: pkgDir,
        dependencies,
      };
    }

    throw new Error(`Unknown CDN result format: ${result.format}`);
  }

  /**
   * Install multiple packages.
   */
  async installAll(specs: string[]): Promise<InstalledPackage[]> {
    return Promise.all(specs.map((spec) => this.install(spec)));
  }

  /**
   * Check if a package is installed.
   */
  isInstalled(name: string): boolean {
    const pkgDir = `${this.options.cacheDir}/${name}`;
    return this.vfs.existsSync(`${pkgDir}/package.json`);
  }

  /**
   * List installed packages.
   */
  listInstalled(): InstalledPackage[] {
    return Array.from(this.installed.values());
  }

  /**
   * Remove an installed package.
   */
  remove(name: string): void {
    const pkgDir = `${this.options.cacheDir}/${name}`;
    if (this.vfs.existsSync(pkgDir)) {
      this.vfs.rmdirSync(pkgDir, { recursive: true });
    }
    // Remove from installed map
    for (const [key, pkg] of this.installed) {
      if (pkg.name === name) {
        this.installed.delete(key);
      }
    }
  }

  private ensureDir(path: string): void {
    if (!this.vfs.existsSync(path)) {
      this.vfs.mkdirSync(path, { recursive: true });
    }
  }
}

function parsePackageSpec(spec: string): { name: string; version: string } {
  // Handle scoped packages: @scope/name@version
  if (spec.startsWith('@')) {
    const slashIdx = spec.indexOf('/');
    if (slashIdx === -1) throw new Error(`Invalid package spec: ${spec}`);
    const afterSlash = spec.slice(slashIdx + 1);
    const atIdx = afterSlash.indexOf('@');
    if (atIdx > 0) {
      return {
        name: spec.slice(0, slashIdx + 1 + atIdx),
        version: afterSlash.slice(atIdx + 1),
      };
    }
    return { name: spec, version: 'latest' };
  }

  // Handle regular packages: name@version
  const atIdx = spec.lastIndexOf('@');
  if (atIdx > 0) {
    return {
      name: spec.slice(0, atIdx),
      version: spec.slice(atIdx + 1),
    };
  }

  return { name: spec, version: 'latest' };
}

export { parsePackageSpec };
