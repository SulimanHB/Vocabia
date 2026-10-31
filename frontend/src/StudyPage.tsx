import { useState, type MouseEvent } from 'react';
import { getErrorMessage, type Word, type WordInput } from './model';
import { interfaceText } from './interfaceText';
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

  return <>
    <section className="study-page-intro" lang={referenceLanguage}>
      <p className="eyebrow">{nav.study}</p><h1>{nav.study}</h1><p>{nav.studyIntro}</p>
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
          <button type="button" className="secondary" onClick={() => setPractice(practice === null ? 'regular' : null)}>{practice === null ? regular.practice : regular.back}</button>
          {practice === null && <>
            <button type="button" className="secondary practice-difficult-button" disabled={difficultWords.length === 0} onClick={() => setPractice('difficult')}>{marks.retryDifficult} ({difficultWords.length})</button>
            <button type="button" className="secondary" onClick={() => setPractice('listening')}>{listeningStartText[referenceLanguage]}</button>
            <button type="button" className="secondary" onClick={() => setPractice('speaking')}>{speakingText[referenceLanguage].start}</button>
          </>}
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
