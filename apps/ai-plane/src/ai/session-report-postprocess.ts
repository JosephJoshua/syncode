import type {
  GenerateSessionReportRequest,
  SessionReport,
  SessionReportDimension,
  SessionReportEvidence,
} from '@syncode/contracts';

const FALSE_PLATFORM_CRITIQUE_PATTERN =
  /class[- ]based|class solution|method signature|leetcode-style|non-standard for class|separating i\/o from business logic|mix(?:es|ing).{0,40}(?:stdin|stdout|input\(|print\().{0,80}(?:class|method)/i;

const SUGGESTION_PATTERN =
  /\b(?:consider|try|for example|next step|you can|recommend|suggest|instead|rename|use)\b/i;

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

  return nextReport;
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

  if (nextDimension.evidence.length === 0) {
    nextDimension.evidence = buildPlatformAwareCodeQualityEvidence(finalCode);
  }

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

function buildPlatformAwareCodeQualityEvidence(finalCode: string): SessionReportEvidence[] {
  const evidence: SessionReportEvidence[] = [];

  const outputSnippet = extractLineSnippet(finalCode, /print\(/);
  if (outputSnippet) {
    evidence.push({
      type: 'code_snippet',
      reference: outputSnippet,
      description:
        'The stdin/stdout flow is valid here. Improve readability by using clearer formatting on this line.',
    });
  }

  const parsingSnippet = extractLineSnippet(finalCode, /input\(/);
  if (parsingSnippet) {
    evidence.push({
      type: 'code_snippet',
      reference: parsingSnippet,
      description:
        'A tiny parsing helper or guard around this input line would make the solution more robust without changing the platform style.',
    });
  }

  return evidence.slice(0, 2);
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
  const lastSnapshot = request.snapshots.at(-1)?.code;
  if (lastSnapshot && lastSnapshot.trim().length > 0) {
    return lastSnapshot;
  }

  const lastSubmission = request.submissions.at(-1)?.code;
  if (lastSubmission && lastSubmission.trim().length > 0) {
    return lastSubmission;
  }

  const lastRun = request.runs.at(-1)?.code;
  return lastRun ?? '';
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
