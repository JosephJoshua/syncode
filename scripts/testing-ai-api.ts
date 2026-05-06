import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface EnvMap {
  [key: string]: string | undefined;
}

interface CliOptions {
  prompt: string;
  model?: string;
  system?: string;
  tts: boolean;
  voice?: string;
  format: 'mp3' | 'wav';
  saveAudio?: string;
}

async function main() {
  const scriptDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
  const rootDir = resolve(scriptDir, '..');
  const env = loadEnvFile(resolve(rootDir, '.env'));
  const options = parseArgs(process.argv.slice(2));

  const baseUrl = mustGetEnv(env, 'AI_PLATFORM_BASE_URL');
  const apiKey = mustGetEnv(env, 'AI_PLATFORM_API_KEY');
  const model = options.model ?? env.AI_PLATFORM_MODEL ?? 'qwen3.5-mini';
  const timeoutMs = Number.parseInt(env.AI_REQUEST_TIMEOUT_MS ?? '60000', 10);
  const apiBaseUrl = normalizeOpenAiCompatibleBaseUrl(baseUrl);

  const textResponse = await generateText({
    apiBaseUrl,
    apiKey,
    model,
    system: options.system,
    prompt: options.prompt,
    timeoutMs,
  });

  printSection('Text Output');
  console.log(`model: ${textResponse.model}`);
  console.log(textResponse.text);

  if (!options.tts) {
    return;
  }

  const ttsModel = env.AI_TTS_MODEL ?? 'qwen-tts';
  const voice = options.voice ?? env.AI_TTS_VOICE ?? 'Chelsie';
  const audioResponse = await generateSpeech({
    apiBaseUrl,
    apiKey,
    model: ttsModel,
    voice,
    format: options.format,
    text: textResponse.text,
    timeoutMs,
  });

  printSection('TTS Output');
  console.log(`model: ${audioResponse.model}`);
  console.log(`voice: ${voice}`);
  console.log(`mimeType: ${audioResponse.mimeType}`);
  console.log(`bytes: ${audioResponse.audio.length}`);

  if (options.saveAudio) {
    const outputPath = resolve(rootDir, options.saveAudio);
    writeFileSync(outputPath, audioResponse.audio);
    console.log(`saved: ${outputPath}`);
  }
}

async function generateText(input: {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  system?: string;
  prompt: string;
  timeoutMs: number;
}) {
  const response = await postJson({
    url: `${input.apiBaseUrl}/chat/completions`,
    apiKey: input.apiKey,
    timeoutMs: input.timeoutMs,
    body: {
      model: input.model,
      temperature: 0.1,
      messages: [
        ...(input.system ? [{ role: 'system', content: input.system }] : []),
        { role: 'user', content: input.prompt },
      ],
    },
  });

  const text = response?.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new Error('Response did not include message content.');
  }

  return {
    model: response.model ?? input.model,
    text,
  };
}

async function generateSpeech(input: {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  voice: string;
  format: 'mp3' | 'wav';
  text: string;
  timeoutMs: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await fetch(`${input.apiBaseUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: input.model,
        input: input.text,
        voice: input.voice,
        response_format: input.format,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TTS request failed with ${response.status}: ${errorText}`);
    }

    return {
      model: input.model,
      mimeType: response.headers.get('content-type') ?? mimeTypeForAudioFormat(input.format),
      audio: Buffer.from(await response.arrayBuffer()),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function postJson(input: { url: string; apiKey: string; timeoutMs: number; body: unknown }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await fetch(input.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input.body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Request failed with ${response.status}: ${errorText}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function parseArgs(args: string[]): CliOptions {
  const positional: string[] = [];
  const options: Partial<CliOptions> = {
    format: 'mp3',
    tts: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if (!value) {
      continue;
    }

    if (!value.startsWith('--')) {
      positional.push(value);
      continue;
    }

    const [flag, inlineValue] = value.split('=', 2);
    const nextValue = inlineValue ?? args[index + 1];
    const consumesNext = inlineValue === undefined;

    switch (flag) {
      case '--prompt':
        options.prompt = assertOptionValue(flag, nextValue);
        if (consumesNext) {
          index += 1;
        }
        break;
      case '--model':
        options.model = assertOptionValue(flag, nextValue);
        if (consumesNext) {
          index += 1;
        }
        break;
      case '--system':
        options.system = assertOptionValue(flag, nextValue);
        if (consumesNext) {
          index += 1;
        }
        break;
      case '--voice':
        options.voice = assertOptionValue(flag, nextValue);
        if (consumesNext) {
          index += 1;
        }
        break;
      case '--format': {
        const format = assertOptionValue(flag, nextValue);
        if (format !== 'mp3' && format !== 'wav') {
          throw new Error('Expected --format to be either "mp3" or "wav".');
        }
        options.format = format;
        if (consumesNext) {
          index += 1;
        }
        break;
      }
      case '--save-audio':
        options.saveAudio = assertOptionValue(flag, nextValue);
        options.tts = true;
        if (consumesNext) {
          index += 1;
        }
        break;
      case '--tts':
        options.tts = true;
        break;
      case '--help':
        printUsage();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown option: ${flag}`);
    }
  }

  if (!options.prompt && positional.length > 0) {
    options.prompt = positional.join(' ');
  }

  if (!options.prompt) {
    printUsage();
    throw new Error('A prompt is required.');
  }

  return options as CliOptions;
}

function printUsage() {
  console.log(`Usage:
  pnpm.cmd exec tsx scripts/testing-ai-api.ts --prompt "Explain two pointers"
  pnpm.cmd exec tsx scripts/testing-ai-api.ts "Explain two pointers"
  pnpm.cmd exec tsx scripts/testing-ai-api.ts --prompt "Ask one interview follow-up" --tts --save-audio tmp/interview.mp3

Options:
  --prompt <text>        Prompt sent as the user message
  --system <text>        Optional system message
  --model <name>         Override AI_PLATFORM_MODEL
  --tts                  Also call the speech endpoint
  --voice <name>         Override AI_TTS_VOICE
  --format <mp3|wav>     Audio format when using --tts
  --save-audio <path>    Save returned audio to a local file
  --help                 Show this message`);
}

function loadEnvFile(path: string): EnvMap {
  const env: EnvMap = { ...process.env };

  if (!existsSync(path)) {
    return env;
  }

  const raw = readFileSync(path, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');

    if (!(key in env)) {
      env[key] = value;
    }
  }

  return env;
}

function mustGetEnv(env: EnvMap, key: string) {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function assertOptionValue(flag: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function normalizeOpenAiCompatibleBaseUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  const pathname = url.pathname.replace(/\/+$/, '');

  if (pathname === '' || pathname === '/') {
    url.pathname = '/v1';
  } else {
    url.pathname = pathname;
  }

  return url.toString().replace(/\/+$/, '');
}

function mimeTypeForAudioFormat(format: 'mp3' | 'wav') {
  return format === 'wav' ? 'audio/wav' : 'audio/mpeg';
}

function printSection(title: string) {
  console.log('');
  console.log(`=== ${title} ===`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
