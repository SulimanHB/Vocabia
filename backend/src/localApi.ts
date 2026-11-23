import { apiRoutes } from './api.js';
import type { Database } from './db.js';
import { matchRoute, reply, type ApiResponse } from './http.js';

// Ejecuta la API sin servidor HTTP: la demo estática la usa en el navegador del visitante.
// Aplica los mismos límites de cuerpo que el servidor Express.
export function createLocalApi(db: Database, { importBytes = 3 * 1024 * 1024, importWords = 5000 } = {}) {
  const routes = apiRoutes(db, { importWords });
  return async function handle(method: string, url: string, bodyText?: string): Promise<ApiResponse> {
    const { pathname, searchParams } = new URL(url, 'http://local');
    const found = matchRoute(routes, method.toUpperCase(), pathname);
    if (!found) return reply(404, { error: 'Ruta no encontrada.' });
    const limit = pathname === '/api/import' ? importBytes : 32 * 1024;
    if (bodyText && new TextEncoder().encode(bodyText).length > limit) return reply(413, { error: 'La petición es demasiado grande.' });
    let body: unknown;
    try { body = bodyText ? JSON.parse(bodyText) : undefined; }
    catch { return reply(400, { error: 'El JSON enviado no es válido.' }); }
    try {
      return await found.route.handle({ params: found.params, query: Object.fromEntries(searchParams), body });
    } catch (error) {
      console.error('Error en la API local:', error instanceof Error ? error.message : error);
      return reply(500, { error: 'No se pudo completar la operación. Inténtalo de nuevo.' });
    }
  };
}
