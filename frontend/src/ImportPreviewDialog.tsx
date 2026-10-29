import { useRef, useState, type ChangeEvent } from 'react';
import { formatText, interfaceText } from './interfaceText';
import { ImportPreviewError, maxImportBytes, parseImportPreview, type ImportDocument } from './importPreview';
import { importText } from './importText';
import { request, type Collection, type Word, type WordInput } from './model';
import { compareImport, type ImportComparison } from './compareImport';
import { importActionText } from './importActionText';

interface ImportResult { createdCollections: number; reusedCollections: number; createdWords: number; skippedWords: number }

export function ImportPreview({ language, onImported }: { language: WordInput['sourceLanguage']; onImported: () => void }) {
  const copy = importText[language];
  const actions = importActionText[language];
  const ui = interfaceText[language];
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const readId = useRef(0);
  const comparisonRequest = useRef<AbortController | null>(null);
  const [preview, setPreview] = useState<ImportDocument | null>(null);
  const [fileName, setFileName] = useState('');
  const [reading, setReading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [comparisonError, setComparisonError] = useState(false);
  const [comparison, setComparison] = useState<ImportComparison | null>(null);
  const [mode, setMode] = useState<'skipMatches' | 'includeMatches'>('includeMatches');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<keyof Pick<typeof copy, 'tooLarge' | 'invalidJson' | 'invalidFormat' | 'invalidData' | 'readError'> | null>(null);

  function reset() {
    readId.current += 1;
    comparisonRequest.current?.abort();
    setPreview(null);
    setFileName('');
    setReading(false);
    setComparing(false);
    setComparison(null);
    setComparisonError(false);
    setMode('includeMatches');
    setSaving(false);
    setSaveError(false);
    setResult(null);
    setError(null);
    if (input.current) input.current.value = '';
  }

  async function compareWithCurrent(document: ImportDocument, currentRead: number) {
    comparisonRequest.current?.abort();
    const controller = new AbortController();
    comparisonRequest.current = controller;
    setComparing(true);
    setComparisonError(false);
    setComparison(null);
    try {
      const [words, collections] = await Promise.all([
        request<Word[]>('/words', { signal: controller.signal }),
        request<Collection[]>('/collections', { signal: controller.signal }),
      ]);
      if (currentRead === readId.current && !controller.signal.aborted) setComparison(compareImport(document, words, collections));
    } catch {
      if (currentRead === readId.current && !controller.signal.aborted) setComparisonError(true);
    } finally {
      if (currentRead === readId.current && !controller.signal.aborted) setComparing(false);
    }
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const currentRead = ++readId.current;
    comparisonRequest.current?.abort();
    setPreview(null);
    setComparison(null);
    setComparisonError(false);
    setComparing(false);
    setSaveError(false);
    setResult(null);
    setError(null);
    setFileName(file?.name ?? '');
    if (!file) return;
    if (file.size > maxImportBytes) { setError('tooLarge'); return; }
    setReading(true);
    try {
      const document = parseImportPreview(await file.text());
      if (currentRead === readId.current) {
        setPreview(document);
        void compareWithCurrent(document, currentRead);
      }
    } catch (cause) {
      if (currentRead === readId.current) setError(cause instanceof ImportPreviewError ? cause.code : 'readError');
    } finally {
      if (currentRead === readId.current) setReading(false);
    }
  }

  async function saveImport() {
    if (!preview || !comparison || saving || result) return;
    setSaving(true);
    setSaveError(false);
    try {
      const saved = await request<ImportResult>('/import', {
        method: 'POST', body: JSON.stringify({ mode, document: preview }),
      });
      setResult(saved);
      onImported();
    } catch { setSaveError(true); }
    finally { setSaving(false); }
  }

  return <>
    <button type="button" className="secondary" aria-haspopup="dialog" onClick={() => { reset(); dialog.current?.showModal(); }}>{copy.open}</button>
    <dialog ref={dialog} className="import-dialog" aria-labelledby="import-title" onClose={reset} onCancel={event => { if (saving) event.preventDefault(); }}>
      <div className="dialog-heading"><h2 id="import-title">{copy.title}</h2><button type="button" className="close-button" disabled={saving} aria-label={ui.closeForm} onClick={() => dialog.current?.close()}>×</button></div>
      <p className="form-help">{copy.help}</p>
      <label className="import-file-label">{copy.choose}<input ref={input} type="file" disabled={saving} accept=".json,application/json" onChange={event => void chooseFile(event)} /></label>
      {reading && <p className="import-status" role="status">{copy.reading}</p>}
      {error && <p className="error" role="alert">{copy[error]}</p>}
      {preview && <div className="import-preview">
        <p className="import-file-name">{fileName}</p>
        {comparing && <p className="import-status" role="status">{copy.comparing}</p>}
        {comparisonError && <p className="error" role="alert">{copy.comparisonError} <button type="button" className="text-button" onClick={() => void compareWithCurrent(preview, readId.current)}>{ui.retry}</button></p>}
        {comparison && <div className="import-comparison" role="region" aria-label={copy.comparisonTitle}>
          <h3>{copy.comparisonTitle}</h3>
          <p>{copy.newCollections}: <strong>{comparison.newCollections}</strong> · {copy.existingCollections}: <strong>{comparison.existingCollections}</strong></p>
          <p>{copy.unmatchedWords}: <strong>{comparison.unmatchedWords}</strong> · {copy.possibleWords}: <strong>{comparison.possibleWords}</strong></p>
          <p className="import-comparison-help">{copy.comparisonRule}</p>
        </div>}
        <div className="import-preview-grid">
          <section aria-label={copy.collections}><h3>{copy.collections} <span>{preview.collections.length}</span></h3>
            {preview.collections.length ? <ul>{preview.collections.slice(0, 5).map((collection, index) => <li key={index}>{collection.name} · {ui.languages[collection.sourceLanguage]} → {ui.languages[collection.targetLanguage]} {comparison && <span className="import-match">{comparison.collectionMatches[index] ? copy.existingCollection : copy.newCollection}</span>}</li>)}</ul> : <p>{copy.empty}</p>}
            {preview.collections.length > 5 && <p>{formatText(copy.more, { count: preview.collections.length - 5 })}</p>}
          </section>
          <section aria-label={copy.words}><h3>{copy.words} <span>{preview.words.length}</span></h3>
            {preview.words.length ? <ul>{preview.words.slice(0, 5).map((word, index) => <li key={index} lang={word.sourceLanguage}>{word.term} → <span lang={word.targetLanguage}>{word.translation}</span> {comparison && <span className="import-match">{comparison.wordMatches[index] ? copy.possibleMatch : copy.noMatch}</span>}</li>)}</ul> : <p>{copy.empty}</p>}
            {preview.words.length > 5 && <p>{formatText(copy.more, { count: preview.words.length - 5 })}</p>}
          </section>
        </div>
        {comparison && !result && <fieldset className="import-choice" disabled={saving}>
          <legend>{actions.choice}</legend>
          <label><input type="radio" name="import-mode" checked={mode === 'skipMatches'} onChange={() => setMode('skipMatches')} />{actions.skip}</label>
          <label><input type="radio" name="import-mode" checked={mode === 'includeMatches'} onChange={() => setMode('includeMatches')} />{actions.include}</label>
          <p>{mode === 'skipMatches' ? actions.skipHelp : actions.includeHelp}</p>
        </fieldset>}
      </div>}
      {result ? <div className="import-saved" role="status"><h3>{actions.saved}</h3><p>{actions.createdCollections}: {result.createdCollections} · {actions.reusedCollections}: {result.reusedCollections}</p><p>{actions.createdWords}: {result.createdWords} · {actions.skippedWords}: {result.skippedWords}</p></div> : !saveError && <p className="import-warning">{copy.previewOnly}</p>}
      {saveError && <p className="error" role="alert">{actions.failed}</p>}
      <div className="form-actions"><button type="button" className="secondary" disabled={saving} onClick={() => dialog.current?.close()}>{ui.done}</button>{comparison && !result && <button type="button" className="primary" disabled={saving || saveError} onClick={() => void saveImport()}>{saving ? actions.saving : actions.confirm}</button>}</div>
    </dialog>
  </>;
}
