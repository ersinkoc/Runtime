import { describe, it, expect } from 'vitest';
import { injectSourceURL } from '../../../src/core/source-url.js';

describe('injectSourceURL', () => {
  it('should append sourceURL comment', () => {
    const result = injectSourceURL('console.log("hi")', '/app/index.js');
    expect(result).toBe('console.log("hi")\n//# sourceURL=vfs:///app/index.js');
  });

  it('should not double-add sourceURL', () => {
    const code = 'console.log("hi")\n//# sourceURL=vfs:///old.js';
    const result = injectSourceURL(code, '/new.js');
    expect(result).toBe(code);
  });

  it('should handle empty code', () => {
    const result = injectSourceURL('', '/empty.js');
    expect(result).toBe('\n//# sourceURL=vfs:///empty.js');
  });
});
