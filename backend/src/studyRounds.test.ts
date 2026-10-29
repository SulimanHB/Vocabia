import { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createApp } from './app.js';
import { initializeDatabase } from './database.js';

const db = new PGlite();
const app = createApp(db);
beforeAll(async () => { await initializeDatabase(db, false); }, 30000);
afterAll(async () => { await db.close(); });

it('guarda solo resúmenes válidos y consulta las cinco rondas recientes de una pareja', async () => {
  const base = { sourceLanguage: 'es', targetLanguage: 'en', questionCount: 3, writtenCount: 2, matchedCount: 1 };
  for (const change of [
    { writtenCount: 4 }, { matchedCount: 3 }, { questionCount: 0 },
    { sourceLanguage: 'en', targetLanguage: 'en' }, { writtenCount: '2' },
  ]) await request(app).post('/api/study-rounds').send({ ...base, ...change }).expect(400);
  await request(app).get('/api/study-rounds').query({ sourceLanguage: 'es' }).expect(400);

  const ids: number[] = [];
  for (let i = 0; i < 6; i++) {
    const response = await request(app).post('/api/study-rounds').send({ ...base, matchedCount: i % 3 }).expect(201);
    expect(response.body).toMatchObject({ ...base, matchedCount: i % 3 });
    expect(response.body.completedAt).toEqual(expect.any(String));
    ids.push(response.body.id);
  }
  await request(app).post('/api/study-rounds').send({ ...base, targetLanguage: 'fr' }).expect(201);
  const recent = await request(app).get('/api/study-rounds').query({ sourceLanguage: 'es', targetLanguage: 'en' }).expect(200);
  expect(recent.body.map((round: { id: number }) => round.id)).toEqual(ids.slice(1).reverse());
  expect((await request(app).get('/api/study-rounds').query({ sourceLanguage: 'es', targetLanguage: 'fr' }).expect(200)).body).toHaveLength(1);
  await initializeDatabase(db, false);
  expect((await request(app).get('/api/study-rounds').query({ sourceLanguage: 'es', targetLanguage: 'en' }).expect(200)).body).toHaveLength(5);
});
