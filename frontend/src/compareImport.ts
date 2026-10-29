import type { Collection, Word } from './model';
import type { ImportDocument } from './importPreview';

export interface ImportComparison {
  collectionMatches: boolean[];
  wordMatches: boolean[];
  newCollections: number;
  existingCollections: number;
  unmatchedWords: number;
  possibleWords: number;
}

// Son pistas para revisar, no decisiones automáticas sobre qué datos conservar.
const normalized = (value: string) => value.trim().normalize('NFC').toLowerCase();
const collectionKey = (source: string, target: string, name: string) => JSON.stringify([source, target, normalized(name)]);
export const wordKey = (source: string, target: string, term: string, translation: string) =>
  JSON.stringify([source, target, normalized(term), normalized(translation)]);

export function compareImport(document: ImportDocument, currentWords: Word[], currentCollections: Collection[]): ImportComparison {
  const collections = new Set(currentCollections.map(item => collectionKey(item.sourceLanguage, item.targetLanguage, item.name)));
  const words = new Set(currentWords.map(item => wordKey(item.sourceLanguage, item.targetLanguage, item.term, item.translation)));
  const collectionMatches = document.collections.map(item => collections.has(collectionKey(item.sourceLanguage, item.targetLanguage, item.name)));
  const wordMatches = document.words.map(item => {
    const key = wordKey(item.sourceLanguage, item.targetLanguage, item.term, item.translation);
    const matched = words.has(key);
    words.add(key); // También avisa si la misma entrada se repite dentro del archivo.
    return matched;
  });
  const existingCollections = collectionMatches.filter(Boolean).length;
  const possibleWords = wordMatches.filter(Boolean).length;
  return {
    collectionMatches, wordMatches,
    existingCollections, newCollections: collectionMatches.length - existingCollections,
    possibleWords, unmatchedWords: wordMatches.length - possibleWords,
  };
}
