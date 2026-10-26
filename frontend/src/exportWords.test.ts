import { expect, it } from 'vitest';
import { createExportDocument } from './exportWords';
import type { Collection, Word } from './model';

it('exporta el contenido completo en un formato versionado sin IDs internos', () => {
  const words: Word[] = [
    { id: 7, term: 'dormir', translation: 'sleep', sourceLanguage: 'es', targetLanguage: 'en', wordType: 'verb', notes: 'Descanso.', examples: [{ text: 'Duermo.', translation: 'I sleep.' }], englishVerbForms: { past: 'slept', pastParticiple: 'slept', ing: 'sleeping' }, collectionIds: [3, 4] },
    { id: 8, term: 'Buch', translation: 'libro', sourceLanguage: 'de', targetLanguage: 'es', wordType: 'noun', notes: '', examples: [{ text: 'Ein Buch.', translation: '' }], englishVerbForms: {} },
  ];
  const collections: Collection[] = [
    { id: 3, name: 'A1', sourceLanguage: 'es', targetLanguage: 'en', wordCount: 1 },
    { id: 4, name: 'Importantes', sourceLanguage: 'es', targetLanguage: 'en', wordCount: 1 },
    { id: 5, name: 'Vacía', sourceLanguage: 'de', targetLanguage: 'es', wordCount: 0 },
  ];
  const exportDocument = createExportDocument(words, collections, new Date('2026-10-24T10:00:00.000Z'));
  expect(exportDocument).toEqual({
    format: 'vocabia-words', version: 2, exportedAt: '2026-10-24T10:00:00.000Z',
    collections: [
      { name: 'A1', sourceLanguage: 'es', targetLanguage: 'en' },
      { name: 'Importantes', sourceLanguage: 'es', targetLanguage: 'en' },
      { name: 'Vacía', sourceLanguage: 'de', targetLanguage: 'es' },
    ],
    words: [
      { term: 'dormir', translation: 'sleep', sourceLanguage: 'es', targetLanguage: 'en', wordType: 'verb', notes: 'Descanso.', examples: [{ text: 'Duermo.', translation: 'I sleep.' }], englishVerbForms: { past: 'slept', pastParticiple: 'slept', ing: 'sleeping' }, collections: ['A1', 'Importantes'] },
      { term: 'Buch', translation: 'libro', sourceLanguage: 'de', targetLanguage: 'es', wordType: 'noun', notes: '', examples: [{ text: 'Ein Buch.', translation: '' }], englishVerbForms: {}, collections: [] },
    ],
  });
  expect(JSON.stringify(exportDocument)).not.toContain('"id"');
});
