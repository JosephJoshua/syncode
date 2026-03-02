import type { SupportedLanguage } from '@syncode/shared';

export interface GenerateHintRequest {
  problemDescription: string;
  currentCode: string;
  language: SupportedLanguage;
  hintLevel: 'gentle' | 'moderate' | 'direct';
}

export interface GenerateHintResult {
  hint: string;
  suggestedApproach?: string;
}

export interface ReviewCodeRequest {
  problemDescription: string;
  code: string;
  language: SupportedLanguage;
  rubric?: string[];
}

export interface ReviewCodeResult {
  overallScore: number;
  categories: Array<{ name: string; score: number; feedback: string }>;
  summary: string;
}

export interface InterviewResponseRequest {
  conversationHistory: Array<{ role: string; content: string }>;
  currentCode: string;
  problemDescription: string;
}

export interface InterviewResponseResult {
  message: string;
  followUpQuestion?: string;
  codeAnnotations?: Array<{ line: number; comment: string }>;
}
