import { languages, wordTypes, type EnglishVerbForms, type Example, type WordInput } from './model';

export const maxImportBytes = 2 * 1024 * 1024;
const maxWords = 5000;
const maxCollections = 500;

type Language = WordInput['sourceLanguage'];
interface ExportedCollection { name: string; sourceLanguage: Language; targetLanguage: Language }
interface ExportedWord extends WordInput { collections: string[]; englishVerbForms: EnglishVerbForms }
export interface ImportDocument {
  format: 'vocabia-words';
  version: 2;
  exportedAt: string;
  collections: ExportedCollection[];
  words: ExportedWord[];
}
export type ImportErrorCode = 'tooLarge' | 'invalidJson' | 'invalidFormat' | 'invalidData';
export class ImportPreviewError extends Error {
  constructor(readonly code: ImportErrorCode) { super(code); }
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const language = (value: unknown): value is Language => typeof value === 'string' && Object.hasOwn(languages, value);
const text = (value: unknown, max: number, required = false): value is string =>
  typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0);
const collectionKey = (source: string, target: string, name: string) => `${source}:${target}:${name.trim().toLocaleLowerCase()}`;

function validCollection(value: unknown): value is ExportedCollection {
  return record(value) && text(value.name, 80, true) && language(value.sourceLanguage) &&
    language(value.targetLanguage) && value.sourceLanguage !== value.targetLanguage;
}

function validExample(value: unknown): value is Example {
  return record(value) && text(value.text, 500, true) && text(value.translation, 500);
}

function validWord(value: unknown, collections: Map<string, ExportedCollection>): value is ExportedWord {
  if (!record(value) || !text(value.term, 120, true) || !text(value.translation, 200, true) ||
    !language(value.sourceLanguage) || !language(value.targetLanguage) || value.sourceLanguage === value.targetLanguage ||
    typeof value.wordType !== 'string' || !Object.hasOwn(wordTypes, value.wordType) ||
    !text(value.notes, 2000) || !Array.isArray(value.examples) || value.examples.length < 1 ||
    value.examples.length > 10 || !value.examples.every(validExample) || !record(value.englishVerbForms) ||
    !Array.isArray(value.collections)) return false;

  const forms = value.englishVerbForms;
  if (Object.keys(forms).some(key => !['past', 'pastParticiple', 'ing'].includes(key)) ||
    Object.values(forms).some(form => !text(form, 120)) ||
    (value.wordType !== 'verb' || value.targetLanguage !== 'en') && Object.values(forms).some(Boolean)) return false;

  const used = new Set<string>();
  return value.collections.every(name => {
    if (!text(name, 80, true)) return false;
    const key = collectionKey(value.sourceLanguage as string, value.targetLanguage as string, name);
    if (!collections.has(key) || used.has(key)) return false;
    used.add(key);
    return true;
  });
}

export function parseImportPreview(content: string): ImportDocument {
  if (new Blob([content]).size > maxImportBytes) throw new ImportPreviewError('tooLarge');
  let value: unknown;
  try { value = JSON.parse(content); }
  catch { throw new ImportPreviewError('invalidJson'); }
  if (!record(value) || value.format !== 'vocabia-words' || value.version !== 2) {
    throw new ImportPreviewError('invalidFormat');
  }
  if (!text(value.exportedAt, 40, true) || Number.isNaN(Date.parse(value.exportedAt)) ||
    !Array.isArray(value.collections) || value.collections.length > maxCollections ||
    !Array.isArray(value.words) || value.words.length > maxWords || !value.collections.every(validCollection)) {
    throw new ImportPreviewError('invalidData');
  }
  const collections = new Map<string, ExportedCollection>();
  for (const collection of value.collections as ExportedCollection[]) {
    const key = collectionKey(collection.sourceLanguage, collection.targetLanguage, collection.name);
    if (collections.has(key)) throw new ImportPreviewError('invalidData');
    collections.set(key, collection);
  }
  if (!value.words.every(word => validWord(word, collections))) throw new ImportPreviewError('invalidData');
  return value as unknown as ImportDocument;
}
