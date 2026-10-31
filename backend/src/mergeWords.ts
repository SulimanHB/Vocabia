import { Router } from 'express';
import { z } from 'zod';
import type { Database, Queryable } from './database.js';
import { languages, wordSchema } from './validation.js';

const requestSchema = z.object({
  keepId: z.number().int().positive().max(2147483647),
  sourceId: z.number().int().positive().max(2147483647),
  deleteSource: z.boolean(),
  word: wordSchema,
}).strict().refine(value => value.keepId !== value.sourceId);

type StoredWord = {
  id: number; term: string; translation: string; sourceLanguage: string; targetLanguage: string;
};

type WordRow = {
  id: number; term: string; translation: string; source_language: string; target_language: string;
  word_type: string; notes: string; examples: unknown; english_verb_forms: unknown; created_at: string;
  study_mark?: 'known' | 'difficult' | null;
};
type Snapshot = { word: WordRow; collectionIds: number[] };
type HistoryRow = { id: number; keep_before: Snapshot; source_before: Snapshot; keep_after: Snapshot;
  source_deleted: boolean; undone_at: string | null };

async function snapshot(tx: Queryable, id: number): Promise<Snapshot | null> {
  const result = await tx.query<Snapshot>(`SELECT to_jsonb(w) AS word,
    COALESCE((SELECT jsonb_agg(collection_id ORDER BY collection_id) FROM collection_words
      WHERE word_id=w.id),'[]'::jsonb) AS "collectionIds"
    FROM words w WHERE w.id=$1 FOR UPDATE`, [id]);
  return result.rows[0] ?? null;
}

async function sameSnapshot(tx: Queryable, first: Snapshot, second: Snapshot) {
  const result = await tx.query<{ same: boolean }>('SELECT $1::jsonb = $2::jsonb AS same',
    [JSON.stringify({ ...first, word: { ...first.word, study_mark: first.word.study_mark ?? null } }),
      JSON.stringify({ ...second, word: { ...second.word, study_mark: second.word.study_mark ?? null } })]);
  return result.rows[0].same;
}

const pairSchema = z.object({ sourceLanguage: z.enum(languages), targetLanguage: z.enum(languages) })
  .strict().refine(pair => pair.sourceLanguage !== pair.targetLanguage);

const normalized = (value: string) => value.trim().normalize('NFC').toLowerCase();

class MergeFailure extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export function createMergeRouter(db: Database) {
  const router = Router();
  router.get('/latest', async (req, res) => {
    const parsed = pairSchema.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: 'Indica una pareja de idiomas válida.' }); return; }
    const result = await db.query<{ id: number; term: string; translation: string }>(`
      SELECT id,keep_after->'word'->>'term' AS term,keep_after->'word'->>'translation' AS translation
      FROM merge_history WHERE source_language=$1 AND target_language=$2 AND undone_at IS NULL
      ORDER BY id DESC LIMIT 1`, [parsed.data.sourceLanguage, parsed.data.targetLanguage]);
    res.json(result.rows[0] ?? null);
  });

  router.post('/:id/undo', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1 || id > 2147483647) {
      res.status(400).json({ error: 'El identificador no es válido.' }); return;
    }
    try {
      const restored = await db.transaction(async tx => {
        const result = await tx.query<HistoryRow>(`SELECT id,keep_before,source_before,keep_after,source_deleted,undone_at
          FROM merge_history WHERE id=$1 FOR UPDATE`, [id]);
        const history = result.rows[0];
        if (!history || history.undone_at) throw new MergeFailure(404, 'Esta fusión ya no se puede deshacer.');
        const currentKeep = await snapshot(tx, history.keep_after.word.id);
        const currentSource = await snapshot(tx, history.source_before.word.id);
        if (!currentKeep || !await sameSnapshot(tx, currentKeep, history.keep_after) ||
          (history.source_deleted ? currentSource !== null : !currentSource || !await sameSnapshot(tx, currentSource, history.source_before))) {
          throw new MergeFailure(409, 'Las tarjetas cambiaron después de la fusión. No se sobrescribió ningún dato.');
        }
        const oldCollections = [...new Set([...history.keep_before.collectionIds, ...history.source_before.collectionIds])];
        if (oldCollections.length) {
          const available = await tx.query<{ id: number }>('SELECT id FROM collections WHERE id = ANY($1::int[])', [oldCollections]);
          if (available.rows.length !== oldCollections.length) throw new MergeFailure(409, 'Una colección original ya no existe.');
        }
        const w = history.keep_before.word;
        await tx.query(`UPDATE words SET term=$1,translation=$2,source_language=$3,target_language=$4,
          word_type=$5,notes=$6,examples=$7::jsonb,english_verb_forms=$8::jsonb,created_at=$9,study_mark=$10 WHERE id=$11`,
          [w.term, w.translation, w.source_language, w.target_language, w.word_type, w.notes,
            JSON.stringify(w.examples), JSON.stringify(w.english_verb_forms), w.created_at, w.study_mark ?? null, w.id]);
        if (history.source_deleted) {
          const s = history.source_before.word;
          await tx.query(`INSERT INTO words(id,term,translation,source_language,target_language,word_type,notes,examples,english_verb_forms,created_at,study_mark)
            OVERRIDING SYSTEM VALUE VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11)`,
            [s.id, s.term, s.translation, s.source_language, s.target_language, s.word_type, s.notes,
              JSON.stringify(s.examples), JSON.stringify(s.english_verb_forms), s.created_at, s.study_mark ?? null]);
        }
        await tx.query('DELETE FROM collection_words WHERE word_id=$1', [w.id]);
        for (const collectionId of history.keep_before.collectionIds) {
          await tx.query('INSERT INTO collection_words(collection_id,word_id) VALUES ($1,$2)', [collectionId, w.id]);
        }
        if (history.source_deleted) {
          for (const collectionId of history.source_before.collectionIds) {
            await tx.query('INSERT INTO collection_words(collection_id,word_id) VALUES ($1,$2)', [collectionId, history.source_before.word.id]);
          }
        }
        await tx.query('UPDATE merge_history SET undone_at=NOW() WHERE id=$1', [id]);
        return { restored: true };
      });
      res.json(restored);
    } catch (error) {
      if (error instanceof MergeFailure) { res.status(error.status).json({ error: error.message }); return; }
      throw error;
    }
  });

  router.post('/', async (req, res) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Revisa las tarjetas y el contenido de la fusión.' }); return; }
    const { keepId, sourceId, deleteSource, word } = parsed.data;
    try {
      const result = await db.transaction(async tx => {
        const current = await tx.query<StoredWord>(`SELECT id,term,translation,source_language AS "sourceLanguage",
          target_language AS "targetLanguage" FROM words WHERE id IN ($1,$2) FOR UPDATE`, [keepId, sourceId]);
        const keep = current.rows.find(item => item.id === keepId);
        const source = current.rows.find(item => item.id === sourceId);
        if (!keep || !source) throw new MergeFailure(404, 'Una de las tarjetas ya no existe.');
        const samePair = keep.sourceLanguage === source.sourceLanguage && keep.targetLanguage === source.targetLanguage &&
          keep.sourceLanguage === word.sourceLanguage && keep.targetLanguage === word.targetLanguage;
        const sameWord = normalized(keep.term) === normalized(source.term) && normalized(keep.translation) === normalized(source.translation) &&
          normalized(keep.term) === normalized(word.term) && normalized(keep.translation) === normalized(word.translation);
        if (!samePair || !sameWord) throw new MergeFailure(400, 'Las tarjetas ya no tienen la misma palabra, traducción e idiomas.');

        const keepBefore = await snapshot(tx, keepId);
        const sourceBefore = await snapshot(tx, sourceId);
        if (!keepBefore || !sourceBefore) throw new MergeFailure(404, 'Una de las tarjetas ya no existe.');

        await tx.query(`UPDATE words SET term=$1,translation=$2,source_language=$3,target_language=$4,
          word_type=$5,notes=$6,examples=$7::jsonb,english_verb_forms=$8::jsonb WHERE id=$9`,
          [word.term, word.translation, word.sourceLanguage, word.targetLanguage, word.wordType, word.notes,
            JSON.stringify(word.examples), JSON.stringify(word.englishVerbForms ?? {}), keepId]);
        await tx.query(`INSERT INTO collection_words(collection_id,word_id)
          SELECT collection_id,$1 FROM collection_words WHERE word_id=$2 ON CONFLICT DO NOTHING`, [keepId, sourceId]);
        if (deleteSource) await tx.query('DELETE FROM words WHERE id=$1', [sourceId]);

        const keepAfter = await snapshot(tx, keepId);
        await tx.query(`INSERT INTO merge_history(source_language,target_language,keep_before,source_before,keep_after,source_deleted)
          VALUES ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6)`, [keep.sourceLanguage, keep.targetLanguage,
          JSON.stringify(keepBefore), JSON.stringify(sourceBefore), JSON.stringify(keepAfter), deleteSource]);

        const merged = await tx.query(`SELECT id,term,translation,source_language AS "sourceLanguage",
          target_language AS "targetLanguage",word_type AS "wordType",notes,examples,
          english_verb_forms AS "englishVerbForms",
          COALESCE((SELECT jsonb_agg(collection_id ORDER BY collection_id) FROM collection_words
            WHERE word_id=words.id),'[]'::jsonb) AS "collectionIds"
          FROM words WHERE id=$1`, [keepId]);
        return merged.rows[0];
      });
      res.json(result);
    } catch (error) {
      if (error instanceof MergeFailure) { res.status(error.status).json({ error: error.message }); return; }
      throw error;
    }
  });
  return router;
}
