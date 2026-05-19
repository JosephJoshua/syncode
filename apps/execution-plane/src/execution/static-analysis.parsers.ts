import type {
  StaticAnalysisComplexity,
  StaticAnalysisDiagnostic,
  StaticAnalysisDuplication,
  StaticAnalysisSeverity,
} from '@syncode/contracts';

function parseJson(value: string): unknown {
  if (!value.trim()) return null;
  return JSON.parse(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeSeverity(value: unknown): StaticAnalysisSeverity {
  const raw = asString(value)?.toLowerCase() ?? '';
  if (raw === 'error' || raw === 'fatal') return 'error';
  if (raw === 'warning' || raw === 'warn') return 'warning';
  return 'info';
}

function pmdSeverity(priority: unknown): StaticAnalysisSeverity {
  const value = asNumber(priority);
  if (value != null && value <= 2) return 'error';
  if (value != null && value <= 4) return 'warning';
  return 'info';
}

export function parseRuffJson(raw: string): StaticAnalysisDiagnostic[] {
  return asArray(parseJson(raw)).map((item) => {
    const diagnostic = asRecord(item);
    const location = asRecord(diagnostic.location);
    return {
      tool: 'ruff',
      rule: asString(diagnostic.code),
      severity: 'error',
      message: asString(diagnostic.message) ?? 'Ruff diagnostic',
      file: asString(diagnostic.filename),
      line: asNumber(location.row),
      column: asNumber(location.column),
    };
  });
}

export function parseBiomeJson(raw: string): StaticAnalysisDiagnostic[] {
  const payload = asRecord(parseJson(raw));
  return asArray(payload.diagnostics).map((item) => {
    const diagnostic = asRecord(item);
    const location = asRecord(diagnostic.location);
    const path = asRecord(location.path);
    const span = asRecord(location.span);
    const start = asRecord(span.start);
    return {
      tool: 'biome',
      rule: asString(diagnostic.category),
      severity: normalizeSeverity(diagnostic.severity),
      message:
        asString(diagnostic.description) ?? asString(diagnostic.message) ?? 'Biome diagnostic',
      file: asString(path.file),
      line: asNumber(start.line),
      column: asNumber(start.column),
    };
  });
}

export function parsePmdJson(raw: string): StaticAnalysisDiagnostic[] {
  const payload = asRecord(parseJson(raw));
  return asArray(payload.files).flatMap((fileItem) => {
    const file = asRecord(fileItem);
    const filename = asString(file.filename);
    return asArray(file.violations).map((item) => {
      const violation = asRecord(item);
      return {
        tool: 'pmd',
        rule: asString(violation.rule),
        severity: pmdSeverity(violation.priority),
        message: asString(violation.description) ?? 'PMD diagnostic',
        file: filename,
        line: asNumber(violation.beginline),
        column: asNumber(violation.begincolumn),
      };
    });
  });
}

export function parseCppcheckXml(raw: string): StaticAnalysisDiagnostic[] {
  const diagnostics: StaticAnalysisDiagnostic[] = [];
  const errorPattern = /<error\b([^>]*)>([\s\S]*?)<\/error>|<error\b([^>]*)\/>/g;
  for (const match of raw.matchAll(errorPattern)) {
    const attrs = parseXmlAttributes(match[1] ?? match[3] ?? '');
    const locationAttrs = parseXmlAttributes(match[2]?.match(/<location\b([^>]*)\/>/)?.[1] ?? '');
    diagnostics.push({
      tool: 'cppcheck',
      rule: attrs.id ?? null,
      severity: normalizeCppcheckSeverity(attrs.severity),
      message: attrs.msg ?? 'Cppcheck diagnostic',
      file: locationAttrs.file ?? null,
      line: asNumber(locationAttrs.line),
      column: asNumber(locationAttrs.column),
    });
  }
  return diagnostics;
}

export function parseGolangciLintJson(raw: string): StaticAnalysisDiagnostic[] {
  const payload = asRecord(parseJson(raw));
  return asArray(payload.Issues).map((item) => {
    const issue = asRecord(item);
    const pos = asRecord(issue.Pos);
    return {
      tool: 'golangci-lint',
      rule: asString(issue.FromLinter),
      severity: normalizeSeverity(issue.Severity ?? 'warning'),
      message: asString(issue.Text) ?? 'golangci-lint diagnostic',
      file: asString(pos.Filename),
      line: asNumber(pos.Line),
      column: asNumber(pos.Column),
    };
  });
}

export function parseClippyJsonLines(raw: string): StaticAnalysisDiagnostic[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const payload = asRecord(parseJson(line));
      if (payload.reason !== 'compiler-message') return [];
      const message = asRecord(payload.message);
      const code = asRecord(message.code);
      const span = asRecord(asArray(message.spans)[0]);
      return [
        {
          tool: 'clippy',
          rule: asString(code.code),
          severity: normalizeSeverity(message.level),
          message: asString(message.message) ?? 'Clippy diagnostic',
          file: asString(span.file_name),
          line: asNumber(span.line_start),
          column: asNumber(span.column_start),
        },
      ];
    });
}

export function parseLizardXml(raw: string): StaticAnalysisComplexity[] {
  return Array.from(raw.matchAll(/<function\b([^>]*)\/>/g)).map((match) => {
    const attrs = parseXmlAttributes(match[1] ?? '');
    return {
      tool: 'lizard',
      functionName: attrs.name ?? '<anonymous>',
      file: attrs.file ?? null,
      startLine: asNumber(attrs.line) ?? 0,
      endLine: asNumber(attrs.endline),
      cyclomaticComplexity: asNumber(attrs.complexity) ?? 0,
    };
  });
}

export function parseCpdJson(raw: string): StaticAnalysisDuplication[] {
  const payload = asRecord(parseJson(raw));
  return asArray(payload.duplications).map((item) => {
    const duplication = asRecord(item);
    return {
      tool: 'pmd-cpd',
      lines: asNumber(duplication.lines) ?? 0,
      tokens: asNumber(duplication.tokens),
      occurrences: asArray(duplication.files).map((fileItem) => {
        const file = asRecord(fileItem);
        return {
          file: asString(file.name),
          startLine: asNumber(file.startLine) ?? 0,
          endLine: asNumber(file.endLine),
        };
      }),
    };
  });
}

function normalizeCppcheckSeverity(value: unknown): StaticAnalysisSeverity {
  const raw = asString(value)?.toLowerCase() ?? '';
  if (raw === 'error') return 'error';
  if (raw === 'warning' || raw === 'performance' || raw === 'portability') return 'warning';
  return 'info';
}

function parseXmlAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  let index = 0;

  while (index < raw.length) {
    if (!isXmlNameStart(raw[index])) {
      index += 1;
      continue;
    }

    const nameStart = index;
    index += 1;
    while (index < raw.length && isXmlNameChar(raw[index])) {
      index += 1;
    }

    const name = raw.slice(nameStart, index);
    while (index < raw.length && isXmlWhitespace(raw[index])) {
      index += 1;
    }

    if (raw[index] !== '=') {
      continue;
    }
    index += 1;

    while (index < raw.length && isXmlWhitespace(raw[index])) {
      index += 1;
    }

    if (raw[index] !== '"') {
      continue;
    }
    index += 1;

    const valueStart = index;
    while (index < raw.length && raw[index] !== '"') {
      index += 1;
    }

    if (index >= raw.length) {
      break;
    }

    attrs[name] = decodeXml(raw.slice(valueStart, index));
    index += 1;
  }
  return attrs;
}

function isXmlWhitespace(char: string | undefined): boolean {
  return char === ' ' || char === '\n' || char === '\r' || char === '\t';
}

function isXmlNameStart(char: string | undefined): boolean {
  return Boolean(
    char &&
      ((char >= 'A' && char <= 'Z') ||
        (char >= 'a' && char <= 'z') ||
        char === '_' ||
        char === ':'),
  );
}

function isXmlNameChar(char: string | undefined): boolean {
  return Boolean(
    char && (isXmlNameStart(char) || (char >= '0' && char <= '9') || char === '-' || char === '.'),
  );
}

function decodeXml(value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}
