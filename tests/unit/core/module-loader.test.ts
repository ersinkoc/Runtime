import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createModuleLoader, findImportSpecifiers, replaceSpecifier } from '../../../src/core/module-loader.js';
import { createKernel, createConfig } from '../../../src/kernel.js';
import { VirtualFS } from '../../../src/vfs/virtual-fs.js';
import { resetInodeCounter } from '../../../src/vfs/fs-node.js';
import { RuntimeError } from '../../../src/errors.js';
import type { RuntimeKernel } from '../../../src/types.js';

describe('createModuleLoader', () => {
  let kernel: RuntimeKernel;
  let vfs: VirtualFS;

  beforeEach(() => {
    resetInodeCounter();
    kernel = createKernel(createConfig());
    vfs = new VirtualFS();
    (kernel as any)._setVfs(vfs);
  });

  describe('require', () => {
    it('should execute and return module.exports', () => {
      const loader = createModuleLoader(kernel);
      vfs.writeFileSync('/app.js', 'module.exports = 42;');
      expect(loader.require('/app.js', '/')).toBe(42);
    });

    it('should support exports.prop pattern', () => {
      const loader = createModuleLoader(kernel);
      vfs.writeFileSync('/app.js', 'exports.hello = "world";');
      const result = loader.require('/app.js', '/') as any;
      expect(result.hello).toBe('world');
    });

    it('should provide __filename and __dirname', () => {
      const loader = createModuleLoader(kernel);
      vfs.mkdirSync('/app', { recursive: true });
      vfs.writeFileSync('/app/index.js', 'module.exports = { f: __filename, d: __dirname };');
      const result = loader.require('/app/index.js', '/') as any;
      expect(result.f).toBe('/app/index.js');
      expect(result.d).toBe('/app');
    });

    it('should cache modules', () => {
      const loader = createModuleLoader(kernel);
      vfs.writeFileSync('/counter.js', 'module.exports = { count: 0 };');
      const first = loader.require('/counter.js', '/') as any;
      first.count++;
      const second = loader.require('/counter.js', '/') as any;
      expect(second.count).toBe(1); // same reference
    });

    it('should handle circular dependencies', () => {
      const loader = createModuleLoader(kernel);
      vfs.writeFileSync('/a.js', `
        exports.value = 'a';
        const b = require('./b.js');
        exports.bValue = b.value;
      `);
      vfs.writeFileSync('/b.js', `
        exports.value = 'b';
        const a = require('./a.js');
        exports.aValue = a.value;
      `);
      const a = loader.require('/a.js', '/') as any;
      expect(a.value).toBe('a');
      expect(a.bValue).toBe('b');
    });

    it('should resolve built-in modules', () => {
      const loader = createModuleLoader(kernel);
      const mockPath = { join: () => 'joined' };
      loader.registerBuiltin('path', mockPath);
      vfs.writeFileSync('/app.js', `
        const path = require('path');
        module.exports = path.join();
      `);
      expect(loader.require('/app.js', '/')).toBe('joined');
    });

    it('should handle JSON files', () => {
      const loader = createModuleLoader(kernel);
      vfs.writeFileSync('/data.json', '{"key": "value"}');
      const result = loader.require('/data.json', '/') as any;
      expect(result.key).toBe('value');
    });

    it('should throw on module not found', () => {
      const loader = createModuleLoader(kernel);
      expect(() => loader.require('./missing', '/')).toThrow(RuntimeError);
    });

    it('should throw on syntax error', () => {
      const loader = createModuleLoader(kernel);
      vfs.writeFileSync('/bad.js', 'this is not valid javascript!!!{{{');
      expect(() => loader.require('/bad.js', '/')).toThrow();
    });

    it('should throw on runtime error', () => {
      const loader = createModuleLoader(kernel);
      vfs.writeFileSync('/error.js', 'throw new Error("runtime error");');
      expect(() => loader.require('/error.js', '/')).toThrow('runtime error');
    });

    it('should require relative modules from within modules', () => {
      const loader = createModuleLoader(kernel);
      vfs.mkdirSync('/lib', { recursive: true });
      vfs.writeFileSync('/lib/helper.js', 'module.exports = "helper";');
      vfs.writeFileSync('/app.js', 'module.exports = require("./lib/helper.js");');
      expect(loader.require('/app.js', '/')).toBe('helper');
    });

    it('should resolve from node_modules', () => {
      const loader = createModuleLoader(kernel);
      vfs.mkdirSync('/node_modules/mylib', { recursive: true });
      vfs.writeFileSync('/node_modules/mylib/index.js', 'module.exports = "mylib";');
      vfs.writeFileSync('/app.js', 'module.exports = require("mylib");');
      expect(loader.require('/app.js', '/')).toBe('mylib');
    });

    it('should handle invalid JSON', () => {
      const loader = createModuleLoader(kernel);
      vfs.writeFileSync('/bad.json', '{not valid json}');
      expect(() => loader.require('/bad.json', '/')).toThrow(RuntimeError);
    });

    it('should wrap non-Error throw as EXECUTION_ERROR', () => {
      const loader = createModuleLoader(kernel);
      vfs.writeFileSync('/throws-string.js', 'throw "string error";');
      expect(() => loader.require('/throws-string.js', '/')).toThrow('string error');
    });

    it('should throw MODULE_NOT_FOUND when readFileSync fails after resolve', () => {
      const loader = createModuleLoader(kernel);
      vfs.writeFileSync('/exists.js', 'module.exports = 1;');
      const origRead = vfs.readFileSync.bind(vfs);
      vfs.readFileSync = ((path: string, encoding?: string) => {
        if (path === '/exists.js') throw new Error('disk error');
        return origRead(path, encoding);
      }) as any;
      try {
        expect(() => loader.require('/exists.js', '/')).toThrow('Cannot find module');
      } finally {
        vfs.readFileSync = origRead;
      }
    });

    it('should rethrow RuntimeError from nested require without wrapping', () => {
      const loader = createModuleLoader(kernel);
      vfs.writeFileSync('/needs-missing.js', 'require("./does-not-exist");');
      expect(() => loader.require('/needs-missing.js', '/')).toThrow(RuntimeError);
    });

    it('should pass through .ts code when no transform handler emits result', () => {
      const loader = createModuleLoader(kernel);
      // .ts extension triggers transformCode, but no handler emits __transformResult
      // result stays undefined → returns original code via ?? fallback
      vfs.writeFileSync('/valid.ts', 'module.exports = 55;');
      const result = loader.require('/valid.ts', '/');
      expect(result).toBe(55);
    });

    it('should transform .ts files via transformCode in require path', () => {
      const loader = createModuleLoader(kernel);
      // Register a beforeExecute handler that strips TS type annotations
      kernel.on('beforeExecute', (code: unknown) => {
        if (typeof code === 'string') {
          kernel.emit('__transformResult', code.replace(/:\s*number/g, ''));
        }
      });
      vfs.writeFileSync('/typed.ts', 'const x: number = 42; module.exports = x;');
      const result = loader.require('/typed.ts', '/');
      expect(result).toBe(42);
    });
  });

  describe('import', () => {
    it('should fall back to CJS when Blob URL is not available', async () => {
      const loader = createModuleLoader(kernel);
      vfs.writeFileSync('/app.js', 'module.exports = 42;');
      const result = await loader.import('/app.js', '/');
      expect(result).toBe(42);
    });

    it('should use early CJS fallback when URL.createObjectURL is undefined', async () => {
      const loader = createModuleLoader(kernel);
      vfs.writeFileSync('/app.js', 'module.exports = 99;');
      const origCreate = URL.createObjectURL;
      // Use assignment instead of delete — property may be non-configurable
      (URL as any).createObjectURL = undefined;
      try {
        const result = await loader.import('/app.js', '/');
        expect(result).toBe(99);
      } finally {
        URL.createObjectURL = origCreate;
      }
    });

    it('should cache ESM import results on repeated calls', async () => {
      const loader = createModuleLoader(kernel);
      vfs.writeFileSync('/cached.js', 'module.exports = { val: 123 };');
      const first = await loader.import('/cached.js', '/');
      const second = await loader.import('/cached.js', '/');
      expect(first).toBe(second);
    });

    it('should resolve builtins directly', async () => {
      const loader = createModuleLoader(kernel);
      const mockPath = { join: () => 'joined' };
      loader.registerBuiltin('path', mockPath);
      const result = await loader.import('path', '/');
      expect(result).toBe(mockPath);
    });

    it('should exercise Blob URL path with specifier rewriting', async () => {
      const loader = createModuleLoader(kernel);

      // Register builtins — object (has keys) and function (non-object → empty keys)
      loader.registerBuiltin('path', { join: () => 'joined', sep: '/' });
      loader.registerBuiltin('my-fn', () => 'hello');

      // Register a beforeExecute listener that emits __transformResult
      // This exercises the handler function inside transformCode
      kernel.on('beforeExecute', (code: unknown) => {
        kernel.emit('__transformResult', code);
      });

      // Create VFS files
      vfs.writeFileSync('/helper.js', 'module.exports = "helped";');
      vfs.writeFileSync('/data.json', '{"key":"value"}');
      vfs.writeFileSync('/typed.ts', 'const x: number = 1; export default x;');
      // /other.js also references helper.js — triggers blobUrlCache hit
      vfs.writeFileSync('/other.js', [
        "// from './helper.js'",
        "// from './data.json'",
        "// from './typed.ts'",
        'module.exports = "other";',
      ].join('\n'));
      // Main app imports builtins, VFS files, and nonexistent
      vfs.writeFileSync('/app.js', [
        "// from 'path'",
        "// from 'my-fn'",
        "// from './helper.js'",
        "// from './other.js'",
        "// from 'nonexistent-pkg'",
        'module.exports = 42;',
      ].join('\n'));

      // Mock URL.createObjectURL/revokeObjectURL to enable the Blob URL path
      const origCreate = URL.createObjectURL;
      const origRevoke = URL.revokeObjectURL;
      let counter = 0;
      URL.createObjectURL = () => `blob:mock-${counter++}`;
      URL.revokeObjectURL = vi.fn();

      try {
        const result = await loader.import('/app.js', '/');
        expect(result).toBe(42);
        expect(URL.revokeObjectURL).toHaveBeenCalled();
      } finally {
        URL.createObjectURL = origCreate;
        URL.revokeObjectURL = origRevoke;
      }
    });

    it('should return ESM module when Blob URL import succeeds', async () => {
      const loader = createModuleLoader(kernel);
      vfs.writeFileSync('/esm.js', 'export default 42;');

      const origCreate = URL.createObjectURL;
      const origRevoke = URL.revokeObjectURL;
      URL.createObjectURL = () => 'data:text/javascript,export default 42';
      URL.revokeObjectURL = vi.fn();

      try {
        const result = await loader.import('/esm.js', '/') as any;
        expect(result.default).toBe(42);
      } finally {
        URL.createObjectURL = origCreate;
        URL.revokeObjectURL = origRevoke;
      }
    });

    it('should fall back to CJS when readFileSync fails inside buildBlobUrl', async () => {
      const loader = createModuleLoader(kernel);
      vfs.writeFileSync('/app.js', 'module.exports = 77;');

      const origRead = vfs.readFileSync.bind(vfs);
      let callCount = 0;
      vfs.readFileSync = ((path: string, encoding?: string) => {
        if (path === '/app.js' && callCount++ === 0) throw new Error('read error');
        return origRead(path, encoding);
      }) as any;

      const origCreate = URL.createObjectURL;
      const origRevoke = URL.revokeObjectURL;
      URL.createObjectURL = () => 'blob:mock';
      URL.revokeObjectURL = vi.fn();

      try {
        const result = await loader.import('/app.js', '/');
        expect(result).toBe(77);
      } finally {
        URL.createObjectURL = origCreate;
        URL.revokeObjectURL = origRevoke;
        vfs.readFileSync = origRead;
      }
    });
  });

  describe('registerBuiltin', () => {
    it('should register and resolve builtins', () => {
      const loader = createModuleLoader(kernel);
      const myModule = { fn: () => 'result' };
      loader.registerBuiltin('my-module', myModule);
      vfs.writeFileSync('/app.js', 'module.exports = require("my-module").fn();');
      expect(loader.require('/app.js', '/')).toBe('result');
    });
  });

  describe('clearCache', () => {
    it('should clear module cache', () => {
      const loader = createModuleLoader(kernel);
      vfs.writeFileSync('/counter.js', 'module.exports = { count: 0 };');
      const first = loader.require('/counter.js', '/') as any;
      first.count = 5;
      loader.clearCache();
      const second = loader.require('/counter.js', '/') as any;
      expect(second.count).toBe(0); // fresh module
    });
  });
});

describe('findImportSpecifiers', () => {
  it('should find named imports', () => {
    expect(findImportSpecifiers("import { foo } from 'bar'")).toEqual(['bar']);
  });

  it('should find default imports', () => {
    expect(findImportSpecifiers("import foo from 'bar'")).toEqual(['bar']);
  });

  it('should find namespace imports', () => {
    expect(findImportSpecifiers("import * as ns from 'bar'")).toEqual(['bar']);
  });

  it('should find side-effect imports', () => {
    expect(findImportSpecifiers("import 'polyfill'")).toEqual(['polyfill']);
  });

  it('should find dynamic imports', () => {
    expect(findImportSpecifiers("const m = import('foo')")).toEqual(['foo']);
  });

  it('should find re-exports', () => {
    expect(findImportSpecifiers("export { foo } from 'bar'")).toEqual(['bar']);
  });

  it('should find export * from', () => {
    expect(findImportSpecifiers("export * from 'utils'")).toEqual(['utils']);
  });

  it('should deduplicate specifiers', () => {
    const code = "import { a } from 'x';\nimport { b } from 'x';";
    expect(findImportSpecifiers(code)).toEqual(['x']);
  });

  it('should handle double quotes', () => {
    expect(findImportSpecifiers('import { foo } from "bar"')).toEqual(['bar']);
  });

  it('should find multiple different specifiers', () => {
    const code = `
      import { a } from 'x';
      import b from 'y';
      import 'z';
    `;
    const specs = findImportSpecifiers(code);
    expect(specs).toContain('x');
    expect(specs).toContain('y');
    expect(specs).toContain('z');
  });
});

describe('replaceSpecifier', () => {
  it('should replace from specifier', () => {
    const code = "import { foo } from 'bar'";
    expect(replaceSpecifier(code, 'bar', 'blob:xxx')).toBe("import { foo } from 'blob:xxx'");
  });

  it('should replace side-effect import', () => {
    const code = "import 'polyfill'";
    expect(replaceSpecifier(code, 'polyfill', 'blob:xxx')).toBe("import 'blob:xxx'");
  });

  it('should replace dynamic import', () => {
    const code = "import('foo')";
    expect(replaceSpecifier(code, 'foo', 'blob:xxx')).toBe("import('blob:xxx')");
  });

  it('should handle special regex characters in specifier', () => {
    const code = "import { foo } from './utils.js'";
    expect(replaceSpecifier(code, './utils.js', 'blob:xxx')).toBe("import { foo } from 'blob:xxx'");
  });

  it('should replace all occurrences', () => {
    const code = "import { a } from 'x';\nimport { b } from 'x';";
    const result = replaceSpecifier(code, 'x', 'blob:xxx');
    expect(result).toBe("import { a } from 'blob:xxx';\nimport { b } from 'blob:xxx';");
  });

  it('should handle double quotes', () => {
    const code = 'import { foo } from "bar"';
    expect(replaceSpecifier(code, 'bar', 'blob:xxx')).toBe('import { foo } from "blob:xxx"');
  });

  it('should replace re-export specifiers', () => {
    const code = "export { foo } from 'bar'";
    expect(replaceSpecifier(code, 'bar', 'blob:xxx')).toBe("export { foo } from 'blob:xxx'");
  });
});
