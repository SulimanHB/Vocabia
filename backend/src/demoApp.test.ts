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

  it('solo responde 503 cuando todas las sesiones están atendiendo una petición', async () => {
    const limited = createDemoApp({ maxSessions: 1 });
    try {
      const responses = await Promise.all([request(limited.app).get('/api/words'), request(limited.app).get('/api/words')]);
      expect(responses.map(response => response.status).sort()).toEqual([200, 503]);
    } finally { await limited.close(); }
  }, 30000);

  it('las visitas a la página sin cookie no ocupan sesiones', async () => {
    const limited = createDemoApp({ maxSessions: 1 });
    try {
      for (let i = 0; i < 20; i++) {
        const page = await request(limited.app).get(i % 2 ? '/estudio' : '/');
        expect(page.headers['set-cookie']).toBeUndefined();
      }
      await request(limited.app).get('/api/words').expect(200);
    } finally { await limited.close(); }
  }, 30000);

  it('con las sesiones llenas, una nueva sustituye a la inactiva más antigua', async () => {
    const limited = createDemoApp({ maxSessions: 2 });
    const query = { sourceLanguage: 'es', targetLanguage: 'en' };
    try {
      const oldest = request.agent(limited.app);
      await oldest.post('/api/words').send({
        term: 'efímera', translation: 'ephemeral', sourceLanguage: 'es', targetLanguage: 'en',
        wordType: 'adjective', notes: '', examples: [{ text: 'Una sesión efímera.', translation: 'An ephemeral session.' }],
      }).expect(201);
      const second = request.agent(limited.app);
      await second.get('/api/words').expect(200);
      await request(limited.app).get('/api/words').expect(200);

      const restarted = await oldest.get('/api/words').query(query).expect(200);
      expect(restarted.body).toHaveLength(20);
      expect(restarted.body.some((word: { term: string }) => word.term === 'efímera')).toBe(false);
    } finally { await limited.close(); }
  }, 30000);

  it('limita la importación para no congelar la demo', async () => {
    const visitor = request.agent(demo.app);
    const document = (count: number) => ({
      mode: 'includeMatches',
      document: {
        format: 'vocabia-words', version: 2, exportedAt: new Date().toISOString(), collections: [],
        words: Array.from({ length: count }, (_, i) => ({
          term: `importada ${i}`, translation: `imported ${i}`, sourceLanguage: 'es', targetLanguage: 'en',
          wordType: 'noun', notes: '', examples: [{ text: `Ejemplo ${i}.`, translation: `Example ${i}.` }], collections: [],
        })),
      },
    });
    const tooMany = await visitor.post('/api/import').send(document(201));
    expect([400, 413]).toContain(tooMany.status);
    const tooBig = await visitor.post('/api/import').set('Content-Type', 'application/json').send(JSON.stringify({ padding: 'x'.repeat(250_000) }));
    expect(tooBig.status).toBe(413);
    await visitor.post('/api/import').send(document(20)).expect(201);
  }, 30000);

  it('envía cabeceras de seguridad', async () => {
    const page = await request(demo.app).get('/');
    expect(page.headers['x-content-type-options']).toBe('nosniff');
    expect(page.headers['referrer-policy']).toBe('same-origin');
    expect(page.headers['content-security-policy']).toBe(
      "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; frame-ancestors 'none'");
  });
});
