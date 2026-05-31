import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseArgs } from './config.mjs';

describe('parseArgs', () => {
  it('parses stress-test CLI options with conservative defaults', () => {
    const config = parseArgs([
      '--base-url',
      'https://staging.syncode.anggita.org',
      '--scenario',
      'mixed',
      '--vus',
      '20',
      '--duration',
      '30',
      '--users-file',
      './users.json',
      '--allow-register',
    ]);

    assert.equal(config.baseUrl, 'https://staging.syncode.anggita.org');
    assert.equal(config.scenario, 'mixed');
    assert.equal(config.vus, 20);
    assert.equal(config.durationSeconds, 30);
    assert.equal(config.usersFile, './users.json');
    assert.equal(config.allowRegister, true);
    assert.equal(config.requestTimeoutMs, 10_000);
  });

  it('rejects unsafe production registration unless explicitly enabled', () => {
    assert.throws(
      () =>
        parseArgs([
          '--base-url',
          'https://syncode.anggita.org',
          '--scenario',
          'mixed',
          '--allow-register',
          '--confirm-production-mutation',
          'no',
        ]),
      /Production mutations require --confirm-production-mutation yes/,
    );
  });

  it('requires explicit expensive opt-in for execution and AI scenarios', () => {
    assert.throws(
      () =>
        parseArgs(['--base-url', 'https://staging.syncode.anggita.org', '--scenario', 'execution']),
      /requires --include-expensive/,
    );

    const config = parseArgs([
      '--base-url',
      'https://staging.syncode.anggita.org',
      '--scenario',
      'ai-hint',
      '--include-expensive',
      '--poll-timeout-ms',
      '15000',
    ]);

    assert.equal(config.scenario, 'ai-hint');
    assert.equal(config.includeExpensive, true);
    assert.equal(config.pollTimeoutMs, 15_000);
  });

  it('requires production confirmation for expensive scenarios', () => {
    assert.throws(
      () =>
        parseArgs([
          '--base-url',
          'https://syncode.anggita.org',
          '--scenario',
          'execution',
          '--include-expensive',
        ]),
      /Production mutations require --confirm-production-mutation yes/,
    );
  });
});
