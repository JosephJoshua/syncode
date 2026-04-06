import { SUPPORTED_LANGUAGES } from '@syncode/shared';
import { describe, expect, it } from 'vitest';
import { formatStarterLanguageLabel, resolvePrismLanguage } from './starter-code-language';

describe('starter code language helpers', () => {
  it('formats standard display labels for supported languages', () => {
    expect(formatStarterLanguageLabel('go')).toBe('Go');
    expect(formatStarterLanguageLabel('javascript')).toBe('JavaScript');
    expect(formatStarterLanguageLabel('rust')).toBe('Rust');
    expect(formatStarterLanguageLabel('typescript')).toBe('TypeScript');
    expect(formatStarterLanguageLabel('cpp')).toBe('C++');
    expect(formatStarterLanguageLabel('c++')).toBe('C++');
  });

  it('maps all eight supported languages to their own syntax highlighter', () => {
    expect(
      SUPPORTED_LANGUAGES.map((language) => [language, resolvePrismLanguage(language)]),
    ).toEqual([
      ['python', 'python'],
      ['javascript', 'javascript'],
      ['typescript', 'typescript'],
      ['java', 'java'],
      ['cpp', 'cpp'],
      ['c', 'c'],
      ['go', 'go'],
      ['rust', 'rust'],
    ]);
  });

  it('resolves supported aliases to the correct Prism language', () => {
    expect(resolvePrismLanguage('golang')).toBe('go');
    expect(resolvePrismLanguage('js')).toBe('javascript');
    expect(resolvePrismLanguage('rs')).toBe('rust');
    expect(resolvePrismLanguage('ts')).toBe('typescript');
    expect(resolvePrismLanguage('c++')).toBe('cpp');
    expect(resolvePrismLanguage('python3')).toBe('python');
  });

  it('does not misclassify unknown languages as javascript', () => {
    expect(resolvePrismLanguage('elixir')).toBeNull();
    expect(formatStarterLanguageLabel('elixir')).toBe('Elixir');
  });
});
