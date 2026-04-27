import { Injectable } from '@nestjs/common';
import type { EnvConfig } from '../config/env.config.js';
import type { ILlmProvider, LlmGenerateTextInput, LlmGenerateTextResult } from './llm.types.js';

interface OpenAiCompatibleProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

interface OpenAiChatCompletionResponse {
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1_000;

@Injectable()
export class OpenAiCompatibleLlmProvider implements ILlmProvider {
  constructor(
    private readonly config: OpenAiCompatibleProviderConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  static fromEnv(config: EnvConfig): OpenAiCompatibleLlmProvider {
    return new OpenAiCompatibleLlmProvider({
      baseUrl: config.AI_PLATFORM_BASE_URL,
      apiKey: config.AI_PLATFORM_API_KEY ?? '',
      model: config.AI_PLATFORM_MODEL,
      timeoutMs: config.AI_REQUEST_TIMEOUT_MS,
    });
  }

  async generateText(input: LlmGenerateTextInput): Promise<LlmGenerateTextResult> {
    const model = input.model ?? this.config.model;
    const requestBody = {
      model,
      messages: input.messages,
      temperature: input.temperature ?? 0.1,
      max_tokens: input.maxOutputTokens,
      ...(input.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
    };

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

      try {
        const response = await this.fetchImpl(`${this.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();

          if (attempt < MAX_RETRY_ATTEMPTS && isRetryableStatus(response.status)) {
            await delay(getRetryDelayMs(attempt));
            continue;
          }

          throw new Error(`LLM request failed with ${response.status}: ${errorText}`);
        }

        const data = (await response.json()) as OpenAiChatCompletionResponse;
        const text = data.choices?.[0]?.message?.content?.trim();

        if (!text) {
          throw new Error('LLM response did not include message content');
        }

        return {
          text,
          model: data.model ?? model,
        };
      } catch (error) {
        if (attempt < MAX_RETRY_ATTEMPTS && isRetryableTransportError(error)) {
          await delay(getRetryDelayMs(attempt));
          continue;
        }

        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new Error('LLM request failed after retries');
  }
}

function isRetryableStatus(status: number) {
  return status === 502 || status === 503 || status === 504;
}

function isRetryableTransportError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

function getRetryDelayMs(attempt: number) {
  return INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
