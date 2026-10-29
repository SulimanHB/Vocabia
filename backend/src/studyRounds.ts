import { Router } from 'express';
import { z } from 'zod';
import type { Database } from './database.js';
import { languages } from './validation.js';

const pair = z.object({
  sourceLanguage: z.enum(languages),
  targetLanguage: z.enum(languages),
}).strict().refine(value => value.sourceLanguage !== value.targetLanguage);

const round = pair.safeExtend({
  questionCount: z.number().int().min(1).max(100000),
  writtenCount: z.number().int().min(0).max(100000),
  matchedCount: z.number().int().min(0).max(100000),
}).refine(value => value.matchedCount <= value.writtenCount && value.writtenCount <= value.questionCount);

const columns = `id, source_language AS "sourceLanguage", target_language AS "targetLanguage",
  question_count AS "questionCount", written_count AS "writtenCount", matched_count AS "matchedCount",
  completed_at AS "completedAt"`;

export function createStudyRoundsRouter(db: Database) {
  const router = Router();
  router.get('/', async (req, res) => {
    const parsed = pair.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: 'Indica dos idiomas distintos y válidos.' }); return; }
    const { sourceLanguage, targetLanguage } = parsed.data;
    const result = await db.query(`SELECT ${columns} FROM study_rounds
      WHERE source_language=$1 AND target_language=$2 ORDER BY completed_at DESC, id DESC LIMIT 5`,
      [sourceLanguage, targetLanguage]);
    res.json(result.rows);
  });

  router.post('/', async (req, res) => {
    const parsed = round.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'El resumen de estudio no es válido.' }); return; }
    const value = parsed.data;
    const result = await db.query(`INSERT INTO study_rounds
      (source_language,target_language,question_count,written_count,matched_count)
      VALUES ($1,$2,$3,$4,$5) RETURNING ${columns}`,
      [value.sourceLanguage, value.targetLanguage, value.questionCount, value.writtenCount, value.matchedCount]);
    res.status(201).json(result.rows[0]);
  });
  return router;
}
