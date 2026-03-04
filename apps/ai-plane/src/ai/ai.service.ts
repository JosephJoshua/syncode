import { Injectable, Logger } from '@nestjs/common';
import type {
  GenerateHintRequest,
  GenerateHintResult,
  InterviewResponseRequest,
  InterviewResponseResult,
  ReviewCodeRequest,
  ReviewCodeResult,
} from '@syncode/contracts';

// TODO: Replace stub responses with @Inject(LLM_PROVIDER) integration
const HINT_RESPONSES: Record<string, string> = {
  gentle: 'Consider what data structure would let you look up values efficiently.',
  moderate:
    'A hash map would give you O(1) lookups. Think about what you need to store as keys vs values.',
  direct:
    'Use a hash map to store each number and its index. For each element, check if the complement (target - current) exists in the map.',
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  async generateHint(request: GenerateHintRequest): Promise<GenerateHintResult> {
    this.logger.debug(`Generating ${request.hintLevel} hint for ${request.language}`);

    // TODO: Call LLM provider for real hint generation
    return {
      hint:
        HINT_RESPONSES[request.hintLevel] ??
        'Consider what data structure would let you look up values efficiently.',
      suggestedApproach: 'Consider breaking the problem into smaller subproblems.',
    };
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
}
