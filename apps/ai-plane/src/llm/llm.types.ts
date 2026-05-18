export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmGenerateTextInput {
  messages: LlmMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  jsonMode?: boolean;
  model?: string;
}

export interface LlmGenerateTextResult {
  text: string;
  model: string;
}

export interface LlmGenerateSpeechInput {
  text: string;
  model?: string;
  voice?: string;
  format?: 'mp3' | 'wav';
}

export interface LlmGenerateSpeechResult {
  audio: Buffer;
  model: string;
  mimeType: string;
}

export interface ILlmProvider {
  generateText(input: LlmGenerateTextInput): Promise<LlmGenerateTextResult>;
  generateSpeech(input: LlmGenerateSpeechInput): Promise<LlmGenerateSpeechResult>;
}
