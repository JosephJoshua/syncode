import { fileURLToPath } from 'node:url';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@syncode/contracts/stubs': fileURLToPath(
        new URL('../../packages/contracts/src/stubs.ts', import.meta.url),
      ),
      '@syncode/contracts': fileURLToPath(
        new URL('../../packages/contracts/src/index.ts', import.meta.url),
      ),
      '@syncode/db': fileURLToPath(new URL('../../packages/db/src/index.ts', import.meta.url)),
      '@syncode/shared/ports': fileURLToPath(
        new URL('../../packages/shared/src/ports/index.ts', import.meta.url),
      ),
      '@syncode/shared/server': fileURLToPath(
        new URL('../../packages/shared/src/server.ts', import.meta.url),
      ),
      '@syncode/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  plugins: [
    // Required for NestJS decorator support in tests.
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    root: './',
    passWithNoTests: true,
    exclude: ['**/*.integration.spec.ts', '**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage/unit',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.spec.ts',
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
