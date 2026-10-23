import express, { type ErrorRequestHandler } from 'express';
import type { Database } from './database.js';
import { filtersSchema, wordSchema } from './validation.js';

const columns = `id, term, translation, source_language AS "sourceLanguage", target_language AS "targetLanguage", word_type AS "wordType", notes, examples`;

export function createApp(db: Database) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/words', async (req, res) => {
    const parsed = filtersSchema.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: 'Los filtros no son válidos.' }); return; }
    const { search, language, wordType, sourceLanguage, targetLanguage } = parsed.data;
    // Los valores viajan separados del SQL: no se interpretan como instrucciones.
    const result = await db.query(`SELECT ${columns} FROM words
      WHERE (strpos(lower(term), lower($1)) > 0 OR strpos(lower(translation), lower($1)) > 0)
      AND ($2::text IS NULL OR source_language = $2 OR target_language = $2)
      AND ($3::text IS NULL OR word_type = $3)
      AND ($4::text IS NULL OR source_language = $4)
      AND ($5::text IS NULL OR target_language = $5)
      ORDER BY created_at DESC, id DESC`, [search, language ?? null, wordType ?? null, sourceLanguage ?? null, targetLanguage ?? null]);
    res.json(result.rows);
  });

  app.post('/api/words', async (req, res) => {
    const parsed = wordSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Revisa los campos: palabra, traducción, idiomas distintos y entre 1 y 10 ejemplos.', details: parsed.error.flatten() }); return; }
    const w = parsed.data;
    const result = await db.query(`INSERT INTO words(term,translation,source_language,target_language,word_type,notes,examples)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING ${columns}`,
      [w.term, w.translation, w.sourceLanguage, w.targetLanguage, w.wordType, w.notes, JSON.stringify(w.examples)]);
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
    const result = await db.query(`UPDATE words SET term=$1, translation=$2, source_language=$3,
      target_language=$4, word_type=$5, notes=$6, examples=$7::jsonb WHERE id=$8 RETURNING ${columns}`,
      [w.term, w.translation, w.sourceLanguage, w.targetLanguage, w.wordType, w.notes, JSON.stringify(w.examples), Number(req.params.id)]);
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
