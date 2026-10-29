import { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { initializeDatabase, type Database, type Queryable } from './database.js';

const db = new PGlite();
const app = createApp(db);
const word = { term: 'book', translation: 'libro', sourceLanguage: 'en', targetLanguage: 'es', wordType: 'noun', notes: 'También puede ser un verbo.', examples: ['I read a book.', 'This book is new.'] };
beforeAll(async () => { await initializeDatabase(db, false); }, 30000);
afterAll(async () => { await db.close(); });

describe('API y SQL del diccionario', () => {
  it('importa una palabra coincidente en A2 sin alterar la tarjeta de A1', async () => {
    const a1 = await request(app).post('/api/collections').send({ name: 'A1 coincidencias', sourceLanguage: 'es', targetLanguage: 'en' }).expect(201);
    const original = await request(app).post(`/api/words?collectionId=${a1.body.id}`).send({
      ...word, term: 'dormir coincidencias', translation: 'sleep', sourceLanguage: 'es', targetLanguage: 'en',
      notes: 'Nota A1', examples: [{ text: 'Duermo.', translation: 'I sleep.' }],
    }).expect(201);
    const document = {
      format: 'vocabia-words', version: 2, exportedAt: '2026-10-29T10:00:00.000Z',
      collections: [{ name: 'A2 coincidencias', sourceLanguage: 'es', targetLanguage: 'en' }],
      words: [{ ...word, term: 'dormir coincidencias', translation: 'sleep', sourceLanguage: 'es', targetLanguage: 'en',
        notes: 'Nota A2', examples: [{ text: 'Quiero dormir.', translation: 'I want to sleep.' }],
        englishVerbForms: {}, collections: ['A2 coincidencias'] }],
    };
    try {
      const imported = await request(app).post('/api/import').send({ mode: 'includeMatches', document }).expect(201);
      expect(imported.body).toMatchObject({ createdCollections: 1, createdWords: 1, skippedWords: 0 });
      const entries = (await request(app).get('/api/words').query({ sourceLanguage: 'es', targetLanguage: 'en' }).expect(200)).body
        .filter((entry: { term: string }) => entry.term === 'dormir coincidencias');
      expect(entries).toHaveLength(2);
      expect(entries.find((entry: { id: number }) => entry.id === original.body.id)).toMatchObject({ notes: 'Nota A1', collectionIds: [a1.body.id] });
      expect(entries.find((entry: { id: number }) => entry.id !== original.body.id)).toMatchObject({ notes: 'Nota A2', examples: [{ text: 'Quiero dormir.', translation: 'I want to sleep.' }] });
      const a2 = (await request(app).get('/api/collections').query({ sourceLanguage: 'es', targetLanguage: 'en' }).expect(200)).body
        .find((group: { name: string }) => group.name === 'A2 coincidencias');
      expect(entries.find((entry: { id: number }) => entry.id !== original.body.id).collectionIds).toEqual([a2.id]);
    } finally {
      const entries = (await request(app).get('/api/words').expect(200)).body.filter((entry: { term: string }) => entry.term === 'dormir coincidencias');
      for (const entry of entries) await request(app).delete(`/api/words/${entry.id}`).expect(204);
      const groups = (await request(app).get('/api/collections').expect(200)).body.filter((group: { name: string }) => group.name.endsWith(' coincidencias'));
      for (const group of groups) await request(app).delete(`/api/collections/${group.id}`).expect(204);
    }
  });

  it('importa con omisión de coincidencias, reutiliza colecciones y no sobrescribe palabras', async () => {
    const existingCollection = await request(app).post('/api/collections').send({ name: 'A1 importación', sourceLanguage: 'es', targetLanguage: 'en' }).expect(201);
    const existingWord = await request(app).post('/api/words').send({ ...word, term: 'importar dormir', translation: 'sleep', sourceLanguage: 'es', targetLanguage: 'en', notes: 'Nota original.' }).expect(201);
    const document = {
      format: 'vocabia-words', version: 2, exportedAt: '2026-10-28T10:00:00.000Z',
      collections: [
        { name: 'A1 importación', sourceLanguage: 'es', targetLanguage: 'en' },
        { name: 'Importantes importación', sourceLanguage: 'es', targetLanguage: 'en' },
      ],
      words: [
        { ...word, term: 'importar dormir', translation: 'sleep', sourceLanguage: 'es', targetLanguage: 'en', notes: 'Nota del archivo.', examples: [{ text: 'Duermo.', translation: 'I sleep.' }], englishVerbForms: {}, collections: ['A1 importación'] },
        { ...word, term: 'importar beber', translation: 'drink', sourceLanguage: 'es', targetLanguage: 'en', notes: '', examples: [{ text: 'Bebo agua.', translation: 'I drink water.' }], englishVerbForms: {}, collections: ['A1 importación', 'Importantes importación'] },
      ],
    };
    try {
      const first = await request(app).post('/api/import').send({ mode: 'skipMatches', document }).expect(201);
      expect(first.body).toEqual({ createdCollections: 1, reusedCollections: 1, createdWords: 1, skippedWords: 1 });
      const second = await request(app).post('/api/import').send({ mode: 'skipMatches', document }).expect(201);
      expect(second.body).toEqual({ createdCollections: 0, reusedCollections: 2, createdWords: 0, skippedWords: 2 });
      const afterSkip = (await request(app).get('/api/words').expect(200)).body;
      expect(afterSkip.find((entry: { id: number }) => entry.id === existingWord.body.id).notes).toBe('Nota original.');
      expect(afterSkip.filter((entry: { term: string }) => entry.term === 'importar beber')).toHaveLength(1);
      const included = await request(app).post('/api/import').send({ mode: 'includeMatches', document }).expect(201);
      expect(included.body).toEqual({ createdCollections: 0, reusedCollections: 2, createdWords: 2, skippedWords: 0 });
      const afterInclude = (await request(app).get('/api/words').expect(200)).body;
      expect(afterInclude.filter((entry: { term: string }) => entry.term === 'importar dormir')).toHaveLength(2);
      expect(afterInclude.filter((entry: { term: string }) => entry.term === 'importar beber')).toHaveLength(2);
      const groups = (await request(app).get('/api/collections').query({ sourceLanguage: 'es', targetLanguage: 'en' }).expect(200)).body;
      expect(groups.find((group: { name: string }) => group.name === 'Importantes importación').wordCount).toBe(2);
    } finally {
      const entries = (await request(app).get('/api/words').expect(200)).body.filter((entry: { term: string }) => entry.term.startsWith('importar '));
      for (const entry of entries) await request(app).delete(`/api/words/${entry.id}`).expect(204);
      const groups = (await request(app).get('/api/collections').expect(200)).body.filter((group: { name: string }) => group.name.endsWith(' importación'));
      for (const group of groups) await request(app).delete(`/api/collections/${group.id}`).expect(204);
    }
  });

  it('rechaza un archivo con relaciones inválidas sin crear ninguna colección', async () => {
    const document = {
      format: 'vocabia-words', version: 2, exportedAt: '2026-10-28T10:00:00.000Z',
      collections: [{ name: 'No guardar importación', sourceLanguage: 'es', targetLanguage: 'en' }],
      words: [{ ...word, term: 'no guardar importación', sourceLanguage: 'es', targetLanguage: 'en', englishVerbForms: {}, collections: ['Otra colección'] }],
    };
    await request(app).post('/api/import').send({ mode: 'skipMatches', document }).expect(400);
    expect((await request(app).get('/api/collections').expect(200)).body.some((group: { name: string }) => group.name === 'No guardar importación')).toBe(false);
    expect((await request(app).get('/api/words').expect(200)).body.some((entry: { term: string }) => entry.term === 'no guardar importación')).toBe(false);
  });

  it('revierte las colecciones si falla el guardado de una palabra a mitad de la importación', async () => {
    const failingDb: Database = {
      query: db.query.bind(db),
      close: db.close.bind(db),
      transaction: <T>(callback: (tx: Queryable) => Promise<T>) => db.transaction(tx => callback({
        query: async <R extends Record<string, unknown>>(sql: string, params?: unknown[]) => {
          if (sql.includes('INSERT INTO words')) throw new Error('Fallo simulado');
          return tx.query<R>(sql, params);
        },
      })),
    };
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const document = {
      format: 'vocabia-words', version: 2, exportedAt: '2026-10-28T10:00:00.000Z',
      collections: [{ name: 'Fallo importación', sourceLanguage: 'es', targetLanguage: 'en' }],
      words: [{ ...word, term: 'fallo importación', sourceLanguage: 'es', targetLanguage: 'en', englishVerbForms: {}, collections: ['Fallo importación'] }],
    };
    try {
      await request(createApp(failingDb)).post('/api/import').send({ mode: 'includeMatches', document }).expect(500);
      expect((await db.query("SELECT id FROM collections WHERE name='Fallo importación'")).rows).toEqual([]);
      expect((await db.query("SELECT id FROM words WHERE term='fallo importación'")).rows).toEqual([]);
    } finally { errorLog.mockRestore(); }
  });


  it('crea una palabra dentro de su colección en una sola operación y rechaza parejas incorrectas sin guardar nada', async () => {
    const collection = await request(app).post('/api/collections').send({ name: 'Nueva A1', sourceLanguage: 'es', targetLanguage: 'en' }).expect(201);
    const entry = { ...word, term: 'nueva palabra', translation: 'new word', sourceLanguage: 'es', targetLanguage: 'en' };
    const created = await request(app).post(`/api/words?collectionId=${collection.body.id}`).send(entry).expect(201);
    try {
      const selected = await request(app).get('/api/words').query({ collectionId: collection.body.id }).expect(200);
      expect(selected.body.find((item: { id: number }) => item.id === created.body.id)?.collectionIds).toEqual([collection.body.id]);
      await request(app).post(`/api/words?collectionId=${collection.body.id}`).send({ ...entry, targetLanguage: 'de', term: 'no guardar' }).expect(400);
      await request(app).post('/api/words?collectionId=999999').send({ ...entry, term: 'tampoco guardar' }).expect(400);
      await request(app).post('/api/words?collectionId=abc').send({ ...entry, term: 'inválida' }).expect(400);
      const all = await request(app).get('/api/words').expect(200);
      expect(all.body.filter((item: { term: string }) => ['no guardar', 'tampoco guardar', 'inválida'].includes(item.term))).toHaveLength(0);
    } finally {
      await request(app).delete(`/api/words/${created.body.id}`).expect(204);
      await request(app).delete(`/api/collections/${collection.body.id}`).expect(204);
    }
  });

  it('crea colecciones por pareja, permite varias por palabra y mantiene los filtros', async () => {
    const first = await request(app).post('/api/collections').send({ name: ' A1 ', sourceLanguage: 'es', targetLanguage: 'en' }).expect(201);
    const important = await request(app).post('/api/collections').send({ name: 'Importantes', sourceLanguage: 'es', targetLanguage: 'en' }).expect(201);
    const german = await request(app).post('/api/collections').send({ name: 'A1', sourceLanguage: 'de', targetLanguage: 'es' }).expect(201);
    const verb = await request(app).post('/api/words').send({ ...word, term: 'dormir', translation: 'sleep', sourceLanguage: 'es', targetLanguage: 'en', wordType: 'verb' }).expect(201);
    const adjective = await request(app).post('/api/words').send({ ...word, term: 'cansado', translation: 'tired', sourceLanguage: 'es', targetLanguage: 'en', wordType: 'adjective' }).expect(201);
    try {
      expect(first.body.name).toBe('A1');
      await request(app).post('/api/collections').send({ name: 'a1', sourceLanguage: 'es', targetLanguage: 'en' }).expect(409);
      await request(app).post(`/api/collections/${first.body.id}/words/${verb.body.id}`).expect(204);
      await request(app).post(`/api/collections/${first.body.id}/words/${verb.body.id}`).expect(204);
      await request(app).post(`/api/collections/${first.body.id}/words/${adjective.body.id}`).expect(204);
      await request(app).post(`/api/collections/${important.body.id}/words/${verb.body.id}`).expect(204);
      await request(app).post(`/api/collections/${german.body.id}/words/${verb.body.id}`).expect(400);
      const listed = await request(app).get('/api/collections').query({ sourceLanguage: 'es', targetLanguage: 'en' }).expect(200);
      expect(listed.body.map((item: { name: string }) => item.name)).toEqual(['A1', 'Importantes']);
      expect(listed.body.find((item: { name: string }) => item.name === 'A1').wordCount).toBe(2);
      const filtered = await request(app).get('/api/words').query({ sourceLanguage: 'es', targetLanguage: 'en', collectionId: first.body.id, wordType: 'verb', search: 'DORMIR' }).expect(200);
      expect(filtered.body).toHaveLength(1);
      expect(filtered.body[0].collectionIds).toEqual([first.body.id, important.body.id]);
      await request(app).delete(`/api/collections/${first.body.id}/words/${verb.body.id}`).expect(204);
      expect((await request(app).get('/api/words').query({ collectionId: first.body.id, wordType: 'verb' })).body).toHaveLength(0);
      expect((await request(app).get('/api/words').query({ collectionId: important.body.id })).body).toHaveLength(1);
      await request(app).delete(`/api/collections/${first.body.id}`).expect(204);
      expect((await request(app).get('/api/words').query({ sourceLanguage: 'es', targetLanguage: 'en' })).body).toHaveLength(2);
    } finally {
      await request(app).delete(`/api/words/${verb.body.id}`).expect(204);
      await request(app).delete(`/api/words/${adjective.body.id}`).expect(204);
      await request(app).delete(`/api/collections/${important.body.id}`).expect(204);
      await request(app).delete(`/api/collections/${german.body.id}`).expect(204);
    }
  });

  it('desvincula una palabra al cambiar su pareja y rechaza datos de colecciones inválidos', async () => {
    const collection = await request(app).post('/api/collections').send({ name: 'A1', sourceLanguage: 'es', targetLanguage: 'en' }).expect(201);
    const created = await request(app).post('/api/words').send({ ...word, term: 'casa', translation: 'house', sourceLanguage: 'es', targetLanguage: 'en' }).expect(201);
    try {
      await request(app).post(`/api/collections/${collection.body.id}/words/${created.body.id}`).expect(204);
      const updated = await request(app).put(`/api/words/${created.body.id}`).send({ ...word, term: 'Haus', translation: 'casa', sourceLanguage: 'de', targetLanguage: 'es' }).expect(200);
      expect(updated.body.sourceLanguage).toBe('de');
      expect((await request(app).get('/api/words').query({ collectionId: collection.body.id })).body).toEqual([]);
      await request(app).post('/api/collections').send({ name: ' ', sourceLanguage: 'es', targetLanguage: 'en' }).expect(400);
      await request(app).post('/api/collections').send({ name: 'a'.repeat(81), sourceLanguage: 'es', targetLanguage: 'en' }).expect(400);
      await request(app).get('/api/words?collectionId=abc').expect(400);
      await request(app).post(`/api/collections/${collection.body.id}/words/999999`).expect(404);
      await request(app).delete('/api/collections/invalid').expect(400);
    } finally {
      await request(app).delete(`/api/words/${created.body.id}`).expect(204);
      await request(app).delete(`/api/collections/${collection.body.id}`).expect(204);
    }
  });

  it('guarda formas inglesas opcionales, las conserva en clientes antiguos y las retira al cambiar de tipo', async () => {
    const verb = { ...word, term: 'dormir', translation: 'sleep', sourceLanguage: 'es', targetLanguage: 'en', wordType: 'verb', englishVerbForms: { past: ' slept ', pastParticiple: 'slept', ing: 'sleeping' } };
    const created = await request(app).post('/api/words').send(verb).expect(201);
    const id = created.body.id;
    expect(created.body.englishVerbForms).toEqual({ past: 'slept', pastParticiple: 'slept', ing: 'sleeping' });
    expect((await request(app).get('/api/words').query({ sourceLanguage: 'es', targetLanguage: 'en' })).body.find((entry: { id: number }) => entry.id === id).englishVerbForms).toEqual(created.body.englishVerbForms);
    const { englishVerbForms: _forms, ...oldClient } = verb;
    const edited = await request(app).put(`/api/words/${id}`).send({ ...oldClient, notes: 'Probado' }).expect(200);
    expect(edited.body.englishVerbForms).toEqual(created.body.englishVerbForms);
    const changedType = await request(app).put(`/api/words/${id}`).send({ ...oldClient, wordType: 'noun' }).expect(200);
    expect(changedType.body.englishVerbForms).toEqual({});
    await request(app).delete(`/api/words/${id}`).expect(204);
  });

  it.each([
    { past: 'x'.repeat(121), pastParticiple: '', ing: '' },
    { past: 42, pastParticiple: '', ing: '' },
    { past: 'slept', pastParticiple: '', ing: '', extra: 'x' },
  ])('rechaza formas inglesas inválidas %#', async englishVerbForms => {
    await request(app).post('/api/words').send({ ...word, sourceLanguage: 'es', targetLanguage: 'en', wordType: 'verb', englishVerbForms }).expect(400);
  });

  it('rechaza formas inglesas en otro idioma o tipo', async () => {
    const englishVerbForms = { past: 'slept', pastParticiple: '', ing: '' };
    await request(app).post('/api/words').send({ ...word, wordType: 'verb', englishVerbForms }).expect(400);
    await request(app).post('/api/words').send({ ...word, sourceLanguage: 'es', targetLanguage: 'en', englishVerbForms }).expect(400);
  });

  it('guarda, consulta y edita ejemplos con traducciones opcionales', async () => {
    const created = await request(app).post('/api/words').send({ ...word, examples: [
      { text: ' I read a book. ', translation: ' Leo un libro. ' }, { text: 'Another book.' },
    ] }).expect(201);
    const expected = [{ text: 'I read a book.', translation: 'Leo un libro.' }, { text: 'Another book.', translation: '' }];
    expect(created.body.examples).toEqual(expected);
    expect((await request(app).get('/api/words')).body.find((entry: { id: number }) => entry.id === created.body.id).examples).toEqual(expected);
    const updated = await request(app).put(`/api/words/${created.body.id}`).send({ ...word, examples: [{ text: 'I read a book.', translation: 'He leído un libro.' }] }).expect(200);
    expect(updated.body.examples).toEqual([{ text: 'I read a book.', translation: 'He leído un libro.' }]);
    await request(app).delete(`/api/words/${created.body.id}`).expect(204);
  });

  it.each([
    { text: '', translation: 'Un libro.' }, { text: '   ', translation: '' },
    { translation: 'Un libro.' }, { text: 'A book.', translation: 'a'.repeat(501) },
    { text: 'a'.repeat(501), translation: '' }, { text: 'A book.', translation: null },
  ])('rechaza ejemplos estructurados inválidos %#', async example => {
    await request(app).post('/api/words').send({ ...word, examples: [example] }).expect(400);
    await request(app).put('/api/words/1').send({ ...word, examples: [example] }).expect(400);
  });

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
    expect(updated.body.examples).toEqual([{ text: 'My notebook.', translation: '' }]);
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
