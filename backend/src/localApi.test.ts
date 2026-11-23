import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeDatabase } from './database.js';
import { seedDemo } from './demoSeed.js';
import { createLocalApi } from './localApi.js';

// La demo estática usa esta API en el navegador: mismos límites que la demo pública.
const db = new PGlite();
const api = createLocalApi(db, { importBytes: 200 * 1024, importWords: 200 });
beforeAll(async () => { await initializeDatabase(db, false); await seedDemo(db); }, 30000);
afterAll(async () => { await db.close(); });

type Word = { term: string; examples: { text: string; translation: string }[] };
const word = { term: 'efímera', translation: 'ephemeral', sourceLanguage: 'es', targetLanguage: 'en',
  wordType: 'adjective', notes: '', examples: [{ text: 'Una sesión efímera.', translation: 'An ephemeral session.' }] };

describe('API local de la demo', () => {
  it('carga 60 palabras con dos ejemplos traducidos, también en cada idioma de estudio', async () => {
    const all = await api('GET', '/api/words');
    expect(all.status).toBe(200);
    expect(all.body).toHaveLength(60);
    for (const language of ['fr', 'de', 'it', 'pt', 'ja']) {
      const pair = (await api('GET', `/api/words?sourceLanguage=es&targetLanguage=${language}`)).body as Word[];
      expect(pair).toHaveLength(4);
      expect(pair.every(item => item.examples.length === 2 && item.examples.every(example => example.text && example.translation))).toBe(true);
    }
  });

  it('ofrece la pareja inversa inglés → español con sus colecciones', async () => {
    const words = (await api('GET', '/api/words?sourceLanguage=en&targetLanguage=es')).body as Word[];
    expect(words).toHaveLength(20);
    expect(words.find(item => item.term === 'sleep')).toMatchObject({ translation: 'dormir', englishVerbForms: {},
      examples: [{ text: 'I need to sleep.', translation: 'Necesito dormir.' }, { text: 'The baby sleeps.', translation: 'El bebé duerme.' }] });
    const collections = (await api('GET', '/api/collections?sourceLanguage=en&targetLanguage=es')).body as { name: string; wordCount: number }[];
    expect(collections.map(c => `${c.name} ${c.wordCount}`).sort()).toEqual(['A1 14', 'A2 6', 'Viajes 4']);
  });

  it('crea, valida y borra con las mismas respuestas que la API del servidor', async () => {
    const created = await api('POST', '/api/words', JSON.stringify(word));
    expect(created.status).toBe(201);
    const id = (created.body as { id: number }).id;
    expect((await api('POST', '/api/words', JSON.stringify({ ...word, examples: [] }))).status).toBe(400);
    expect((await api('PUT', '/api/words/0x10', JSON.stringify(word))).status).toBe(400);
    expect((await api('DELETE', `/api/words/${id}`)).status).toBe(204);
    expect((await api('DELETE', `/api/words/${id}`)).status).toBe(404);
  });

  it('responde 404 a rutas desconocidas y 400 a JSON roto', async () => {
    expect(await api('GET', '/api/no-existe')).toEqual({ status: 404, body: { error: 'Ruta no encontrada.' } });
    expect((await api('POST', '/api/words', '{roto')).status).toBe(400);
  });

  it('limita la importación para no congelar el navegador', async () => {
    const document = (count: number, notes = '') => JSON.stringify({ mode: 'includeMatches', document: {
      format: 'vocabia-words', version: 2, exportedAt: new Date().toISOString(), collections: [],
      words: Array.from({ length: count }, (_, i) => ({ ...word, term: `importada ${i}`, notes, collections: [] })),
    } });
    expect((await api('POST', '/api/import', document(201))).status).toBe(413);
    expect((await api('POST', '/api/import', document(150, 'x'.repeat(1500)))).status).toBe(413);
    expect((await api('POST', '/api/import', document(20))).status).toBe(201);
  });
});
