type StarterCodeLanguageConfig = {
  aliases: string[];
  label: string;
  prismLanguage: string | null;
};

const starterCodeLanguageConfigs: Record<string, StarterCodeLanguageConfig> = {
  c: {
    aliases: ['c', 'h'],
    label: 'C',
    prismLanguage: 'c',
  },
  cpp: {
    aliases: ['cpp', 'c++', 'cplusplus', 'cxx', 'cc'],
    label: 'C++',
    prismLanguage: 'cpp',
  },
  java: {
    aliases: ['java'],
    label: 'Java',
    prismLanguage: 'java',
  },
  javascript: {
    aliases: ['javascript', 'js', 'node', 'nodejs', 'mjs', 'cjs'],
    label: 'JavaScript',
    prismLanguage: 'javascript',
  },
  python: {
    aliases: ['python', 'py', 'python3'],
    label: 'Python',
    prismLanguage: 'python',
  },
  typescript: {
    aliases: ['typescript', 'ts', 'tsx'],
    label: 'TypeScript',
    prismLanguage: 'typescript',
  },
};

const starterCodeLanguageAliasMap = Object.entries(starterCodeLanguageConfigs).reduce<
  Record<string, string>
>((accumulator, [canonicalLanguage, config]) => {
  for (const alias of config.aliases) {
    accumulator[alias] = canonicalLanguage;
  }

  return accumulator;
}, {});

export function formatStarterLanguageLabel(language: string) {
  const config = getStarterCodeLanguageConfig(language);

  if (config) {
    return config.label;
  }

  return language
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');
}

export function resolvePrismLanguage(language: string) {
  return getStarterCodeLanguageConfig(language)?.prismLanguage ?? null;
}

function getStarterCodeLanguageConfig(language: string) {
  const normalizedLanguage = language.trim().toLowerCase();
  const canonicalLanguage = starterCodeLanguageAliasMap[normalizedLanguage];

  return canonicalLanguage ? starterCodeLanguageConfigs[canonicalLanguage] : null;
}
