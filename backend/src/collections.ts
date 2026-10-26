import { Router } from 'express';
import type { Database } from './database.js';
import { collectionFiltersSchema, collectionSchema } from './validation.js';

const validId = (value: string | undefined) => /^[1-9]\d*$/.test(value ?? '') && Number.isSafeInteger(Number(value)) && Number(value) <= 2147483647;

export function createCollectionsRouter(db: Database) {
  const router = Router();

  router.get('/', async (req, res) => {
    const parsed = collectionFiltersSchema.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: 'Los idiomas no son válidos.' }); return; }
    const { sourceLanguage, targetLanguage } = parsed.data;
    const result = await db.query(`SELECT id, name, source_language AS "sourceLanguage", target_language AS "targetLanguage",
      (SELECT count(*)::int FROM collection_words WHERE collection_id=collections.id) AS "wordCount"
      FROM collections WHERE ($1::text IS NULL OR source_language=$1)
      AND ($2::text IS NULL OR target_language=$2)
      ORDER BY lower(name), id`, [sourceLanguage ?? null, targetLanguage ?? null]);
    res.json(result.rows);
  });

  router.post('/', async (req, res) => {
    const parsed = collectionSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Indica un nombre de hasta 80 caracteres y dos idiomas distintos.' }); return; }
    const { name, sourceLanguage, targetLanguage } = parsed.data;
    const result = await db.query(`INSERT INTO collections(name,source_language,target_language)
      VALUES($1,$2,$3) ON CONFLICT DO NOTHING
      RETURNING id, name, source_language AS "sourceLanguage", target_language AS "targetLanguage"`, [name, sourceLanguage, targetLanguage]);
    if (!result.rows.length) { res.status(409).json({ error: 'Ya existe una colección con ese nombre para esta pareja.' }); return; }
    res.status(201).json({ ...result.rows[0], wordCount: 0 });
  });

  router.use('/:id', (req, res, next) => {
    if (!validId(req.params.id)) { res.status(400).json({ error: 'El identificador no es válido.' }); return; }
    next();
  });

  router.delete('/:id', async (req, res) => {
    const result = await db.query('DELETE FROM collections WHERE id=$1 RETURNING id', [Number(req.params.id)]);
    if (!result.rows.length) { res.status(404).json({ error: 'Esta colección ya no existe.' }); return; }
    res.status(204).end();
  });

  router.use('/:id/words/:wordId', (req, res, next) => {
    if (!validId(req.params.wordId)) { res.status(400).json({ error: 'El identificador de la palabra no es válido.' }); return; }
    next();
  });

  router.post('/:id/words/:wordId', async (req, res) => {
    const collectionId = Number(req.params.id);
    const wordId = Number(req.params.wordId);
    const check = await db.query<{ collection_exists: boolean; word_exists: boolean; compatible: boolean }>(`SELECT
      EXISTS(SELECT 1 FROM collections WHERE id=$1) AS collection_exists,
      EXISTS(SELECT 1 FROM words WHERE id=$2) AS word_exists,
      EXISTS(SELECT 1 FROM collections c JOIN words w ON c.source_language=w.source_language
        AND c.target_language=w.target_language WHERE c.id=$1 AND w.id=$2) AS compatible`, [collectionId, wordId]);
    const { collection_exists, word_exists, compatible } = check.rows[0];
    if (!collection_exists || !word_exists) { res.status(404).json({ error: 'La colección o la palabra ya no existe.' }); return; }
    if (!compatible) { res.status(400).json({ error: 'La palabra y la colección deben tener la misma pareja de idiomas.' }); return; }
    await db.query(`INSERT INTO collection_words(collection_id,word_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, [collectionId, wordId]);
    res.status(204).end();
  });

  router.delete('/:id/words/:wordId', async (req, res) => {
    await db.query('DELETE FROM collection_words WHERE collection_id=$1 AND word_id=$2', [Number(req.params.id), Number(req.params.wordId)]);
    res.status(204).end();
  });

  return router;
}
