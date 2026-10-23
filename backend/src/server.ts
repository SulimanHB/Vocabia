import { createApp } from './app.js';
import { initializeDatabase, openDatabase } from './database.js';

const db = openDatabase();
try {
  await initializeDatabase(db);
  const port = Number(process.env.PORT ?? 3001);
  const server = createApp(db).listen(port, '127.0.0.1', () => {
    console.log(`API disponible en http://localhost:${port} (${process.env.DATABASE_URL ? 'PostgreSQL' : 'PGlite local'})`);
  });
  const shutdown = () => server.close(() => { void db.close().then(() => process.exit(0)); });
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (error) {
  console.error('No se pudo iniciar la base de datos. Revisa la configuración.', error instanceof Error ? error.message : 'Error desconocido');
  await db.close();
  process.exitCode = 1;
}
