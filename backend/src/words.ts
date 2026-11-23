import { z } from 'zod';
import type { Database } from './db.js';
import { reply, type ApiRoute } from './http.js';
import { filtersSchema, validId, wordCreationFiltersSchema, wordSchema } from './validation.js';

const columns = `id, term, translation, source_language AS "sourceLanguage", target_language AS "targetLanguage", word_type AS "wordType", notes, examples, english_verb_forms AS "englishVerbForms", study_mark AS "studyMark"`;
const invalidId = reply(400, { error: 'El identificador no es válido.' });

export const wordRoutes = (db: Database): ApiRoute[] => [
  { method: 'GET', path: '/api/words', handle: async req => {
    const parsed = filtersSchema.safeParse(req.query);
    if (!parsed.success) return reply(400, { error: 'Los filtros no son válidos.' });
    const { search, language, wordType, sourceLanguage, targetLanguage, collectionId } = parsed.data;
    // Los valores viajan separados del SQL: no se interpretan como instrucciones.
    const result = await db.query(`SELECT ${columns},
      COALESCE((SELECT jsonb_agg(cw.collection_id ORDER BY cw.collection_id)
        FROM collection_words cw WHERE cw.word_id=words.id), '[]'::jsonb) AS "collectionIds"
      FROM words
      WHERE (strpos(lower(term), lower($1)) > 0 OR strpos(lower(translation), lower($1)) > 0)
      AND ($2::text IS NULL OR source_language = $2 OR target_language = $2)
      AND ($3::text IS NULL OR word_type = $3)
      AND ($4::text IS NULL OR source_language = $4)
      AND ($5::text IS NULL OR target_language = $5)
      AND ($6::integer IS NULL OR EXISTS(SELECT 1 FROM collection_words cw
        WHERE cw.word_id=words.id AND cw.collection_id=$6))
      ORDER BY created_at DESC, id DESC`, [search, language ?? null, wordType ?? null, sourceLanguage ?? null, targetLanguage ?? null, collectionId ?? null]);
    return reply(200, result.rows);
  } },

  { method: 'POST', path: '/api/words', handle: async req => {
    const creationFilters = wordCreationFiltersSchema.safeParse(req.query);
    if (!creationFilters.success) return reply(400, { error: 'La colección indicada no es válida.' });
    const parsed = wordSchema.safeParse(req.body);
    if (!parsed.success) return reply(400, { error: 'Revisa los campos: palabra, traducción, idiomas distintos y entre 1 y 10 ejemplos.', details: parsed.error.flatten() });
    const w = parsed.data;
    // Las dos inserciones forman una sola instrucción: una colección inválida no deja una palabra huérfana.
    const result = await db.query(`WITH inserted AS (
      INSERT INTO words(term,translation,source_language,target_language,word_type,notes,examples,english_verb_forms)
      SELECT $1::text,$2::text,$3::text,$4::text,$5::text,$6::text,$7::jsonb,$8::jsonb
      WHERE $9::integer IS NULL OR EXISTS (
        SELECT 1 FROM collections WHERE id=$9 AND source_language=$3::text AND target_language=$4::text
      ) RETURNING ${columns}
    ), linked AS (
      INSERT INTO collection_words(collection_id,word_id)
      SELECT $9::integer, id FROM inserted WHERE $9::integer IS NOT NULL
      RETURNING collection_id
    ) SELECT * FROM inserted`,
      [w.term, w.translation, w.sourceLanguage, w.targetLanguage, w.wordType, w.notes, JSON.stringify(w.examples), JSON.stringify(w.englishVerbForms ?? {}), creationFilters.data.collectionId ?? null]);
    if (!result.rows.length) return reply(400, { error: 'La colección no existe o pertenece a otra pareja de idiomas.' });
    return reply(201, result.rows[0]);
  } },

  { method: 'PUT', path: '/api/words/:id/study-mark', handle: async req => {
    if (!validId(req.params.id)) return invalidId;
    const parsed = z.object({ mark: z.enum(['known', 'difficult']) }).strict().safeParse(req.body);
    if (!parsed.success) return reply(400, { error: 'La marca de estudio no es válida.' });
    const result = await db.query<{ id: number; studyMark: 'known' | 'difficult' }>(
      'UPDATE words SET study_mark=$1 WHERE id=$2 RETURNING id,study_mark AS "studyMark"',
      [parsed.data.mark, Number(req.params.id)]);
    if (!result.rows.length) return reply(404, { error: 'Esta palabra ya no existe.' });
    return reply(200, result.rows[0]);
  } },

  { method: 'PUT', path: '/api/words/:id', handle: async req => {
    if (!validId(req.params.id)) return invalidId;
    const parsed = wordSchema.safeParse(req.body);
    if (!parsed.success) return reply(400, { error: 'Revisa los campos: palabra, traducción, idiomas distintos y entre 1 y 10 ejemplos.' });
    const w = parsed.data;
    const result = await db.query(`WITH updated AS (
      UPDATE words SET term=$1, translation=$2, source_language=$3,
        target_language=$4::text, word_type=$5::text, notes=$6, examples=$7::jsonb,
        english_verb_forms=CASE WHEN $4::text='en' AND $5::text='verb'
          THEN COALESCE($8::jsonb, english_verb_forms) ELSE '{}'::jsonb END
        WHERE id=$9 RETURNING ${columns}
      ), detached AS (
        DELETE FROM collection_words cw USING collections c, updated u
        WHERE cw.collection_id=c.id AND cw.word_id=u.id
          AND (c.source_language<>u."sourceLanguage" OR c.target_language<>u."targetLanguage")
        RETURNING cw.collection_id
      ) SELECT * FROM updated`,
      [w.term, w.translation, w.sourceLanguage, w.targetLanguage, w.wordType, w.notes, JSON.stringify(w.examples), w.englishVerbForms ? JSON.stringify(w.englishVerbForms) : null, Number(req.params.id)]);
    if (!result.rows.length) return reply(404, { error: 'Esta palabra ya no existe.' });
    return reply(200, result.rows[0]);
  } },

  { method: 'DELETE', path: '/api/words/:id', handle: async req => {
    if (!validId(req.params.id)) return invalidId;
    const result = await db.query('DELETE FROM words WHERE id=$1 RETURNING id', [Number(req.params.id)]);
    if (!result.rows.length) return reply(404, { error: 'Esta palabra ya no existe.' });
    return reply(204);
  } },
];
