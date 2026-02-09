/**
 * Zero-dependency semver parser and comparator.
 * Supports: ^1.2.3, ~1.2.3, >=1.0.0, 1.x, *, 1.2.3 - 2.0.0, || operator
 * @module npm/semver
 */

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
  build: string[];
}

export function parse(version: string): SemVer | null {
  const match = version.trim().replace(/^[=v]+/, '').match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.]+))?(?:\+([a-zA-Z0-9.]+))?$/,
  );
  if (!match) return null;
  return {
    major: parseInt(match[1]!, 10),
    minor: parseInt(match[2]!, 10),
    patch: parseInt(match[3]!, 10),
    prerelease: match[4] ? match[4].split('.') : [],
    build: match[5] ? match[5].split('.') : [],
  };
}

export function valid(version: string): string | null {
  const v = parse(version);
  return v ? `${v.major}.${v.minor}.${v.patch}` : null;
}

export function compare(a: string, b: string): -1 | 0 | 1 {
  const va = parse(a);
  const vb = parse(b);
  if (!va || !vb) return 0;

  if (va.major !== vb.major) return va.major > vb.major ? 1 : -1;
  if (va.minor !== vb.minor) return va.minor > vb.minor ? 1 : -1;
  if (va.patch !== vb.patch) return va.patch > vb.patch ? 1 : -1;

  // Pre-release comparison
  if (va.prerelease.length === 0 && vb.prerelease.length > 0) return 1;
  if (va.prerelease.length > 0 && vb.prerelease.length === 0) return -1;

  for (let i = 0; i < Math.max(va.prerelease.length, vb.prerelease.length); i++) {
    if (i >= va.prerelease.length) return -1;
    if (i >= vb.prerelease.length) return 1;

    const ai = va.prerelease[i]!;
    const bi = vb.prerelease[i]!;
    const an = parseInt(ai, 10);
    const bn = parseInt(bi, 10);

    if (!isNaN(an) && !isNaN(bn)) {
      if (an !== bn) return an > bn ? 1 : -1;
    } else if (ai !== bi) {
      return ai > bi ? 1 : -1;
    }
  }

  return 0;
}

export function gt(a: string, b: string): boolean { return compare(a, b) === 1; }
export function gte(a: string, b: string): boolean { return compare(a, b) >= 0; }
export function lt(a: string, b: string): boolean { return compare(a, b) === -1; }
export function lte(a: string, b: string): boolean { return compare(a, b) <= 0; }
export function eq(a: string, b: string): boolean { return compare(a, b) === 0; }

export function satisfies(version: string, range: string): boolean {
  const v = parse(version);
  if (!v) return false;

  // Handle || operator
  const orParts = range.split('||').map((s) => s.trim());
  return orParts.some((part) => satisfiesSingle(v, part));
}

function satisfiesSingle(v: SemVer, range: string): boolean {
  const ver = `${v.major}.${v.minor}.${v.patch}`;

  // Handle wildcard
  if (range === '*' || range === '' || range === 'latest') return true;

  // Handle hyphen range: 1.0.0 - 2.0.0
  const hyphenMatch = range.match(/^([^\s]+)\s+-\s+([^\s]+)$/);
  if (hyphenMatch) {
    return gte(ver, hyphenMatch[1]!) && lte(ver, hyphenMatch[2]!);
  }

  // Handle multiple space-separated (AND) comparators
  const comparators = range.split(/\s+/).filter(Boolean);
  if (comparators.length > 1 && !comparators[0]!.startsWith('>') && !comparators[0]!.startsWith('<')) {
    // e.g. ">=1.0.0 <2.0.0"
    return comparators.every((c) => satisfiesSingle(v, c));
  }
  if (comparators.length > 1) {
    return comparators.every((c) => satisfiesSingle(v, c));
  }

  const s = range.trim();

  // ^1.2.3 — compatible with version
  if (s.startsWith('^')) {
    const r = parse(s.slice(1));
    if (!r) return false;
    if (v.major !== r.major) return false;
    if (r.major === 0) {
      if (v.minor !== r.minor) return false;
      return v.patch >= r.patch;
    }
    return gte(ver, `${r.major}.${r.minor}.${r.patch}`);
  }

  // ~1.2.3 — allows patch-level changes
  if (s.startsWith('~')) {
    const r = parse(s.slice(1));
    if (!r) return false;
    return v.major === r.major && v.minor === r.minor && v.patch >= r.patch;
  }

  // >=, >, <=, <, =
  if (s.startsWith('>=')) return gte(ver, s.slice(2).trim());
  if (s.startsWith('>')) return gt(ver, s.slice(1).trim());
  if (s.startsWith('<=')) return lte(ver, s.slice(2).trim());
  if (s.startsWith('<')) return lt(ver, s.slice(1).trim());
  if (s.startsWith('=')) return eq(ver, s.slice(1).trim());

  // x-range: 1.x, 1.2.x, 1.*
  if (s.includes('x') || s.includes('*')) {
    const parts = s.split('.');
    if (parts[0] === 'x' || parts[0] === '*') return true;
    if (v.major !== parseInt(parts[0]!, 10)) return false;
    if (!parts[1] || parts[1] === 'x' || parts[1] === '*') return true;
    if (v.minor !== parseInt(parts[1], 10)) return false;
    return true;
  }

  // Exact match
  return eq(ver, s);
}

export function maxSatisfying(versions: string[], range: string): string | null {
  const matching = versions
    .filter((v) => satisfies(v, range))
    .sort(compare);
  return matching.length > 0 ? matching[matching.length - 1]! : null;
}

export function coerce(version: string): string | null {
  const match = version.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return null;
  return `${match[1]}.${match[2] ?? '0'}.${match[3] ?? '0'}`;
}
