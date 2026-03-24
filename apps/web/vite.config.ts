import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import tanstackRouter from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tanstackRouter(), react(), tailwindcss()],
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
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
});
