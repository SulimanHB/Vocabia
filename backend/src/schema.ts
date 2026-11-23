import type { Database } from './db.js';

export const migrations = ['001_initial', '002_example_translations', '003_english_verb_forms', '004_collections',
  '005_study_rounds', '006_merge_history', '007_word_study_mark'];

// readSql obtiene el texto de cada migración: del disco en Node, empaquetado en el navegador.
export async function applySchema(db: Database, readSql: (name: string) => Promise<string> | string, seed = true) {
  await db.query('CREATE TABLE IF NOT EXISTS app_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  // Todas son repetibles (IF NOT EXISTS o con su propia comprobación) y se aplican en cada arranque.
  for (const name of migrations) {
    const sql = await readSql(name);
    // Los scripts no tienen funciones SQL ni puntos y coma dentro de cadenas o comentarios.
    await db.transaction(async tx => {
      for (const statement of sql.split(';').filter(part => part.trim())) await tx.query(statement);
      await tx.query('INSERT INTO app_migrations(name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
    });
  }
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
    const structuredExamples = Array.isArray(sentences) ? sentences.map(text => ({ text, translation: '' })) : [];
    params.push(term, translation, source, target, type, notes, JSON.stringify(structuredExamples));
    return `(${Array.from({ length: 7 }, (_, index) => `$${offset + index + 1}${index === 6 ? '::jsonb' : '::text'}`).join(',')})`;
  });
  // Una sola instrucción: se guardan tanto el marcador como los ejemplos, o ninguno.
  await db.query(`WITH seed AS (
    INSERT INTO app_seeds(name) VALUES ('demo-v1') ON CONFLICT DO NOTHING RETURNING name
  ) INSERT INTO words(term,translation,source_language,target_language,word_type,notes,examples)
    SELECT v.* FROM (VALUES ${values.join(',')}) AS v(term,translation,source_language,target_language,word_type,notes,examples)
    CROSS JOIN seed`, params);
}
