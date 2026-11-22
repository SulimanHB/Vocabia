import { afterEach, expect, it, vi } from 'vitest';
import { createExportDocument, downloadExport } from './exportWords';
import { maxImportBytes, maxWords, parseImportPreview } from './importPreview';

afterEach(() => { vi.restoreAllMocks(); });
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

it('una exportación grande (3000 palabras con 3 ejemplos) se puede volver a importar', async () => {
  const words: Word[] = Array.from({ length: 3000 }, (_, i) => ({
    id: i, term: `palabra número ${i}`, translation: `word number ${i}`, sourceLanguage: 'es', targetLanguage: 'en', wordType: 'noun',
    notes: 'Una nota corta sobre el uso de esta palabra.', englishVerbForms: {}, collectionIds: [1],
    examples: [1, 2, 3].map(n => ({ text: `Esta es la frase de ejemplo ${n} con la palabra ${i}.`, translation: `This is example sentence ${n} with word ${i}.` })),
  }));
  const collections: Collection[] = [{ id: 1, name: 'A1', sourceLanguage: 'es', targetLanguage: 'en', wordCount: 3000 }];
  let blob: Blob | undefined;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(value => { blob = value as Blob; return 'blob:test'; });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  expect(downloadExport(words, collections)).toBe(true);
  expect(blob!.size).toBeLessThanOrEqual(maxImportBytes);
  const content = await new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.readAsText(blob!); });
  expect(parseImportPreview(content).words).toHaveLength(3000);
});

it('avisa si la exportación supera el número de palabras importables', () => {
  const words = Array.from({ length: maxWords + 1 }, (_, i) => ({ id: i, term: `t${i}`, translation: `w${i}`, sourceLanguage: 'es', targetLanguage: 'en', wordType: 'noun', notes: '', examples: [{ text: 'x', translation: '' }], englishVerbForms: {} })) as Word[];
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  expect(downloadExport(words, [])).toBe(false);
});
