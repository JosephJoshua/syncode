import { SUPPORTED_LANGUAGES } from '@syncode/shared';
import { describe, expect, it } from 'vitest';
import { getLanguageConfig } from './language-config.js';

describe('getLanguageConfig', () => {
  it.each(
    SUPPORTED_LANGUAGES,
  )('GIVEN %s WHEN getLanguageConfig THEN returns config with extension and run', (lang) => {
    const config = getLanguageConfig(lang);
    expect(config).toBeDefined();
    expect(config!.extension).toMatch(/^\.\w+$/);
    expect(config!.run('/tmp/code')).toContain('/tmp/code');
  });

  it.each([
    'cpp',
    'c',
    'rust',
  ] as const)('GIVEN compiled language %s WHEN getLanguageConfig THEN has compile step', (lang) => {
    const config = getLanguageConfig(lang)!;
    expect(config.compile).toBeDefined();
    const cmd = config.compile!('/tmp/src.cpp', '/tmp/out');
    expect(cmd).toContain('/tmp/src.cpp');
    expect(cmd).toContain('/tmp/out');
  });

  it.each([
    'python',
    'javascript',
    'typescript',
    'java',
    'go',
  ] as const)('GIVEN interpreted language %s WHEN getLanguageConfig THEN has no compile step', (lang) => {
    const config = getLanguageConfig(lang)!;
    expect(config.compile).toBeUndefined();
  });

  it('GIVEN unknown language WHEN getLanguageConfig THEN returns undefined', () => {
    const config = getLanguageConfig('brainfuck');
    expect(config).toBeUndefined();
  });
});
