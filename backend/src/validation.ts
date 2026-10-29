import { z } from 'zod';

export const languages = ['es', 'en', 'fr', 'de', 'it', 'pt', 'ja'] as const;
export const wordTypes = ['noun', 'verb', 'adjective', 'adverb', 'expression', 'other'] as const;

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

export const filtersSchema = z.object({
  search: z.string().trim().max(120).default(''),
  language: z.enum(languages).optional(),
  wordType: z.enum(wordTypes).optional(),
  sourceLanguage: z.enum(languages).optional(),
  targetLanguage: z.enum(languages).optional(),
  collectionId: z.coerce.number().int().positive().max(2147483647).optional(),
}).refine(filters => (filters.sourceLanguage === undefined) === (filters.targetLanguage === undefined), {
  message: 'Indica los dos idiomas de la pareja.',
}).refine(filters => !filters.sourceLanguage || filters.sourceLanguage !== filters.targetLanguage, {
  message: 'Los idiomas deben ser distintos.',
});

export const collectionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sourceLanguage: z.enum(languages),
  targetLanguage: z.enum(languages),
}).strict().refine(collection => collection.sourceLanguage !== collection.targetLanguage, {
  message: 'Los idiomas deben ser distintos.', path: ['targetLanguage'],
});

export const collectionFiltersSchema = z.object({
  sourceLanguage: z.enum(languages).optional(),
  targetLanguage: z.enum(languages).optional(),
}).refine(filters => (filters.sourceLanguage === undefined) === (filters.targetLanguage === undefined), {
  message: 'Indica los dos idiomas de la pareja.',
}).refine(filters => !filters.sourceLanguage || filters.sourceLanguage !== filters.targetLanguage, {
  message: 'Los idiomas deben ser distintos.',
});

export const wordCreationFiltersSchema = z.object({
  collectionId: z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(2147483647)).optional(),
}).strict();

export type WordInput = z.infer<typeof wordSchema>;
