import { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { initializeDatabase, type Database, type Queryable } from './database.js';

const db = new PGlite();
const app = createApp(db);
beforeAll(async () => { await initializeDatabase(db, false); }, 30000);
afterAll(async () => { await db.close(); });

const base = {
  term: 'dormir', translation: 'sleep', sourceLanguage: 'es', targetLanguage: 'en',
  wordType: 'verb', notes: 'Nota A1', examples: [{ text: 'Duermo.', translation: 'I sleep.' }],
  englishVerbForms: { past: 'slept', pastParticiple: '', ing: '' },
};

it('une contenido y colecciones, conserva la segunda tarjeta hasta que se confirma su eliminación', async () => {
  const a1 = await request(app).post('/api/collections').send({ name: 'A1 fusión', sourceLanguage: 'es', targetLanguage: 'en' }).expect(201);
  const a2 = await request(app).post('/api/collections').send({ name: 'A2 fusión', sourceLanguage: 'es', targetLanguage: 'en' }).expect(201);
  const keep = await request(app).post(`/api/words?collectionId=${a1.body.id}`).send(base).expect(201);
  const sourceWord = { ...base, notes: 'Nota A2', examples: [{ text: 'Quiero dormir.', translation: 'I want to sleep.' }],
    englishVerbForms: { past: '', pastParticiple: 'slept', ing: 'sleeping' } };
  const source = await request(app).post(`/api/words?collectionId=${a2.body.id}`).send(sourceWord).expect(201);
  const mergedWord = { ...base, notes: 'Nota A1\nNota A2', examples: [...base.examples, ...sourceWord.examples],
    englishVerbForms: { past: 'slept', pastParticiple: 'slept', ing: 'sleeping' } };

  const preview = await request(app).post('/api/words/merge').send({ keepId: keep.body.id, sourceId: source.body.id,
    deleteSource: false, word: mergedWord }).expect(200);
  expect(preview.body).toMatchObject({ id: keep.body.id, notes: 'Nota A1\nNota A2', examples: mergedWord.examples,
    englishVerbForms: mergedWord.englishVerbForms, collectionIds: [a1.body.id, a2.body.id] });
  const retained = (await request(app).get('/api/words').expect(200)).body.find((item: { id: number }) => item.id === source.body.id);
  expect(retained).toMatchObject({ notes: 'Nota A2', examples: sourceWord.examples, collectionIds: [a2.body.id] });

  await request(app).post('/api/words/merge').send({ keepId: keep.body.id, sourceId: source.body.id,
    deleteSource: true, word: mergedWord }).expect(200);
  const after = (await request(app).get('/api/words').expect(200)).body;
  expect(after.some((item: { id: number }) => item.id === source.body.id)).toBe(false);
  expect(after.find((item: { id: number }) => item.id === keep.body.id).collectionIds).toEqual([a1.body.id, a2.body.id]);

  const latest = await request(app).get('/api/words/merge/latest?sourceLanguage=es&targetLanguage=en').expect(200);
  expect(latest.body).toMatchObject({ term: 'dormir', translation: 'sleep' });
  await request(app).post(`/api/words/merge/${latest.body.id}/undo`).expect(200);
  const restored = (await request(app).get('/api/words').expect(200)).body;
  expect(restored.find((item: { id: number }) => item.id === source.body.id)).toMatchObject({
    notes: 'Nota A2', examples: sourceWord.examples, collectionIds: [a2.body.id],
  });
  expect(restored.find((item: { id: number }) => item.id === keep.body.id)).toMatchObject({
    notes: mergedWord.notes, collectionIds: [a1.body.id, a2.body.id],
  });
  await request(app).post(`/api/words/merge/${latest.body.id}/undo`).expect(404);
  const previous = await request(app).get('/api/words/merge/latest?sourceLanguage=es&targetLanguage=en').expect(200);
  await request(app).post(`/api/words/merge/${previous.body.id}/undo`).expect(200);
  const original = (await request(app).get('/api/words').expect(200)).body;
  expect(original.find((item: { id: number }) => item.id === keep.body.id)).toMatchObject({
    notes: 'Nota A1', examples: base.examples, collectionIds: [a1.body.id],
  });
});

it('no deshace si la tarjeta se editó después de fusionar', async () => {
  const keep = await request(app).post('/api/words').send({ ...base, term: 'andar', translation: 'walk' }).expect(201);
  const source = await request(app).post('/api/words').send({ ...base, term: 'andar', translation: 'walk' }).expect(201);
  await request(app).post('/api/words/merge').send({ keepId: keep.body.id, sourceId: source.body.id,
    deleteSource: true, word: { ...base, term: 'andar', translation: 'walk', notes: 'Fusionada' } }).expect(200);
  const latest = await request(app).get('/api/words/merge/latest?sourceLanguage=es&targetLanguage=en').expect(200);
  await request(app).put(`/api/words/${keep.body.id}`).send({ ...base, term: 'andar', translation: 'walk', notes: 'Cambio posterior' }).expect(200);
  await request(app).post(`/api/words/merge/${latest.body.id}/undo`).expect(409);
  const after = (await request(app).get('/api/words').expect(200)).body;
  expect(after.find((item: { id: number }) => item.id === keep.body.id).notes).toBe('Cambio posterior');
  expect(after.some((item: { id: number }) => item.id === source.body.id)).toBe(false);
});

it('rechaza tarjetas distintas y revierte la actualización si falla la relación con colecciones', async () => {
  const keep = await request(app).post('/api/words').send({ ...base, term: 'beber' }).expect(201);
  const source = await request(app).post('/api/words').send({ ...base, term: 'beber' }).expect(201);
  const unrelated = await request(app).post('/api/words').send({ ...base, term: 'comer' }).expect(201);
  const selected = { ...base, term: 'beber', notes: 'Contenido nuevo' };
  await request(app).post('/api/words/merge').send({ keepId: keep.body.id, sourceId: keep.body.id, deleteSource: true, word: selected }).expect(400);
  await request(app).post('/api/words/merge').send({ keepId: keep.body.id, sourceId: unrelated.body.id, deleteSource: true, word: selected }).expect(400);
  await request(app).post('/api/words/merge').send({ keepId: keep.body.id, sourceId: source.body.id, deleteSource: true,
    word: { ...selected, examples: [] } }).expect(400);

  const failingDb: Database = {
    query: db.query.bind(db), close: db.close.bind(db),
    transaction: <T>(callback: (tx: Queryable) => Promise<T>) => db.transaction(tx => callback({
      query: async <R extends Record<string, unknown>>(sql: string, params?: unknown[]) => {
        if (sql.includes('INSERT INTO collection_words')) throw new Error('Fallo simulado');
        return tx.query<R>(sql, params);
      },
    })),
  };
  const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await request(createApp(failingDb)).post('/api/words/merge').send({ keepId: keep.body.id, sourceId: source.body.id,
      deleteSource: true, word: selected }).expect(500);
  } finally { errorLog.mockRestore(); }
  const after = (await request(app).get('/api/words').expect(200)).body;
  expect(after.find((item: { id: number }) => item.id === keep.body.id).notes).toBe('Nota A1');
  expect(after.some((item: { id: number }) => item.id === source.body.id)).toBe(true);
});
