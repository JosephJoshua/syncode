import type { SupportedLanguage } from '@syncode/shared';

export interface RunCodeRequest {
  language: SupportedLanguage;
  code: string;
  stdin?: string;
  timeoutMs?: number;
  memoryMb?: number;
}

export interface RunCodeResult {
  status: 'completed' | 'failed';
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
  error?: string;
  cpuTimeMs?: number;
  memoryUsageMb?: number;
  outputTruncated?: boolean;
}

export type StaticAnalysisSource = 'run' | 'submission';

export type StaticAnalysisStatus = 'pending' | 'completed' | 'failed';

export type StaticAnalysisSeverity = 'error' | 'warning' | 'info';

export interface StaticAnalysisDiagnostic {
  tool: string;
  rule: string | null;
  severity: StaticAnalysisSeverity;
  message: string;
  file: string | null;
  line: number | null;
  column: number | null;
}

export interface StaticAnalysisComplexity {
  tool: string;
  functionName: string;
  file: string | null;
  startLine: number;
  endLine: number | null;
  cyclomaticComplexity: number;
}

export interface StaticAnalysisDuplicationOccurrence {
  file: string | null;
  startLine: number;
  endLine: number | null;
}

export interface StaticAnalysisDuplication {
  tool: string;
  lines: number;
  tokens: number | null;
  occurrences: StaticAnalysisDuplicationOccurrence[];
}

export interface StaticAnalysisToolResult {
  tool: string;
  status: 'completed' | 'failed' | 'skipped';
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
  error?: string;
}

export interface StaticAnalysisSummary {
  diagnosticCount: number;
  errorCount: number;
  warningCount: number;
  maxCyclomaticComplexity: number | null;
  highComplexityCount: number;
  duplicationCount: number;
  toolFailureCount: number;
}

export interface StaticAnalysisRequest {
  userId: string;
  roomId: string;
  sessionId?: string | null;
  runId?: string | null;
  submissionId?: string | null;
  language: SupportedLanguage;
  source: StaticAnalysisSource;
  code: string;
  timeoutMs?: number;
}

export interface StaticAnalysisReport {
  diagnostics: StaticAnalysisDiagnostic[];
  complexity: StaticAnalysisComplexity[];
  duplications: StaticAnalysisDuplication[];
  toolResults: StaticAnalysisToolResult[];
}

export interface StaticAnalysisResult extends StaticAnalysisRequest, StaticAnalysisReport {
  jobId: string;
  status: Exclude<StaticAnalysisStatus, 'pending'>;
  summary: StaticAnalysisSummary;
  error?: string;
}
