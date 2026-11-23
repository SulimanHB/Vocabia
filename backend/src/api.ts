import type { Database } from './db.js';
import type { ApiRoute } from './http.js';
import { importRoutes } from './importWords.js';
import { collectionRoutes } from './collections.js';
import { studyRoundRoutes } from './studyRounds.js';
import { mergeRoutes } from './mergeWords.js';
import { wordRoutes } from './words.js';

// Orden importante: «/api/words/merge» debe comprobarse antes que «/api/words/:id».
export const apiRoutes = (db: Database, { importWords = 5000 } = {}): ApiRoute[] => [
  ...importRoutes(db, importWords),
  ...collectionRoutes(db),
  ...studyRoundRoutes(db),
  ...mergeRoutes(db),
  ...wordRoutes(db),
];
