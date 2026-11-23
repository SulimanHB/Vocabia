import type { Database } from './db.js';
import { reply, type ApiRequest, type ApiRoute } from './http.js';
import { collectionFiltersSchema, collectionSchema, validId } from './validation.js';

function invalidIds({ params }: ApiRequest) {
  if (!validId(params.id)) return reply(400, { error: 'El identificador no es válido.' });
  if (params.wordId !== undefined && !validId(params.wordId)) return reply(400, { error: 'El identificador de la palabra no es válido.' });
  return null;
}

export const collectionRoutes = (db: Database): ApiRoute[] => [
  { method: 'GET', path: '/api/collections', handle: async req => {
    const parsed = collectionFiltersSchema.safeParse(req.query);
    if (!parsed.success) return reply(400, { error: 'Los idiomas no son válidos.' });
    const { sourceLanguage, targetLanguage } = parsed.data;
    const result = await db.query(`SELECT id, name, source_language AS "sourceLanguage", target_language AS "targetLanguage",
      (SELECT count(*)::int FROM collection_words WHERE collection_id=collections.id) AS "wordCount"
      FROM collections WHERE ($1::text IS NULL OR source_language=$1)
      AND ($2::text IS NULL OR target_language=$2)
      ORDER BY lower(name), id`, [sourceLanguage ?? null, targetLanguage ?? null]);
    return reply(200, result.rows);
  } },

  { method: 'POST', path: '/api/collections', handle: async req => {
    const parsed = collectionSchema.safeParse(req.body);
    if (!parsed.success) return reply(400, { error: 'Indica un nombre de hasta 80 caracteres y dos idiomas distintos.' });
    const { name, sourceLanguage, targetLanguage } = parsed.data;
    const result = await db.query(`INSERT INTO collections(name,source_language,target_language)
      VALUES($1,$2,$3) ON CONFLICT DO NOTHING
      RETURNING id, name, source_language AS "sourceLanguage", target_language AS "targetLanguage"`, [name, sourceLanguage, targetLanguage]);
    if (!result.rows.length) return reply(409, { error: 'Ya existe una colección con ese nombre para esta pareja.' });
    return reply(201, { ...result.rows[0], wordCount: 0 });
  } },

  { method: 'DELETE', path: '/api/collections/:id', handle: async req => {
    const invalid = invalidIds(req);
    if (invalid) return invalid;
    const result = await db.query('DELETE FROM collections WHERE id=$1 RETURNING id', [Number(req.params.id)]);
    if (!result.rows.length) return reply(404, { error: 'Esta colección ya no existe.' });
    return reply(204);
  } },

  { method: 'POST', path: '/api/collections/:id/words/:wordId', handle: async req => {
    const invalid = invalidIds(req);
    if (invalid) return invalid;
    const collectionId = Number(req.params.id);
    const wordId = Number(req.params.wordId);
    const check = await db.query<{ collection_exists: boolean; word_exists: boolean; compatible: boolean }>(`SELECT
      EXISTS(SELECT 1 FROM collections WHERE id=$1) AS collection_exists,
      EXISTS(SELECT 1 FROM words WHERE id=$2) AS word_exists,
      EXISTS(SELECT 1 FROM collections c JOIN words w ON c.source_language=w.source_language
        AND c.target_language=w.target_language WHERE c.id=$1 AND w.id=$2) AS compatible`, [collectionId, wordId]);
    const { collection_exists, word_exists, compatible } = check.rows[0];
    if (!collection_exists || !word_exists) return reply(404, { error: 'La colección o la palabra ya no existe.' });
    if (!compatible) return reply(400, { error: 'La palabra y la colección deben tener la misma pareja de idiomas.' });
    await db.query(`INSERT INTO collection_words(collection_id,word_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, [collectionId, wordId]);
    return reply(204);
  } },

  { method: 'DELETE', path: '/api/collections/:id/words/:wordId', handle: async req => {
    const invalid = invalidIds(req);
    if (invalid) return invalid;
    await db.query('DELETE FROM collection_words WHERE collection_id=$1 AND word_id=$2', [Number(req.params.id), Number(req.params.wordId)]);
    return reply(204);
  } },
];
