import { languages, wordTypes, type Word, type WordInput } from './model';
import { verbFormsText } from './verbFormsText';
import { collectionsText } from './collectionsText';
import { WordAudioButton } from './WordAudioButton';
import { englishBase, englishFuture } from './englishFuture';

interface Props {
  word: Word;
  anchorId?: string;
  interfaceLanguage: WordInput['sourceLanguage'];
  inCollection: boolean;
  removing: boolean;
  onRemoveFromCollection: (id: number) => void;
  onEdit: (word: Word) => void;
  onDelete: (word: Word) => void;
}

export function WordCard({ word, anchorId, interfaceLanguage, inCollection, removing, onRemoveFromCollection, onEdit, onDelete }: Props) {
  const verbCopy = verbFormsText[interfaceLanguage];
  const groupCopy = collectionsText[interfaceLanguage];
  const isEnglishVerb = word.wordType === 'verb' && word.targetLanguage === 'en';
  const base = isEnglishVerb ? englishBase(word.translation) : null;
  const future = isEnglishVerb ? englishFuture(word.translation) : null;
  const forms = isEnglishVerb ? [
    { key: 'past', label: verbCopy.past, value: word.englishVerbForms?.past },
    { key: 'future', label: verbCopy.future, value: future },
    { key: 'pastParticiple', label: verbCopy.pastParticiple, value: word.englishVerbForms?.pastParticiple },
    { key: 'ing', label: verbCopy.ing, value: word.englishVerbForms?.ing },
  ].filter(form => form.key === 'past' || form.key === 'future' || Boolean(form.value)) : [];

  return <article className={`word-card card-${word.wordType}`} id={anchorId} tabIndex={anchorId ? -1 : undefined} lang={interfaceLanguage}>
    <div className="card-top">
      <span className={`type-tag type-${word.wordType}`} lang="es">{wordTypes[word.wordType]}</span>
      <span className="language-pair" lang="es">
        {languages[word.sourceLanguage]} <span aria-hidden="true">→</span><span className="sr-only">a</span> {languages[word.targetLanguage]}
      </span>
    </div>

    <div className="word-pair">
      <h3 lang={word.sourceLanguage}>{word.term}</h3>
      <span className="pair-arrow" aria-hidden="true">→</span>
      <div className="card-translation">
        <p className="translation" lang={word.targetLanguage}>{word.translation}</p>
        {base && <span className="verb-present-label">{verbCopy.present}</span>}
        <WordAudioButton text={base ?? word.translation} language={word.targetLanguage}
          interfaceLanguage={interfaceLanguage} context={base ? verbCopy.present : undefined} />
      </div>
    </div>

    {isEnglishVerb && <div className="card-verb-forms">
      <p>{verbCopy.title}</p>
      <dl>{forms.map(form => <div key={form.key}>
        <dt>{form.label}</dt>
        <dd lang="en">{form.value || '—'}</dd>
        {form.value && <WordAudioButton text={form.value} language="en" interfaceLanguage={interfaceLanguage}
          context={form.label} compact />}
      </div>)}</dl>
    </div>}

    <div className="sentences">{word.examples.map((example, index) => <div className="sentence-pair" key={index}>
      <blockquote lang={word.sourceLanguage}>{example.text}</blockquote>
      {example.translation && <p className="example-translation" lang={word.targetLanguage}>{example.translation}</p>}
    </div>)}</div>
    {word.notes && <p className="notes">{word.notes}</p>}

    <div className="card-actions">
      {inCollection && <button type="button" disabled={removing} onClick={() => onRemoveFromCollection(word.id)}
        aria-label={`${groupCopy.remove}: ${word.term}`}>{groupCopy.remove}</button>}
      <button type="button" lang="es" onClick={() => onEdit(word)} aria-label={`Editar ${word.term}`}>
        <span aria-hidden="true">✎</span> Editar
      </button>
      <button type="button" lang="es" className="delete" onClick={() => onDelete(word)} aria-label={`Borrar ${word.term}`}>
        <span aria-hidden="true">×</span> Borrar
      </button>
    </div>
  </article>;
}
