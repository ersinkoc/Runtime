/**
 * Example 01 — Basic Usage
 *
 * Demonstrates creating a container and running simple Node.js code.
 */
import { createContainer } from '@oxog/runtime';

// 1. Create a full runtime container
const container = createContainer();

// 2. Write a simple module to the VFS
container.vfs.writeFileSync('/app.js', `
  const path = require('path');
  const { Buffer } = require('buffer');

  const greeting = Buffer.from('Hello World').toString('base64');
  const joined = path.join('/users', 'ersin', 'projects');

  module.exports = { greeting, joined };
`);

// 3. Run the module
const result = container.runFile('/app.js');
console.log(result.exports);
// { greeting: 'SGVsbG8gV29ybGQ=', joined: '/users/ersin/projects' }

// 4. Use require directly
const pathShim = container.require('path') as any;
console.log(pathShim.extname('app.tsx')); // '.tsx'

// 5. Execute inline code
const inline = container.execute('module.exports = 2 + 2;');
console.log(inline.exports); // 4

// 6. Multi-file project
container.vfs.mkdirSync('/src', { recursive: true });
container.vfs.writeFileSync('/src/math.js', `
  exports.add = (a, b) => a + b;
  exports.multiply = (a, b) => a * b;
`);
container.vfs.writeFileSync('/src/main.js', `
  const { add, multiply } = require('./math');
  module.exports = { sum: add(3, 4), product: multiply(5, 6) };
`);

const project = container.runFile('/src/main.js');
console.log(project.exports); // { sum: 7, product: 30 }
