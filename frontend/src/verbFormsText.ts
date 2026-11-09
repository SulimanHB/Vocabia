import type { WordInput } from './model';

export const verbFormsText: Record<WordInput['sourceLanguage'], {
  title: string; help: string; present: string; future: string; past: string; pastParticiple: string; ing: string;
}> = {
  es: { title: 'Formas del verbo en inglés', help: 'Opcionales. La traducción de arriba es la forma base, por ejemplo sleep.', present: 'Presente (forma base)', past: 'Pasado simple', future: 'Futuro con will', pastParticiple: 'Participio pasado', ing: 'Forma -ing' },
  en: { title: 'English verb forms', help: 'Optional. The translation above is the base form, for example sleep.', present: 'Present (base form)', past: 'Simple past', future: 'Future with will', pastParticiple: 'Past participle', ing: '-ing form' },
  fr: { title: 'Formes du verbe anglais', help: 'Facultatives. La traduction ci-dessus est la base, par exemple sleep.', present: 'Présent (base)', past: 'Prétérit', future: 'Futur avec will', pastParticiple: 'Participe passé', ing: 'Forme en -ing' },
  de: { title: 'Englische Verbformen', help: 'Optional. Die Übersetzung oben ist die Grundform, zum Beispiel sleep.', present: 'Präsens (Grundform)', past: 'Einfache Vergangenheit', future: 'Zukunft mit will', pastParticiple: 'Partizip Perfekt', ing: '-ing-Form' },
  it: { title: 'Forme del verbo inglese', help: 'Facoltative. La traduzione sopra è la forma base, per esempio sleep.', present: 'Presente (forma base)', past: 'Passato semplice', future: 'Futuro con will', pastParticiple: 'Participio passato', ing: 'Forma in -ing' },
  pt: { title: 'Formas do verbo inglês', help: 'Opcionais. A tradução acima é a forma base, por exemplo sleep.', present: 'Presente (forma base)', past: 'Passado simples', future: 'Futuro com will', pastParticiple: 'Particípio passado', ing: 'Forma em -ing' },
  ja: { title: '英語の動詞の活用形', help: '任意。上の訳は sleep のような原形です。', present: '現在形（原形）', past: '過去形', future: '未来形（will）', pastParticiple: '過去分詞', ing: '-ing形' },
};
