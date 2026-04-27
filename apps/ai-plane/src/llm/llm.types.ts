export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmGenerateTextInput {
  messages: LlmMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  jsonMode?: boolean;
}

export interface LlmGenerateTextResult {
  text: string;
  model: string;
}

export interface ILlmProvider {
  generateText(input: LlmGenerateTextInput): Promise<LlmGenerateTextResult>;
}
