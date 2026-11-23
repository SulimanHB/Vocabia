import { PGlite } from '@electric-sql/pglite';
import { applySchema } from '../../backend/src/schema.js';
import { seedDemo } from '../../backend/src/demoSeed.js';
import { createLocalApi } from '../../backend/src/localApi.js';

// Demo estática: cada visitante tiene su propia base PGlite en memoria, dentro de su navegador.
// No hay servidor que pagar ni que se sature; los cambios se pierden al recargar.
const migrations = import.meta.glob<string>('../../database/*.sql', { query: '?raw', import: 'default', eager: true });

let api: ReturnType<typeof start> | null = null;

async function start() {
  const db = new PGlite();
  await applySchema(db, name => migrations[`../../database/${name}.sql`], false);
  await seedDemo(db);
  // Límites menores que en local: PGlite comparte hilo con la interfaz.
  return createLocalApi(db, { importBytes: 200 * 1024, importWords: 200 });
}

export async function demoFetch(path: string, options?: RequestInit): Promise<Response> {
  api ??= start();
  let handle: Awaited<ReturnType<typeof start>>;
  try { handle = await api; }
  catch (error) { api = null; throw error; } // permite reintentar si falló la carga
  const { status, body } = await handle(options?.method ?? 'GET', `/api${path}`, typeof options?.body === 'string' ? options.body : undefined);
  return new Response(body === undefined || status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
