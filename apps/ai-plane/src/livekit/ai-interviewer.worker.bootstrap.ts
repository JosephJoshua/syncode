import { existsSync } from 'node:fs';
import type { Agent } from 'node:http';
import type { RequestOptions } from 'node:https';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineAgent, type JobContext, type JobProcess } from '@livekit/agents';
import { config as loadDotenv } from 'dotenv';
import { HttpsProxyAgent } from 'https-proxy-agent';

const PROXY_ENV_KEYS = [
  'http_proxy',
  'https_proxy',
  'all_proxy',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
] as const;

type HttpsModule = typeof import('node:https');
type PatchedHttpsRequest = HttpsModule['request'] & {
  __syncodeRealtimeProxyPatch?: boolean;
};

type LiveKitAgent = {
  prewarm?: (proc: JobProcess) => Promise<void> | void;
  entry: (ctx: JobContext) => Promise<void> | void;
};

type WorkerModule = {
  default: LiveKitAgent;
  runAiInterviewerWorker: (agentFilePath?: string) => void;
};

let workerModulePromise: Promise<WorkerModule> | undefined;
let bootstrapEnvLoaded = false;

function normalizeOptionalEnvUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') {
    return undefined;
  }

  return trimmed;
}

function loadBootstrapEnvFiles(): void {
  if (bootstrapEnvLoaded) {
    return;
  }
  bootstrapEnvLoaded = true;

  const visited = new Set<string>();
  let cursor = process.cwd();
  let loaded = false;

  while (!visited.has(cursor)) {
    visited.add(cursor);
    const localPath = resolve(cursor, '.env.local');
    const envPath = resolve(cursor, '.env');
    if (existsSync(localPath)) {
      loadDotenv({ path: localPath, override: false });
      loaded = true;
    }
    if (existsSync(envPath)) {
      loadDotenv({ path: envPath, override: false });
      loaded = true;
    }

    const parent = dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }

  if (!loaded) {
    loadDotenv();
  }
}

function isRequestOptions(value: unknown): value is RequestOptions {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hostnameFromUrl(value: string | URL): string | undefined {
  try {
    return new URL(value).hostname;
  } catch {
    return undefined;
  }
}

function hostnameFromOptions(options: RequestOptions): string | undefined {
  const hostname = options.hostname ?? options.host;
  if (!hostname) {
    return undefined;
  }

  return String(hostname).split(':')[0];
}

function resolveHttpsRequestHostname(args: unknown[]): string | undefined {
  const [input, options] = args;

  if (typeof input === 'string' || input instanceof URL) {
    return (
      hostnameFromUrl(input) ??
      (isRequestOptions(options) ? hostnameFromOptions(options) : undefined)
    );
  }

  if (isRequestOptions(input)) {
    return hostnameFromOptions(input);
  }

  return undefined;
}

function withRealtimeProxyAgent(args: unknown[], targetHost: string, proxyAgent: Agent): unknown[] {
  if (resolveHttpsRequestHostname(args) !== targetHost) {
    return args;
  }

  const [input, options] = args;
  if (isRequestOptions(input)) {
    return [{ ...input, agent: input.agent ?? proxyAgent }, ...args.slice(1)];
  }

  if (isRequestOptions(options)) {
    return [input, { ...options, agent: options.agent ?? proxyAgent }, ...args.slice(2)];
  }

  return [input, { agent: proxyAgent }, ...args.slice(1)];
}

export function installRealtimeHttpsProxy(
  proxyUrl: string | undefined,
  realtimeBaseUrl: string | undefined,
): void {
  const normalizedProxyUrl = normalizeOptionalEnvUrl(proxyUrl);
  if (!normalizedProxyUrl) {
    return;
  }

  let protocol: string;
  try {
    protocol = new URL(normalizedProxyUrl).protocol;
  } catch {
    console.warn(
      '[ai-interviewer-worker] OpenAI Realtime proxy URL is invalid; using direct WebSocket',
    );
    return;
  }

  if (protocol !== 'http:' && protocol !== 'https:') {
    console.warn(
      `[ai-interviewer-worker] OpenAI Realtime proxy ${protocol} is not supported by https-proxy-agent; using direct WebSocket`,
    );
    return;
  }

  const targetHost = new URL(
    normalizeOptionalEnvUrl(realtimeBaseUrl) ?? 'https://api.openai.com/v1',
  ).hostname;
  const require = createRequire(import.meta.url);
  const httpsModule = require('node:https') as HttpsModule;
  const currentRequest = httpsModule.request as PatchedHttpsRequest;
  if (currentRequest.__syncodeRealtimeProxyPatch) {
    return;
  }

  const proxyAgent = new HttpsProxyAgent(normalizedProxyUrl) as Agent;
  const originalRequest = httpsModule.request;
  const patchedRequest = function patchedRequest(this: unknown, ...args: unknown[]) {
    return originalRequest.apply(
      this,
      withRealtimeProxyAgent(args, targetHost, proxyAgent) as Parameters<typeof originalRequest>,
    );
  } as PatchedHttpsRequest;

  Object.defineProperty(patchedRequest, '__syncodeRealtimeProxyPatch', { value: true });
  httpsModule.request = patchedRequest;
}

async function loadWorkerModule(): Promise<WorkerModule> {
  prepareAiInterviewerWorkerRuntime();
  workerModulePromise ??= import('./ai-interviewer.worker.js') as Promise<WorkerModule>;
  return workerModulePromise;
}

const currentFilePath = fileURLToPath(import.meta.url);
const agent = defineAgent({
  prewarm: async (proc: JobProcess) => {
    const workerModule = await loadWorkerModule();
    await workerModule.default.prewarm?.(proc);
  },
  entry: async (ctx: JobContext) => {
    const workerModule = await loadWorkerModule();
    await workerModule.default.entry(ctx);
  },
});

export default agent;

export function prepareAiInterviewerWorkerRuntime(): void {
  loadBootstrapEnvFiles();

  const upstreamProxyUrl =
    normalizeOptionalEnvUrl(process.env.OPENAI_REALTIME_PROXY_URL) ??
    normalizeOptionalEnvUrl(process.env.SYNCODE_UPSTREAM_PROXY_URL) ??
    normalizeOptionalEnvUrl(process.env.https_proxy) ??
    normalizeOptionalEnvUrl(process.env.HTTPS_PROXY) ??
    normalizeOptionalEnvUrl(process.env.http_proxy) ??
    normalizeOptionalEnvUrl(process.env.HTTP_PROXY) ??
    normalizeOptionalEnvUrl(process.env.all_proxy) ??
    normalizeOptionalEnvUrl(process.env.ALL_PROXY);

  if (upstreamProxyUrl) {
    process.env.SYNCODE_UPSTREAM_PROXY_URL = upstreamProxyUrl;
  } else {
    delete process.env.SYNCODE_UPSTREAM_PROXY_URL;
  }

  installRealtimeHttpsProxy(upstreamProxyUrl, process.env.OPENAI_REALTIME_BASE_URL);

  for (const key of PROXY_ENV_KEYS) {
    delete process.env[key];
  }
}

export function runAiInterviewerWorkerBootstrap(): void {
  void loadWorkerModule()
    .then((workerModule) => {
      workerModule.runAiInterviewerWorker(currentFilePath);
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}

if (process.argv[1] === currentFilePath) {
  runAiInterviewerWorkerBootstrap();
}
