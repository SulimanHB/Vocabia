import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { languages, request, type Word, type WordInput } from './model';
import { WordForm } from './WordForm';
import { LanguageFlag } from './LanguageFlag';
import { presentation } from './presentation';
import { interfaceText, formatText, type UiKey } from './interfaceText';
import { DictionaryPage } from './DictionaryPage';
import { StudyPage } from './StudyPage';
import { appNavigationText } from './appNavigationText';

const referenceLanguageKey = 'vocabia.referenceLanguage';
const studyLanguageKey = 'vocabia.studyLanguage';
type AppView = 'dictionary' | 'study';
const readView = (): AppView => window.location.pathname === '/estudio' ? 'study' : 'dictionary';

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
  const [view, setView] = useState<AppView>(readView);
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
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
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
  const visibleWords = words.filter(word => word.sourceLanguage === referenceLanguage && word.targetLanguage === studyLanguage && (view === 'study' || !wordType || word.wordType === wordType) && (selectedCollectionId === null || word.collectionIds?.includes(selectedCollectionId)));
  const navCopy = appNavigationText[referenceLanguage];

  function navigate(next: AppView) {
    if (view === next) return;
    window.history.pushState(null, '', next === 'study' ? '/estudio' : '/');
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    setLoading(true);
    setView(next);
  }

  function followInternalLink(event: MouseEvent<HTMLAnchorElement>, next: AppView) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(next);
  }

  useEffect(() => {
    const onPopState = () => { setLoading(true); setView(readView()); };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  function changeReferenceLanguage(value: WordInput['targetLanguage']) {
    const nextStudyLanguage = studyLanguage === value ? (value === 'en' ? 'es' : 'en') : studyLanguage;
    setReferenceLanguage(value);
    setStudyLanguage(nextStudyLanguage);
    setSelectedCollectionId(null);
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
    setSelectedCollectionId(null);
    try {
      localStorage.setItem(studyLanguageKey, value);
    } catch {
      setNotice('storageBlocked');
    }
  }

  useEffect(() => {
    document.documentElement.lang = referenceLanguage;
    document.title = `Vocabia · ${view === 'study' ? navCopy.study : navCopy.dictionary}`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', text.tagline);
  }, [referenceLanguage, view, navCopy.study, navCopy.dictionary, text.tagline]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ search: view === 'dictionary' ? search : '', sourceLanguage: referenceLanguage, targetLanguage: studyLanguage });
      if (view === 'dictionary' && wordType) params.set('wordType', wordType);
      if (selectedCollectionId !== null) params.set('collectionId', String(selectedCollectionId));
      request<Word[]>(`/words?${params}`, { signal: controller.signal })
        .then(data => { if (!controller.signal.aborted) setWords(data); })
        .catch(cause => { if (!controller.signal.aborted) setError(cause); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [view, search, referenceLanguage, studyLanguage, wordType, selectedCollectionId, revision]);

  function openEditor(word: Word | null) { setEditing(word); setEditorOpen(true); editor.current?.showModal(); }
  async function save(word: WordInput) {
    setBusy(true);
    try {
      const collectionId = !editing && word.sourceLanguage === referenceLanguage && word.targetLanguage === studyLanguage
        ? selectedCollectionId : null;
      const path = editing ? `/words/${editing.id}` : `/words${collectionId === null ? '' : `?collectionId=${collectionId}`}`;
      await request(path, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(word) });
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
    <header className="topbar"><a className="brand" href="/" aria-label={ui.home} onClick={event => followInternalLink(event, 'dictionary')}><span className="brand-mark" aria-hidden="true">v.</span>vocabia<span className="brand-dot">.</span></a><span className="top-caption" lang={referenceLanguage}>{text.tagline}</span><nav className="app-nav" aria-label={navCopy.nav}><a href="/" aria-current={view === 'dictionary' ? 'page' : undefined} onClick={event => followInternalLink(event, 'dictionary')}>{navCopy.dictionary}</a><a href="/estudio" aria-current={view === 'study' ? 'page' : undefined} onClick={event => followInternalLink(event, 'study')}>{navCopy.study}</a></nav><span className="personal-badge" lang={referenceLanguage}>{text.personalSpace}</span></header>
    <main>
      {view === 'dictionary' ? <DictionaryPage referenceLanguage={referenceLanguage} studyLanguage={studyLanguage}
        selectedCollectionId={selectedCollectionId} revision={revision} words={visibleWords} loading={loading} error={error} notice={notice}
        search={search} wordType={wordType}
        onStudyLanguageChange={changeStudyLanguage} onCollectionChange={setSelectedCollectionId} onRefresh={() => setRevision(value => value + 1)}
        onSearchChange={setSearch} onWordTypeChange={setWordType} onNotice={setNotice} onAddWord={() => openEditor(null)} onEditWord={openEditor}
        onDeleteWord={selected => { setDeleting(selected); confirmation.current?.showModal(); }} /> : <StudyPage key={`${referenceLanguage}-${studyLanguage}`} referenceLanguage={referenceLanguage} studyLanguage={studyLanguage}
        selectedCollectionId={selectedCollectionId} revision={revision} words={visibleWords} loading={loading} error={error}
        onStudyLanguageChange={changeStudyLanguage} onCollectionChange={setSelectedCollectionId} onRetry={() => setRevision(value => value + 1)}
        onGoDictionary={event => followInternalLink(event, 'dictionary')}
        onMark={(wordId, mark) => setWords(current => current.map(word => word.id === wordId ? { ...word, studyMark: mark } : word))} />}
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
