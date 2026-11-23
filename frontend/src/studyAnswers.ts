import type { WordInput } from './model';

export function normalizeStudyAnswer(value: string, language: WordInput['targetLanguage']): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase(language);
}

export function normalizeSpokenAnswer(value: string, language: WordInput['targetLanguage']): string {
  // El reconocedor puede añadir un punto al final de una palabra o expresión.
  return normalizeStudyAnswer(value.replace(/[.!?。！？]+\s*$/u, ''), language);
}

// «averiguar / entender»: vale la frase completa o cualquiera de las opciones.
// Solo se parte con espacios alrededor de la barra, para no romper «24/7» o «and/or».
export function matchesStudyAnswer(answer: string, expected: string, language: WordInput['targetLanguage'], normalize = normalizeStudyAnswer): boolean {
  const given = normalize(answer, language);
  return [expected, ...expected.split(/\s+\/\s+/)].some(option => normalize(option, language) === given);
}
