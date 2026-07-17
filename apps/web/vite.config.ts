import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import tanstackRouter from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig, type PluginOption, type ProxyOptions } from 'vite';

const DEV_TERMINAL_ROUTE = '/dev/terminal';
const devTerminalHost = '127.0.0.1';
const devTerminalPort = Number(process.env.DEV_TERMINAL_INTERNAL_PORT ?? 8765);
const devTerminalToken = randomBytes(24).toString('hex');
const viteServerHost = process.env.VITE_HOST ?? process.env.HOST ?? '0.0.0.0';

function rewriteDevTerminalPath(requestPath: string): string {
  const [pathname, search] = requestPath.split('?');
  const rewrittenPath = pathname.replace(new RegExp(`^${DEV_TERMINAL_ROUTE}`), '') || '/';

  return search ? `${rewrittenPath}?${search}` : rewrittenPath;
}

function devTerminalProxy(): ProxyOptions {
  return {
    target: `http://${devTerminalHost}:${devTerminalPort}`,
    changeOrigin: true,
    ws: true,
    rewrite: rewriteDevTerminalPath,
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.setHeader('Authorization', `Bearer ${devTerminalToken}`);
      });
      proxy.on('proxyReqWs', (proxyReq) => {
        proxyReq.setHeader('Authorization', `Bearer ${devTerminalToken}`);
      });
    },
  };
}

function localWebTerminalPlugin(): PluginOption {
  let terminalProcess: ChildProcessWithoutNullStreams | undefined;

  return {
    name: 'syncode-local-web-terminal',
    apply: 'serve',
    configureServer(server) {
      const appDir = resolveTerminalAppDir();
      const shell = process.env.DEV_TERMINAL_SHELL ?? process.env.SHELL ?? '/bin/bash';
      const cwd = process.env.DEV_TERMINAL_CWD ?? resolveWorkspaceRoot(appDir);

      terminalProcess = spawn(
        process.env.PYTHON ?? 'python3',
        [
          'server.py',
          '--host',
          devTerminalHost,
          '--port',
          String(devTerminalPort),
          '--shell',
          shell,
          '--cwd',
          cwd,
        ],
        {
          cwd: appDir,
          env: {
            ...process.env,
            COMMAND_PANEL_TOKEN: devTerminalToken,
          },
        },
      );

      terminalProcess.stdout.on('data', (data) => {
        server.config.logger.info(String(data).trim());
      });
      terminalProcess.stderr.on('data', (data) => {
        server.config.logger.error(String(data).trim());
      });
      terminalProcess.on('exit', (code, signal) => {
        server.config.logger.info(
          `Local web terminal exited with code ${code ?? 'none'} (${signal ?? 'none'})`,
        );
        terminalProcess = undefined;
      });

      server.httpServer?.once('close', () => {
        terminalProcess?.kill('SIGTERM');
      });
    },
  };
}

function resolveTerminalAppDir(): string {
  const appDir = path.resolve(
    fileURLToPath(new URL('.', import.meta.url)),
    'tools/local-web-terminal',
  );

  if (!existsSync(path.join(appDir, 'server.py'))) {
    throw new Error('Could not find tools/local-web-terminal/server.py.');
  }

  return appDir;
}

function resolveWorkspaceRoot(appDir: string): string {
  let current = appDir;

  while (path.dirname(current) !== current) {
    if (existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }

    current = path.dirname(current);
  }

  return process.cwd();
}

export default defineConfig({
  plugins: [localWebTerminalPlugin(), tanstackRouter(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: viteServerHost,
    allowedHosts: ['deltawood.my', 'www.deltawood.my', 'collab.deltawood.my'],

    proxy: {
      [DEV_TERMINAL_ROUTE]: devTerminalProxy(),
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
      '/storage': {
        target: 'http://localhost:8333',
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/storage/, ''),
      },
    },
  },
});
