import { describe, it, expect } from 'vitest';
import { esmToCjs, stripTypeAnnotations } from '../../../src/core/esm-to-cjs.js';

describe('esmToCjs', () => {
  it('should convert named imports', () => {
    const result = esmToCjs("import { foo, bar } from 'module';");
    expect(result).toContain("const { foo, bar } = require('module')");
  });

  it('should convert default imports', () => {
    const result = esmToCjs("import myModule from 'module';");
    expect(result).toContain("const myModule = require('module')");
  });

  it('should convert namespace imports', () => {
    const result = esmToCjs("import * as ns from 'module';");
    expect(result).toContain("const ns = require('module')");
  });

  it('should convert side-effect imports', () => {
    const result = esmToCjs("import 'module';");
    expect(result).toContain("require('module')");
  });

  it('should convert export default', () => {
    const result = esmToCjs('export default 42;');
    expect(result).toContain('module.exports = 42');
  });

  it('should convert named exports', () => {
    const result = esmToCjs('export { foo, bar };');
    expect(result).toContain('exports.foo = foo');
    expect(result).toContain('exports.bar = bar');
  });

  it('should convert aliased imports', () => {
    const result = esmToCjs("import { foo as bar } from 'module';");
    expect(result).toContain("const { foo: bar } = require('module')");
  });

  it('should convert export const', () => {
    const result = esmToCjs('export const x = 42;');
    expect(result).toContain('const x = 42;');
    expect(result).toContain('exports.x = x;');
  });

  it('should convert export let', () => {
    const result = esmToCjs("export let name = 'hello';");
    expect(result).toContain("let name = 'hello';");
    expect(result).toContain('exports.name = name;');
  });

  it('should convert export function', () => {
    const result = esmToCjs('export function hello() {}');
    expect(result).toContain('function hello()');
    expect(result).toContain('exports.hello = hello;');
  });

  it('should convert export class', () => {
    const result = esmToCjs('export class Foo {}');
    expect(result).toContain('class Foo');
    expect(result).toContain('exports.Foo = Foo;');
  });

  it('should handle aliased exports', () => {
    const result = esmToCjs('export { foo as bar };');
    expect(result).toContain('exports.bar = foo');
  });

  it('should handle mixed content', () => {
    const code = `
import { readFileSync } from 'fs';
const content = readFileSync('/test.txt', 'utf8');
export default content;
`;
    const result = esmToCjs(code);
    expect(result).toContain("require('fs')");
    expect(result).toContain('module.exports = content');
  });

  // Re-export patterns
  it('should convert export * from', () => {
    const result = esmToCjs("export * from './utils';");
    expect(result).toContain("Object.assign(exports, require('./utils'))");
  });

  it('should convert re-export named: export { x } from', () => {
    const result = esmToCjs("export { foo, bar } from './utils';");
    expect(result).toContain("require('./utils')");
    expect(result).toContain("exports.foo = __reexport['foo']");
    expect(result).toContain("exports.bar = __reexport['bar']");
  });

  it('should convert re-export with rename: export { x as y } from', () => {
    const result = esmToCjs("export { internal as publicName } from './lib';");
    expect(result).toContain("require('./lib')");
    expect(result).toContain("exports.publicName = __reexport['internal']");
  });

  it('should convert re-export default: export { default } from', () => {
    const result = esmToCjs("export { default } from './main';");
    expect(result).toContain("require('./main')");
    expect(result).toContain("module.exports = __reexport['default']");
  });

  // Mixed default + named import
  it('should convert mixed default and named imports', () => {
    const result = esmToCjs("import React, { useState, useEffect } from 'react';");
    expect(result).toContain("const React = require('react')");
    expect(result).toContain('const { useState, useEffect } = React');
  });

  // Multiline imports
  it('should convert multiline imports', () => {
    const code = `import {
  readFileSync,
  writeFileSync,
  mkdirSync,
} from 'fs';`;
    const result = esmToCjs(code);
    expect(result).toContain("require('fs')");
    expect(result).toContain('readFileSync');
    expect(result).toContain('writeFileSync');
    expect(result).toContain('mkdirSync');
    expect(result).not.toContain('import');
  });

  // Double quotes
  it('should handle double-quoted imports', () => {
    const result = esmToCjs('import { foo } from "module";');
    expect(result).toContain("require('module')");
  });

  // export default function
  it('should convert export default function', () => {
    const result = esmToCjs('export default function hello() { return 1; }');
    expect(result).toContain('module.exports = function hello()');
  });

  // export default class
  it('should convert export default class', () => {
    const result = esmToCjs('export default class Foo { }');
    expect(result).toContain('module.exports = class Foo');
  });

  // export var
  it('should convert export var', () => {
    const result = esmToCjs('export var count = 0;');
    expect(result).toContain('var count = 0;');
    expect(result).toContain('exports.count = count;');
  });
});

describe('stripTypeAnnotations', () => {
  it('should strip simple type annotations', () => {
    const result = stripTypeAnnotations('const x: number = 42;');
    expect(result).toContain('const x = 42');
  });

  it('should strip string type annotations', () => {
    const result = stripTypeAnnotations("const name: string = 'hello';");
    expect(result).toContain("const name = 'hello'");
  });

  it('should strip boolean type annotations', () => {
    const result = stripTypeAnnotations('const flag: boolean = true;');
    expect(result).toContain('const flag = true');
  });

  it('should remove interface declarations', () => {
    const result = stripTypeAnnotations('interface User { name: string; }');
    expect(result.trim()).toBe('');
  });

  it('should remove type alias declarations', () => {
    const result = stripTypeAnnotations('type ID = string;');
    expect(result.trim()).toBe('');
  });

  it('should remove export interface', () => {
    const result = stripTypeAnnotations('export interface User { name: string; }');
    expect(result.trim()).toBe('');
  });

  it('should strip as assertions', () => {
    const result = stripTypeAnnotations('const x = value as string;');
    expect(result).toContain('const x = value;');
  });

  it('should handle code without annotations', () => {
    const code = 'const x = 42;';
    expect(stripTypeAnnotations(code)).toBe(code);
  });
});
