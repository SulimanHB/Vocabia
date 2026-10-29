import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { initializeDatabase } from './database.js';

async function oldDatabase() {
  const db = new PGlite();
  await db.exec(await readFile(new URL('../../database/001_initial.sql', import.meta.url), 'utf8'));
  await db.query(`INSERT INTO words(term, translation, source_language, target_language, word_type, notes, examples)
    VALUES ($1,$2,'es','en','expression',$3,$4::jsonb)`, [
    'darse cuenta', 'realize', 'Nota original',
    JSON.stringify(['Me di cuenta del error.', '¿Dónde está el libro?', { text: 'Ya lo sé.', translation: 'I already know.' }]),
  ]);
  return db;
}

describe('Migración de ejemplos', () => {
  it('conserva todos los datos y el orden, transforma frases antiguas y se puede reiniciar', async () => {
    const db = await oldDatabase();
    try {
      const before = (await db.query('SELECT * FROM words')).rows[0];
      await initializeDatabase(db, false);
      const after = (await db.query('SELECT * FROM words')).rows[0];
      const examples = [
        { text: 'Me di cuenta del error.', translation: '' },
        { text: '¿Dónde está el libro?', translation: '' },
        { text: 'Ya lo sé.', translation: 'I already know.' },
      ];
      expect(after).toEqual({ ...before, examples, english_verb_forms: {} });
      await initializeDatabase(db, false);
      expect((await db.query('SELECT * FROM words')).rows[0]).toEqual(after);
      expect((await db.query('SELECT name FROM app_migrations ORDER BY name')).rows).toEqual([{ name: '002_example_translations' }, { name: '003_english_verb_forms' }, { name: '004_collections' }, { name: '005_study_rounds' }, { name: '006_merge_history' }]);
    } finally { await db.close(); }
  });

  it('no deja una conversión parcial si falla el registro de la migración', async () => {
    const db = await oldDatabase();
    try {
      await db.query("CREATE TABLE app_migrations(name TEXT PRIMARY KEY CHECK (name <> '002_example_translations'))");
      const before = (await db.query('SELECT * FROM words')).rows;
      await expect(initializeDatabase(db, false)).rejects.toThrow();
      expect((await db.query('SELECT * FROM words')).rows).toEqual(before);
      expect((await db.query('SELECT * FROM app_migrations')).rows).toEqual([]);
    } finally { await db.close(); }
  });
});
