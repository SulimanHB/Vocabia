import { LanguageFlag } from './LanguageFlag';
import { interfaceText, formatText } from './interfaceText';
import type { WordInput } from './model';

type Language = WordInput['sourceLanguage'];

export function StudyLanguages({ referenceLanguage, studyLanguage, onChange }: {
  referenceLanguage: Language;
  studyLanguage: Language;
  onChange: (language: Language) => void;
}) {
  const ui = interfaceText[referenceLanguage];
  const availableLanguages = (Object.keys(ui.languages) as Language[]).filter(code => code !== referenceLanguage);

  return <section className="study-languages" aria-labelledby="study-title">
    <div className="study-heading"><div><h2 id="study-title">{ui.studyTitle}</h2><p>{ui.studyHelp}</p></div>
      <p className="study-pair" role="status">{formatText(ui.studyPair, { source: ui.languages[referenceLanguage], target: ui.languages[studyLanguage] })}</p>
    </div>
    <div className="study-options" role="group" aria-label={ui.studyTitle}>
      {availableLanguages.map(code => <button key={code} type="button" className="study-option" aria-pressed={code === studyLanguage} onClick={() => onChange(code)}>
        <LanguageFlag language={code} /><span>{ui.languages[code]}</span>
      </button>)}
    </div>
  </section>;
}
