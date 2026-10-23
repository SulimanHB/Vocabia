import { useState, type FormEvent } from 'react';
import { getErrorMessage, type WordInput } from './model';
import { interfaceText, formatText, type UiKey } from './interfaceText';

function setFieldValidity(target: EventTarget, message: string) {
  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
    target.setCustomValidity(message);
  }
}

export function WordForm({ initial, referenceLanguage = 'es', studyLanguage, busy, onSave, onCancel }: {
  initial?: WordInput; referenceLanguage?: WordInput['targetLanguage']; studyLanguage?: WordInput['targetLanguage']; busy: boolean; onSave: (word: WordInput) => Promise<void>; onCancel: () => void;
}) {
  const ui = interfaceText[referenceLanguage];
  const [form, setForm] = useState<WordInput>(() => initial ? {
    term: initial.term, translation: initial.translation, sourceLanguage: initial.sourceLanguage,
    targetLanguage: initial.targetLanguage, wordType: initial.wordType, notes: initial.notes, examples: [...initial.examples],
  } : {
    term: '', translation: '', sourceLanguage: referenceLanguage,
    targetLanguage: studyLanguage && studyLanguage !== referenceLanguage ? studyLanguage : (referenceLanguage === 'en' ? 'es' : 'en'),
    wordType: 'noun', notes: '', examples: [''],
  });
  const [error, setError] = useState<UiKey | Error | null>(null);
  const set = <K extends keyof WordInput>(key: K, value: WordInput[K]) => setForm(current => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (form.sourceLanguage === form.targetLanguage) { setError('sameLanguages'); return; }
    if (![form.term, form.translation, ...form.examples].every(value => value.trim())) { setError('requiredFields'); return; }
    setError(null);
    try { await onSave(form); } catch (cause) { setError(cause instanceof Error ? cause : 'operationError'); }
  }

  return <form onSubmit={submit} className="word-form" onInvalid={event => setFieldValidity(event.target, ui.requiredFields)} onChangeCapture={event => setFieldValidity(event.target, '')}>
    <p className="form-help">{ui.formHelp}</p>
    <fieldset disabled={busy}>
      <div className="form-grid">
        <label>{ui.term} *<input autoFocus required maxLength={120} value={form.term} onChange={e => set('term', e.target.value)} placeholder={ui.termPlaceholder} /></label>
        <label>{ui.translation} *<input required maxLength={200} value={form.translation} onChange={e => set('translation', e.target.value)} placeholder={ui.translationPlaceholder} /></label>
        <label>{ui.sourceLanguage} *<select value={form.sourceLanguage} onChange={e => set('sourceLanguage', e.target.value as WordInput['sourceLanguage'])}>{Object.entries(ui.languages).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
        <label>{ui.targetLanguage} *<select value={form.targetLanguage} onChange={e => set('targetLanguage', e.target.value as WordInput['targetLanguage'])}>{Object.entries(ui.languages).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
      </div>
      <label>{ui.wordType} *<select value={form.wordType} onChange={e => set('wordType', e.target.value as WordInput['wordType'])}>{Object.entries(ui.wordTypes).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
      <div className="examples-heading"><span>{ui.examples} *</span><small>{form.examples.length}/10</small></div>
      {form.examples.map((example, index) => <div className="example-input" key={index}>
        <label className="grow"><span className="sr-only">{formatText(ui.example, { number: index + 1 })}</span><input required maxLength={500} value={example} placeholder={ui.examplePlaceholder} onChange={e => set('examples', form.examples.map((value, i) => i === index ? e.target.value : value))} /></label>
        {form.examples.length > 1 && <button className="text-button" type="button" aria-label={formatText(ui.removeExample, { number: index + 1 })} onClick={() => set('examples', form.examples.filter((_, i) => i !== index))}>{ui.remove}</button>}
      </div>)}
      <button type="button" className="text-button" disabled={form.examples.length >= 10} onClick={() => set('examples', [...form.examples, ''])}>{ui.addExample}</button>
      <label>{ui.notes} <span className="optional">{ui.optional}</span><textarea rows={3} maxLength={2000} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder={ui.notesPlaceholder} /></label>
    </fieldset>
    {error && <p role="alert" className="error">{typeof error === 'string' ? ui[error] : getErrorMessage(error, ui)}</p>}
    <div className="form-actions"><button type="button" className="secondary" disabled={busy} onClick={onCancel}>{ui.cancel}</button><button className="primary" disabled={busy}>{busy ? ui.saving : ui.saveWord}</button></div>
  </form>;
}
