import { useEffect, useRef, useState, type DragEvent } from 'react';
import { request, type Collection, type Example, type EnglishVerbForms, type Word, type WordInput } from './model';
import { interfaceText } from './interfaceText';
import { verbFormsText } from './verbFormsText';
import { mergeText, type MergeCopy } from './mergeText';

interface Props {
  group: Word[];
  collections: Collection[];
  language: WordInput['sourceLanguage'];
  onClose: () => void;
  onMerged: () => void;
}

const directText: Record<WordInput['sourceLanguage'], { base: string; other: string; combine: string; limit: string; noteLimit: string; conflict: string }> = {
  es: { base: 'Tarjeta A · base del resultado', other: 'Tarjeta B · para unir', combine: 'Unir ambas en el resultado', limit: 'Entre las dos tarjetas hay más de 10 ejemplos. Elige cuáles conservar.', noteLimit: 'Las notas juntas superan el límite de 2000 caracteres. Edítalas antes de guardar.', conflict: 'Hay formas verbales distintas. Revisa cuál debe quedar en el resultado.' },
  en: { base: 'Card A · result base', other: 'Card B · to combine', combine: 'Combine both in the result', limit: 'Together these cards have more than 10 examples. Choose which to keep.', noteLimit: 'The combined notes exceed 2000 characters. Edit them before saving.', conflict: 'Some verb forms differ. Review which one should remain in the result.' },
  fr: { base: 'Fiche A · base du résultat', other: 'Fiche B · à réunir', combine: 'Réunir les deux dans le résultat', limit: 'Les fiches ont ensemble plus de 10 exemples. Choisissez lesquels garder.', noteLimit: 'Les notes réunies dépassent 2000 caractères. Modifiez-les avant d’enregistrer.', conflict: 'Certaines formes verbales diffèrent. Vérifiez celles à conserver.' },
  de: { base: 'Karte A · Basis des Ergebnisses', other: 'Karte B · zum Vereinen', combine: 'Beide im Ergebnis vereinen', limit: 'Zusammen enthalten die Karten mehr als 10 Beispiele. Wähle aus, welche bleiben.', noteLimit: 'Die verbundenen Notizen überschreiten 2000 Zeichen. Bearbeite sie vor dem Speichern.', conflict: 'Einige Verbformen unterscheiden sich. Prüfe, welche im Ergebnis bleiben sollen.' },
  it: { base: 'Scheda A · base del risultato', other: 'Scheda B · da unire', combine: 'Unisci entrambe nel risultato', limit: 'Le schede hanno più di 10 esempi insieme. Scegli quali conservare.', noteLimit: 'Le note unite superano 2000 caratteri. Modificale prima di salvare.', conflict: 'Alcune forme verbali sono diverse. Controlla quali tenere nel risultato.' },
  pt: { base: 'Cartão A · base do resultado', other: 'Cartão B · para juntar', combine: 'Juntar ambos no resultado', limit: 'Juntos, os cartões têm mais de 10 exemplos. Escolhe quais guardar.', noteLimit: 'As notas juntas ultrapassam 2000 caracteres. Edita-as antes de guardar.', conflict: 'Algumas formas verbais diferem. Confirma quais devem ficar no resultado.' },
  ja: { base: 'カードA · 結果の基準', other: 'カードB · 統合するカード', combine: '両方を結果にまとめる', limit: '2枚合わせると例文が10件を超えます。残す例文を選んでください。', noteLimit: 'メモを合わせると2000文字を超えます。保存前に編集してください。', conflict: '異なる活用形があります。結果に残す形を確認してください。' },
};

export function MergeDialog({ group, collections, language, onClose, onMerged }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [keepId, setKeepId] = useState(group[0].id);
  const [sourceId, setSourceId] = useState(group[1].id);
  const [busy, setBusy] = useState(false);
  const copy = mergeText[language];
  const labels = directText[language];
  const ui = interfaceText[language];
  const keep = group.find(word => word.id === keepId) ?? group[0];
  const source = group.find(word => word.id === sourceId) ?? group[1];
  const cardLabel = (word: Word) => {
    const names = word.collectionIds?.map(id => collections.find(item => item.id === id)?.name).filter(Boolean).join(' · ');
    return `${word.term} → ${word.translation}${names ? ` · ${names}` : ''}`;
  };

  useEffect(() => { dialog.current?.showModal(); }, []);

  return <dialog ref={dialog} className="merge-dialog" aria-labelledby="merge-title" onClose={onClose}
    onCancel={event => { if (busy) event.preventDefault(); }}>
    <div className="dialog-heading"><h2 id="merge-title">{copy.title}</h2><button type="button" className="close-button" disabled={busy}
      aria-label={ui.closeForm} onClick={() => dialog.current?.close()}>×</button></div>
    <div className="merge-card-selectors">
      <label>{labels.base}<select value={keepId} disabled={busy} onChange={event => {
        const id = Number(event.target.value);
        setKeepId(id);
        if (id === sourceId) setSourceId(group.find(word => word.id !== id)!.id);
      }}>{group.map(word => <option key={word.id} value={word.id}>{cardLabel(word)}</option>)}</select></label>
      <label>{labels.other}<select value={sourceId} disabled={busy} onChange={event => {
        const id = Number(event.target.value);
        setSourceId(id);
        if (id === keepId) setKeepId(group.find(word => word.id !== id)!.id);
      }}>{group.map(word => <option key={word.id} value={word.id}>{cardLabel(word)}</option>)}</select></label>
    </div>
    <MergeEditor key={`${keep.id}-${source.id}`} keep={keep} source={source} collections={collections}
      language={language} copy={copy} onBusy={setBusy} onMerged={onMerged} onCancel={() => dialog.current?.close()} />
  </dialog>;
}

function MergeEditor({ keep, source, collections, language, copy, onBusy, onMerged, onCancel }: {
  keep: Word; source: Word; collections: Collection[]; language: WordInput['sourceLanguage']; copy: MergeCopy;
  onBusy: (value: boolean) => void; onMerged: () => void; onCancel: () => void;
}) {
  const ui = interfaceText[language];
  const verbs = verbFormsText[language];
  const direct = directText[language];
  const [examples, setExamples] = useState<Example[]>(() => keep.examples.map(example => ({ ...example })));
  const [notes, setNotes] = useState(keep.notes);
  const [wordType, setWordType] = useState(keep.wordType);
  const [forms, setForms] = useState<EnglishVerbForms>(() => ({ ...keep.englishVerbForms }));
  const [deleteSource, setDeleteSource] = useState(false);
  const [message, setMessage] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const collectionIds = [...new Set([...(keep.collectionIds ?? []), ...(source.collectionIds ?? [])])];
  const collectionNames = collectionIds.map(id => collections.find(item => item.id === id)?.name).filter(Boolean).join(' · ') || '—';
  const combinedNotes = [...new Set([keep.notes, source.notes].filter(Boolean))].join('\n');
  const hasForms = wordType === 'verb' && keep.targetLanguage === 'en';

  function combineBoth() {
    const combined = [...keep.examples];
    for (const example of source.examples) {
      if (!combined.some(item => item.text.trim() === example.text.trim() && item.translation.trim() === example.translation.trim())) combined.push(example);
    }
    if (combined.length > 10) { setMessage(direct.limit); return; }
    if (combinedNotes.length > 2000) { setMessage(direct.noteLimit); return; }
    const mergedForms: EnglishVerbForms = {};
    let conflictingForms = false;
    for (const kind of ['past', 'pastParticiple', 'ing'] as const) {
      const first = keep.englishVerbForms?.[kind] ?? '';
      const second = source.englishVerbForms?.[kind] ?? '';
      if (first && second && first !== second) conflictingForms = true;
      mergedForms[kind] = first || second;
    }
    setExamples(combined.map(example => ({ ...example })));
    setNotes(combinedNotes);
    if (keep.targetLanguage === 'en' && (keep.wordType === 'verb' || source.wordType === 'verb')) setWordType('verb');
    setForms(mergedForms);
    setDeleteSource(true);
    changed();
    if (conflictingForms) setMessage(direct.conflict);
  }

  function changed() { setReviewing(false); setSaveError(false); setMessage(''); }

  function addExample(index: number, position = examples.length) {
    const example = source.examples[index];
    if (!example) return;
    if (examples.length >= 10) { setMessage(copy.limit); return; }
    if (examples.some(item => item.text.trim() === example.text.trim() && item.translation.trim() === example.translation.trim())) {
      setMessage(copy.duplicate); return;
    }
    setExamples(current => [...current.slice(0, position), { ...example }, ...current.slice(position)]);
    changed();
  }

  function dropExample(event: DragEvent<HTMLElement>, position: number) {
    event.preventDefault();
    event.stopPropagation();
    const rawIndex = event.dataTransfer.getData('application/x-vocabia-example');
    if (/^\d+$/.test(rawIndex)) addExample(Number(rawIndex), position);
  }

  function moveExample(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= examples.length) return;
    const ordered = [...examples];
    [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
    setExamples(ordered);
    changed();
  }

  async function save() {
    if (saving || examples.length === 0) return;
    setSaving(true);
    onBusy(true);
    setSaveError(false);
    const word: WordInput = {
      term: keep.term, translation: keep.translation, sourceLanguage: keep.sourceLanguage,
      targetLanguage: keep.targetLanguage, wordType, notes, examples,
      englishVerbForms: hasForms ? forms : { past: '', pastParticiple: '', ing: '' },
    };
    try {
      await request('/words/merge', { method: 'POST', body: JSON.stringify({ keepId: keep.id, sourceId: source.id, deleteSource, word }) });
      onBusy(false);
      onMerged();
    } catch {
      setSaveError(true);
      setSaving(false);
      onBusy(false);
    }
  }

  return <>
    <button type="button" className="secondary merge-combine-button" onClick={combineBoth}>{direct.combine}</button>
    {message && <p role="status" className="merge-message">{message}</p>}
    <div className="merge-columns">
      {[keep, source].map((word, cardIndex) => <section className="merge-source" key={word.id} aria-label={cardIndex === 0 ? direct.base : direct.other}>
        <h3>{cardIndex === 0 ? direct.base : direct.other}</h3>
        <p className="merge-card-word"><span lang={word.sourceLanguage}>{word.term}</span> → <span lang={word.targetLanguage}>{word.translation}</span></p>
        <p className="merge-card-detail">{copy.collections}: {word.collectionIds?.map(id => collections.find(item => item.id === id)?.name).filter(Boolean).join(' · ') || '—'}</p>
        <p className="merge-card-detail">{ui.wordType}: {ui.wordTypes[word.wordType]}</p>
        <h4>{ui.examples}</h4>
        <ol>{word.examples.map((example, index) => <li key={index} draggable={cardIndex === 1}
          onDragStart={cardIndex === 1 ? event => event.dataTransfer.setData('application/x-vocabia-example', String(index)) : undefined}>
          <span lang={word.sourceLanguage}>{example.text}</span>{example.translation && <> → <span lang={word.targetLanguage}>{example.translation}</span></>}
          {cardIndex === 1 && <button type="button" className="secondary" onClick={() => addExample(index)}>{copy.add}</button>}
        </li>)}</ol>
        <h4>{ui.notes}</h4><p className="merge-card-detail">{word.notes || '—'}</p>
        {word.wordType === 'verb' && word.targetLanguage === 'en' && <><h4>{verbs.title}</h4>
          <dl className="merge-card-forms">{(['past', 'pastParticiple', 'ing'] as const).map(kind => <div key={kind}>
            <dt>{verbs[kind]}</dt><dd>{word.englishVerbForms?.[kind] || '—'}</dd>
          </div>)}</dl></>}
      </section>)}
      <section className="merge-result" aria-label={copy.preview}>
        <h3>{copy.preview}</h3>
        <p lang={keep.sourceLanguage}>{keep.term} → <span lang={keep.targetLanguage}>{keep.translation}</span></p>
        <p>{copy.collections}: {collectionNames}</p>
        <label>{ui.wordType}<select value={wordType} onChange={event => { setWordType(event.target.value as WordInput['wordType']); changed(); }}>
          {[...new Set([keep.wordType, source.wordType])].map(type => <option key={type} value={type}>{ui.wordTypes[type]}</option>)}
        </select></label>
        <h4>{copy.resultExamples} ({examples.length}/10)</h4>
        <ol className="merge-examples" onDragOver={event => event.preventDefault()} onDrop={event => dropExample(event, examples.length)}>
          {examples.map((example, index) => <li key={index} onDragOver={event => event.preventDefault()} onDrop={event => dropExample(event, index)}>
            <span lang={keep.sourceLanguage}>{example.text}</span>{example.translation && <> → <span lang={keep.targetLanguage}>{example.translation}</span></>}
            <div className="merge-example-actions">
              <button type="button" disabled={index === 0} aria-label={`${copy.up}: ${example.text}`} onClick={() => moveExample(index, -1)}>↑</button>
              <button type="button" disabled={index === examples.length - 1} aria-label={`${copy.down}: ${example.text}`} onClick={() => moveExample(index, 1)}>↓</button>
              <button type="button" disabled={examples.length === 1} aria-label={`${copy.remove}: ${example.text}`} onClick={() => { setExamples(current => current.filter((_, i) => i !== index)); changed(); }}>{copy.remove}</button>
            </div>
          </li>)}
          <li className="merge-drop-hint">{copy.drop}</li>
        </ol>
        <div className="merge-fields">
      <div><label htmlFor="merge-notes">{ui.notes}</label><div className="merge-field-actions">
        <button type="button" onClick={() => { setNotes(keep.notes); changed(); }}>{copy.useKeep}</button>
        <button type="button" onClick={() => { setNotes(source.notes); changed(); }}>{copy.useSource}</button>
        <button type="button" disabled={combinedNotes.length > 2000} onClick={() => { setNotes(combinedNotes); changed(); }}>{copy.combine}</button>
      </div><textarea id="merge-notes" rows={3} maxLength={2000} value={notes} onChange={event => { setNotes(event.target.value); changed(); }} /></div>
      {hasForms && <fieldset><legend>{verbs.title}</legend>{(['past', 'pastParticiple', 'ing'] as const).map(kind => <div className="merge-form-row" key={kind}>
        <label>{verbs[kind]}<input lang="en" maxLength={120} value={forms[kind] ?? ''} onChange={event => { setForms(current => ({ ...current, [kind]: event.target.value })); changed(); }} /></label>
        <div className="merge-field-actions">
          <button type="button" onClick={() => { setForms(current => ({ ...current, [kind]: keep.englishVerbForms?.[kind] ?? '' })); changed(); }}>{copy.useKeep}: {keep.englishVerbForms?.[kind] || '—'}</button>
          <button type="button" onClick={() => { setForms(current => ({ ...current, [kind]: source.englishVerbForms?.[kind] ?? '' })); changed(); }}>{copy.useSource}: {source.englishVerbForms?.[kind] || '—'}</button>
        </div>
      </div>)}</fieldset>}
        </div>
      </section>
    </div>

    <label className="merge-delete-option"><input type="checkbox" checked={deleteSource} onChange={event => { setDeleteSource(event.target.checked); changed(); }} />{copy.removeSource}</label>
    {reviewing && <div className="merge-confirm" role="group" aria-label={copy.review}>
      <p>{deleteSource ? copy.removing : copy.keeping}</p>
      <button type="button" className="primary" disabled={saving} onClick={() => void save()}>{saving ? ui.saving : copy.confirm}</button>
    </div>}
    {saveError && <p role="alert" className="error">{copy.error}</p>}
    <div className="form-actions"><button type="button" className="secondary" disabled={saving} onClick={onCancel}>{ui.cancel}</button>
      {!reviewing && <button type="button" className="primary" onClick={() => setReviewing(true)}>{copy.review}</button>}
    </div>
  </>;
}
