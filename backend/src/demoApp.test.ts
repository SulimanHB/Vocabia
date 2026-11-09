import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createDemoApp } from './demoApp.js';

const demo = createDemoApp();
afterAll(async () => { await demo.close(); });

describe('demo pública', () => {
  it('aísla palabras, colecciones y cambios entre dos visitantes', async () => {
    const first = request.agent(demo.app);
    const second = request.agent(demo.app);
    const initial = await first.get('/api/words').query({ sourceLanguage: 'es', targetLanguage: 'en' }).expect(200);
    expect(initial.body).toHaveLength(20);
    expect(initial.body.some((word: { term: string }) => word.term === 'dormir')).toBe(true);
    expect(initial.body.every((word: { examples: unknown[] }) => word.examples.length === 2)).toBe(true);

    await first.post('/api/words').send({
      term: 'prueba aislada', translation: 'isolated test', sourceLanguage: 'es', targetLanguage: 'en',
      wordType: 'expression', notes: '', examples: [{ text: 'Una prueba.', translation: 'A test.' }],
    }).expect(201);
    const firstWords = await first.get('/api/words').query({ sourceLanguage: 'es', targetLanguage: 'en' }).expect(200);
    const secondWords = await second.get('/api/words').query({ sourceLanguage: 'es', targetLanguage: 'en' }).expect(200);
    expect(firstWords.body).toHaveLength(21);
    expect(secondWords.body).toHaveLength(20);
    expect(secondWords.body.some((word: { term: string }) => word.term === 'prueba aislada')).toBe(false);

    const firstCollection = await first.get('/api/collections').query({ sourceLanguage: 'es', targetLanguage: 'en' }).expect(200);
    const secondCollection = await second.get('/api/collections').query({ sourceLanguage: 'es', targetLanguage: 'en' }).expect(200);
    expect(firstCollection.body).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'A1', wordCount: 14 }), expect.objectContaining({ name: 'Viajes', wordCount: 4 })]));
    expect(secondCollection.body).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'A1', wordCount: 14 }), expect.objectContaining({ name: 'Viajes', wordCount: 4 })]));
  }, 30000);

  it('ofrece palabras con ejemplos en cada idioma de estudio', async () => {
    const visitor = request.agent(demo.app);
    const all = await visitor.get('/api/words').expect(200);
    expect(all.body).toHaveLength(40);
    for (const language of ['fr', 'de', 'it', 'pt', 'ja']) {
      const response = await visitor.get('/api/words').query({ sourceLanguage: 'es', targetLanguage: language }).expect(200);
      expect(response.body).toHaveLength(4);
      expect(response.body.every((word: { examples: { text: string; translation: string }[] }) =>
        word.examples.length === 2 && word.examples.every(example => example.text && example.translation))).toBe(true);
    }
  }, 30000);

  it('declara que los datos de la demo son temporales', async () => {
    await request(demo.app).get('/api/demo-info').expect(200, { demo: true, temporary: true });
  });

  it('limita las sesiones simultáneas para proteger la memoria del servidor', async () => {
    const limited = createDemoApp({ maxSessions: 1 });
    try {
      await request.agent(limited.app).get('/api/words').expect(200);
      await request.agent(limited.app).get('/api/words').expect(503);
    } finally { await limited.close(); }
  }, 30000);
});
