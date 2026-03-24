import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@syncode\/contracts\/route-utils$/,
        replacement: fileURLToPath(
          new URL('../../packages/contracts/src/route-utils.ts', import.meta.url),
        ),
      },
      {
        find: /^@syncode\/contracts\/control\/routes$/,
        replacement: fileURLToPath(
          new URL('../../packages/contracts/src/control/routes.ts', import.meta.url),
        ),
      },
      {
        find: /^@syncode\/contracts\/control\/error$/,
        replacement: fileURLToPath(
          new URL('../../packages/contracts/src/control/error.ts', import.meta.url),
        ),
      },
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    passWithNoTests: true,
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/routeTree.gen.ts', 'src/vite-env.d.ts', 'src/test-setup.ts'],
    },
  },
});
