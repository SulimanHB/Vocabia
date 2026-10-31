import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import request from 'supertest';
import { createApp } from './backend/dist/app.js';
import { initializeDatabase, openDatabase } from './backend/dist/database.js';

const run = promisify(execFile);
const name = `vocabia-smoke-${process.pid}`;
const password = randomBytes(24).toString('base64url');
let started = false;
let db;

try {
  try {
    await run('docker', ['run', '-d', '--rm', '--name', name,
      '-e', 'POSTGRES_USER=vocabia_test', '-e', `POSTGRES_PASSWORD=${password}`,
      '-e', 'POSTGRES_DB=vocabia_test', '-p', '127.0.0.1::5432', 'postgres:15-alpine']);
  } catch {
    throw new Error('No se pudo iniciar el PostgreSQL temporal. Comprueba que Docker está disponible y en ejecución.');
  }
  started = true;
  const { stdout } = await run('docker', ['port', name, '5432/tcp']);
  const port = Number(stdout.trim().match(/127\.0\.0\.1:(\d+)/)?.[1]);
  assert.ok(port > 0, 'Docker no publicó un puerto local');
  process.env.DATABASE_URL = `postgresql://vocabia_test:${password}@127.0.0.1:${port}/vocabia_test`;
  db = openDatabase();
  for (let attempt = 0; ; attempt++) {
    try { await db.query('SELECT 1'); break; }
    catch (error) {
      if (attempt >= 29) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  await initializeDatabase(db, false);
  await initializeDatabase(db, false);
  const migrations = await db.query('SELECT name FROM app_migrations ORDER BY name');
  assert.deepEqual(migrations.rows.map(row => row.name), [
    '002_example_translations', '003_english_verb_forms', '004_collections',
    '005_study_rounds', '006_merge_history', '007_word_study_mark',
  ]);
  console.log('OK: conexión, migraciones iniciales y segundo arranque');

  const app = createApp(db);
  const a1 = (await request(app).post('/api/collections').send({ name: 'A1', sourceLanguage: 'es', targetLanguage: 'en' }).expect(201)).body;
  const a2 = (await request(app).post('/api/collections').send({ name: 'A2', sourceLanguage: 'es', targetLanguage: 'en' }).expect(201)).body;
  const base = { term: 'dormir', translation: 'sleep', sourceLanguage: 'es', targetLanguage: 'en',
    wordType: 'verb', notes: 'Nota A1', examples: [{ text: 'Duermo.', translation: 'I sleep.' }],
    englishVerbForms: { past: 'slept', pastParticiple: '', ing: '' } };
  const keep = (await request(app).post(`/api/words?collectionId=${a1.id}`).send(base).expect(201)).body;
  const source = (await request(app).post(`/api/words?collectionId=${a2.id}`).send({ ...base, notes: 'Nota A2',
    examples: [{ text: 'Quiero dormir.', translation: 'I want to sleep.' }],
    englishVerbForms: { past: '', pastParticiple: 'slept', ing: 'sleeping' } }).expect(201)).body;
  await request(app).put(`/api/words/${keep.id}/study-mark`).send({ mark: 'known' }).expect(200);
  await request(app).put(`/api/words/${source.id}/study-mark`).send({ mark: 'difficult' }).expect(200);
  const merged = { ...base, notes: 'Nota A1\nNota A2', examples: [base.examples[0], { text: 'Quiero dormir.', translation: 'I want to sleep.' }],
    englishVerbForms: { past: 'slept', pastParticiple: 'slept', ing: 'sleeping' } };
  await request(app).post('/api/words/merge').send({ keepId: keep.id, sourceId: source.id, deleteSource: true, word: merged }).expect(200);
  const afterMerge = (await request(app).get('/api/words?sourceLanguage=es&targetLanguage=en').expect(200)).body;
  assert.equal(afterMerge.length, 1);
  assert.deepEqual(afterMerge[0].collectionIds, [a1.id, a2.id]);
  assert.deepEqual(afterMerge[0].examples, merged.examples);
  const latest = (await request(app).get('/api/words/merge/latest?sourceLanguage=es&targetLanguage=en').expect(200)).body;
  await request(app).post(`/api/words/merge/${latest.id}/undo`).expect(200);
  const restored = (await request(app).get('/api/words').expect(200)).body;
  assert.equal(restored.length, 2);
  assert.equal(restored.find(word => word.id === source.id).studyMark, 'difficult');
  assert.equal(restored.find(word => word.id === keep.id).studyMark, 'known');
  console.log('OK: colecciones, palabras, marcas de estudio, fusión y deshacer');

  await request(app).post('/api/study-rounds').send({ sourceLanguage: 'es', targetLanguage: 'en', questionCount: 2, writtenCount: 1, matchedCount: 1 }).expect(201);
  assert.equal((await request(app).get('/api/study-rounds?sourceLanguage=es&targetLanguage=en').expect(200)).body.length, 1);
  await db.close();
  db = undefined;
  db = openDatabase();
  assert.equal((await db.query('SELECT count(*)::integer AS count FROM words')).rows[0].count, 2);
  console.log('OK: ronda de estudio y persistencia tras reconectar');
} finally {
  if (db) await db.close();
  if (started) await run('docker', ['stop', name]);
  delete process.env.DATABASE_URL;
}
