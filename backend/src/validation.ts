import { z } from 'zod';

export const languages = ['es', 'en', 'fr', 'de', 'it', 'pt', 'ja'] as const;
export const wordTypes = ['noun', 'verb', 'adjective', 'adverb', 'expression', 'other'] as const;

export const wordSchema = z.object({
  term: z.string().trim().min(1).max(120),
  translation: z.string().trim().min(1).max(200),
  sourceLanguage: z.enum(languages),
  targetLanguage: z.enum(languages),
  wordType: z.enum(wordTypes),
  notes: z.string().trim().max(2000),
  examples: z.array(z.string().trim().min(1).max(500)).min(1).max(10),
}).strict().refine(word => word.sourceLanguage !== word.targetLanguage, {
  message: 'Los idiomas deben ser distintos.', path: ['targetLanguage'],
});

export const filtersSchema = z.object({
  search: z.string().trim().max(120).default(''),
  language: z.enum(languages).optional(),
  wordType: z.enum(wordTypes).optional(),
  sourceLanguage: z.enum(languages).optional(),
  targetLanguage: z.enum(languages).optional(),
}).refine(filters => (filters.sourceLanguage === undefined) === (filters.targetLanguage === undefined), {
  message: 'Indica los dos idiomas de la pareja.',
}).refine(filters => !filters.sourceLanguage || filters.sourceLanguage !== filters.targetLanguage, {
  message: 'Los idiomas deben ser distintos.',
});

export type WordInput = z.infer<typeof wordSchema>;
