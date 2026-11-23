import type { Database } from './db.js';
import { demoWords } from './demoData.js';

// Pareja inversa inglés → español: con la interfaz en inglés, la demo no aparece vacía.
const seedWords = [
  ...demoWords.map(word => ({ ...word, sourceLanguage: 'es' as const })),
  ...demoWords.filter(word => word.targetLanguage === 'en').map(word => ({
    ...word, sourceLanguage: 'en' as const, targetLanguage: 'es' as const, term: word.translation, translation: word.term,
    examples: word.examples.map(([text, translation]): [string, string] => [translation, text]),
    englishVerbForms: undefined, // las formas inglesas solo se muestran cuando el inglés es la traducción
  })),
];

// Carga las palabras y colecciones de ejemplo en una base recién creada.
export async function seedDemo(db: Database) {
  await db.transaction(async tx => {
    const collections = new Map<string, number>();
    for (const word of seedWords) {
      const inserted = await tx.query<{ id: number }>(
        `INSERT INTO words(term,translation,source_language,target_language,word_type,notes,examples,english_verb_forms)
         VALUES ($1,$2,$3,$4,$5,'',$6::jsonb,$7::jsonb) RETURNING id`,
        [word.term, word.translation, word.sourceLanguage, word.targetLanguage, word.wordType,
          JSON.stringify(word.examples.map(([text, translation]) => ({ text, translation }))),
          JSON.stringify(word.englishVerbForms ?? {})],
      );
      for (const name of word.collections) {
        const key = `${word.sourceLanguage}:${word.targetLanguage}:${name}`;
        let collectionId = collections.get(key);
        if (collectionId === undefined) {
          const created = await tx.query<{ id: number }>(
            'INSERT INTO collections(name,source_language,target_language) VALUES ($1,$2,$3) RETURNING id',
            [name, word.sourceLanguage, word.targetLanguage],
          );
          collectionId = created.rows[0].id;
          collections.set(key, collectionId);
        }
        await tx.query('INSERT INTO collection_words(collection_id,word_id) VALUES ($1,$2)', [collectionId, inserted.rows[0].id]);
      }
    }
  });
}
