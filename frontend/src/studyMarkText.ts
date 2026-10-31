import type { WordInput } from './model';

export const studyMarkText: Record<WordInput['sourceLanguage'], {
  known: string; difficult: string; retryDifficult: string; saveError: string;
}> = {
  es: { known: 'La sabía', difficult: 'Me costó', retryDifficult: 'Practicar las difíciles', saveError: 'No se pudo guardar la marca. Inténtalo otra vez.' },
  en: { known: 'I knew it', difficult: 'I struggled', retryDifficult: 'Practice difficult words', saveError: 'Could not save your choice. Try again.' },
  fr: { known: 'Je la savais', difficult: 'J’ai eu du mal', retryDifficult: 'Réviser les mots difficiles', saveError: 'Impossible d’enregistrer votre choix. Réessayez.' },
  de: { known: 'Ich wusste es', difficult: 'Es fiel mir schwer', retryDifficult: 'Schwierige Wörter üben', saveError: 'Deine Auswahl konnte nicht gespeichert werden. Versuche es erneut.' },
  it: { known: 'La sapevo', difficult: 'Ho avuto difficoltà', retryDifficult: 'Ripassa le parole difficili', saveError: 'Impossibile salvare la scelta. Riprova.' },
  pt: { known: 'Eu sabia', difficult: 'Tive dificuldade', retryDifficult: 'Praticar palavras difíceis', saveError: 'Não foi possível guardar a escolha. Tenta novamente.' },
  ja: { known: '分かった', difficult: '難しかった', retryDifficult: '難しい単語を復習', saveError: '記録できませんでした。もう一度お試しください。' },
};
