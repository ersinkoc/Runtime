import { describe, it, expect, vi } from 'vitest';
import { transformPlugin } from '../../../src/plugins/transform/transform-plugin.js';
import { createKernel } from '../../../src/kernel.js';
import { vfsPlugin } from '../../../src/plugins/core/vfs-plugin.js';

describe('transformPlugin', () => {
  function setup(options?: Parameters<typeof transformPlugin>[0]) {
    const kernel = createKernel();
    kernel.use(vfsPlugin());
    kernel.use(transformPlugin(options));
    return kernel;
  }

  it('should install successfully', () => {
    const kernel = setup();
    expect(kernel.listPlugins()).toContain('transform');
  });

  it('should transform TypeScript via event', () => {
    const kernel = setup();
    let result = '';
    kernel.emit('__transform', 'const x: number = 1; export default x;', 'test.ts', (code: string) => {
      result = code;
    });
    expect(result).not.toContain(': number');
    expect(result).toContain('module.exports');
  });

  it('should transform ESM to CJS', () => {
    const kernel = setup();
    let result = '';
    kernel.emit('__transform', 'import { foo } from "bar"; export default foo;', 'test.js', (code: string) => {
      result = code;
    });
    expect(result).toContain('require');
    expect(result).toContain('module.exports');
  });

  it('should cache transforms', () => {
    const kernel = setup();
    const code = 'export const x = 1;';
    let result1 = '';
    let result2 = '';
    kernel.emit('__transform', code, 'cached.js', (code: string) => { result1 = code; });
    kernel.emit('__transform', code, 'cached.js', (code: string) => { result2 = code; });
    expect(result1).toBe(result2);
  });

  it('should expose cache operations', () => {
    const kernel = setup();
    const transform = (kernel as any)._transform;
    expect(typeof transform.clearCache).toBe('function');
    expect(typeof transform.cacheSize).toBe('function');
    expect(transform.cacheSize()).toBe(0);
  });

  it('should support custom transform', () => {
    const customFn = vi.fn((code: string) => `/* custom */ ${code}`);
    const kernel = setup({ transform: customFn });
    let result = '';
    kernel.emit('__transform', 'const x = 1;', 'test.js', (code: string) => { result = code; });
    expect(result).toContain('/* custom */');
    expect(customFn).toHaveBeenCalled();
  });

  it('should transform JSX self-closing tags', () => {
    const kernel = setup();
    let result = '';
    kernel.emit('__transform', 'const el = <div className="box" />;', 'test.jsx', (code: string) => { result = code; });
    expect(result).toContain('React.createElement');
    expect(result).toContain('"div"');
    expect(result).toContain('className');
  });

  it('should transform JSX with children', () => {
    const kernel = setup();
    let result = '';
    kernel.emit('__transform', 'const el = <div>Hello</div>;', 'test.jsx', (code: string) => { result = code; });
    expect(result).toContain('React.createElement');
    expect(result).toContain('"div"');
    expect(result).toContain('"Hello"');
  });

  it('should treat uppercase tags as components', () => {
    const kernel = setup();
    let result = '';
    kernel.emit('__transform', 'const el = <MyComponent />;', 'test.jsx', (code: string) => { result = code; });
    expect(result).toContain('React.createElement(MyComponent');
    expect(result).not.toContain('"MyComponent"');
  });

  it('should handle TSX with both TS stripping and JSX transform', () => {
    const kernel = setup();
    let result = '';
    const code = 'const x: number = 1;\nconst el = <div />;';
    kernel.emit('__transform', code, 'test.tsx', (code: string) => { result = code; });
    expect(result).not.toContain(': number');
    expect(result).toContain('React.createElement');
  });

  it('should return cached result for unchanged code', () => {
    const kernel = setup();
    const transform = (kernel as any)._transform;
    const code = 'export const a = 1;';
    const result1 = transform.transform(code, 'cache-test.js');
    const result2 = transform.transform(code, 'cache-test.js');
    expect(result1).toBe(result2);
    expect(transform.cacheSize()).toBe(1);
  });

  it('should invalidate cache when code changes', () => {
    const kernel = setup();
    const transform = (kernel as any)._transform;
    const result1 = transform.transform('export const a = 1;', 'change.js');
    const result2 = transform.transform('export const a = 2;', 'change.js');
    expect(result1).not.toBe(result2);
  });

  it('should clear cache', () => {
    const kernel = setup();
    const transform = (kernel as any)._transform;
    transform.transform('export const x = 1;', 'clear.js');
    expect(transform.cacheSize()).toBe(1);
    transform.clearCache();
    expect(transform.cacheSize()).toBe(0);
  });

  it('should transform JSX expression children', () => {
    const kernel = setup();
    let result = '';
    kernel.emit('__transform', 'const el = <span>{name}</span>;', 'test.jsx', (code: string) => { result = code; });
    expect(result).toContain('React.createElement');
    expect(result).toContain('name');
  });

  it('should transform JSX with attribute expressions', () => {
    const kernel = setup();
    let result = '';
    kernel.emit('__transform', 'const el = <div onClick={handler} />;', 'test.jsx', (code: string) => { result = code; });
    expect(result).toContain('onClick: handler');
  });

  it('should skip custom transform when provided', () => {
    const kernel = setup({ transform: (code) => `// transformed\n${code}` });
    let result = '';
    // Custom transform should NOT do JSX/TS processing
    kernel.emit('__transform', 'const x: number = 1;', 'test.ts', (code: string) => { result = code; });
    expect(result).toContain(': number'); // Custom didn't strip TS
    expect(result).toContain('// transformed');
  });

  it('should transform JSX opening/closing tags with no children', () => {
    const kernel = setup();
    let result = '';
    kernel.emit('__transform', 'const el = <div></div>;', 'test.jsx', (code: string) => { result = code; });
    expect(result).toContain('React.createElement');
    expect(result).toContain('"div"');
    expect(result).toContain('null');
  });

  it('should transform JSX boolean attribute', () => {
    const kernel = setup();
    let result = '';
    kernel.emit('__transform', 'const el = <input disabled />;', 'test.jsx', (code: string) => { result = code; });
    expect(result).toContain('disabled: true');
  });

  it('should transform JSX single-quoted attribute', () => {
    const kernel = setup();
    let result = '';
    kernel.emit('__transform', "const el = <div id='main' />;", 'test.jsx', (code: string) => { result = code; });
    expect(result).toContain('id: "main"');
  });

  it('should transform JSX with no attributes', () => {
    const kernel = setup();
    let result = '';
    kernel.emit('__transform', 'const el = <span>text</span>;', 'test.jsx', (code: string) => { result = code; });
    expect(result).toContain('React.createElement("span", null');
  });

  it('should treat uppercase opening/closing tags as components', () => {
    const kernel = setup();
    let result = '';
    kernel.emit('__transform', 'const el = <MyComponent>Hello</MyComponent>;', 'test.jsx', (code: string) => { result = code; });
    expect(result).toContain('React.createElement(MyComponent');
    expect(result).not.toContain('"MyComponent"');
    expect(result).toContain('"Hello"');
  });

  it('should handle JSX children with whitespace around expressions', () => {
    const kernel = setup();
    let result = '';
    kernel.emit('__transform', 'const el = <div> {name} </div>;', 'test.jsx', (code: string) => { result = code; });
    expect(result).toContain('React.createElement');
    expect(result).toContain('name');
  });

  it('should ignore beforeExecute with non-string args', () => {
    const kernel = setup();
    // Emit beforeExecute with non-string args — transform should skip
    expect(() => kernel.emit('beforeExecute', 123, null)).not.toThrow();
  });
});
