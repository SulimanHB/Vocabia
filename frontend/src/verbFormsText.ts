import type { WordInput } from './model';

export const verbFormsText: Record<WordInput['sourceLanguage'], {
  title: string; help: string; past: string; pastParticiple: string; ing: string;
}> = {
  es: { title: 'Formas del verbo en inglés', help: 'Opcionales. La traducción de arriba es la forma base, por ejemplo sleep.', past: 'Pasado simple', pastParticiple: 'Participio pasado', ing: 'Forma -ing' },
  en: { title: 'English verb forms', help: 'Optional. The translation above is the base form, for example sleep.', past: 'Simple past', pastParticiple: 'Past participle', ing: '-ing form' },
  fr: { title: 'Formes du verbe anglais', help: 'Facultatives. La traduction ci-dessus est la base, par exemple sleep.', past: 'Prétérit', pastParticiple: 'Participe passé', ing: 'Forme en -ing' },
  de: { title: 'Englische Verbformen', help: 'Optional. Die Übersetzung oben ist die Grundform, zum Beispiel sleep.', past: 'Einfache Vergangenheit', pastParticiple: 'Partizip Perfekt', ing: '-ing-Form' },
  it: { title: 'Forme del verbo inglese', help: 'Facoltative. La traduzione sopra è la forma base, per esempio sleep.', past: 'Passato semplice', pastParticiple: 'Participio passato', ing: 'Forma in -ing' },
  pt: { title: 'Formas do verbo inglês', help: 'Opcionais. A tradução acima é a forma base, por exemplo sleep.', past: 'Passado simples', pastParticiple: 'Particípio passado', ing: 'Forma em -ing' },
  ja: { title: '英語の動詞の活用形', help: '任意。上の訳は sleep のような原形です。', past: '過去形', pastParticiple: '過去分詞', ing: '-ing形' },
};
