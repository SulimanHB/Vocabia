import express, { type ErrorRequestHandler } from 'express';
import type { Database } from './database.js';
import { filtersSchema, wordCreationFiltersSchema, wordSchema } from './validation.js';
import { createCollectionsRouter } from './collections.js';
import { createImportRouter } from './importWords.js';
import { createStudyRoundsRouter } from './studyRounds.js';
import { createMergeRouter } from './mergeWords.js';

const columns = `id, term, translation, source_language AS "sourceLanguage", target_language AS "targetLanguage", word_type AS "wordType", notes, examples, english_verb_forms AS "englishVerbForms"`;

export function createApp(db: Database) {
  const app = express();
  app.disable('x-powered-by');
  app.use('/api/import', express.json({ limit: '3mb' }), createImportRouter(db));
  app.use(express.json({ limit: '32kb' }));
  app.use('/api/collections', createCollectionsRouter(db));
  app.use('/api/study-rounds', createStudyRoundsRouter(db));
  app.use('/api/words/merge', createMergeRouter(db));

  app.get('/api/words', async (req, res) => {
    const parsed = filtersSchema.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: 'Los filtros no son válidos.' }); return; }
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
    res.json(result.rows);
  });

  app.post('/api/words', async (req, res) => {
    const creationFilters = wordCreationFiltersSchema.safeParse(req.query);
    if (!creationFilters.success) { res.status(400).json({ error: 'La colección indicada no es válida.' }); return; }
    const parsed = wordSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Revisa los campos: palabra, traducción, idiomas distintos y entre 1 y 10 ejemplos.', details: parsed.error.flatten() }); return; }
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
    if (!result.rows.length) { res.status(400).json({ error: 'La colección no existe o pertenece a otra pareja de idiomas.' }); return; }
    res.status(201).json(result.rows[0]);
  });

  app.use('/api/words/:id', (req, res, next) => {
    if (!/^[1-9]\d*$/.test(req.params.id ?? '') || !Number.isSafeInteger(Number(req.params.id)) || Number(req.params.id) > 2147483647) {
      res.status(400).json({ error: 'El identificador no es válido.' }); return;
    }
    next();
  });

  app.put('/api/words/:id', async (req, res) => {
    const parsed = wordSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Revisa los campos: palabra, traducción, idiomas distintos y entre 1 y 10 ejemplos.' }); return; }
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
    if (!result.rows.length) { res.status(404).json({ error: 'Esta palabra ya no existe.' }); return; }
    res.json(result.rows[0]);
  });

  app.delete('/api/words/:id', async (req, res) => {
    const result = await db.query('DELETE FROM words WHERE id=$1 RETURNING id', [Number(req.params.id)]);
    if (!result.rows.length) { res.status(404).json({ error: 'Esta palabra ya no existe.' }); return; }
    res.status(204).end();
  });

  app.use((_req, res) => { res.status(404).json({ error: 'Ruta no encontrada.' }); });
  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') { res.status(400).json({ error: 'El JSON enviado no es válido.' }); return; }
    if (error.type === 'entity.too.large') { res.status(413).json({ error: 'La petición es demasiado grande.' }); return; }
    console.error('Error en la API:', error.message);
    res.status(500).json({ error: 'No se pudo completar la operación. Inténtalo de nuevo.' });
  };
  app.use(handleError);
  return app;
}
