import { describe, it, expect } from 'vitest';
import { parse, valid, compare, gt, gte, lt, lte, eq, satisfies, maxSatisfying, coerce } from '../../../src/npm/semver.js';

describe('semver', () => {
  describe('parse', () => {
    it('should parse simple version', () => {
      const v = parse('1.2.3');
      expect(v).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [], build: [] });
    });

    it('should parse with prerelease', () => {
      const v = parse('1.0.0-alpha.1');
      expect(v?.prerelease).toEqual(['alpha', '1']);
    });

    it('should parse with build metadata', () => {
      const v = parse('1.0.0+build.123');
      expect(v?.build).toEqual(['build', '123']);
    });

    it('should strip leading v', () => {
      expect(parse('v1.2.3')?.major).toBe(1);
    });

    it('should return null for invalid', () => {
      expect(parse('invalid')).toBeNull();
      expect(parse('1.2')).toBeNull();
    });
  });

  describe('valid', () => {
    it('should return normalized version', () => {
      expect(valid('1.2.3')).toBe('1.2.3');
      expect(valid('v1.2.3')).toBe('1.2.3');
    });

    it('should return null for invalid', () => {
      expect(valid('nope')).toBeNull();
    });
  });

  describe('compare', () => {
    it('should compare major versions', () => {
      expect(compare('2.0.0', '1.0.0')).toBe(1);
      expect(compare('1.0.0', '2.0.0')).toBe(-1);
    });

    it('should compare minor versions', () => {
      expect(compare('1.2.0', '1.1.0')).toBe(1);
    });

    it('should compare patch versions', () => {
      expect(compare('1.0.2', '1.0.1')).toBe(1);
    });

    it('should return 0 for equal', () => {
      expect(compare('1.2.3', '1.2.3')).toBe(0);
    });

    it('should compare prerelease', () => {
      expect(compare('1.0.0-alpha', '1.0.0')).toBe(-1);
      expect(compare('1.0.0', '1.0.0-alpha')).toBe(1);
    });

    it('should compare prerelease numeric identifiers', () => {
      expect(compare('1.0.0-1', '1.0.0-2')).toBe(-1);
      expect(compare('1.0.0-2', '1.0.0-1')).toBe(1);
      expect(compare('1.0.0-1', '1.0.0-1')).toBe(0);
    });

    it('should compare prerelease string identifiers', () => {
      expect(compare('1.0.0-alpha', '1.0.0-beta')).toBe(-1);
      expect(compare('1.0.0-beta', '1.0.0-alpha')).toBe(1);
    });

    it('should compare prerelease with different lengths', () => {
      expect(compare('1.0.0-alpha', '1.0.0-alpha.1')).toBe(-1);
      expect(compare('1.0.0-alpha.1', '1.0.0-alpha')).toBe(1);
    });

    it('should compare equal prereleases', () => {
      expect(compare('1.0.0-alpha.1', '1.0.0-alpha.1')).toBe(0);
    });
  });

  describe('gt/gte/lt/lte/eq', () => {
    it('should work', () => {
      expect(gt('2.0.0', '1.0.0')).toBe(true);
      expect(gte('1.0.0', '1.0.0')).toBe(true);
      expect(lt('1.0.0', '2.0.0')).toBe(true);
      expect(lte('1.0.0', '1.0.0')).toBe(true);
      expect(eq('1.0.0', '1.0.0')).toBe(true);
    });
  });

  describe('satisfies', () => {
    it('should handle exact version', () => {
      expect(satisfies('1.2.3', '1.2.3')).toBe(true);
      expect(satisfies('1.2.4', '1.2.3')).toBe(false);
    });

    it('should handle caret range', () => {
      expect(satisfies('1.2.3', '^1.2.0')).toBe(true);
      expect(satisfies('1.3.0', '^1.2.0')).toBe(true);
      expect(satisfies('2.0.0', '^1.2.0')).toBe(false);
    });

    it('should handle tilde range', () => {
      expect(satisfies('1.2.3', '~1.2.0')).toBe(true);
      expect(satisfies('1.2.5', '~1.2.0')).toBe(true);
      expect(satisfies('1.3.0', '~1.2.0')).toBe(false);
    });

    it('should handle >= operator', () => {
      expect(satisfies('1.5.0', '>=1.0.0')).toBe(true);
      expect(satisfies('0.9.0', '>=1.0.0')).toBe(false);
    });

    it('should handle > operator', () => {
      expect(satisfies('1.0.1', '>1.0.0')).toBe(true);
      expect(satisfies('1.0.0', '>1.0.0')).toBe(false);
    });

    it('should handle < operator', () => {
      expect(satisfies('0.9.0', '<1.0.0')).toBe(true);
    });

    it('should handle <= operator', () => {
      expect(satisfies('1.0.0', '<=1.0.0')).toBe(true);
    });

    it('should handle wildcard', () => {
      expect(satisfies('1.2.3', '*')).toBe(true);
      expect(satisfies('99.0.0', '*')).toBe(true);
    });

    it('should handle caret range with major 0 (minor-locked)', () => {
      expect(satisfies('0.1.2', '^0.1.0')).toBe(true);
      expect(satisfies('0.1.5', '^0.1.0')).toBe(true);
      expect(satisfies('0.2.0', '^0.1.0')).toBe(false);
      expect(satisfies('0.0.9', '^0.1.0')).toBe(false);
    });

    it('should handle = operator', () => {
      expect(satisfies('1.0.0', '=1.0.0')).toBe(true);
      expect(satisfies('1.0.1', '=1.0.0')).toBe(false);
    });

    it('should handle x-range', () => {
      expect(satisfies('1.5.0', '1.x')).toBe(true);
      expect(satisfies('2.0.0', '1.x')).toBe(false);
    });

    it('should handle x-range with minor level', () => {
      expect(satisfies('1.2.5', '1.2.x')).toBe(true);
      expect(satisfies('1.2.0', '1.2.x')).toBe(true);
      expect(satisfies('1.3.0', '1.2.x')).toBe(false);
    });

    it('should handle x-range with * wildcard parts', () => {
      expect(satisfies('5.0.0', '*.*.*')).toBe(true);
      expect(satisfies('1.5.0', '1.*')).toBe(true);
      expect(satisfies('2.0.0', '1.*')).toBe(false);
    });

    it('should handle AND comparators (non-operator)', () => {
      // Multiple space-separated comparators where first doesn't start with > or <
      expect(satisfies('1.5.0', '^1.0.0 <2.0.0')).toBe(true);
      expect(satisfies('2.0.0', '^1.0.0 <2.0.0')).toBe(false);
    });

    it('should handle latest/empty as wildcard', () => {
      expect(satisfies('1.0.0', 'latest')).toBe(true);
      expect(satisfies('1.0.0', '')).toBe(true);
    });

    it('should return false for unparseable version', () => {
      expect(satisfies('invalid', '^1.0.0')).toBe(false);
    });

    it('should handle || operator', () => {
      expect(satisfies('1.0.0', '1.0.0 || 2.0.0')).toBe(true);
      expect(satisfies('2.0.0', '1.0.0 || 2.0.0')).toBe(true);
      expect(satisfies('3.0.0', '1.0.0 || 2.0.0')).toBe(false);
    });

    it('should handle hyphen range', () => {
      expect(satisfies('1.5.0', '1.0.0 - 2.0.0')).toBe(true);
      expect(satisfies('2.0.0', '1.0.0 - 2.0.0')).toBe(true);
      expect(satisfies('3.0.0', '1.0.0 - 2.0.0')).toBe(false);
    });

    it('should handle AND ranges', () => {
      expect(satisfies('1.5.0', '>=1.0.0 <2.0.0')).toBe(true);
      expect(satisfies('2.0.0', '>=1.0.0 <2.0.0')).toBe(false);
    });
  });

  describe('maxSatisfying', () => {
    it('should find highest matching version', () => {
      const versions = ['1.0.0', '1.1.0', '1.2.0', '2.0.0'];
      expect(maxSatisfying(versions, '^1.0.0')).toBe('1.2.0');
    });

    it('should return null when none match', () => {
      expect(maxSatisfying(['1.0.0', '2.0.0'], '^3.0.0')).toBeNull();
    });
  });

  describe('coerce', () => {
    it('should coerce partial versions', () => {
      expect(coerce('1')).toBe('1.0.0');
      expect(coerce('1.2')).toBe('1.2.0');
      expect(coerce('1.2.3')).toBe('1.2.3');
    });

    it('should return null for invalid', () => {
      expect(coerce('abc')).toBeNull();
    });
  });

  describe('compare edge cases', () => {
    it('should return 0 when either version is invalid', () => {
      expect(compare('invalid', '1.0.0')).toBe(0);
      expect(compare('1.0.0', 'bad')).toBe(0);
    });

    it('should compare by minor version', () => {
      expect(compare('1.2.0', '1.1.0')).toBe(1);
      expect(compare('1.0.0', '1.1.0')).toBe(-1);
    });

    it('should compare by patch version', () => {
      expect(compare('1.0.2', '1.0.1')).toBe(1);
      expect(compare('1.0.0', '1.0.1')).toBe(-1);
    });
  });

  describe('satisfies edge cases', () => {
    it('should return false for invalid caret range', () => {
      expect(satisfies('1.0.0', '^invalid')).toBe(false);
    });

    it('should return false for invalid tilde range', () => {
      expect(satisfies('1.0.0', '~invalid')).toBe(false);
    });

    it('should handle AND comparators starting with > or <', () => {
      expect(satisfies('1.5.0', '>1.0.0 <2.0.0')).toBe(true);
      expect(satisfies('0.5.0', '>1.0.0 <2.0.0')).toBe(false);
    });
  });
});
