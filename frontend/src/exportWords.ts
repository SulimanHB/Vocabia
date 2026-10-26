import type { Collection, Word } from './model';

// El formato versionado permitirá validar una importación futura sin depender de IDs locales.
export function createExportDocument(words: Word[], collections: Collection[], exportedAt: Date) {
  const collectionById = new Map(collections.map(collection => [collection.id, collection]));
  return {
    format: 'vocabia-words',
    version: 2,
    exportedAt: exportedAt.toISOString(),
    collections: collections.map(({ name, sourceLanguage, targetLanguage }) => ({ name, sourceLanguage, targetLanguage })),
    words: words.map(({ term, translation, sourceLanguage, targetLanguage, wordType, notes, examples, englishVerbForms, collectionIds }) => ({
      term, translation, sourceLanguage, targetLanguage, wordType, notes,
      examples: examples.map(({ text, translation }) => ({ text, translation })),
      englishVerbForms: englishVerbForms ?? {},
      collections: (collectionIds ?? []).flatMap(id => {
        const collection = collectionById.get(id);
        return collection && collection.sourceLanguage === sourceLanguage && collection.targetLanguage === targetLanguage ? [collection.name] : [];
      }),
    })),
  };
}

export function downloadExport(words: Word[], collections: Collection[]) {
  const date = new Date();
  const content = JSON.stringify(createExportDocument(words, collections, date), null, 2);
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `vocabia-colecciones-${date.toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
