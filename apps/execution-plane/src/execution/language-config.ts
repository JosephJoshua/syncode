import type { SupportedLanguage } from '@syncode/shared';

/**
 * Per-language execution config.
 * Callers must ensure paths passed to run/compile are built from trusted constants,
 * not user input — the lambdas use shell interpolation without quoting.
 */
export interface LanguageConfig {
  /** File extension including dot, e.g. '.py'. */
  extension: string;
  /** Shell command to run the executable (compiled) or source (interpreted) file. */
  run: (executablePath: string) => string;
  /** Shell command to compile source to binary. Undefined for interpreted languages. */
  compile?: (sourcePath: string, outputPath: string) => string;
}

const CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  python: {
    extension: '.py',
    run: (f) => `python3 ${f}`,
  },
  javascript: {
    extension: '.js',
    run: (f) => `node ${f}`,
  },
  typescript: {
    extension: '.ts',
    run: (f) => `npx tsx ${f}`,
  },
  java: {
    extension: '.java',
    // Java 11+ single-file source-code launcher; no package declarations.
    run: (f) => `java ${f}`,
  },
  cpp: {
    extension: '.cpp',
    compile: (src, out) => `g++ -o ${out} ${src}`,
    run: (f) => f,
  },
  c: {
    extension: '.c',
    compile: (src, out) => `gcc -o ${out} ${src}`,
    run: (f) => f,
  },
  go: {
    extension: '.go',
    run: (f) => `go run ${f}`,
  },
  rust: {
    extension: '.rs',
    compile: (src, out) => `rustc -o ${out} ${src}`,
    run: (f) => f,
  },
};

/** Look up the run/compile config for a language. Returns undefined for unknown languages. */
export function getLanguageConfig(language: string): LanguageConfig | undefined {
  return CONFIGS[language as SupportedLanguage];
}
