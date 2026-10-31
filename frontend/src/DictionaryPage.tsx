import { useState } from 'react';
import { getErrorMessage, request, type Collection, type Word, type WordInput } from './model';
import { interfaceText, formatText, type UiKey } from './interfaceText';
import { presentation } from './presentation';
import { StudyLanguages } from './StudyLanguages';
import { CollectionsPanel } from './CollectionsPanel';
import { FindMatches } from './FindMatches';
import { ImportPreview } from './ImportPreviewDialog';
import { WordCard } from './WordCard';
import { downloadExport } from './exportWords';

interface Props {
  referenceLanguage: WordInput['sourceLanguage'];
  studyLanguage: WordInput['targetLanguage'];
  selectedCollectionId: number | null;
  revision: number;
  words: Word[];
  loading: boolean;
  error: unknown;
  notice: UiKey | null;
  search: string;
  wordType: string;
  onStudyLanguageChange: (language: WordInput['targetLanguage']) => void;
  onCollectionChange: (id: number | null) => void;
  onRefresh: () => void;
  onSearchChange: (search: string) => void;
  onWordTypeChange: (wordType: string) => void;
  onNotice: (notice: UiKey | null) => void;
  onAddWord: () => void;
  onEditWord: (word: Word) => void;
  onDeleteWord: (word: Word) => void;
}

export function DictionaryPage({ referenceLanguage, studyLanguage, selectedCollectionId, revision, words, loading, error, notice,
  search, wordType, onStudyLanguageChange, onCollectionChange, onRefresh, onSearchChange, onWordTypeChange,
  onNotice, onAddWord, onEditWord, onDeleteWord }: Props) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [membershipError, setMembershipError] = useState<unknown>(null);
  const [membershipBusyId, setMembershipBusyId] = useState<number | null>(null);
  const ui = interfaceText[referenceLanguage];
  const text = presentation[referenceLanguage];
  const filtered = Boolean(search || wordType || selectedCollectionId !== null);

  async function exportCollection() {
    setExporting(true);
    setExportError(false);
    onNotice(null);
    try {
      const [allWords, allCollections] = await Promise.all([request<Word[]>('/words'), request<Collection[]>('/collections')]);
      downloadExport(allWords, allCollections);
      onNotice('wordsExported');
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  }

  async function removeFromCollection(wordId: number) {
    if (selectedCollectionId === null) return;
    setMembershipBusyId(wordId);
    setMembershipError(null);
    try {
      await request(`/collections/${selectedCollectionId}/words/${wordId}`, { method: 'DELETE' });
      onRefresh();
    } catch (cause) { setMembershipError(cause); }
    finally { setMembershipBusyId(null); }
  }

  return <>
    <section className="intro" lang={referenceLanguage}>
      <div><p className="eyebrow">{text.eyebrow}</p><h1>{text.title}<br /><em>{text.titleAccent}</em></h1><p className="intro-copy">{text.introduction}<br className="desktop-break" /> {text.invitation}</p></div>
      <div className="word-art" aria-hidden="true"><span className="art-small">{text.artCaption}</span><span className="art-word">hello<span>hola</span></span><span className="art-bottom">bonjour · ciao · hallo · olá</span></div>
    </section>
    <StudyLanguages referenceLanguage={referenceLanguage} studyLanguage={studyLanguage} onChange={onStudyLanguageChange} />
    <CollectionsPanel key={`${referenceLanguage}-${studyLanguage}`} referenceLanguage={referenceLanguage} studyLanguage={studyLanguage} selectedId={selectedCollectionId}
      revision={revision} onSelect={onCollectionChange} onMutation={onRefresh} />
    <FindMatches key={`matches-${referenceLanguage}-${studyLanguage}`} sourceLanguage={referenceLanguage} targetLanguage={studyLanguage} revision={revision} onMerged={onRefresh} />
    <section className="collection" aria-labelledby="collection-heading">
      <div className="collection-top">
        <div><div className="title-row"><h2 id="collection-heading">{ui.collection}</h2><span className="count">{loading ? '…' : words.length}</span></div><p>{ui.collectionHelp}</p></div>
        <div className="collection-actions">
          <button type="button" className="secondary" disabled={exporting} onClick={() => { void exportCollection(); }}>{exporting ? ui.exportingWords : ui.exportWords}</button>
          <ImportPreview language={referenceLanguage} onImported={onRefresh} />
          <button type="button" className="primary" onClick={onAddWord}><span aria-hidden="true">＋</span> {ui.addWord}</button>
        </div>
      </div>
      <div className="filters"><label className="search"><span aria-hidden="true">⌕</span><span className="sr-only">{ui.search}</span>
        <input type="search" value={search} maxLength={120} onChange={event => onSearchChange(event.target.value)} placeholder={ui.searchPlaceholder} /></label></div>
      <div className="type-filters" role="group" aria-label={ui.filterType}>
        <button type="button" aria-pressed={wordType === ''} onClick={() => onWordTypeChange('')}>{ui.allTypes}</button>
        {Object.entries(ui.wordTypeFilters).map(([code, name]) => <button key={code} className={`filter-${code}`} type="button" aria-pressed={wordType === code} onClick={() => onWordTypeChange(code)}>{name}</button>)}
      </div>
      <div className="results-line"><span>{loading ? ui.searching : formatText(words.length === 1 ? ui.resultOne : ui.resultMany, { count: words.length })}</span>
        {(search || wordType) && <button type="button" className="text-button" onClick={() => { onSearchChange(''); onWordTypeChange(''); }}>{ui.clearFilters}</button>}
        <span className="filter-help">{ui.filterHelp}</span>
      </div>
      <p className="notice" role="status">{notice ? formatText(ui[notice], { language: ui.languages[referenceLanguage] }) : ''}</p>
      {exportError && <p className="error" role="alert">{ui.exportError}</p>}
      {membershipError !== null && <p className="error" role="alert">{getErrorMessage(membershipError, ui)}</p>}
      {error !== null && <div className="error" role="alert">{getErrorMessage(error, ui)} <button type="button" className="text-button" onClick={onRefresh}>{ui.retry}</button></div>}
      {loading ? <div className="empty" role="status">{ui.preparing}</div> : error ? null : words.length === 0 ? <div className="empty">
        <h3>{filtered ? ui.noMatches : ui.emptyTitle}</h3><p>{filtered ? ui.noMatchesHelp : ui.emptyHelp}</p>
      </div> : <div className="word-grid">{words.map(word => <WordCard key={word.id} word={word} interfaceLanguage={referenceLanguage}
        inCollection={selectedCollectionId !== null} removing={membershipBusyId === word.id} onRemoveFromCollection={id => { void removeFromCollection(id); }}
        onEdit={onEditWord} onDelete={onDeleteWord} />)}</div>}
    </section>
  </>;
}
