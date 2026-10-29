import { Router } from 'express';
import { z } from 'zod';
import type { Database } from './database.js';
import { collectionSchema, wordSchema, type WordInput } from './validation.js';

const referencesSchema = z.array(z.string().trim().min(1).max(80)).max(500);
const requestSchema = z.object({
  mode: z.enum(['skipMatches', 'includeMatches']),
  document: z.object({
    format: z.literal('vocabia-words'),
    version: z.literal(2),
    exportedAt: z.iso.datetime(),
    collections: z.array(collectionSchema).max(500),
    words: z.array(z.unknown()).max(5000),
  }).strict(),
}).strict();

type CollectionInput = z.infer<typeof collectionSchema>;
type ImportedWord = { input: WordInput; collections: string[] };
const normalized = (value: string) => value.trim().normalize('NFC').toLowerCase();
const collectionKey = (source: string, target: string, name: string) => JSON.stringify([source, target, normalized(name)]);
const wordKey = (source: string, target: string, term: string, translation: string) => JSON.stringify([source, target, normalized(term), normalized(translation)]);

function validateWords(rawWords: unknown[], collections: CollectionInput[]): ImportedWord[] | null {
  const names = new Set<string>();
  for (const collection of collections) {
    const key = collectionKey(collection.sourceLanguage, collection.targetLanguage, collection.name);
    if (names.has(key)) return null;
    names.add(key);
  }
  const words: ImportedWord[] = [];
  for (const raw of rawWords) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
    const { collections: rawReferences, ...rawWord } = raw as Record<string, unknown>;
    const input = wordSchema.safeParse(rawWord);
    const references = referencesSchema.safeParse(rawReferences);
    if (!input.success || !references.success) return null;
    const used = new Set<string>();
    for (const name of references.data) {
      const key = collectionKey(input.data.sourceLanguage, input.data.targetLanguage, name);
      if (!names.has(key) || used.has(key)) return null;
      used.add(key);
    }
    words.push({ input: input.data, collections: references.data });
  }
  return words;
}

export function createImportRouter(db: Database) {
  const router = Router();
  router.post('/', async (req, res) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'El archivo o la opción de importación no son válidos.' }); return; }
    const { document, mode } = parsed.data;
    const words = validateWords(document.words, document.collections);
    if (!words) { res.status(400).json({ error: 'El archivo contiene palabras o relaciones inválidas.' }); return; }

    const result = await db.transaction(async tx => {
      const collectionIds = new Map<string, number>();
      let createdCollections = 0;
      let reusedCollections = 0;
      for (const collection of document.collections) {
        const inserted = await tx.query<{ id: number }>(`INSERT INTO collections(name,source_language,target_language)
          VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id`,
          [collection.name, collection.sourceLanguage, collection.targetLanguage]);
        let id = inserted.rows[0]?.id;
        if (id === undefined) {
          const existing = await tx.query<{ id: number }>(`SELECT id FROM collections
            WHERE source_language=$1 AND target_language=$2 AND lower(name)=lower($3)`,
            [collection.sourceLanguage, collection.targetLanguage, collection.name]);
          if (!existing.rows[0]) throw new Error('No se pudo reutilizar la colección.');
          id = existing.rows[0].id;
          reusedCollections++;
        } else createdCollections++;
        collectionIds.set(collectionKey(collection.sourceLanguage, collection.targetLanguage, collection.name), id);
      }

      const existingWords = await tx.query<{ term: string; translation: string; sourceLanguage: string; targetLanguage: string }>(
        `SELECT term, translation, source_language AS "sourceLanguage", target_language AS "targetLanguage" FROM words`);
      const known = new Set(existingWords.rows.map(word => wordKey(word.sourceLanguage, word.targetLanguage, word.term, word.translation)));
      let createdWords = 0;
      let skippedWords = 0;
      for (const { input, collections } of words) {
        const key = wordKey(input.sourceLanguage, input.targetLanguage, input.term, input.translation);
        if (mode === 'skipMatches' && known.has(key)) { skippedWords++; continue; }
        const inserted = await tx.query<{ id: number }>(`INSERT INTO words(term,translation,source_language,target_language,word_type,notes,examples,english_verb_forms)
          VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb) RETURNING id`,
          [input.term, input.translation, input.sourceLanguage, input.targetLanguage, input.wordType, input.notes,
            JSON.stringify(input.examples), JSON.stringify(input.englishVerbForms ?? {})]);
        const wordId = inserted.rows[0].id;
        for (const name of collections) {
          const collectionId = collectionIds.get(collectionKey(input.sourceLanguage, input.targetLanguage, name));
          if (collectionId === undefined) throw new Error('La colección importada no está disponible.');
          await tx.query('INSERT INTO collection_words(collection_id,word_id) VALUES($1,$2)', [collectionId, wordId]);
        }
        createdWords++;
        known.add(key);
      }
      return { createdCollections, reusedCollections, createdWords, skippedWords };
    });
    res.status(201).json(result);
  });
  return router;
}
