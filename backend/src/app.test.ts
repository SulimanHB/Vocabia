import { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { initializeDatabase } from './database.js';

const db = new PGlite();
const app = createApp(db);
const word = { term: 'book', translation: 'libro', sourceLanguage: 'en', targetLanguage: 'es', wordType: 'noun', notes: 'También puede ser un verbo.', examples: ['I read a book.', 'This book is new.'] };
beforeAll(async () => { await initializeDatabase(db, false); }, 30000);
afterAll(async () => { await db.close(); });

describe('API y SQL del diccionario', () => {
  it('devuelve solo la pareja exacta en su dirección y combina búsqueda y tipo', async () => {
    const fixtures = [
      { ...word, term: 'libro', translation: 'book', sourceLanguage: 'es', targetLanguage: 'en' },
      { ...word, term: 'book', translation: 'libro', sourceLanguage: 'en', targetLanguage: 'es' },
      { ...word, term: 'Buch', translation: 'book', sourceLanguage: 'de', targetLanguage: 'en' },
      { ...word, term: 'libro', translation: 'Buch', sourceLanguage: 'es', targetLanguage: 'de' },
    ];
    const ids: number[] = [];
    try {
      for (const input of fixtures) ids.push((await request(app).post('/api/words').send(input).expect(201)).body.id);
      const selected = await request(app).get('/api/words').query({ sourceLanguage: 'es', targetLanguage: 'en' }).expect(200);
      expect(selected.body.map((entry: { id: number }) => entry.id)).toEqual([ids[0]]);
      expect((await request(app).get('/api/words').query({ sourceLanguage: 'es', targetLanguage: 'en', search: 'BOOK', wordType: 'noun' })).body).toHaveLength(1);
      expect((await request(app).get('/api/words').query({ sourceLanguage: 'es', targetLanguage: 'en', wordType: 'verb' })).body).toHaveLength(0);
      const reversed = await request(app).get('/api/words').query({ sourceLanguage: 'en', targetLanguage: 'es' }).expect(200);
      expect(reversed.body.map((entry: { id: number }) => entry.id)).toEqual([ids[1]]);
      expect((await request(app).get('/api/words').query({ sourceLanguage: 'es', targetLanguage: 'ja' })).body).toEqual([]);
    } finally {
      for (const id of ids) await request(app).delete(`/api/words/${id}`).expect(204);
    }
  });

  it('rechaza parejas incompletas, repetidas o con códigos inválidos', async () => {
    for (const query of [
      { sourceLanguage: 'es' }, { targetLanguage: 'en' },
      { sourceLanguage: 'es', targetLanguage: 'es' },
      { sourceLanguage: 'xx', targetLanguage: 'en' },
      { sourceLanguage: 'es', targetLanguage: 'xx' },
    ]) await request(app).get('/api/words').query(query).expect(400);
  });

  it('crea, lista, busca, filtra, edita y borra una palabra', async () => {
    const created = await request(app).post('/api/words').send(word).expect(201);
    const id = created.body.id;
    expect(created.body.examples).toHaveLength(2);
    expect((await request(app).get('/api/words?search=LIBRO&language=en&wordType=noun')).body).toHaveLength(1);
    expect((await request(app).get('/api/words?language=es')).body).toHaveLength(1);
    expect((await request(app).get('/api/words?language=fr')).body).toHaveLength(0);
    expect((await request(app).get('/api/words?wordType=verb')).body).toHaveLength(0);
    const updated = await request(app).put(`/api/words/${id}`).send({ ...word, term: 'notebook', examples: ['My notebook.'] }).expect(200);
    expect(updated.body.term).toBe('notebook');
    expect(updated.body.examples).toEqual(['My notebook.']);
    await request(app).delete(`/api/words/${id}`).expect(204);
    await request(app).delete(`/api/words/${id}`).expect(404);
    expect((await request(app).get('/api/words')).body).toEqual([]);
  });

  it.each([
    { ...word, term: '  ' }, { ...word, examples: [] }, { ...word, examples: [' '] },
    { ...word, targetLanguage: 'en' }, { ...word, sourceLanguage: 'xx' },
    { ...word, wordType: 'invalid' }, { ...word, notes: 'a'.repeat(2001) },
    { ...word, examples: Array(11).fill('A book.') },
  ])('rechaza datos inválidos %#', async input => {
    await request(app).post('/api/words').send(input).expect(400);
    await request(app).put('/api/words/1').send(input).expect(400);
  });

  it('maneja identificadores inválidos, filtros, JSON incorrecto y registros inexistentes', async () => {
    await request(app).delete('/api/words/no-es-un-id').expect(400);
    await request(app).delete('/api/words/2147483648').expect(400);
    await request(app).get('/api/words?language=xx').expect(400);
    await request(app).put('/api/words/99999').send(word).expect(404);
    await request(app).post('/api/words').set('Content-Type', 'application/json').send('{').expect(400);
    await request(app).get('/api/missing').expect(404);
  });

  it('trata los caracteres SQL como texto y no elimina la tabla', async () => {
    const created = await request(app).post('/api/words').send({ ...word, term: "'; DROP TABLE words; --" }).expect(201);
    const found = await request(app).get('/api/words').query({ search: "'; DROP TABLE" }).expect(200);
    expect(found.body[0].term).toBe("'; DROP TABLE words; --");
    await request(app).delete(`/api/words/${created.body.id}`).expect(204);
  });

  it('carga demostración una vez y no la repone tras borrar la colección', async () => {
    await initializeDatabase(db);
    expect((await request(app).get('/api/words')).body).toHaveLength(6);
    await initializeDatabase(db);
    expect((await request(app).get('/api/words')).body).toHaveLength(6);
    await db.query('DELETE FROM words');
    await initializeDatabase(db);
    expect((await request(app).get('/api/words')).body).toHaveLength(0);
  });
});
