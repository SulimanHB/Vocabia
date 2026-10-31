import { useEffect, useState } from 'react';
import { request, type Collection, type WordInput } from './model';
import { collectionsText } from './collectionsText';
import { interfaceText } from './interfaceText';

interface Props {
  referenceLanguage: WordInput['sourceLanguage'];
  studyLanguage: WordInput['targetLanguage'];
  selectedId: number | null;
  revision: number;
  onSelect: (id: number | null) => void;
}

export function StudyCollectionFilter({ referenceLanguage, studyLanguage, selectedId, revision, onSelect }: Props) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const copy = collectionsText[referenceLanguage];
  const ui = interfaceText[referenceLanguage];

  useEffect(() => {
    const controller = new AbortController();
    setCollections([]);
    setError(false);
    const params = new URLSearchParams({ sourceLanguage: referenceLanguage, targetLanguage: studyLanguage });
    request<Collection[]>(`/collections?${params}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setCollections(data); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [referenceLanguage, studyLanguage, revision, retry]);

  return <section className="study-collections" aria-label={copy.title}>
    <h2>{copy.title}</h2>
    {error && <p role="alert" className="error">{ui.operationError} <button type="button" className="text-button" onClick={() => setRetry(value => value + 1)}>{ui.retry}</button></p>}
    <div className="collection-tabs" role="group" aria-label={copy.title}>
      <button type="button" aria-pressed={selectedId === null} onClick={() => onSelect(null)}>{copy.all}</button>
      {collections.map(collection => <button type="button" key={collection.id} aria-pressed={selectedId === collection.id}
        onClick={() => onSelect(collection.id)}>{collection.name}<span>{collection.wordCount}</span></button>)}
    </div>
  </section>;
}
