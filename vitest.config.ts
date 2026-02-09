import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/', 'tests/', 'website/', 'examples/', 'dist/', '*.config.*',
        'src/types.ts',
        'src/shims/child_process.ts',  // untestable — requires process spawning
        'src/vfs/opfs-backend.ts',      // untestable — requires OPFS API
        'src/plugins/index.ts',         // pure re-export barrel — no logic to cover
      ],
      thresholds: {
        // vitest 4.x v8 engine counts phantom branches (optional chaining,
        // nullish coalescing, ternaries) differently than vitest 2.x.
        // Remaining gaps: ESM blob URL paths (untestable in happy-dom),
        // v8 phantom branches, and internal callback adapters.
        statements: 99.8,
        branches: 99,
        functions: 99,
        lines: 99.9,
      },
    },
  },
});
