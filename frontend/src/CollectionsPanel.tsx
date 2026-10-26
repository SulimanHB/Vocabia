import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getErrorMessage, request, type Collection, type Word, type WordInput } from './model';
import { interfaceText } from './interfaceText';
import { collectionsText } from './collectionsText';

interface Props {
  referenceLanguage: WordInput['sourceLanguage'];
  studyLanguage: WordInput['targetLanguage'];
  selectedId: number | null;
  revision: number;
  onSelect: (id: number | null) => void;
  onMutation: () => void;
}

export function CollectionsPanel({ referenceLanguage, studyLanguage, selectedId, revision, onSelect, onMutation }: Props) {
  const copy = collectionsText[referenceLanguage];
  const ui = interfaceText[referenceLanguage];
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState<Word[]>([]);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [chosenWordId, setChosenWordId] = useState('');
  const addDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const selected = collections.find(collection => collection.id === selectedId);
  const choices = available.filter(word => !word.collectionIds?.includes(selectedId ?? -1));

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ sourceLanguage: referenceLanguage, targetLanguage: studyLanguage });
    request<Collection[]>(`/collections?${params}`, { signal: controller.signal })
      .then(data => {
        if (controller.signal.aborted) return;
        setCollections(data);
        if (selectedId !== null && !data.some(collection => collection.id === selectedId)) onSelect(null);
      })
      .catch(cause => { if (!controller.signal.aborted) setError(cause); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [referenceLanguage, studyLanguage, revision, selectedId, onSelect]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      const created = await request<Collection>('/collections', {
        method: 'POST', body: JSON.stringify({ name, sourceLanguage: referenceLanguage, targetLanguage: studyLanguage }),
      });
      setName('');
      setCreating(false);
      setCollections(current => [...current, created]);
      onSelect(created.id);
      onMutation();
    } catch (cause) { setActionError(cause); }
    finally { setBusy(false); }
  }

  async function openAddDialog() {
    if (selectedId === null) return;
    setActionError(null);
    setAvailable([]);
    setChosenWordId('');
    setAvailableLoading(true);
    addDialog.current?.showModal();
    const params = new URLSearchParams({ sourceLanguage: referenceLanguage, targetLanguage: studyLanguage });
    try {
      const data = await request<Word[]>(`/words?${params}`);
      setAvailable(data);
      const first = data.find(word => !word.collectionIds?.includes(selectedId));
      setChosenWordId(first ? String(first.id) : '');
    } catch (cause) { setActionError(cause); }
    finally { setAvailableLoading(false); }
  }

  async function addWord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedId === null || !chosenWordId) return;
    setBusy(true);
    setActionError(null);
    try {
      await request(`/collections/${selectedId}/words/${chosenWordId}`, { method: 'POST' });
      addDialog.current?.close();
      onMutation();
    } catch (cause) { setActionError(cause); }
    finally { setBusy(false); }
  }

  async function deleteCollection() {
    if (selectedId === null) return;
    setBusy(true);
    setActionError(null);
    try {
      await request(`/collections/${selectedId}`, { method: 'DELETE' });
      deleteDialog.current?.close();
      onSelect(null);
      onMutation();
    } catch (cause) { setActionError(cause); }
    finally { setBusy(false); }
  }

  return <section className="collections-panel" aria-label={copy.title}>
    <div className="collections-heading"><div><h2>{copy.title}</h2><p>{copy.help}</p></div><button type="button" className="secondary" onClick={() => { setCreating(value => !value); setActionError(null); }}>{copy.newCollection}</button></div>
    {creating && <form className="collection-create" onSubmit={event => void create(event)}>
      <label>{copy.name}<input autoFocus required maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label>
      <button className="primary" disabled={busy || !name.trim()}>{copy.create}</button>
      <button type="button" className="secondary" onClick={() => setCreating(false)}>{ui.cancel}</button>
    </form>}
    {loading && <p className="collection-loading" role="status">{copy.loading}</p>}
    {error !== null && <p className="error" role="alert">{getErrorMessage(error, ui)} <button type="button" className="text-button" onClick={() => onMutation()}>{ui.retry}</button></p>}
    {actionError !== null && !addDialog.current?.open && !deleteDialog.current?.open && <p className="error" role="alert">{getErrorMessage(actionError, ui)}</p>}
    <div className="collection-tabs" role="group" aria-label={copy.title}>
      <button type="button" aria-pressed={selectedId === null} onClick={() => onSelect(null)}>{copy.all}</button>
      {collections.map(collection => <button type="button" key={collection.id} aria-pressed={selectedId === collection.id} onClick={() => onSelect(collection.id)}>{collection.name} <span>{collection.wordCount}</span></button>)}
    </div>
    {selected && <div className="collection-tools"><button type="button" className="secondary" onClick={() => void openAddDialog()}>{copy.addExisting}</button><button type="button" className="text-button" onClick={() => { setActionError(null); deleteDialog.current?.showModal(); }}>{copy.deleteCollection}</button></div>}
    <dialog ref={addDialog} className="collection-dialog" aria-labelledby="add-to-collection-title" onCancel={event => { if (busy) event.preventDefault(); }}>
      <h2 id="add-to-collection-title">{copy.addExisting}: {selected?.name}</h2>
      {availableLoading ? <p className="form-help">{ui.searching}</p> : choices.length === 0 ? <p className="form-help">{copy.noAvailable}</p> : <form onSubmit={event => void addWord(event)}>
        <label>{copy.chooseWord}<select value={chosenWordId} onChange={event => setChosenWordId(event.target.value)}>{choices.map(word => <option value={word.id} key={word.id}>{word.term} → {word.translation}</option>)}</select></label>
        <div className="form-actions"><button type="button" className="secondary" disabled={busy} onClick={() => addDialog.current?.close()}>{ui.cancel}</button><button className="primary" disabled={busy || !chosenWordId}>{copy.add}</button></div>
      </form>}
      {(availableLoading || choices.length === 0) && <div className="form-actions"><button type="button" className="secondary" onClick={() => addDialog.current?.close()}>{ui.done}</button></div>}
      {actionError !== null && <p className="error" role="alert">{getErrorMessage(actionError, ui)}</p>}
    </dialog>
    <dialog ref={deleteDialog} className="confirm-dialog" aria-labelledby="delete-collection-title" onCancel={event => { if (busy) event.preventDefault(); }}>
      <h2 id="delete-collection-title">{copy.deleteTitle}</h2><p>{copy.deleteDescription}</p>
      {actionError !== null && <p className="error" role="alert">{getErrorMessage(actionError, ui)}</p>}
      <div className="form-actions"><button type="button" className="secondary" disabled={busy} onClick={() => deleteDialog.current?.close()}>{ui.cancel}</button><button type="button" className="danger" disabled={busy} onClick={() => void deleteCollection()}>{copy.confirmDelete}</button></div>
    </dialog>
  </section>;
}
