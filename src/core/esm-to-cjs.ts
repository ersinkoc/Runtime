/**
 * Simple regex-based ESM to CJS converter.
 * Used as sync fallback when esbuild-wasm is not yet loaded.
 * @module core/esm-to-cjs
 */

/**
 * Convert ESM syntax to CJS using regex transformations.
 * This is a simplified converter — handles common patterns but not all edge cases.
 * For full conversion, use esbuild via the transform plugin.
 *
 * @example
 * ```typescript
 * const cjs = esmToCjs("import { foo } from 'bar'; export default 42;");
 * // "const { foo } = require('bar'); module.exports = 42;"
 * ```
 */
export function esmToCjs(code: string): string {
  let result = code;

  // import defaultExport, { named } from 'module' (mixed default + named — must come first)
  result = result.replace(
    /import\s+(\w+)\s*,\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]\s*;?/g,
    (_, def: string, imports: string, mod: string) => {
      const cleaned = imports.replace(/\s+as\s+/g, ': ');
      return `const ${def} = require('${mod}');\nconst {${cleaned}} = ${def};`;
    },
  );

  // import { x, y } from 'module' (supports multiline via [^}] which matches newlines)
  result = result.replace(
    /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]\s*;?/g,
    (_, imports: string, mod: string) => {
      const cleaned = imports
        .replace(/\s+as\s+/g, ': ')
        .replace(/\s*\btype\s+/g, '')  // strip TypeScript `type` keyword in import list
        .replace(/\n/g, ' ');            // collapse multiline to single line
      return `const {${cleaned}} = require('${mod}');`;
    },
  );

  // import * as name from 'module' (must come before default import)
  result = result.replace(
    /import\s*\*\s*as\s+(\w+)\s+from\s*['"]([^'"]+)['"]\s*;?/g,
    (_, name: string, mod: string) => `const ${name} = require('${mod}');`,
  );

  // import defaultExport from 'module'
  result = result.replace(
    /import\s+(\w+)\s+from\s*['"]([^'"]+)['"]\s*;?/g,
    (_, name: string, mod: string) => `const ${name} = require('${mod}');`,
  );

  // import 'module' (side-effect)
  result = result.replace(
    /import\s*['"]([^'"]+)['"]\s*;?/g,
    (_, mod: string) => `require('${mod}');`,
  );

  // export default expression
  result = result.replace(
    /export\s+default\s+/g,
    'module.exports = ',
  );

  // export * from 'module' (re-export all)
  result = result.replace(
    /export\s*\*\s*from\s*['"]([^'"]+)['"]\s*;?/g,
    (_, mod: string) => `Object.assign(exports, require('${mod}'));`,
  );

  // export { x, y } from 'module' (re-export with from clause — must come before local exports)
  result = result.replace(
    /export\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]\s*;?/g,
    (_, exports: string, mod: string) => {
      const names = exports.split(',').map((n) => n.trim()).filter(Boolean);
      const tmpVar = '__reexport';
      const assignments = names.map((n) => {
        const parts = n.split(/\s+as\s+/);
        const imported = parts[0]!.trim();
        const exported = (parts[1] ?? parts[0])!.trim();
        if (exported === 'default') {
          return `module.exports = ${tmpVar}['${imported}'];`;
        }
        return `exports.${exported} = ${tmpVar}['${imported}'];`;
      });
      return `const ${tmpVar} = require('${mod}');\n${assignments.join('\n')}`;
    },
  );

  // export { x, y } (local exports — no from clause)
  result = result.replace(
    /export\s*\{([^}]+)\}\s*;?/g,
    (_, exports: string) => {
      const names = exports.split(',').map((n) => n.trim()).filter(Boolean);
      return names
        .map((n) => {
          const parts = n.split(/\s+as\s+/);
          const local = parts[0]!.trim();
          const exported = (parts[1] ?? parts[0])!.trim();
          return `exports.${exported} = ${local};`;
        })
        .join('\n');
    },
  );

  // export const/let/var name = value → const name = value;\nexports.name = name;
  result = result.replace(
    /export\s+(const|let|var)\s+(\w+)\s*=\s*([^;\n]+);?/g,
    (_, decl: string, name: string, value: string) => `${decl} ${name} = ${value};\nexports.${name} = ${name};`,
  );

  // Collect exported function/class names to append exports at end
  const exportedNames: string[] = [];

  // export function name(...) → function name(...)
  result = result.replace(
    /export\s+function\s+(\w+)/g,
    (_, name: string) => { exportedNames.push(name); return `function ${name}`; },
  );

  // export class name → class name
  result = result.replace(
    /export\s+class\s+(\w+)/g,
    (_, name: string) => { exportedNames.push(name); return `class ${name}`; },
  );

  // Append exports assignments for collected function/class names
  if (exportedNames.length > 0) {
    result += '\n' + exportedNames.map((n) => `exports.${n} = ${n};`).join('\n');
  }

  return result;
}

/**
 * Strip TypeScript type annotations using simple regex patterns.
 * This is a best-effort approach — complex cases need esbuild.
 *
 * @example
 * ```typescript
 * const js = stripTypeAnnotations('const x: number = 42;');
 * // 'const x = 42;'
 * ```
 */
export function stripTypeAnnotations(code: string): string {
  let result = code;

  // Remove interface/type declarations (entire blocks)
  result = result.replace(/^(export\s+)?(interface|type)\s+\w+[^{]*\{[^}]*\}\s*;?\s*$/gm, '');
  result = result.replace(/^(export\s+)?type\s+\w+\s*=\s*[^;]+;\s*$/gm, '');

  // Remove : type annotations (simplified)
  // e.g., const x: string = 'hello' → const x = 'hello'
  result = result.replace(/:\s*(?:string|number|boolean|any|void|never|unknown|undefined|null)\b(\s*[=,;\)\]])/g, '$1');

  // Remove generic type params < ... > in function calls/definitions (simplified)
  result = result.replace(/<[A-Z]\w*(?:\s*,\s*[A-Z]\w*)*>/g, '');

  // Remove 'as' type assertions (simplified)
  result = result.replace(/\s+as\s+\w+/g, '');

  return result;
}
