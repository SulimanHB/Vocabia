import { useId, useState, type MouseEvent } from 'react';
import { getErrorMessage, type Word, type WordInput } from './model';
import { formatText, interfaceText } from './interfaceText';
import { StudyLanguages } from './StudyLanguages';
import { StudyCollectionFilter } from './StudyCollectionFilter';
import { StudyMode, studyModeText } from './StudyMode';
import { ListeningExercise, listeningStartText } from './ListeningExercise';
import { SpeakingExercise, speakingText } from './SpeakingExercise';
import { StudyHistory } from './StudyHistory';
import { appNavigationText } from './appNavigationText';
import { studyMarkText } from './studyMarkText';

type Practice = 'regular' | 'difficult' | 'listening' | 'speaking' | null;

interface Props {
  referenceLanguage: WordInput['sourceLanguage'];
  studyLanguage: WordInput['targetLanguage'];
  selectedCollectionId: number | null;
  revision: number;
  words: Word[];
  loading: boolean;
  error: unknown;
  onStudyLanguageChange: (language: WordInput['targetLanguage']) => void;
  onCollectionChange: (id: number | null) => void;
  onRetry: () => void;
  onGoDictionary: (event: MouseEvent<HTMLAnchorElement>) => void;
  onMark: (wordId: number, mark: 'known' | 'difficult') => void;
}

export function StudyPage({ referenceLanguage, studyLanguage, selectedCollectionId, revision, words, loading, error,
  onStudyLanguageChange, onCollectionChange, onRetry, onGoDictionary, onMark }: Props) {
  const [practice, setPractice] = useState<Practice>(null);
  const ui = interfaceText[referenceLanguage];
  const nav = appNavigationText[referenceLanguage];
  const regular = studyModeText[referenceLanguage];
  const marks = studyMarkText[referenceLanguage];
  const difficultWords = words.filter(word => word.studyMark === 'difficult');
  const hintId = useId();

  return <>
    <section className="study-page-intro" lang={referenceLanguage}>
      <h1>{nav.study}</h1><p>{nav.studyIntro}</p>
    </section>
    <StudyLanguages referenceLanguage={referenceLanguage} studyLanguage={studyLanguage} onChange={onStudyLanguageChange} />
    <StudyCollectionFilter referenceLanguage={referenceLanguage} studyLanguage={studyLanguage} selectedId={selectedCollectionId} revision={revision}
      onSelect={id => { onCollectionChange(id); setPractice(null); }} />
    <section className="study-page-content" aria-label={nav.study}>
      <div className="study-page-heading"><h2>{nav.available}: {loading ? '…' : words.length}</h2></div>
      {error !== null && <div className="error" role="alert">{getErrorMessage(error, ui)} <button type="button" className="text-button" onClick={onRetry}>{ui.retry}</button></div>}
      {loading ? <div className="empty" role="status">{ui.preparing}</div> : error ? null : words.length === 0 ? <div className="empty">
        <h3>{nav.empty}</h3><p>{nav.emptyHelp}</p><a href="/" className="secondary study-dictionary-link" onClick={onGoDictionary}>{nav.goDictionary}</a>
      </div> : <>
        <div className="practice-toggle">
          {practice === null ? <>
            <button type="button" className="primary" onClick={() => setPractice('regular')}>{regular.practice} ({words.length})</button>
            <ul className="practice-options">
              <li>
                <button type="button" className="secondary practice-difficult-button" disabled={difficultWords.length === 0}
                  aria-describedby={`${hintId}-difficult`} onClick={() => setPractice('difficult')}>{marks.retryDifficult} ({difficultWords.length})</button>
                <p id={`${hintId}-difficult`}>{formatText(difficultWords.length ? nav.difficultHint : nav.difficultEmpty, { mark: marks.difficult })}</p>
              </li>
              <li>
                <button type="button" className="secondary" aria-describedby={`${hintId}-listening`} onClick={() => setPractice('listening')}>{listeningStartText[referenceLanguage]}</button>
                <p id={`${hintId}-listening`}>{nav.listeningHint}</p>
              </li>
              <li>
                <button type="button" className="secondary" aria-describedby={`${hintId}-speaking`} onClick={() => setPractice('speaking')}>{speakingText[referenceLanguage].start}</button>
                <p id={`${hintId}-speaking`}>{speakingText[referenceLanguage].help}</p>
              </li>
            </ul>
          </> : <button type="button" className="secondary" onClick={() => setPractice(null)}>{regular.back}</button>}
        </div>
        {practice === 'listening' && <ListeningExercise words={words} language={referenceLanguage} studyLanguage={studyLanguage} />}
        {practice === 'speaking' && <SpeakingExercise words={words} language={referenceLanguage} studyLanguage={studyLanguage} />}
        {(practice === 'regular' || practice === 'difficult') && <StudyMode words={practice === 'difficult' ? difficultWords : words}
          language={referenceLanguage} studyLanguage={studyLanguage} difficultOnly={practice === 'difficult'} onMark={onMark} onNoWords={() => setPractice(null)} />}
      </>}
      {practice === null && <StudyHistory sourceLanguage={referenceLanguage} targetLanguage={studyLanguage} revision={revision} />}
    </section>
  </>;
}
