import { expect, it } from 'vitest';
import { matchesStudyAnswer, normalizeSpokenAnswer } from './studyAnswers';

it('acepta cualquiera de las opciones separadas por « / » o la respuesta completa', () => {
  for (const answer of ['averiguar', ' Entender ', 'averiguar / entender']) {
    expect(matchesStudyAnswer(answer, 'averiguar / entender', 'es')).toBe(true);
  }
  expect(matchesStudyAnswer('resolver', 'averiguar / entender', 'es')).toBe(false);
});

it('no parte barras sin espacios como 24/7 o and/or', () => {
  expect(matchesStudyAnswer('24', '24/7', 'en')).toBe(false);
  expect(matchesStudyAnswer('and', 'and/or', 'en')).toBe(false);
  expect(matchesStudyAnswer('and/or', 'and/or', 'en')).toBe(true);
});

it('funciona con la normalización de voz (punto final del reconocedor)', () => {
  expect(matchesStudyAnswer('Entender.', 'averiguar / entender', 'es', normalizeSpokenAnswer)).toBe(true);
});
