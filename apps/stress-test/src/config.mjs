import { readFile } from 'node:fs/promises';

const DEFAULTS = {
  baseUrl: 'https://syncode.anggita.org',
  scenario: 'smoke',
  vus: 5,
  durationSeconds: 60,
  requestTimeoutMs: 10_000,
  pollTimeoutMs: 30_000,
  pollIntervalMs: 1_000,
  thinkTimeMs: 250,
  maxFailureRate: 0.01,
  maxP95Ms: 1_500,
  allowRegister: false,
  confirmProductionMutation: 'no',
  cleanupRooms: true,
  includeExpensive: false,
};

const SCENARIOS = new Set(['smoke', 'browse', 'rooms', 'mixed', 'execution', 'ai-hint']);
const EXPENSIVE_SCENARIOS = new Set(['execution', 'ai-hint']);

export function parseArgs(argv = process.argv.slice(2), env = process.env) {
  const values = { ...DEFAULTS };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const readValue = () => {
      const next = argv[index + 1];
      if (!next || next.startsWith('--')) {
        throw new Error(`Missing value for ${arg}`);
      }
      index += 1;
      return next;
    };

    switch (arg) {
      case '--base-url':
        values.baseUrl = readValue();
        break;
      case '--scenario':
        values.scenario = readValue();
        break;
      case '--vus':
        values.vus = parsePositiveInteger(readValue(), '--vus');
        break;
      case '--duration':
        values.durationSeconds = parsePositiveInteger(readValue(), '--duration');
        break;
      case '--timeout-ms':
        values.requestTimeoutMs = parsePositiveInteger(readValue(), '--timeout-ms');
        break;
      case '--poll-timeout-ms':
        values.pollTimeoutMs = parsePositiveInteger(readValue(), '--poll-timeout-ms');
        break;
      case '--poll-interval-ms':
        values.pollIntervalMs = parsePositiveInteger(readValue(), '--poll-interval-ms');
        break;
      case '--think-ms':
        values.thinkTimeMs = parseNonNegativeInteger(readValue(), '--think-ms');
        break;
      case '--users-file':
        values.usersFile = readValue();
        break;
      case '--report-file':
        values.reportFile = readValue();
        break;
      case '--max-failure-rate':
        values.maxFailureRate = parseRatio(readValue(), '--max-failure-rate');
        break;
      case '--max-p95-ms':
        values.maxP95Ms = parsePositiveInteger(readValue(), '--max-p95-ms');
        break;
      case '--confirm-production-mutation':
        values.confirmProductionMutation = readValue();
        break;
      case '--allow-register':
        values.allowRegister = true;
        break;
      case '--no-cleanup-rooms':
        values.cleanupRooms = false;
        break;
      case '--include-expensive':
        values.includeExpensive = true;
        break;
      case '--help':
        values.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  values.baseUrl = env.SYNCODE_STRESS_BASE_URL ?? values.baseUrl;
  values.usersFile = env.SYNCODE_STRESS_USERS_FILE ?? values.usersFile;

  if (!SCENARIOS.has(values.scenario)) {
    throw new Error(
      `Invalid scenario "${values.scenario}". Expected one of: ${[...SCENARIOS].join(', ')}`,
    );
  }

  if (EXPENSIVE_SCENARIOS.has(values.scenario) && !values.includeExpensive) {
    throw new Error(`Scenario "${values.scenario}" requires --include-expensive`);
  }

  const isProduction = new URL(values.baseUrl).hostname === 'syncode.anggita.org';
  const mutatesData =
    values.allowRegister ||
    values.scenario === 'rooms' ||
    values.scenario === 'mixed' ||
    EXPENSIVE_SCENARIOS.has(values.scenario);
  if (isProduction && mutatesData && values.confirmProductionMutation !== 'yes') {
    throw new Error('Production mutations require --confirm-production-mutation yes');
  }

  return values;
}

export async function loadUsers(filePath) {
  if (!filePath) {
    return [];
  }

  const raw = await readFile(filePath, 'utf8');
  if (filePath.endsWith('.json')) {
    const parsed = JSON.parse(raw);
    const users = Array.isArray(parsed) ? parsed : parsed.users;
    if (!Array.isArray(users)) {
      throw new Error('JSON users file must be an array or { "users": [...] }');
    }
    return users.map(normalizeUser);
  }

  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('#'))
    .map((line) => {
      const [identifier, password] = line.split(',').map((item) => item.trim());
      return normalizeUser({ identifier, password });
    });
}

export function printHelp() {
  return [
    'SynCode stress-test harness',
    '',
    'Usage:',
    '  pnpm --filter @syncode/stress-test start -- --scenario browse --vus 20 --duration 60 --users-file ./users.json',
    '',
    'Scenarios:',
    '  smoke   Health endpoint only; safe for quick production checks.',
    '  browse  Login, profile, tags, problem list, problem detail, sessions.',
    '  rooms   Login, create private room, ensure collab, list rooms, cleanup.',
    '  mixed   Weighted browse + room flow.',
    '  execution  Create room, run code, poll execution status, cleanup. Requires --include-expensive.',
    '  ai-hint    Create room, request AI hint, poll hint status, cleanup. Requires --include-expensive.',
    '',
    'Safety:',
    '  Production mutations require --confirm-production-mutation yes.',
    '  Expensive code execution and AI paths are excluded from v1 by default.',
  ].join('\n');
}

function normalizeUser(user) {
  if (!user?.identifier || !user?.password) {
    throw new Error('Each user must include identifier and password');
  }
  return {
    identifier: String(user.identifier),
    password: String(user.password),
  };
}

function parsePositiveInteger(value, option) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${option} must be a positive integer`);
  }
  return parsed;
}

function parseNonNegativeInteger(value, option) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${option} must be a non-negative integer`);
  }
  return parsed;
}

function parseRatio(value, option) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`${option} must be between 0 and 1`);
  }
  return parsed;
}
