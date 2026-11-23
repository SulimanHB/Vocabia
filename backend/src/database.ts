import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Database } from './db.js';
import { applySchema } from './schema.js';

export type { Database, Queryable } from './db.js';

export function openDatabase(): Database {
  if (process.env.DATABASE_URL) {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    return {
      query: (sql, params) => pool.query(sql, params),
      transaction: async callback => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await callback({ query: (sql, params) => client.query(sql, params) });
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally { client.release(); }
      },
      close: () => pool.end(),
    };
  }
  return new PGlite(fileURLToPath(new URL('../data/', import.meta.url)));
}

export function initializeDatabase(db: Database, seed = true) {
  return applySchema(db, name => readFile(new URL(`../../database/${name}.sql`, import.meta.url), 'utf8'), seed);
}
