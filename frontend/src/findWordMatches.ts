import type { Word } from './model';
import { wordKey } from './compareImport';

// Mismo criterio que la vista previa: pareja, palabra y traducción; los ejemplos pueden variar.
export function findWordMatches(words: Word[]): Word[][] {
  const groups = new Map<string, Word[]>();
  for (const word of words) {
    const key = wordKey(word.sourceLanguage, word.targetLanguage, word.term, word.translation);
    const group = groups.get(key) ?? [];
    group.push(word);
    groups.set(key, group);
  }
  return [...groups.values()].filter(group => group.length > 1)
    .sort((first, second) => first[0].term.localeCompare(second[0].term));
}
