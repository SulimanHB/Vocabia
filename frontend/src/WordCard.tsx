import { languages, wordTypes, type Word, type WordInput } from './model';
import { verbFormsText } from './verbFormsText';
import { collectionsText } from './collectionsText';
import { WordAudioButton } from './WordAudioButton';

interface Props {
  word: Word;
  interfaceLanguage: WordInput['sourceLanguage'];
  inCollection: boolean;
  removing: boolean;
  onRemoveFromCollection: (id: number) => void;
  onEdit: (word: Word) => void;
  onDelete: (word: Word) => void;
}

export function WordCard({ word, interfaceLanguage, inCollection, removing, onRemoveFromCollection, onEdit, onDelete }: Props) {
  const verbCopy = verbFormsText[interfaceLanguage];
  const groupCopy = collectionsText[interfaceLanguage];

  return <article className={`word-card card-${word.wordType}`} lang={interfaceLanguage}>
    <div className="card-top"><span className={`type-tag type-${word.wordType}`} lang="es">{wordTypes[word.wordType]}</span><span className="language-pair" lang="es">{languages[word.sourceLanguage]} <span aria-hidden="true">→</span><span className="sr-only">a</span> {languages[word.targetLanguage]}</span></div>
    <div className="word-pair"><h3 lang={word.sourceLanguage}>{word.term}</h3><span className="pair-arrow" aria-hidden="true">→</span><div className="card-translation"><p className="translation" lang={word.targetLanguage}>{word.translation}</p><WordAudioButton text={word.translation} language={word.targetLanguage} interfaceLanguage={interfaceLanguage} /></div></div>
    {word.wordType === 'verb' && word.targetLanguage === 'en' && word.englishVerbForms && Object.values(word.englishVerbForms).some(Boolean) && <div className="card-verb-forms"><p>{verbCopy.title}</p><dl>{(['past', 'pastParticiple', 'ing'] as const).map(key => word.englishVerbForms?.[key] && <div key={key}><dt>{verbCopy[key]}</dt><dd lang="en">{word.englishVerbForms[key]}</dd></div>)}</dl></div>}
    <div className="sentences">{word.examples.map((example, index) => <div className="sentence-pair" key={index}><blockquote lang={word.sourceLanguage}>{example.text}</blockquote>{example.translation && <p className="example-translation" lang={word.targetLanguage}>{example.translation}</p>}</div>)}</div>
    {word.notes && <p className="notes">{word.notes}</p>}
    <div className="card-actions">{inCollection && <button type="button" disabled={removing} onClick={() => onRemoveFromCollection(word.id)} aria-label={`${groupCopy.remove}: ${word.term}`}>{groupCopy.remove}</button>}<button type="button" lang="es" onClick={() => onEdit(word)} aria-label={`Editar ${word.term}`}><span aria-hidden="true">✎</span> Editar</button><button type="button" lang="es" className="delete" onClick={() => onDelete(word)} aria-label={`Borrar ${word.term}`}><span aria-hidden="true">×</span> Borrar</button></div>
  </article>;
}
