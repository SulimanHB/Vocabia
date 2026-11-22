import { z } from 'zod';

export const languages = ['es', 'en', 'fr', 'de', 'it', 'pt', 'ja'] as const;
export const wordTypes = ['noun', 'verb', 'adjective', 'adverb', 'expression', 'other'] as const;

// Entero decimal positivo dentro del rango de INTEGER de Postgres (rechaza 0x10, 1e1, 01…).
export const validId = (value: string | undefined) => /^[1-9]\d*$/.test(value ?? '') && Number(value) <= 2147483647;

export const pairSchema = z.object({ sourceLanguage: z.enum(languages), targetLanguage: z.enum(languages) })
  .strict().refine(pair => pair.sourceLanguage !== pair.targetLanguage);

const exampleText = z.string().trim().min(1).max(500);
const exampleSchema = z.object({
  text: exampleText,
  translation: z.string().trim().max(500).default(''),
}).strict();
const englishVerbFormsSchema = z.object({
  past: z.string().trim().max(120).default(''),
  pastParticiple: z.string().trim().max(120).default(''),
  ing: z.string().trim().max(120).default(''),
}).strict();

export const wordSchema = z.object({
  term: z.string().trim().min(1).max(120),
  translation: z.string().trim().min(1).max(200),
  sourceLanguage: z.enum(languages),
  targetLanguage: z.enum(languages),
  wordType: z.enum(wordTypes),
  englishVerbForms: englishVerbFormsSchema.optional(),
  notes: z.string().trim().max(2000),
  // Acepta también el formato anterior de la API, pero guarda siempre objetos.
  examples: z.array(z.union([exampleSchema, exampleText.transform(text => ({ text, translation: '' }))])).min(1).max(10),
}).strict().refine(word => word.sourceLanguage !== word.targetLanguage, {
  message: 'Los idiomas deben ser distintos.', path: ['targetLanguage'],
}).refine(word => !word.englishVerbForms || word.targetLanguage === 'en' && word.wordType === 'verb' || !Object.values(word.englishVerbForms).some(Boolean), {
  message: 'Las formas inglesas solo se guardan para verbos traducidos al inglés.', path: ['englishVerbForms'],
});

const idParam = z.string().refine(validId).transform(Number);

// Pareja opcional: o los dos idiomas (distintos) o ninguno.
export const collectionFiltersSchema = z.object({
  sourceLanguage: z.enum(languages).optional(),
  targetLanguage: z.enum(languages).optional(),
}).refine(filters => (filters.sourceLanguage === undefined) === (filters.targetLanguage === undefined), {
  message: 'Indica los dos idiomas de la pareja.',
}).refine(filters => !filters.sourceLanguage || filters.sourceLanguage !== filters.targetLanguage, {
  message: 'Los idiomas deben ser distintos.',
});

export const filtersSchema = collectionFiltersSchema.safeExtend({
  search: z.string().trim().max(120).default(''),
  language: z.enum(languages).optional(),
  wordType: z.enum(wordTypes).optional(),
  collectionId: idParam.optional(),
});

export const collectionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sourceLanguage: z.enum(languages),
  targetLanguage: z.enum(languages),
}).strict().refine(collection => collection.sourceLanguage !== collection.targetLanguage, {
  message: 'Los idiomas deben ser distintos.', path: ['targetLanguage'],
});

export const wordCreationFiltersSchema = z.object({ collectionId: idParam.optional() }).strict();

export type WordInput = z.infer<typeof wordSchema>;
