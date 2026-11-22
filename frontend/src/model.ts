import type { UiText } from './interfaceText';

// Solo códigos: los nombres visibles salen de interfaceText en el idioma de la interfaz.
export const languages = ['es', 'en', 'fr', 'de', 'it', 'pt', 'ja'] as const;
export const wordTypes = ['noun', 'verb', 'adjective', 'adverb', 'expression', 'other'] as const;
export interface Example { text: string; translation: string }
export interface EnglishVerbForms { past?: string; pastParticiple?: string; ing?: string }

export interface WordInput {
  term: string;
  translation: string;
  sourceLanguage: typeof languages[number];
  targetLanguage: typeof languages[number];
  wordType: typeof wordTypes[number];
  englishVerbForms?: EnglishVerbForms;
  notes: string;
  examples: Example[];
}
export interface Word extends WordInput { id: number; collectionIds?: number[]; studyMark?: 'known' | 'difficult' | null }
export interface Collection {
  id: number;
  name: string;
  sourceLanguage: WordInput['sourceLanguage'];
  targetLanguage: WordInput['targetLanguage'];
  wordCount: number;
}
export interface StudyRound {
  id: number;
  sourceLanguage: WordInput['sourceLanguage'];
  targetLanguage: WordInput['targetLanguage'];
  questionCount: number;
  writtenCount: number;
  matchedCount: number;
  completedAt: string;
}

// La API comunica el fallo; la interfaz decide en qué idioma mostrarlo.
export class ApiError extends Error {
  constructor(readonly messageKey: 'connectionError' | 'invalidError' | 'missingError' | 'largeError' | 'operationError' | 'duplicateError') {
    super(messageKey);
  }
}

export function getErrorMessage(error: unknown, text: UiText): string {
  if (error instanceof ApiError) return text[error.messageKey];
  return error instanceof Error ? error.message : text.operationError;
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('connectionError');
  }
  if (!response.ok) {
    if (response.status === 400) throw new ApiError('invalidError');
    if (response.status === 404) throw new ApiError('missingError');
    if (response.status === 413) throw new ApiError('largeError');
    if (response.status === 409) throw new ApiError('duplicateError');
    throw new ApiError('operationError');
  }
  return response.status === 204 ? undefined as T : response.json();
}
