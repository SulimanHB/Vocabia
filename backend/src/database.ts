import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Una interfaz pequeña permite usar las mismas consultas con ambos motores.
export interface Database {
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
}

export function openDatabase(): Database {
  if (process.env.DATABASE_URL) {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    return { query: (sql, params) => pool.query(sql, params), close: () => pool.end() };
  }
  return new PGlite(fileURLToPath(new URL('../data/', import.meta.url)));
}

export async function initializeDatabase(db: Database, seed = true) {
  const sql = await readFile(new URL('../../database/001_initial.sql', import.meta.url), 'utf8');
  // El script inicial no tiene funciones SQL ni puntos y coma dentro de cadenas.
  for (const statement of sql.split(';').filter(part => part.trim())) await db.query(statement);
  if (!seed) return;
  const examples = [
    ['serendipity', 'casualidad afortunada', 'en', 'es', 'noun', 'Encontrar algo valioso cuando buscabas otra cosa.', ['Finding this book was pure serendipity.']],
    ['to figure out', 'averiguar / entender', 'en', 'es', 'expression', 'Se usa al resolver un problema o comprender algo.', ['I finally figured out the answer.', 'Can you figure out how it works?']],
    ['resilient', 'resiliente', 'en', 'es', 'adjective', 'Capaz de recuperarse ante una dificultad.', ['She remained resilient after the setback.']],
    ['to wander', 'deambular / pasear sin rumbo', 'en', 'es', 'verb', '', ['We wandered through the old town.']],
    ['flâner', 'pasear sin prisa', 'fr', 'es', 'verb', 'Disfrutar del paseo sin un destino concreto.', ['J’aime flâner dans les rues de Paris.']],
    ['allmählich', 'poco a poco', 'de', 'es', 'adverb', '', ['Allmählich wird es heller.']],
  ];
  const params: unknown[] = [];
  const values = examples.map(([term, translation, source, target, type, notes, sentences]) => {
    const offset = params.length;
    params.push(term, translation, source, target, type, notes, JSON.stringify(sentences));
    return `(${Array.from({ length: 7 }, (_, index) => `$${offset + index + 1}${index === 6 ? '::jsonb' : '::text'}`).join(',')})`;
  });
  // Una sola instrucción: se guardan tanto el marcador como los ejemplos, o ninguno.
  await db.query(`WITH seed AS (
    INSERT INTO app_seeds(name) VALUES ('demo-v1') ON CONFLICT DO NOTHING RETURNING name
  ) INSERT INTO words(term,translation,source_language,target_language,word_type,notes,examples)
    SELECT v.* FROM (VALUES ${values.join(',')}) AS v(term,translation,source_language,target_language,word_type,notes,examples)
    CROSS JOIN seed`, params);
}
