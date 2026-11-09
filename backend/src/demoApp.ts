import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express, { type Express, type Request, type Response } from 'express';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from './app.js';
import { initializeDatabase } from './database.js';
import { demoWords } from './demoData.js';

const cookieName = 'vocabia_demo';
const sessionDurationMs = 30 * 60 * 1000;
const maxSessions = 12;
const frontendDirectory = fileURLToPath(new URL('../../frontend/dist/', import.meta.url));

interface DemoSession {
  db: PGlite;
  api: Express;
  lastUsed: number;
  activeRequests: number;
}

async function createSession(): Promise<DemoSession> {
  const db = new PGlite();
  try {
    await initializeDatabase(db, false);
    await db.transaction(async tx => {
      const collections = new Map<string, number>();
      for (const word of demoWords) {
        const inserted = await tx.query<{ id: number }>(
          `INSERT INTO words(term,translation,source_language,target_language,word_type,notes,examples,english_verb_forms)
           VALUES ($1,$2,'es',$3,$4,'',$5::jsonb,$6::jsonb) RETURNING id`,
          [word.term, word.translation, word.targetLanguage, word.wordType,
            JSON.stringify(word.examples.map(([text, translation]) => ({ text, translation }))),
            JSON.stringify(word.englishVerbForms ?? {})],
        );
        for (const name of word.collections) {
          const key = `${word.targetLanguage}:${name}`;
          let collectionId = collections.get(key);
          if (collectionId === undefined) {
            const created = await tx.query<{ id: number }>(
              'INSERT INTO collections(name,source_language,target_language) VALUES ($1,\'es\',$2) RETURNING id',
              [name, word.targetLanguage],
            );
            collectionId = created.rows[0].id;
            collections.set(key, collectionId);
          }
          await tx.query('INSERT INTO collection_words(collection_id,word_id) VALUES ($1,$2)', [collectionId, inserted.rows[0].id]);
        }
      }
    });
    return { db, api: createApp(db), lastUsed: Date.now(), activeRequests: 0 };
  } catch (error) {
    await db.close();
    throw error;
  }
}

function readSessionId(req: Request): string | null {
  const cookie = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`));
  const id = cookie?.slice(cookieName.length + 1) ?? '';
  return /^[a-f0-9]{48}$/.test(id) ? id : null;
}

export function createDemoApp(options: { maxSessions?: number } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  const sessions = new Map<string, DemoSession>();
  let pendingSessions = 0;

  async function expireIdleSessions() {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (session.activeRequests || now - session.lastUsed < sessionDurationMs) continue;
      sessions.delete(id);
      try { await session.db.close(); }
      catch (error) { console.error('No se pudo cerrar una sesión caducada de la demo:', error); }
    }
  }

  async function sessionFor(req: Request, res: Response): Promise<DemoSession | null> {
    await expireIdleSessions();
    const oldId = readSessionId(req);
    const existing = oldId && sessions.get(oldId);
    if (existing) {
      existing.lastUsed = Date.now();
      res.cookie(cookieName, oldId, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: sessionDurationMs, path: '/' });
      return existing;
    }
    if (sessions.size + pendingSessions >= (options.maxSessions ?? maxSessions)) {
      res.status(503).json({ error: 'La demo está ocupada. Vuelve a intentarlo más tarde.' });
      return null;
    }
    pendingSessions += 1;
    let session: DemoSession;
    try { session = await createSession(); }
    finally { pendingSessions -= 1; }
    const id = randomBytes(24).toString('hex');
    sessions.set(id, session);
    res.cookie(cookieName, id, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: sessionDurationMs, path: '/' });
    return session;
  }

  const cleanup = setInterval(() => {
    void expireIdleSessions().catch(error => { console.error('No se pudo limpiar la demo:', error); });
  }, 60_000);
  cleanup.unref();

  app.get('/api/demo-info', (_req, res) => { res.json({ demo: true, temporary: true }); });
  app.use(async (req, res, next) => {
    if (!req.path.startsWith('/api/')) { next(); return; }
    const session = await sessionFor(req, res);
    if (!session) return;
    session.activeRequests += 1;
    res.once('close', () => { session.activeRequests -= 1; session.lastUsed = Date.now(); });
    session.api(req, res);
  });

  app.get(['/', '/estudio'], async (req, res) => {
    const session = await sessionFor(req, res);
    if (session) res.sendFile('index.html', { root: frontendDirectory });
  });
  app.use(express.static(frontendDirectory));
  app.use((_req, res) => { res.status(404).end(); });

  return {
    app,
    close: async () => {
      clearInterval(cleanup);
      await Promise.all([...sessions.values()].map(session => session.db.close()));
      sessions.clear();
    },
  };
}
