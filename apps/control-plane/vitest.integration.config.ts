import path from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    root: './',
    include: ['src/**/*.integration.test.ts'],
    globalSetup: ['src/test/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage/integration',
      reporter: ['json'],
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.spec.ts',
        '**/*.test.ts',
        'src/main.ts',
        'src/telemetry.ts',
        'src/test/**',
        'src/**/*.module.ts',
        'src/**/*.config.ts',
        'src/**/*.dto.ts',
        'src/**/index.ts',
        'src/**/*.decorator.ts',
        'src/**/*.types.ts',
      ],
      excludeAfterRemap: true,
    },
  },
});
