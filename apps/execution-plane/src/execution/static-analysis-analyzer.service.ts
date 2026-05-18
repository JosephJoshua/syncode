import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import type {
  StaticAnalysisComplexity,
  StaticAnalysisDiagnostic,
  StaticAnalysisDuplication,
  StaticAnalysisRequest,
  StaticAnalysisResult,
  StaticAnalysisToolResult,
} from '@syncode/contracts';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@syncode/shared';
import {
  parseBiomeJson,
  parseClippyJsonLines,
  parseCpdJson,
  parseCppcheckXml,
  parseGolangciLintJson,
  parseLizardXml,
  parsePmdJson,
  parseRuffJson,
} from './static-analysis.parsers.js';
import {
  ChildProcessStaticAnalysisCommandRunner,
  type StaticAnalysisCommandRunner,
} from './static-analysis-command-runner.service.js';

export const STATIC_ANALYSIS_COMMAND_RUNNER = Symbol.for('STATIC_ANALYSIS_COMMAND_RUNNER');

const DEFAULT_TOOL_TIMEOUT_MS = 15_000;
const COMPLEXITY_THRESHOLD = 10;

type AnalyzerOutput = Omit<StaticAnalysisResult, keyof StaticAnalysisRequest | 'jobId'>;

interface ToolCommand {
  tool: string;
  command: string;
  args: string[];
  parser: (stdout: string, stderr: string) => Partial<AnalyzerFindings>;
}

interface AnalyzerFindings {
  diagnostics: StaticAnalysisDiagnostic[];
  complexity: StaticAnalysisComplexity[];
  duplications: StaticAnalysisDuplication[];
}

@Injectable()
export class StaticAnalysisAnalyzer {
  constructor(
    @Inject(STATIC_ANALYSIS_COMMAND_RUNNER)
    private readonly runner: StaticAnalysisCommandRunner = new ChildProcessStaticAnalysisCommandRunner(),
  ) {}

  async analyze(request: StaticAnalysisRequest): Promise<AnalyzerOutput> {
    const validationError = this.validateRequest(request);
    if (validationError) {
      return this.failed(validationError);
    }

    const workspace = await mkdtemp(join(tmpdir(), 'syncode-static-analysis-'));
    try {
      const fileName = await this.writeSource(workspace, request.language, request.code);
      const commands = this.buildCommands(request.language, fileName);
      const findings: AnalyzerFindings = { diagnostics: [], complexity: [], duplications: [] };
      const toolResults: StaticAnalysisToolResult[] = [];

      for (const tool of commands) {
        const startedAt = Date.now();
        const result = await this.runner.run(tool.command, tool.args, {
          cwd: workspace,
          timeoutMs: request.timeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS,
        });
        const durationMs = Date.now() - startedAt;
        const parsed = this.parseToolOutput(tool, result.stdout, result.stderr);

        findings.diagnostics.push(...(parsed.diagnostics ?? []));
        findings.complexity.push(...(parsed.complexity ?? []));
        findings.duplications.push(...(parsed.duplications ?? []));

        const failed = Boolean(result.error || result.timedOut);
        toolResults.push({
          tool: tool.tool,
          status: failed ? 'failed' : 'completed',
          exitCode: result.exitCode,
          durationMs,
          timedOut: result.timedOut,
          ...(failed && { error: result.error ?? 'Tool timed out' }),
        });
      }

      return {
        status: 'completed',
        ...findings,
        toolResults,
        summary: buildSummary(findings, toolResults),
      };
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }

  private validateRequest(request: StaticAnalysisRequest): string | null {
    if (!SUPPORTED_LANGUAGES.includes(request.language)) {
      return `Unsupported language: ${request.language}`;
    }
    if (!request.code || request.code.trim().length === 0) {
      return 'Code cannot be empty';
    }
    if ((request.runId == null) === (request.submissionId == null)) {
      return 'Exactly one of runId or submissionId is required';
    }
    return null;
  }

  private failed(error: string): AnalyzerOutput {
    const findings: AnalyzerFindings = { diagnostics: [], complexity: [], duplications: [] };
    return {
      status: 'failed',
      error,
      ...findings,
      toolResults: [],
      summary: buildSummary(findings, []),
    };
  }

  private async writeSource(
    workspace: string,
    language: SupportedLanguage,
    code: string,
  ): Promise<string> {
    if (language === 'rust') {
      await writeFile(
        join(workspace, 'Cargo.toml'),
        '[package]\nname = "syncode_analysis"\nversion = "0.1.0"\nedition = "2021"\n',
      );
      const srcDir = join(workspace, 'src');
      await mkdir(srcDir);
      const fileName = join('src', 'main.rs');
      await writeFile(join(workspace, fileName), code);
      return fileName;
    }

    if (language === 'go') {
      await writeFile(join(workspace, 'go.mod'), 'module syncode_analysis\n\ngo 1.22\n');
    }

    const fileName = `Main.${extensionFor(language)}`;
    await writeFile(join(workspace, fileName), code);
    return fileName;
  }

  private buildCommands(language: SupportedLanguage, fileName: string): ToolCommand[] {
    const common: ToolCommand[] = [
      {
        tool: 'lizard',
        command: 'lizard',
        args: ['--xml', fileName],
        parser: (stdout) => ({ complexity: parseLizardXml(stdout) }),
      },
      {
        tool: 'pmd-cpd',
        command: 'pmd',
        args: ['cpd', '--format', 'json', '--minimum-tokens', '40', '--files', fileName],
        parser: (stdout) => ({ duplications: parseCpdJson(stdout) }),
      },
    ];

    const lint = lintCommandFor(language, fileName);
    return lint ? [lint, ...common] : common;
  }

  private parseToolOutput(
    tool: ToolCommand,
    stdout: string,
    stderr: string,
  ): Partial<AnalyzerFindings> {
    try {
      return tool.parser(stdout, stderr);
    } catch (error) {
      return {
        diagnostics: [
          {
            tool: tool.tool,
            rule: 'parse-error',
            severity: 'info',
            message: error instanceof Error ? error.message : 'Failed to parse tool output',
            file: null,
            line: null,
            column: null,
          },
        ],
      };
    }
  }
}

function lintCommandFor(language: SupportedLanguage, fileName: string): ToolCommand | null {
  switch (language) {
    case 'python':
      return {
        tool: 'ruff',
        command: 'ruff',
        args: ['check', '--output-format', 'json', fileName],
        parser: (stdout) => ({ diagnostics: parseRuffJson(stdout) }),
      };
    case 'javascript':
    case 'typescript':
      return {
        tool: 'biome',
        command: 'biome',
        args: ['check', '--reporter=json', fileName],
        parser: (stdout) => ({ diagnostics: parseBiomeJson(stdout) }),
      };
    case 'java':
      return {
        tool: 'pmd',
        command: 'pmd',
        args: [
          'check',
          '--format',
          'json',
          '--dir',
          fileName,
          '--rulesets',
          'rulesets/java/quickstart.xml',
        ],
        parser: (stdout) => ({ diagnostics: parsePmdJson(stdout) }),
      };
    case 'c':
    case 'cpp':
      return {
        tool: 'cppcheck',
        command: 'cppcheck',
        args: ['--xml', '--enable=warning,style,performance,portability', fileName],
        parser: (_stdout, stderr) => ({ diagnostics: parseCppcheckXml(stderr) }),
      };
    case 'go':
      return {
        tool: 'golangci-lint',
        command: 'golangci-lint',
        args: ['run', '--out-format', 'json'],
        parser: (stdout) => ({ diagnostics: parseGolangciLintJson(stdout) }),
      };
    case 'rust':
      return {
        tool: 'clippy',
        command: 'cargo',
        args: ['clippy', '--message-format=json'],
        parser: (stdout) => ({ diagnostics: parseClippyJsonLines(stdout) }),
      };
    default:
      return null;
  }
}

function extensionFor(language: SupportedLanguage): string {
  switch (language) {
    case 'python':
      return 'py';
    case 'javascript':
      return 'js';
    case 'typescript':
      return 'ts';
    case 'java':
      return 'java';
    case 'cpp':
      return 'cpp';
    case 'c':
      return 'c';
    case 'go':
      return 'go';
    case 'rust':
      return 'rs';
  }
}

function buildSummary(findings: AnalyzerFindings, toolResults: StaticAnalysisToolResult[]) {
  const errorCount = findings.diagnostics.filter((item) => item.severity === 'error').length;
  const warningCount = findings.diagnostics.filter((item) => item.severity === 'warning').length;
  const maxComplexity = findings.complexity.reduce<number | null>(
    (max, item) =>
      max == null ? item.cyclomaticComplexity : Math.max(max, item.cyclomaticComplexity),
    null,
  );

  return {
    diagnosticCount: findings.diagnostics.length,
    errorCount,
    warningCount,
    maxCyclomaticComplexity: maxComplexity,
    highComplexityCount: findings.complexity.filter(
      (item) => item.cyclomaticComplexity >= COMPLEXITY_THRESHOLD,
    ).length,
    duplicationCount: findings.duplications.length,
    toolFailureCount: toolResults.filter((item) => item.status === 'failed').length,
  };
}
