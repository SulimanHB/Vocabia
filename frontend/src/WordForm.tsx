import { useState, type FormEvent } from 'react';
import { getErrorMessage, type WordInput } from './model';
import { interfaceText, formatText, type UiKey } from './interfaceText';
import { verbFormsText } from './verbFormsText';

function setFieldValidity(target: EventTarget, message: string) {
  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
    target.setCustomValidity(message);
  }
}

export function WordForm({ initial, referenceLanguage = 'es', studyLanguage, busy, onSave, onCancel }: {
  initial?: WordInput; referenceLanguage?: WordInput['targetLanguage']; studyLanguage?: WordInput['targetLanguage']; busy: boolean; onSave: (word: WordInput) => Promise<void>; onCancel: () => void;
}) {
  const ui = interfaceText[referenceLanguage];
  const verbs = verbFormsText[referenceLanguage];
  const [form, setForm] = useState<WordInput>(() => initial ? {
    term: initial.term, translation: initial.translation, sourceLanguage: initial.sourceLanguage,
    targetLanguage: initial.targetLanguage, wordType: initial.wordType, notes: initial.notes, examples: initial.examples.map(example => ({ ...example })),
    englishVerbForms: { past: initial.englishVerbForms?.past ?? '', pastParticiple: initial.englishVerbForms?.pastParticiple ?? '', ing: initial.englishVerbForms?.ing ?? '' },
  } : {
    term: '', translation: '', sourceLanguage: referenceLanguage,
    targetLanguage: studyLanguage && studyLanguage !== referenceLanguage ? studyLanguage : (referenceLanguage === 'en' ? 'es' : 'en'),
    wordType: 'noun', notes: '', examples: [{ text: '', translation: '' }], englishVerbForms: { past: '', pastParticiple: '', ing: '' },
  });
  const [error, setError] = useState<UiKey | Error | null>(null);
  const set = <K extends keyof WordInput>(key: K, value: WordInput[K]) => setForm(current => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (form.sourceLanguage === form.targetLanguage) { setError('sameLanguages'); return; }
    if (![form.term, form.translation, ...form.examples.map(example => example.text)].every(value => value.trim())) { setError('requiredFields'); return; }
    setError(null);
    const englishVerbForms = form.wordType === 'verb' && form.targetLanguage === 'en'
      ? form.englishVerbForms : { past: '', pastParticiple: '', ing: '' };
    try { await onSave({ ...form, englishVerbForms }); } catch (cause) { setError(cause instanceof Error ? cause : 'operationError'); }
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
      {form.wordType === 'verb' && form.targetLanguage === 'en' && <div className="verb-forms">
        <p className="verb-forms-title">{verbs.title}</p><p className="verb-forms-help">{verbs.help}</p>
        <div className="form-grid">
          {(['past', 'pastParticiple', 'ing'] as const).map(key => <label key={key}>{verbs[key]} <span className="optional">{ui.optional}</span><input lang="en" maxLength={120} value={form.englishVerbForms?.[key] ?? ''} onChange={event => set('englishVerbForms', { past: form.englishVerbForms?.past ?? '', pastParticiple: form.englishVerbForms?.pastParticiple ?? '', ing: form.englishVerbForms?.ing ?? '', [key]: event.target.value })} /></label>)}
        </div>
      </div>}
      <div className="examples-heading"><span>{ui.examples} *</span><small>{form.examples.length}/10</small></div>
      {form.examples.map((example, index) => <div className="example-input" key={index}>
        <div className="grow example-fields">
          <label>{formatText(ui.example, { number: index + 1 })} *<input aria-label={formatText(ui.example, { number: index + 1 })} required maxLength={500} lang={form.sourceLanguage} value={example.text} placeholder={ui.examplePlaceholder} onChange={e => set('examples', form.examples.map((value, i) => i === index ? { ...value, text: e.target.value } : value))} /></label>
          <label>{formatText(ui.exampleTranslation, { number: index + 1 })} <span className="optional">{ui.optional}</span><input aria-label={formatText(ui.exampleTranslation, { number: index + 1 })} maxLength={500} lang={form.targetLanguage} value={example.translation} placeholder={ui.translationPlaceholder} onChange={e => set('examples', form.examples.map((value, i) => i === index ? { ...value, translation: e.target.value } : value))} /></label>
        </div>
        {form.examples.length > 1 && <button className="text-button" type="button" aria-label={formatText(ui.removeExample, { number: index + 1 })} onClick={() => set('examples', form.examples.filter((_, i) => i !== index))}>{ui.remove}</button>}
      </div>)}
      <button type="button" className="text-button" disabled={form.examples.length >= 10} onClick={() => set('examples', [...form.examples, { text: '', translation: '' }])}>{ui.addExample}</button>
      <label>{ui.notes} <span className="optional">{ui.optional}</span><textarea rows={3} maxLength={2000} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder={ui.notesPlaceholder} /></label>
    </fieldset>
    {error && <p role="alert" className="error">{typeof error === 'string' ? ui[error] : getErrorMessage(error, ui)}</p>}
    <div className="form-actions"><button type="button" className="secondary" disabled={busy} onClick={onCancel}>{ui.cancel}</button><button className="primary" disabled={busy}>{busy ? ui.saving : ui.saveWord}</button></div>
  </form>;
}
