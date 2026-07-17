import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_SERVICE_URL =
  'https://api.jp-tok.text-to-speech.watson.cloud.ibm.com/instances/80c2d32d-873e-4777-8b6d-120a0dee3805';

loadDotEnv();

const apiKey = process.env.IBM_WATSON_TTS_API_KEY;
const serviceUrl = (process.env.IBM_WATSON_TTS_URL ?? DEFAULT_SERVICE_URL).replace(/\/$/, '');
const voice = process.env.IBM_WATSON_TTS_VOICE ?? 'en-US_AllisonV3Voice';
const text = process.env.IBM_WATSON_TTS_TEXT ?? 'Hello World';
const outputPath = resolve(process.env.IBM_WATSON_TTS_OUTPUT ?? '/tmp/ibm-watson-hello-world.mp3');

if (!apiKey || apiKey === 'your_ibm_watson_api_key_here') {
  console.error('Missing IBM_WATSON_TTS_API_KEY in .env.');
  process.exit(1);
}

const url = new URL(`${serviceUrl}/v1/synthesize`);
url.searchParams.set('voice', voice);

const response = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Basic ${Buffer.from(`apikey:${apiKey}`).toString('base64')}`,
    Accept: 'audio/mp3',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ text }),
});

const payload = Buffer.from(await response.arrayBuffer());
if (!response.ok) {
  throw new Error(
    `IBM Watson TTS failed with ${response.status}: ${payload.toString('utf8').slice(0, 1000)}`,
  );
}

writeFileSync(outputPath, payload);
console.log('IBM Watson TTS OK');
console.log(`voice: ${voice}`);
console.log(`text: ${text}`);
console.log(`bytes: ${payload.length}`);
console.log(`saved: ${outputPath}`);

function loadDotEnv() {
  const envPath = resolve('.env');
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }

    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const value = unquote(trimmed.slice(index + 1).trim());
    process.env[key] ??= value;
  }
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
