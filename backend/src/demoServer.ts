import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createDemoApp } from './demoApp.js';

const indexFile = fileURLToPath(new URL('../../frontend/dist/index.html', import.meta.url));
await access(indexFile);
// Cada sesión es una PGlite de ~200 MB: en hosting con poca RAM hay que bajar el máximo.
const maxSessions = Number(process.env.DEMO_MAX_SESSIONS ?? 12);
if (!Number.isInteger(maxSessions) || maxSessions < 1) throw new Error('DEMO_MAX_SESSIONS debe ser un entero mayor que 0');
const { app, close } = createDemoApp({ maxSessions });
const port = Number(process.env.PORT ?? 3001);
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Demo de Vocabia disponible en el puerto ${port}`);
});

function shutdown() {
  server.close(() => { void close().then(() => { process.exitCode = 0; }); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
