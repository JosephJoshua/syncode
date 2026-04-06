import { describe, expect, it } from 'vitest';
import { formatStarterLanguageLabel, resolvePrismLanguage } from './starter-code-language';

describe('starter code language helpers', () => {
  it('formats standard display labels for supported languages', () => {
    expect(formatStarterLanguageLabel('javascript')).toBe('JavaScript');
    expect(formatStarterLanguageLabel('typescript')).toBe('TypeScript');
    expect(formatStarterLanguageLabel('cpp')).toBe('C++');
    expect(formatStarterLanguageLabel('c++')).toBe('C++');
  });

  it('resolves supported aliases to the correct Prism language', () => {
    expect(resolvePrismLanguage('js')).toBe('javascript');
    expect(resolvePrismLanguage('ts')).toBe('typescript');
    expect(resolvePrismLanguage('c++')).toBe('cpp');
    expect(resolvePrismLanguage('python3')).toBe('python');
  });

  it('does not misclassify unknown languages as javascript', () => {
    expect(resolvePrismLanguage('go')).toBeNull();
    expect(formatStarterLanguageLabel('go')).toBe('Go');
  });
});
