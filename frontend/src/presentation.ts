import type { WordInput } from './model';

// Traducciones escritas del contenido de presentación, sin servicios externos.
interface Presentation {
  tagline: string;
  personalSpace: string;
  eyebrow: string;
  title: string;
  titleAccent: string;
  introduction: string;
  invitation: string;
  artCaption: string;
  footer: string;
  footerMessage: string;
}

export const presentation: Record<WordInput['targetLanguage'], Presentation> = {
  es: {
    tagline: 'Un mundo de palabras por descubrir', personalSpace: 'Mi espacio personal',
    eyebrow: 'TU DICCIONARIO PERSONAL', title: 'Una palabra más.', titleAccent: 'Un mundo más grande.',
    introduction: 'Reúne lo que descubres, dale contexto y hazlo tuyo.', invitation: 'Tu próxima conversación empieza aquí.',
    artCaption: 'palabras que conectan', footer: 'Aprende a tu ritmo',
    footerMessage: 'Las grandes conversaciones empiezan con pequeñas palabras.',
  },
  en: {
    tagline: 'A world of words to discover', personalSpace: 'My personal space',
    eyebrow: 'YOUR PERSONAL DICTIONARY', title: 'One more word.', titleAccent: 'A bigger world.',
    introduction: 'Collect what you discover, give it context and make it yours.', invitation: 'Your next conversation starts here.',
    artCaption: 'words that connect', footer: 'Learn at your own pace',
    footerMessage: 'Great conversations start with small words.',
  },
  fr: {
    tagline: 'Un monde de mots à découvrir', personalSpace: 'Mon espace personnel',
    eyebrow: 'VOTRE DICTIONNAIRE PERSONNEL', title: 'Un mot de plus.', titleAccent: 'Un monde plus grand.',
    introduction: 'Rassemblez vos découvertes, donnez-leur du contexte et faites-les vôtres.', invitation: 'Votre prochaine conversation commence ici.',
    artCaption: 'des mots qui relient', footer: 'Apprenez à votre rythme',
    footerMessage: 'Les grandes conversations commencent par de petits mots.',
  },
  de: {
    tagline: 'Eine Welt voller Wörter entdecken', personalSpace: 'Mein persönlicher Bereich',
    eyebrow: 'DEIN PERSÖNLICHES WÖRTERBUCH', title: 'Ein Wort mehr.', titleAccent: 'Eine größere Welt.',
    introduction: 'Sammle deine Entdeckungen, gib ihnen Kontext und mache sie dir zu eigen.', invitation: 'Dein nächstes Gespräch beginnt hier.',
    artCaption: 'Wörter, die verbinden', footer: 'Lerne in deinem Tempo',
    footerMessage: 'Große Gespräche beginnen mit kleinen Wörtern.',
  },
  it: {
    tagline: 'Un mondo di parole da scoprire', personalSpace: 'Il mio spazio personale',
    eyebrow: 'IL TUO DIZIONARIO PERSONALE', title: 'Una parola in più.', titleAccent: 'Un mondo più grande.',
    introduction: 'Raccogli ciò che scopri, dagli un contesto e fallo tuo.', invitation: 'La tua prossima conversazione inizia qui.',
    artCaption: 'parole che uniscono', footer: 'Impara al tuo ritmo',
    footerMessage: 'Le grandi conversazioni iniziano con piccole parole.',
  },
  pt: {
    tagline: 'Um mundo de palavras para descobrir', personalSpace: 'O meu espaço pessoal',
    eyebrow: 'O TEU DICIONÁRIO PESSOAL', title: 'Mais uma palavra.', titleAccent: 'Um mundo maior.',
    introduction: 'Reúne o que descobres, dá-lhe contexto e torna-o teu.', invitation: 'A tua próxima conversa começa aqui.',
    artCaption: 'palavras que ligam', footer: 'Aprende ao teu ritmo',
    footerMessage: 'As grandes conversas começam com pequenas palavras.',
  },
  ja: {
    tagline: '新しい言葉の世界を見つけよう', personalSpace: 'マイスペース',
    eyebrow: '自分だけの辞書', title: '言葉がひとつ増える。', titleAccent: '世界がもっと広がる。',
    introduction: '見つけた言葉を集め、文脈とともに自分のものにしよう。', invitation: '次の会話はここから始まる。',
    artCaption: '人をつなぐ言葉', footer: '自分のペースで学ぼう',
    footerMessage: '小さな言葉から、すてきな会話が始まる。',
  },
};
