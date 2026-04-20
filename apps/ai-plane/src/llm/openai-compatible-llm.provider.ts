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

@Injectable()
export class OpenAiCompatibleLlmProvider implements ILlmProvider {
  constructor(
    private readonly config: OpenAiCompatibleProviderConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  static fromEnv(config: EnvConfig): OpenAiCompatibleLlmProvider {
    return new OpenAiCompatibleLlmProvider({
      baseUrl: config.AI_PLATFORM_BASE_URL,
      apiKey: config.AI_PLATFORM_API_KEY,
      model: config.AI_PLATFORM_MODEL,
      timeoutMs: config.AI_REQUEST_TIMEOUT_MS,
    });
  }

  async generateText(input: LlmGenerateTextInput): Promise<LlmGenerateTextResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: input.messages,
          temperature: input.temperature ?? 0.1,
          max_tokens: input.maxOutputTokens,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM request failed with ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as OpenAiChatCompletionResponse;
      const text = data.choices?.[0]?.message?.content?.trim();

      if (!text) {
        throw new Error('LLM response did not include message content');
      }

      return {
        text,
        model: data.model ?? this.config.model,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
