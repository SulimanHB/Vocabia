import type { ReactNode } from 'react';
import type { WordInput } from './model';

// Símbolos visuales del selector. El nombre del idioma siempre acompaña a la bandera.
const flags: Record<WordInput['targetLanguage'], ReactNode> = {
  es: <><path fill="#aa151b" d="M0 0h30v20H0z" /><path fill="#f1bf00" d="M0 5h30v10H0z" /><path fill="#aa151b" d="M7 8h4v5H7z" /><path fill="#f5e5ab" d="M8 8h2v2H8z" /></>,
  en: <><path fill="#012169" d="M0 0h30v20H0z" /><path stroke="#fff" strokeWidth="5" d="m0 0 30 20M30 0 0 20" /><path stroke="#c8102e" strokeWidth="2" d="m0 0 30 20M30 0 0 20" /><path stroke="#fff" strokeWidth="7" d="M15 0v20M0 10h30" /><path stroke="#c8102e" strokeWidth="4" d="M15 0v20M0 10h30" /></>,
  fr: <><path fill="#fff" d="M0 0h30v20H0z" /><path fill="#002654" d="M0 0h10v20H0z" /><path fill="#ed2939" d="M20 0h10v20H20z" /></>,
  de: <><path fill="#000" d="M0 0h30v20H0z" /><path fill="#d00" d="M0 6.67h30v6.67H0z" /><path fill="#ffce00" d="M0 13.33h30V20H0z" /></>,
  it: <><path fill="#fff" d="M0 0h30v20H0z" /><path fill="#009246" d="M0 0h10v20H0z" /><path fill="#ce2b37" d="M20 0h10v20H20z" /></>,
  pt: <><path fill="#f00" d="M0 0h30v20H0z" /><path fill="#006600" d="M0 0h12v20H0z" /><circle cx="12" cy="10" r="4" fill="#ffcc00" /><path fill="#fff" stroke="#c00" strokeWidth="1.5" d="M10 7h4v4a2 2 0 0 1-4 0z" /></>,
  ja: <><path fill="#fff" d="M0 0h30v20H0z" /><circle fill="#bc002d" cx="15" cy="10" r="6" /></>,
};

export function LanguageFlag({ language }: { language: WordInput['targetLanguage'] }) {
  return <svg className="language-flag" viewBox="0 0 30 20" aria-hidden="true" focusable="false" data-language={language}>{flags[language]}</svg>;
}
