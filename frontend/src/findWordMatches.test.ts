import { expect, it } from 'vitest';
import { findWordMatches } from './findWordMatches';
import type { Word } from './model';

const base: Word = {
  id: 1, term: 'Dormir', translation: 'sleep', sourceLanguage: 'es', targetLanguage: 'en',
  wordType: 'verb', notes: '', examples: [{ text: 'Quiero dormir.', translation: 'I want to sleep.' }],
};

it('encuentra coincidencias aunque sus ejemplos o colecciones sean distintos', () => {
  const groups = findWordMatches([
    base,
    { ...base, id: 2, term: ' dormir ', translation: 'SLEEP', collectionIds: [4], examples: [{ text: 'Duermo.', translation: 'I sleep.' }] },
    { ...base, id: 3, translation: 'to rest' },
    { ...base, id: 4, targetLanguage: 'fr' },
    { ...base, id: 5, term: 'Dormí' },
  ]);
  expect(groups).toHaveLength(1);
  expect(groups[0].map(word => word.id)).toEqual([1, 2]);
});
