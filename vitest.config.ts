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
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
