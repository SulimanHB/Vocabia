import { describe, expect, it } from 'vitest';
import { compareImport } from './compareImport';
import { createExportDocument } from './exportWords';
import { parseImportPreview } from './importPreview';
import type { Collection, Word } from './model';

const currentCollection: Collection = { id: 1, name: 'A1', sourceLanguage: 'es', targetLanguage: 'en', wordCount: 1 };
const currentWord: Word = { id: 1, term: 'Dormir', translation: 'Sleep', sourceLanguage: 'es', targetLanguage: 'en', wordType: 'verb', notes: 'Con otro contexto', examples: [{ text: 'Voy a dormir.', translation: '' }], collectionIds: [1] };

describe('comparación previa a la importación', () => {
  it('separa colecciones existentes de nuevas y avisa de palabras parecidas sin fusionarlas', () => {
    const collections: Collection[] = [
      { ...currentCollection, id: 2, name: ' a1 ' },
      { ...currentCollection, id: 3, name: 'Importantes' },
      { ...currentCollection, id: 4, sourceLanguage: 'en', targetLanguage: 'es' },
    ];
    const words: Word[] = [
      { ...currentWord, id: 2, term: ' dormir ', translation: 'SLEEP', notes: 'Ejemplos distintos' },
      { ...currentWord, id: 3, term: 'beber', translation: 'drink' },
      { ...currentWord, id: 4, sourceLanguage: 'en', targetLanguage: 'es' },
      { ...currentWord, id: 5, translation: 'sleeping' },
    ];
    const exported = createExportDocument(words, collections, new Date('2026-10-28T10:00:00.000Z'));
    const document = parseImportPreview(JSON.stringify(exported));
    expect(compareImport(document, [currentWord], [currentCollection])).toEqual({
      collectionMatches: [true, false, false], wordMatches: [true, false, false, false],
      existingCollections: 1, newCollections: 2, possibleWords: 1, unmatchedWords: 3,
    });
  });

  it('no confunde la dirección ni las tildes del texto', () => {
    const document = parseImportPreview(JSON.stringify(createExportDocument([
      { ...currentWord, id: 2, term: 'Dormír', collectionIds: [] },
    ], [], new Date('2026-10-28T10:00:00.000Z'))));
    expect(compareImport(document, [currentWord], [currentCollection]).possibleWords).toBe(0);
  });

  it('marca como posible coincidencia la segunda aparición de una palabra en el mismo archivo', () => {
    const document = parseImportPreview(JSON.stringify(createExportDocument([
      { ...currentWord, id: 2, term: 'beber', translation: 'drink', collectionIds: [] },
      { ...currentWord, id: 3, term: 'Beber', translation: 'Drink', collectionIds: [] },
    ], [], new Date('2026-10-28T10:00:00.000Z'))));
    expect(compareImport(document, [], []).wordMatches).toEqual([false, true]);
  });
});
