import type { WordInput } from './model';

export function normalizeStudyAnswer(value: string, language: WordInput['targetLanguage']): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase(language);
}

export function normalizeSpokenAnswer(value: string, language: WordInput['targetLanguage']): string {
  // El reconocedor puede añadir un punto al final de una palabra o expresión.
  return normalizeStudyAnswer(value.replace(/[.!?。！？]+\s*$/u, ''), language);
}
