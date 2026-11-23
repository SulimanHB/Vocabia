import express, { type ErrorRequestHandler } from 'express';
import { apiRoutes } from './api.js';
import type { Database } from './database.js';

export function createApp(db: Database, { importLimit = { bytes: '3mb', words: 5000 }, allowedHosts }: {
  importLimit?: { bytes: string; words: number }; allowedHosts?: string[];
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  // DNS rebinding: una web con un dominio que resuelve a 127.0.0.1 llega con su propio Host.
  if (allowedHosts) app.use((req, res, next) => {
    if (allowedHosts.includes(req.headers.host ?? '')) { next(); return; }
    res.status(403).json({ error: 'Host no permitido.' });
  });
  // CSRF: un formulario o fetch "simple" de otra web no puede enviar application/json sin preflight CORS.
  app.use((req, res, next) => {
    const type = req.headers['content-type']?.split(';')[0].trim().toLowerCase();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || type === 'application/json') { next(); return; }
    res.status(415).json({ error: 'Las escrituras deben enviarse como application/json.' });
  });
  const importJson = express.json({ limit: importLimit.bytes });
  const json = express.json({ limit: '32kb' });
  app.use((req, res, next) => (req.path === '/api/import' ? importJson : json)(req, res, next));

  for (const route of apiRoutes(db, { importWords: importLimit.words })) {
    app[route.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete'](route.path, async (req, res) => {
      const result = await route.handle({ params: req.params as Record<string, string>, query: req.query, body: req.body });
      if (result.body === undefined) res.status(result.status).end();
      else res.status(result.status).json(result.body);
    });
  }

  app.use((_req, res) => { res.status(404).json({ error: 'Ruta no encontrada.' }); });
  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') { res.status(400).json({ error: 'El JSON enviado no es válido.' }); return; }
    if (error.type === 'entity.too.large') { res.status(413).json({ error: 'La petición es demasiado grande.' }); return; }
    console.error('Error en la API:', error.message);
    res.status(500).json({ error: 'No se pudo completar la operación. Inténtalo de nuevo.' });
  };
  app.use(handleError);
  return app;
}
