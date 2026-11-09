import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createDemoApp } from './demoApp.js';

const indexFile = fileURLToPath(new URL('../../frontend/dist/index.html', import.meta.url));
await access(indexFile);
const { app, close } = createDemoApp();
const port = Number(process.env.PORT ?? 3001);
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Demo de Vocabia disponible en el puerto ${port}`);
});

function shutdown() {
  server.close(() => { void close().then(() => { process.exitCode = 0; }); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
