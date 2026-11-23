import type { Collection, Word } from './model';
import { maxImportBytes, maxWords } from './importPreview';

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

// Devuelve false si el archivo no se podrá volver a importar entero por tamaño o número de palabras.
export function downloadExport(words: Word[], collections: Collection[]) {
  const date = new Date();
  // Sin sangría: con ella, unas 3000 palabras ya superan el límite de importación.
  const blob = new Blob([JSON.stringify(createExportDocument(words, collections, date))], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
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
  return blob.size <= maxImportBytes && words.length <= maxWords;
}
