import type { WordInput } from './model';

export const appNavigationText: Record<WordInput['sourceLanguage'], {
  nav: string; dictionary: string; study: string; studyIntro: string;
  available: string; empty: string; emptyHelp: string; goDictionary: string;
}> = {
  es: { nav: 'Secciones', dictionary: 'Diccionario', study: 'Estudio', studyIntro: 'Elige una colección y practica las palabras de esta pareja de idiomas.', available: 'Palabras disponibles', empty: 'Aún no hay palabras para estudiar aquí.', emptyHelp: 'Añade palabras en el diccionario o elige otra colección.', goDictionary: 'Ir al diccionario' },
  en: { nav: 'Sections', dictionary: 'Dictionary', study: 'Study', studyIntro: 'Choose a collection and practice words from this language pair.', available: 'Available words', empty: 'There are no words to study here yet.', emptyHelp: 'Add words in the dictionary or choose another collection.', goDictionary: 'Go to dictionary' },
  fr: { nav: 'Sections', dictionary: 'Dictionnaire', study: 'Étude', studyIntro: 'Choisissez une collection et révisez les mots de cette paire de langues.', available: 'Mots disponibles', empty: 'Il n’y a pas encore de mots à étudier ici.', emptyHelp: 'Ajoutez des mots au dictionnaire ou choisissez une autre collection.', goDictionary: 'Aller au dictionnaire' },
  de: { nav: 'Bereiche', dictionary: 'Wörterbuch', study: 'Üben', studyIntro: 'Wähle eine Sammlung und übe Wörter dieses Sprachpaars.', available: 'Verfügbare Wörter', empty: 'Hier gibt es noch keine Wörter zum Üben.', emptyHelp: 'Füge Wörter im Wörterbuch hinzu oder wähle eine andere Sammlung.', goDictionary: 'Zum Wörterbuch' },
  it: { nav: 'Sezioni', dictionary: 'Dizionario', study: 'Studio', studyIntro: 'Scegli una raccolta e ripassa le parole di questa coppia di lingue.', available: 'Parole disponibili', empty: 'Non ci sono ancora parole da studiare qui.', emptyHelp: 'Aggiungi parole nel dizionario o scegli un’altra raccolta.', goDictionary: 'Vai al dizionario' },
  pt: { nav: 'Secções', dictionary: 'Dicionário', study: 'Estudo', studyIntro: 'Escolhe uma coleção e pratica as palavras deste par de idiomas.', available: 'Palavras disponíveis', empty: 'Ainda não há palavras para estudar aqui.', emptyHelp: 'Adiciona palavras no dicionário ou escolhe outra coleção.', goDictionary: 'Ir para o dicionário' },
  ja: { nav: 'セクション', dictionary: '辞書', study: '学習', studyIntro: 'コレクションを選び、この言語ペアの単語を練習しましょう。', available: '学習できる単語', empty: 'ここにはまだ学習する単語がありません。', emptyHelp: '辞書に単語を追加するか、別のコレクションを選んでください。', goDictionary: '辞書へ移動' },
};
