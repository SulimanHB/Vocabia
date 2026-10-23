import { useEffect, useRef, useState } from 'react';
import { languages, wordTypes, request, getErrorMessage, type Word, type WordInput } from './model';
import { WordForm } from './WordForm';
import { LanguageFlag } from './LanguageFlag';
import { presentation } from './presentation';
import { interfaceText, formatText, type UiKey } from './interfaceText';
import { StudyLanguages } from './StudyLanguages';

const referenceLanguageKey = 'vocabia.referenceLanguage';
const studyLanguageKey = 'vocabia.studyLanguage';

function readLanguagePreference(key: string, fallback: WordInput['targetLanguage']): WordInput['targetLanguage'] {
  try {
    const saved = localStorage.getItem(key);
    if (saved && Object.hasOwn(languages, saved)) return saved as WordInput['targetLanguage'];
  } catch {
    // Algunos navegadores bloquean el almacenamiento. La aplicación puede seguir usándose.
  }
  return fallback;
}

export function App() {
  const [referenceLanguage, setReferenceLanguage] = useState(() => readLanguagePreference(referenceLanguageKey, 'es'));
  const [studyLanguage, setStudyLanguage] = useState(() => {
    const saved = readLanguagePreference(studyLanguageKey, 'en');
    return saved === referenceLanguage ? (referenceLanguage === 'en' ? 'es' : 'en') : saved;
  });
  const text = presentation[referenceLanguage];
  const ui = interfaceText[referenceLanguage];
  const [words, setWords] = useState<Word[]>([]);
  const [search, setSearch] = useState('');
  const [wordType, setWordType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<UiKey | null>(null);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<Word | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleting, setDeleting] = useState<Word | null>(null);
  const [busy, setBusy] = useState(false);
  const editor = useRef<HTMLDialogElement>(null);
  const confirmation = useRef<HTMLDialogElement>(null);
  const languageSettings = useRef<HTMLDialogElement>(null);
  // Evita mostrar resultados de la selección anterior mientras llega la nueva respuesta.
  const visibleWords = words.filter(word => word.sourceLanguage === referenceLanguage && word.targetLanguage === studyLanguage && (!wordType || word.wordType === wordType));

  function changeReferenceLanguage(value: WordInput['targetLanguage']) {
    const nextStudyLanguage = studyLanguage === value ? (value === 'en' ? 'es' : 'en') : studyLanguage;
    setReferenceLanguage(value);
    setStudyLanguage(nextStudyLanguage);
    try {
      localStorage.setItem(referenceLanguageKey, value);
      localStorage.setItem(studyLanguageKey, nextStudyLanguage);
      setNotice('languageChanged');
    } catch {
      setNotice('storageBlocked');
    }
  }

  function changeStudyLanguage(value: WordInput['targetLanguage']) {
    if (value === referenceLanguage) return;
    setStudyLanguage(value);
    try {
      localStorage.setItem(studyLanguageKey, value);
    } catch {
      setNotice('storageBlocked');
    }
  }

  useEffect(() => {
    document.documentElement.lang = referenceLanguage;
    document.title = `Vocabia · ${ui.collection}`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', text.tagline);
  }, [referenceLanguage, ui.collection, text.tagline]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ search, sourceLanguage: referenceLanguage, targetLanguage: studyLanguage });
      if (wordType) params.set('wordType', wordType);
      request<Word[]>(`/words?${params}`, { signal: controller.signal })
        .then(data => { if (!controller.signal.aborted) setWords(data); })
        .catch(cause => { if (!controller.signal.aborted) setError(cause); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [search, referenceLanguage, studyLanguage, wordType, revision]);

  function openEditor(word: Word | null) { setEditing(word); setEditorOpen(true); editor.current?.showModal(); }
  async function save(word: WordInput) {
    setBusy(true);
    try {
      await request(`/words${editing ? `/${editing.id}` : ''}`, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(word) });
      editor.current?.close();
      setNotice(editing ? 'wordUpdated' : 'wordAdded');
      setRevision(value => value + 1);
    } finally { setBusy(false); }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await request(`/words/${deleting.id}`, { method: 'DELETE' });
      setWords(current => current.filter(word => word.id !== deleting.id));
      setNotice('wordDeleted');
      setRevision(value => value + 1);
      confirmation.current?.close();
    } catch (cause) { setError(cause); confirmation.current?.close(); }
    finally { setBusy(false); }
  }

  return <>
    <header className="topbar"><a className="brand" href="/" aria-label={ui.home}><span className="brand-mark" aria-hidden="true">v.</span>vocabia<span className="brand-dot">.</span></a><span className="top-caption" lang={referenceLanguage}>{text.tagline}</span><span className="personal-badge" lang={referenceLanguage}>{text.personalSpace}</span></header>
    <main>
      <section className="intro" lang={referenceLanguage}><div><p className="eyebrow">{text.eyebrow}</p><h1>{text.title}<br /><em>{text.titleAccent}</em></h1><p className="intro-copy">{text.introduction}<br className="desktop-break" /> {text.invitation}</p></div><div className="word-art" aria-hidden="true"><span className="art-small">{text.artCaption}</span><span className="art-word">hello<span>hola</span></span><span className="art-bottom">bonjour · ciao · hallo · olá</span></div></section>
      <StudyLanguages referenceLanguage={referenceLanguage} studyLanguage={studyLanguage} onChange={changeStudyLanguage} />
      <section className="collection" aria-labelledby="collection-heading">
        <div className="collection-top"><div><div className="title-row"><h2 id="collection-heading">{ui.collection}</h2><span className="count">{loading ? '…' : visibleWords.length}</span></div><p>{ui.collectionHelp}</p></div><button className="primary" onClick={() => openEditor(null)}><span aria-hidden="true">＋</span> {ui.addWord}</button></div>
        <div className="filters"><label className="search"><span aria-hidden="true">⌕</span><span className="sr-only">{ui.search}</span><input type="search" value={search} maxLength={120} onChange={e => setSearch(e.target.value)} placeholder={ui.searchPlaceholder} /></label></div>
        <div className="type-filters" role="group" aria-label={ui.filterType}>
          <button type="button" aria-pressed={wordType === ''} onClick={() => setWordType('')}>{ui.allTypes}</button>
          {Object.entries(ui.wordTypeFilters).map(([code, name]) => <button key={code} type="button" aria-pressed={wordType === code} onClick={() => setWordType(code)}>{name}</button>)}
        </div>
        <div className="results-line"><span>{loading ? ui.searching : formatText(visibleWords.length === 1 ? ui.resultOne : ui.resultMany, { count: visibleWords.length })}</span>{(search || wordType) && <button className="text-button" onClick={() => { setSearch(''); setWordType(''); }}>{ui.clearFilters}</button>}<span className="filter-help">{ui.filterHelp}</span></div>
        <p className="notice" role="status">{notice ? formatText(ui[notice], { language: ui.languages[referenceLanguage] }) : ''}</p>
        {error !== null && <div className="error" role="alert">{getErrorMessage(error, ui)} <button className="text-button" onClick={() => setRevision(value => value + 1)}>{ui.retry}</button></div>}
        {loading ? <div className="empty" role="status">{ui.preparing}</div> : error ? null : visibleWords.length === 0 ? <div className="empty"><h3>{search || wordType ? ui.noMatches : ui.emptyTitle}</h3><p>{search || wordType ? ui.noMatchesHelp : ui.emptyHelp}</p></div> : <div className="word-grid">{visibleWords.map(word => <article className="word-card" key={word.id} lang="es">
          <div className="card-top"><span className={`type-tag type-${word.wordType}`}>{wordTypes[word.wordType]}</span><span className="language-pair">{languages[word.sourceLanguage]} <span aria-hidden="true">→</span><span className="sr-only">a</span> {languages[word.targetLanguage]}</span></div>
          <h3 lang={word.sourceLanguage}>{word.term}</h3><p className="translation" lang={word.targetLanguage}>{word.translation}</p>
          <div className="sentences">{word.examples.map((example, index) => <blockquote key={index} lang={word.sourceLanguage}>{example}</blockquote>)}</div>
          {word.notes && <p className="notes">{word.notes}</p>}
          <div className="card-actions"><button onClick={() => openEditor(word)} aria-label={`Editar ${word.term}`}>Editar</button><button className="delete" onClick={() => { setDeleting(word); confirmation.current?.showModal(); }} aria-label={`Borrar ${word.term}`}>Borrar</button></div>
        </article>)}</div>}
      </section>
      <footer lang={referenceLanguage}><span>vocabia · {text.footer}</span><span>{text.footerMessage}</span></footer>
    </main>
    <button className="language-button" aria-label={formatText(ui.myLanguage, { language: ui.languages[referenceLanguage] })} title={ui.changeLanguage} aria-haspopup="dialog" onClick={() => languageSettings.current?.showModal()}><LanguageFlag language={referenceLanguage} /><span>{ui.languages[referenceLanguage]}</span></button>
    <dialog ref={editor} aria-labelledby="editor-title" onCancel={event => { if (busy) event.preventDefault(); }} onClose={() => { setEditing(null); setEditorOpen(false); }}>
      <div className="dialog-heading"><h2 id="editor-title">{editing ? ui.editTitle : ui.newTitle}</h2><button className="close-button" aria-label={ui.closeForm} disabled={busy} onClick={() => editor.current?.close()}>×</button></div>
      {editorOpen && <WordForm key={editing?.id ?? `new-${revision}`} initial={editing ?? undefined} referenceLanguage={referenceLanguage} studyLanguage={studyLanguage} busy={busy} onSave={save} onCancel={() => editor.current?.close()} />}
    </dialog>
    <dialog ref={languageSettings} className="language-dialog" aria-labelledby="language-title" aria-describedby="language-description">
      <div className="dialog-heading"><h2 id="language-title">{ui.languageTitle}</h2><button className="close-button" aria-label={ui.closeLanguage} onClick={() => languageSettings.current?.close()}>×</button></div>
      <p id="language-description" className="form-help">{ui.languageDescription}</p>
      <label className="language-label">{ui.referenceLanguage}<select autoFocus value={referenceLanguage} onChange={event => changeReferenceLanguage(event.target.value as WordInput['targetLanguage'])}>{Object.entries(ui.languages).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
      <p className="form-help">{ui.languageHelp}</p>
      <div className="form-actions"><button className="primary" onClick={() => languageSettings.current?.close()}>{ui.done}</button></div>
    </dialog>
    <dialog ref={confirmation} className="confirm-dialog" aria-labelledby="delete-title" onCancel={event => { if (busy) event.preventDefault(); }}><h2 id="delete-title">{ui.deleteTitle}</h2><p>{formatText(ui.deleteDescription, { term: deleting?.term ?? '' })}</p><div className="form-actions"><button className="secondary" disabled={busy} onClick={() => confirmation.current?.close()}>{ui.keep}</button><button className="danger" disabled={busy} onClick={() => void remove()}>{busy ? ui.deleting : ui.deleteWord}</button></div></dialog>
  </>;
}
