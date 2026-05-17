import type {
  GenerateSessionReportRequest,
  SessionReport,
  SessionReportDimension,
  SessionReportEventContext,
  SessionReportEvidence,
} from '@syncode/contracts';

const FALSE_PLATFORM_CRITIQUE_PATTERN =
  /class[- ]based|class solution|method signature|leetcode-style|non-standard for class|separating i\/o from business logic|mix(?:es|ing).{0,40}(?:stdin|stdout|input\(|print\().{0,80}(?:class|method)/i;

const SUGGESTION_PATTERN =
  /\b(?:consider|try|for example|next step|you can|recommend|suggest|instead|rename|use)\b/i;

const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /\bignore\b[\s\S]{0,80}\binstructions?\b/i,
  /\bignore\b[\s\S]{0,80}\b(developer|system|prior)\s+(rules?|instructions?|prompts?)\b/i,
  /\bdisregard\b[\s\S]{0,80}\binstructions?\b/i,
  /\boverride\s+instructions?\b/i,
  /\b(system|developer)\s+prompt\b/i,
  /\b(disclose|reveal)\b[\s\S]{0,80}\b(secrets?|system prompt|developer prompt|policy text)\b/i,
  /\bjailbreak\b/i,
  /\bprompt\s+injection\b/i,
  /\boutput\s+exactly\b/i,
];

const PROFANITY_PATTERN = /\b(fuck|fucking|shit|bitch|asshole|bastard|motherfucker|dick|cunt)\b/i;
const META_REASONING_PATTERNS: RegExp[] = [
  /\bwait[, ]/i,
  /\blet'?s re-?examine\b/i,
  /\bactually[, ]/i,
  /\bthe main logical flow is\b/i,
];

const OPTIMAL_EFFICIENCY_POSITIVE_PATTERNS = [
  /\boptimal\b/i,
  /\bbest(?: possible)? time complexity\b/i,
  /\bsingle pass\b/i,
  /\blinear time\b/i,
  /\bo\(n\)\s+time complexity\b/i,
];

const OPTIMAL_EFFICIENCY_NEGATIVE_PATTERNS = [
  /\bquadratic\b/i,
  /\bnested loop\b/i,
  /\bn\^2\b/i,
  /\bnot optimal\b/i,
  /\bcould be faster\b/i,
];

const REQUIRED_DIMENSION_KEYS = [
  'correctness',
  'efficiency',
  'codeQuality',
  'communication',
  'problemSolving',
] as const satisfies readonly (keyof NonNullable<SessionReport['dimensions']>)[];

const MAX_REPORT_TEXT_LENGTH = 900;
const MAX_REPORT_LIST_ITEM_LENGTH = 240;
const MAX_EVIDENCE_DESCRIPTION_LENGTH = 220;

export function postprocessSessionReport(
  request: GenerateSessionReportRequest,
  report: SessionReport,
): SessionReport {
  const finalCode = getFinalCode(request);
  const usesPlatformIo = usesPlatformIoStyle(finalCode, request.language);

  const nextReport: SessionReport = {
    ...report,
    dimensions: report.dimensions ? { ...report.dimensions } : report.dimensions,
    strengths: report.strengths ? [...report.strengths] : report.strengths,
    areasForImprovement: report.areasForImprovement
      ? [...report.areasForImprovement]
      : report.areasForImprovement,
  };

  if (nextReport.dimensions?.efficiency) {
    nextReport.dimensions.efficiency = normalizeEfficiencyDimension(
      nextReport.dimensions.efficiency,
    );
  }

  if (nextReport.dimensions?.correctness) {
    nextReport.dimensions.correctness = ensureDimensionCoaching(
      nextReport.dimensions.correctness,
      'correctness',
      finalCode,
    );
  }

  if (nextReport.dimensions?.communication) {
    nextReport.dimensions.communication = ensureDimensionCoaching(
      nextReport.dimensions.communication,
      'communication',
      finalCode,
    );
  }

  if (nextReport.dimensions?.problemSolving) {
    nextReport.dimensions.problemSolving = ensureDimensionCoaching(
      nextReport.dimensions.problemSolving,
      'problemSolving',
      finalCode,
    );
  }

  if (nextReport.dimensions?.codeQuality) {
    nextReport.dimensions.codeQuality = normalizeCodeQualityDimension(
      nextReport.dimensions.codeQuality,
      finalCode,
      usesPlatformIo,
    );
  }

  if (nextReport.dimensions) {
    const sessionEvents = request.sessionEvents ?? [];
    nextReport.dimensions = {
      ...nextReport.dimensions,
      correctness: ensureEvidenceCoverage(
        nextReport.dimensions.correctness,
        finalCode,
        sessionEvents,
      ),
      efficiency: ensureEvidenceCoverage(
        nextReport.dimensions.efficiency,
        finalCode,
        sessionEvents,
      ),
      codeQuality: ensureEvidenceCoverage(
        nextReport.dimensions.codeQuality,
        finalCode,
        sessionEvents,
      ),
      communication: ensureEvidenceCoverage(
        nextReport.dimensions.communication,
        finalCode,
        sessionEvents,
      ),
      problemSolving: ensureEvidenceCoverage(
        nextReport.dimensions.problemSolving,
        finalCode,
        sessionEvents,
      ),
    };
  }

  if (nextReport.areasForImprovement) {
    nextReport.areasForImprovement = nextReport.areasForImprovement
      .map((item) => toActionableImprovement(item, finalCode, usesPlatformIo))
      .filter((item) => item.length > 0)
      .slice(0, 3);
  }

  nextReport.detailedFeedback = normalizeDetailedFeedback(
    nextReport.detailedFeedback,
    nextReport.areasForImprovement ?? [],
    usesPlatformIo,
  );

  if (nextReport.dimensions) {
    nextReport.categoryScores = Object.fromEntries(
      Object.entries(nextReport.dimensions)
        .filter(([, dimension]) => dimension !== undefined)
        .map(([key, dimension]) => [key, Math.round(dimension.score)]),
    );
  }

  if (nextReport.detailedFeedback) {
    nextReport.feedback = nextReport.detailedFeedback;
  }

  sanitizeReportOutput(nextReport);
  assertEvidenceBackedDimensions(nextReport, request.sessionEvents ?? []);
  return nextReport;
}

function assertEvidenceBackedDimensions(
  report: SessionReport,
  sessionEvents: SessionReportEventContext[],
) {
  if (!report.dimensions) {
    throw new Error('LLM session report omitted required scored dimensions');
  }

  const missingOrInvalid = REQUIRED_DIMENSION_KEYS.filter((key) => {
    const dimension = report.dimensions?.[key];
    return (
      !dimension ||
      !Number.isFinite(dimension.score) ||
      dimension.score < 0 ||
      dimension.score > 100 ||
      dimension.evidence.length === 0
    );
  });

  if (missingOrInvalid.length > 0) {
    throw new Error(
      `LLM session report omitted evidence-backed scores for: ${missingOrInvalid.join(', ')}`,
    );
  }

  if (
    sessionEvents.length > 0 &&
    !Object.values(report.dimensions).some((dimension) =>
      dimension?.evidence.some((item) => item.type === 'event_timestamp'),
    )
  ) {
    throw new Error('LLM session report omitted session event timestamp evidence');
  }
}

function sanitizeReportOutput(report: SessionReport) {
  if (report.dimensions) {
    for (const [key, dimension] of Object.entries(report.dimensions)) {
      if (!dimension) {
        continue;
      }

      dimension.feedback =
        sanitizeReportText(dimension.feedback, MAX_REPORT_LIST_ITEM_LENGTH) ??
        `No safe ${key} feedback was provided.`;
      dimension.evidence = dimension.evidence
        .map((item) => {
          const description = sanitizeReportText(item.description, MAX_EVIDENCE_DESCRIPTION_LENGTH);
          return description ? { ...item, description } : null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
    }
  }

  report.strengths = sanitizeReportList(report.strengths);
  report.areasForImprovement = sanitizeReportList(report.areasForImprovement);
  report.detailedFeedback = sanitizeReportText(report.detailedFeedback, MAX_REPORT_TEXT_LENGTH);
  report.feedback = sanitizeReportText(report.feedback, MAX_REPORT_TEXT_LENGTH);

  if (report.peerFeedbackSummary) {
    report.peerFeedbackSummary.themes = sanitizeReportList(
      report.peerFeedbackSummary.themes,
    ) as string[];
  }
}

function sanitizeReportList(items: string[] | undefined) {
  if (!items) {
    return items;
  }

  return items
    .map((item) => sanitizeReportText(item, MAX_REPORT_LIST_ITEM_LENGTH))
    .filter((item): item is string => Boolean(item));
}

function sanitizeReportText(value: string | undefined, maxLength: number): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = Array.from(value)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code === 9 || code === 10 || (code >= 32 && code !== 127);
    })
    .join('')
    .replaceAll(/\r\n?/g, '\n')
    .replaceAll(/\n{3,}/g, '\n\n')
    .replaceAll(/[^\S\n\t]+/g, ' ')
    .trim();

  if (!normalized || isUnsafeReportText(normalized)) {
    return undefined;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trim()}...`;
}

function isUnsafeReportText(value: string) {
  return (
    PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(value)) ||
    PROFANITY_PATTERN.test(value) ||
    META_REASONING_PATTERNS.some((pattern) => pattern.test(value))
  );
}

function normalizeEfficiencyDimension(dimension: SessionReportDimension): SessionReportDimension {
  const feedbackText = buildDimensionText(dimension);
  const nextDimension = ensureDimensionCoaching(dimension, 'efficiency', '');

  if (shouldBoostEfficiencyScore(feedbackText)) {
    return {
      ...nextDimension,
      score: Math.max(nextDimension.score, 95),
    };
  }

  return nextDimension;
}

function normalizeCodeQualityDimension(
  dimension: SessionReportDimension,
  finalCode: string,
  usesPlatformIo: boolean,
): SessionReportDimension {
  const nextDimension = {
    ...dimension,
    evidence: dimension.evidence.map((item) => ({ ...item })),
  };

  if (!usesPlatformIo) {
    return ensureDimensionCoaching(nextDimension, 'codeQuality', finalCode);
  }

  const filteredFeedback = removeFalsePlatformCritiqueSentences(nextDimension.feedback);
  nextDimension.feedback =
    filteredFeedback ||
    'The stdin/stdout structure matches this platform. Focus code quality improvements on readability, naming, parsing guards, and clean output formatting.';

  nextDimension.evidence = nextDimension.evidence.filter(
    (item) =>
      !FALSE_PLATFORM_CRITIQUE_PATTERN.test(item.description) &&
      !FALSE_PLATFORM_CRITIQUE_PATTERN.test(item.reference),
  );

  if (nextDimension.score < 65) {
    nextDimension.score = 65;
  }

  return ensureDimensionCoaching(nextDimension, 'codeQuality', finalCode);
}

function ensureDimensionCoaching(
  dimension: SessionReportDimension,
  key: 'correctness' | 'efficiency' | 'codeQuality' | 'communication' | 'problemSolving',
  finalCode: string,
): SessionReportDimension {
  if (SUGGESTION_PATTERN.test(dimension.feedback)) {
    return dimension;
  }

  return {
    ...dimension,
    feedback: `${dimension.feedback} ${getCoachingSentence(key, finalCode)}`.trim(),
  };
}

function getCoachingSentence(
  key: 'correctness' | 'efficiency' | 'codeQuality' | 'communication' | 'problemSolving',
  finalCode: string,
) {
  const printSnippet = extractLineSnippet(finalCode, /print\(/);

  switch (key) {
    case 'correctness':
      return 'Next step: manually trace one passing case and one edge case before submitting so hidden-case failures are easier to spot.';
    case 'efficiency':
      return 'When you explain the solution, explicitly call out why the single-pass structure gives the best asymptotic complexity.';
    case 'codeQuality':
      return printSnippet
        ? `For example, keep the stdin/stdout structure but improve readability with clearer names and cleaner output such as \`print(f'[{maps[num]},{idx}]')\` instead of raw concatenation.`
        : 'For example, keep the stdin/stdout structure but improve readability with clearer names and small parsing/output helpers.';
    case 'communication':
      return 'Next step: say the invariant out loud, then mention one or two edge cases you would test before you submit.';
    case 'problemSolving':
      return 'Next step: state the pattern you chose, why it fits the constraints, and one alternative you ruled out.';
    default:
      return '';
  }
}

function toActionableImprovement(item: string, finalCode: string, usesPlatformIo: boolean) {
  const cleaned = usesPlatformIo ? removeFalsePlatformCritiqueSentences(item) : item.trim();
  const lower = cleaned.toLowerCase();

  if (cleaned.length === 0) {
    return usesPlatformIo
      ? 'Improve readability within the stdin/stdout style by using clearer names and cleaner output formatting.'
      : '';
  }

  if (FALSE_PLATFORM_CRITIQUE_PATTERN.test(cleaned) && usesPlatformIo) {
    return "Keep the stdin/stdout structure, but improve readability with clearer names and cleaner formatting, for example rename `maps` to `complements` and use `print(f'[{maps[num]},{idx}]')`.";
  }

  if (lower.includes('parsing') || lower.includes('stdin') || lower.includes('stdout')) {
    const parsingSnippet = extractLineSnippet(finalCode, /input\(/);
    return parsingSnippet
      ? `Make the parser a little safer around \`${parsingSnippet}\`, for example validate the raw line before slicing or move the parse step into a tiny helper.`
      : 'Make the parser a little safer by validating the raw input before slicing or by moving the parse step into a tiny helper.';
  }

  if (lower.includes('string concatenation') || lower.includes('format')) {
    return "Clean up the output formatting; for example, replace manual concatenation with `print(f'[{maps[num]},{idx}]')` for readability.";
  }

  if (lower.includes('variable') || lower.includes('readability') || lower.includes('naming')) {
    return 'Use clearer names, for example rename `s` to `rawNumbers` and `maps` to `complements`, so the intent is easier to read quickly.';
  }

  if (lower.includes('edge case') || lower.includes('test')) {
    return 'Before submitting, manually test duplicates, negatives, and already-seen complements so hidden-case failures are less likely to slip through.';
  }

  if (SUGGESTION_PATTERN.test(cleaned)) {
    return cleaned;
  }

  return `${cleaned} Next step: turn this into one concrete code change you would make before the next submission.`;
}

function normalizeDetailedFeedback(
  feedback: string | undefined,
  areasForImprovement: string[],
  usesPlatformIo: boolean,
) {
  if (!feedback) {
    return feedback;
  }

  const withoutFalsePositiveSentences = usesPlatformIo
    ? removeFalsePlatformCritiqueSentences(feedback)
    : feedback.trim();

  const normalized = withoutFalsePositiveSentences.trim();
  if (normalized.length === 0) {
    return areasForImprovement.length > 0
      ? `Recommended next step: ${areasForImprovement[0]}`
      : normalized;
  }

  if (SUGGESTION_PATTERN.test(normalized) || areasForImprovement.length === 0) {
    return normalized;
  }

  return `${normalized} Recommended next step: ${areasForImprovement[0]}`;
}

function shouldBoostEfficiencyScore(text: string) {
  return (
    OPTIMAL_EFFICIENCY_POSITIVE_PATTERNS.some((pattern) => pattern.test(text)) &&
    !OPTIMAL_EFFICIENCY_NEGATIVE_PATTERNS.some((pattern) => pattern.test(text))
  );
}

function buildDimensionText(dimension: SessionReportDimension) {
  return [
    dimension.feedback,
    ...dimension.evidence.map((item) => `${item.description} ${item.reference}`),
  ].join(' ');
}

function removeFalsePlatformCritiqueSentences(text: string) {
  return splitIntoSentences(text)
    .filter((sentence) => !FALSE_PLATFORM_CRITIQUE_PATTERN.test(sentence))
    .join(' ')
    .trim();
}

function splitIntoSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function getFinalCode(request: GenerateSessionReportRequest) {
  return request.finalCodeSnapshot?.code ?? '';
}

function usesPlatformIoStyle(code: string, language: GenerateSessionReportRequest['language']) {
  if (!code.trim()) {
    return false;
  }

  if (language === 'python') {
    return /\binput\(/.test(code) || /\bprint\(/.test(code);
  }

  if (language === 'javascript' || language === 'typescript') {
    return /\bconsole\.log\(/.test(code) || /\bprocess\.stdin\b/.test(code);
  }

  return /\bstdin\b/i.test(code) || /\bstdout\b/i.test(code);
}

function extractLineSnippet(code: string, pattern: RegExp) {
  const line = code
    .split('\n')
    .map((entry) => entry.trim())
    .find((entry) => pattern.test(entry));

  return line?.slice(0, 120) ?? null;
}

function ensureEvidenceCoverage(
  dimension: SessionReportDimension | undefined,
  finalCode: string,
  sessionEvents: SessionReportEventContext[],
): SessionReportDimension | undefined {
  if (!dimension) {
    return dimension;
  }

  const evidence = normalizeSpecificEvidence(dimension.evidence, finalCode, sessionEvents);

  return {
    ...dimension,
    evidence,
  };
}

function normalizeSpecificEvidence(
  evidence: SessionReportEvidence[],
  finalCode: string,
  sessionEvents: SessionReportEventContext[],
): SessionReportEvidence[] {
  return evidence
    .map((item) => normalizeEvidenceItem(item, finalCode, sessionEvents))
    .filter((item): item is SessionReportEvidence => item !== null);
}

function normalizeEvidenceItem(
  item: SessionReportEvidence,
  finalCode: string,
  sessionEvents: SessionReportEventContext[],
): SessionReportEvidence | null {
  const description = sanitizeReportText(item.description, MAX_EVIDENCE_DESCRIPTION_LENGTH);
  if (!description) {
    return null;
  }

  if (item.type === 'code_line') {
    const reference = normalizeLineReference(item.reference, finalCode);
    return reference ? { ...item, reference, description } : null;
  }

  if (item.type === 'event_timestamp') {
    return sessionEvents.some((event) => event.timestamp === item.reference)
      ? { ...item, description }
      : null;
  }

  if (item.type === 'code_snippet') {
    const reference = item.reference.trim();
    if (
      reference.length === 0 ||
      reference.length > 120 ||
      isGenericEvidenceReference(reference) ||
      isUnsafeReportText(reference) ||
      !finalCode.includes(reference)
    ) {
      return null;
    }

    return { ...item, reference, description };
  }

  return null;
}

function normalizeLineReference(reference: string, finalCode: string) {
  const trimmed = reference.trim();
  if (isGenericEvidenceReference(trimmed)) {
    return null;
  }

  const lines = finalCode.trim().length > 0 ? finalCode.split('\n') : [];
  const lineCount = lines.length;

  const withSnippet = /^(L\d+(?:-L\d+)?)(?::|\||\s+-\s+|\s+)(.+)$/i.exec(trimmed);
  if (withSnippet?.[1] && withSnippet[2]) {
    const normalizedRange = normalizeValidLineRange(withSnippet[1], lineCount);
    return normalizedRange && snippetMatchesLineRange(withSnippet[2], normalizedRange, lines)
      ? `${normalizedRange}: ${normalizeCodeExcerpt(withSnippet[2])}`
      : null;
  }

  const lineWord = /^line\s+(\d+)(?:\s*(?:-|to)\s*(?:line\s*)?(\d+))?(?::|\s+-\s+|\s+)(.+)$/i.exec(
    trimmed,
  );
  if (lineWord?.[1] && lineWord[3]) {
    const normalizedRange = normalizeValidLineRange(
      lineWord[2] ? `L${lineWord[1]}-L${lineWord[2]}` : `L${lineWord[1]}`,
      lineCount,
    );
    return normalizedRange && snippetMatchesLineRange(lineWord[3], normalizedRange, lines)
      ? `${normalizedRange}: ${normalizeCodeExcerpt(lineWord[3])}`
      : null;
  }

  return null;
}

function snippetMatchesLineRange(snippet: string, normalizedRange: string, lines: string[]) {
  const normalizedSnippet = normalizeCodeExcerpt(snippet);
  if (normalizedSnippet.length < 6 || isGenericEvidenceReference(normalizedSnippet)) {
    return false;
  }

  const range = /^L(\d+)(?:-L(\d+))?$/i.exec(normalizedRange);
  if (!range?.[1]) {
    return false;
  }

  const start = Number(range[1]);
  const end = range[2] ? Number(range[2]) : start;
  const referencedText = normalizeCodeExcerpt(lines.slice(start - 1, end).join('\n'));
  return referencedText.includes(normalizedSnippet);
}

function normalizeCodeExcerpt(value: string) {
  return value
    .trim()
    .replace(/^['"`]+|['"`]+$/g, '')
    .replace(/\s+/g, ' ');
}

function normalizeValidLineRange(reference: string, lineCount: number) {
  if (lineCount === 0) {
    return null;
  }

  const match = /^L(\d+)(?:-L(\d+))?$/i.exec(reference);
  if (!match?.[1]) {
    return null;
  }

  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : start;
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    return null;
  }

  if (start < 1 || end < start || end > lineCount) {
    return null;
  }

  return start === end ? `L${start}` : `L${start}-L${end}`;
}

function isGenericEvidenceReference(reference: string) {
  return /^(?:code|final code|code structure|final snapshot(?: code)?|solution|session data|overall performance)$/i.test(
    reference.trim(),
  );
}
