import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  GenerateHintRequest,
  GenerateHintResult,
  GenerateSessionReportRequest,
  GenerateSessionReportResult,
  InterviewResponseRequest,
  InterviewResponseResult,
  ReviewCodeRequest,
  ReviewCodeResult,
} from '@syncode/contracts';
import { toPublicSessionReportTestCaseBreakdown } from '@syncode/contracts';
import { z } from 'zod';
import type { EnvConfig } from '../config/env.config.js';
import { LLM_PROVIDER } from '../llm/llm.constants.js';
import type { ILlmProvider } from '../llm/llm.types.js';
import { buildSessionReportPrompt } from './prompts/session-report.prompt.js';
import { parseSessionReportJson } from './report-json.js';
import { postprocessSessionReport } from './session-report-postprocess.js';

const HINT_FALLBACK_APPROACHES: Record<GenerateHintRequest['hintLevel'], string> = {
  gentle: 'Track a compact summary of earlier steps so each new element can be validated quickly.',
  moderate:
    'Maintain a fast lookup structure while iterating once, then check whether the needed value is already available.',
  direct:
    'Use one pass and store lookup state so each step can decide immediately whether a valid pair has been found.',
};

const FIRST_HINT_SUGGESTED_APPROACH =
  'Focus on what small piece of history from earlier elements would let each new step verify progress without re-checking every pair.';

const MAX_UNTRUSTED_BLOCK_LENGTH = 16_000;
const MAX_HINT_TEXT_LENGTH = 900;
const MAX_SUGGESTED_APPROACH_LENGTH = 220;
const MAX_REFLECTION_PROMPT_LENGTH = 180;

const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /\bignore\b[\s\S]{0,80}\binstructions?\b/i,
  /\bdisregard\b[\s\S]{0,80}\binstructions?\b/i,
  /\boverride\s+instructions?\b/i,
  /\b(system|developer)\s+prompt\b/i,
  /\bjailbreak\b/i,
  /\bprompt\s+injection\b/i,
  /\bdo\s+not\s+output\s+hints?\b/i,
  /\boutput\s+exactly\b/i,
];

const PROFANITY_PATTERN = /\b(fuck|fucking|shit|bitch|asshole|bastard|motherfucker|dick|cunt)\b/i;
const META_REASONING_PATTERNS: RegExp[] = [
  /\bwait[, ]/i,
  /\blet'?s re-?examine\b/i,
  /\bactually[, ]/i,
  /\bthe main logical flow is\b/i,
];
const INCORRECTNESS_CLAIM_PATTERNS: RegExp[] = [
  /\bbug\b/i,
  /\bincorrect\b/i,
  /\bwrong\b/i,
  /\blogic error\b/i,
  /\boff-?by-?one\b/i,
  /\bfail(?:s|ed|ing)?\b/i,
  /\bnot pass(?:ed)?\b/i,
  /\bhidden test\b/i,
  /\bdoes(?:\s+not|n't)\s+work\b/i,
];

interface HintProcessingContext {
  hintLevel: GenerateHintRequest['hintLevel'];
  hintStage: 'initial' | 'follow_up';
  hintIteration: number;
  latestAllTestsPassed: boolean;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private static readonly hintResponseSchema = z.object({
    hint: z.string().min(1),
    suggestedApproach: z.string().min(1).optional(),
    reflectionPrompt: z.string().min(1).optional(),
  });

  constructor(
    @Inject(LLM_PROVIDER) private readonly llmProvider: ILlmProvider,
    @Optional() private readonly configService?: ConfigService<EnvConfig>,
  ) {}

  async generateHint(request: GenerateHintRequest): Promise<GenerateHintResult> {
    const hintStage = request.hintStage ?? 'initial';
    const hintIteration = Math.max(request.hintIteration ?? 1, 1);
    const adaptiveHintLevel = this.resolveAdaptiveHintLevel(request.hintLevel, hintIteration);
    const latestAllTestsPassed = request.latestSubmissionSummary?.allTestsPassed === true;
    this.logger.debug(
      `Generating ${hintStage} ${adaptiveHintLevel} hint for ${request.language} (iteration=${hintIteration})`,
    );

    const levelGuidance = this.resolveHintLevelGuidance(adaptiveHintLevel);
    const conversationSummary = this.buildConversationSummary(request.conversationHistory ?? []);
    const prompt = this.buildHintPrompt({
      ...request,
      hintStage,
      hintIteration,
      hintLevel: adaptiveHintLevel,
      conversationSummary,
      levelGuidance,
      latestSubmissionSummary: request.latestSubmissionSummary,
    });

    const llmResult = await this.llmProvider.generateText({
      messages: [
        {
          role: 'system',
          content: this.buildHintSystemPrompt(),
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      maxOutputTokens: 500,
      model: this.resolveHintModel(),
    });

    return this.parseHintOutput(llmResult.text, {
      hintLevel: adaptiveHintLevel,
      hintStage,
      hintIteration,
      latestAllTestsPassed,
    });
  }

  async reviewCode(_request: ReviewCodeRequest): Promise<ReviewCodeResult> {
    this.logger.debug('Reviewing code');

    // TODO: Call LLM provider for real code review
    return {
      overallScore: 7,
      categories: [
        {
          name: 'Correctness',
          score: 8,
          feedback: 'Solution handles main cases correctly.',
        },
        {
          name: 'Efficiency',
          score: 7,
          feedback: 'Time complexity is acceptable. Consider edge cases.',
        },
        {
          name: 'Code Quality',
          score: 6,
          feedback: 'Variable naming could be more descriptive.',
        },
      ],
      summary: 'Solid solution with room for improvement in code clarity and edge case handling.',
    };
  }

  async generateInterviewResponse(
    _request: InterviewResponseRequest,
  ): Promise<InterviewResponseResult> {
    this.logger.debug('Generating interview response');

    // TODO: Call LLM provider for real interview AI
    return {
      message: "That's a good approach. Let me ask you about the time complexity.",
      followUpQuestion: 'What is the time and space complexity of your solution?',
      codeAnnotations: [
        {
          line: 1,
          comment: 'Consider adding input validation here.',
        },
      ],
    };
  }

  async generateSessionReport(
    request: GenerateSessionReportRequest,
  ): Promise<GenerateSessionReportResult> {
    this.logger.debug(`Generating session report for session ${request.sessionId}`);
    try {
      const prompt = buildSessionReportPrompt(request);
      const llmResult = await this.llmProvider.generateText({
        messages: [
          { role: 'system', content: prompt.systemPrompt },
          { role: 'user', content: prompt.userPrompt },
        ],
        temperature: 0.1,
        maxOutputTokens: 2500,
        jsonMode: true,
      });

      const parsed = parseSessionReportJson(llmResult.text);
      const normalizedReport = postprocessSessionReport(request, parsed);

      return {
        ...normalizedReport,
        sessionId: request.sessionId,
        generatedAt: new Date().toISOString(),
        testCaseBreakdown: toPublicSessionReportTestCaseBreakdown(request.finalTestCaseBreakdown),
        model: llmResult.model,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Session report generation failed for session ${request.sessionId} participant ${request.participantId}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
