import { describe, expect, it } from 'vitest';
import { createExportDocument } from './exportWords';
import { ImportPreviewError, maxImportBytes, parseImportPreview } from './importPreview';
import type { Collection, Word } from './model';

const collection: Collection = { id: 4, name: 'A1', sourceLanguage: 'es', targetLanguage: 'en', wordCount: 1 };
const word: Word = { id: 8, term: 'dormir', translation: 'sleep', sourceLanguage: 'es', targetLanguage: 'en', wordType: 'verb', notes: '', examples: [{ text: 'Quiero dormir.', translation: 'I want to sleep.' }], englishVerbForms: { past: 'slept' }, collectionIds: [4] };
const exported = () => createExportDocument([word], [collection], new Date('2026-10-28T10:00:00.000Z'));
const parse = (value: unknown) => parseImportPreview(JSON.stringify(value));
const failsWith = (value: unknown, code: string) => {
  try { parse(value); throw new Error('El archivo fue aceptado'); }
  catch (cause) { expect(cause).toBeInstanceOf(ImportPreviewError); expect((cause as ImportPreviewError).code).toBe(code); }
};

describe('vista previa del archivo exportado', () => {
  it('acepta el formato v2 real con una palabra vinculada y una colección vacía', () => {
    const document = exported();
    document.collections.push({ name: 'Vacía', sourceLanguage: 'de', targetLanguage: 'es' });
    expect(parse(document)).toEqual(document);
  });

  it('distingue JSON roto, otra versión y archivo excesivo', () => {
    expect(() => parseImportPreview('{')).toThrowError(new ImportPreviewError('invalidJson'));
    failsWith({ ...exported(), version: 1 }, 'invalidFormat');
    expect(() => parseImportPreview(' '.repeat(maxImportBytes + 1))).toThrowError(new ImportPreviewError('tooLarge'));
  });

  it('rechaza campos incompletos y relaciones a colecciones de otra pareja', () => {
    failsWith({ ...exported(), words: [{ ...exported().words[0], examples: [] }] }, 'invalidData');
    failsWith({ ...exported(), words: [{ ...exported().words[0], collections: ['No existe'] }] }, 'invalidData');
    failsWith({ ...exported(), words: [{ ...exported().words[0], targetLanguage: 'de' }] }, 'invalidData');
    failsWith({ ...exported(), collections: [exported().collections[0], { ...exported().collections[0], name: 'a1' }] }, 'invalidData');
  });
});
