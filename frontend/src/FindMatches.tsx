import { useEffect, useState } from 'react';
import { request, type Collection, type Word, type WordInput } from './model';
import { findWordMatches } from './findWordMatches';
import { MergeDialog } from './MergeDialog';
import { mergeText } from './mergeText';

type LastMerge = { id: number; term: string; translation: string };
const undoText: Record<WordInput['sourceLanguage'], { button: string; done: string; error: string }> = {
  es: { button: 'Deshacer última fusión', done: 'Fusión deshecha. Las tarjetas originales se han recuperado.', error: 'No se pudo deshacer. Puede que alguna tarjeta o colección haya cambiado desde la fusión.' },
  en: { button: 'Undo last merge', done: 'Merge undone. The original cards have been restored.', error: 'Could not undo. A card or collection may have changed since the merge.' },
  fr: { button: 'Annuler la dernière fusion', done: 'Fusion annulée. Les fiches originales ont été restaurées.', error: 'Annulation impossible. Une fiche ou collection a peut-être changé depuis la fusion.' },
  de: { button: 'Letzte Zusammenführung rückgängig machen', done: 'Zusammenführung rückgängig gemacht. Die ursprünglichen Karten wurden wiederhergestellt.', error: 'Rückgängig machen fehlgeschlagen. Eine Karte oder Sammlung wurde möglicherweise geändert.' },
  it: { button: 'Annulla l’ultima unione', done: 'Unione annullata. Le schede originali sono state ripristinate.', error: 'Impossibile annullare. Una scheda o raccolta potrebbe essere cambiata.' },
  pt: { button: 'Desfazer a última fusão', done: 'Fusão desfeita. Os cartões originais foram recuperados.', error: 'Não foi possível desfazer. Um cartão ou coleção pode ter mudado.' },
  ja: { button: '最後の統合を元に戻す', done: '統合を元に戻し、元のカードを復元しました。', error: '元に戻せませんでした。統合後にカードやコレクションが変更された可能性があります。' },
};

const text: Record<WordInput['sourceLanguage'], {
  open: string; close: string; title: string; help: string; loading: string; error: string;
  retry: string; empty: string; count: string; card: string; noCollection: string; notes: string;
}> = {
  es: { open: 'Buscar coincidencias', close: 'Ocultar coincidencias', title: 'Posibles coincidencias', help: 'Misma pareja de idiomas, palabra y traducción. Compara ejemplos y notas antes de preparar una fusión manual.', loading: 'Buscando coincidencias…', error: 'No se pudieron consultar las tarjetas.', retry: 'Reintentar', empty: 'No hay coincidencias en esta pareja.', count: 'Grupos encontrados', card: 'Tarjeta', noCollection: 'Sin colección', notes: 'Notas' },
  en: { open: 'Find matches', close: 'Hide matches', title: 'Possible matches', help: 'Same language pair, word and translation. Compare examples and notes before preparing a manual merge.', loading: 'Finding matches…', error: 'Cards could not be loaded.', retry: 'Retry', empty: 'No matches in this language pair.', count: 'groups found', card: 'Card', noCollection: 'No collection', notes: 'Notes' },
  fr: { open: 'Chercher les correspondances', close: 'Masquer les correspondances', title: 'Correspondances possibles', help: 'Mêmes langues, mot et traduction. Comparez exemples et notes avant de préparer une fusion manuelle.', loading: 'Recherche des correspondances…', error: 'Impossible de charger les fiches.', retry: 'Réessayer', empty: 'Aucune correspondance pour cette paire.', count: 'groupes trouvés', card: 'Fiche', noCollection: 'Sans collection', notes: 'Notes' },
  de: { open: 'Übereinstimmungen suchen', close: 'Übereinstimmungen ausblenden', title: 'Mögliche Übereinstimmungen', help: 'Gleiches Sprachpaar, Wort und Übersetzung. Vergleiche Beispiele und Notizen vor der manuellen Zusammenführung.', loading: 'Übereinstimmungen werden gesucht…', error: 'Karten konnten nicht geladen werden.', retry: 'Erneut versuchen', empty: 'Keine Übereinstimmungen für dieses Sprachpaar.', count: 'Gruppen gefunden', card: 'Karte', noCollection: 'Keine Sammlung', notes: 'Notizen' },
  it: { open: 'Cerca corrispondenze', close: 'Nascondi corrispondenze', title: 'Possibili corrispondenze', help: 'Stessa coppia di lingue, parola e traduzione. Confronta esempi e note prima di preparare un’unione manuale.', loading: 'Ricerca corrispondenze…', error: 'Impossibile caricare le schede.', retry: 'Riprova', empty: 'Nessuna corrispondenza per questa coppia.', count: 'gruppi trovati', card: 'Scheda', noCollection: 'Nessuna raccolta', notes: 'Note' },
  pt: { open: 'Procurar coincidências', close: 'Ocultar coincidências', title: 'Possíveis coincidências', help: 'Mesmo par de idiomas, palavra e tradução. Compara exemplos e notas antes de preparar uma fusão manual.', loading: 'A procurar coincidências…', error: 'Não foi possível carregar os cartões.', retry: 'Tentar novamente', empty: 'Sem coincidências neste par de idiomas.', count: 'grupos encontrados', card: 'Cartão', noCollection: 'Sem coleção', notes: 'Notas' },
  ja: { open: '一致候補を探す', close: '一致候補を隠す', title: '一致候補', help: '言語ペア・単語・訳が同じカードです。手動で統合する前に例文とメモを比較してください。', loading: '一致候補を検索中…', error: 'カードを読み込めませんでした。', retry: '再試行', empty: 'この言語ペアに一致候補はありません。', count: 'グループ', card: 'カード', noCollection: 'コレクションなし', notes: 'メモ' },
};

interface Props {
  sourceLanguage: WordInput['sourceLanguage'];
  targetLanguage: WordInput['targetLanguage'];
  revision: number;
  onMerged: () => void;
}

export function FindMatches({ sourceLanguage, targetLanguage, revision, onMerged }: Props) {
  const copy = text[sourceLanguage];
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<Word[][] | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [activeGroup, setActiveGroup] = useState<Word[] | null>(null);
  const [lastMerge, setLastMerge] = useState<LastMerge | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [undoStatus, setUndoStatus] = useState<'done' | 'error' | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setGroups(null);
    setError(false);
    const params = new URLSearchParams({ sourceLanguage, targetLanguage });
    Promise.all([
      request<Word[]>(`/words?${params}`, { signal: controller.signal }),
      request<Collection[]>(`/collections?${params}`, { signal: controller.signal }),
    ]).then(([words, currentCollections]) => {
      if (controller.signal.aborted) return;
      setGroups(findWordMatches(words.filter(word => word.sourceLanguage === sourceLanguage && word.targetLanguage === targetLanguage)));
      setCollections(currentCollections);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [open, sourceLanguage, targetLanguage, revision, retry]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ sourceLanguage, targetLanguage });
    request<LastMerge | null>(`/words/merge/latest?${params}`, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setLastMerge(value); })
      .catch(() => { if (!controller.signal.aborted) setLastMerge(null); });
    return () => controller.abort();
  }, [open, sourceLanguage, targetLanguage, revision, retry]);

  async function undoLastMerge() {
    if (!lastMerge || undoBusy) return;
    setUndoBusy(true);
    setUndoStatus(null);
    try {
      await request(`/words/merge/${lastMerge.id}/undo`, { method: 'POST' });
      setLastMerge(null);
      setUndoStatus('done');
      onMerged();
    } catch { setUndoStatus('error'); }
    finally { setUndoBusy(false); }
  }

  return <section className="find-matches" aria-label={copy.title}>
    <button type="button" className="secondary" aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? copy.close : copy.open}</button>
    {open && <div className="find-matches-content">
      <h2>{copy.title}</h2><p>{copy.help}</p>
      {lastMerge && <button type="button" className="secondary undo-merge-button" disabled={undoBusy}
        onClick={() => void undoLastMerge()}>{undoText[sourceLanguage].button}: {lastMerge.term} → {lastMerge.translation}</button>}
      {undoStatus && <p role={undoStatus === 'error' ? 'alert' : 'status'}>{undoText[sourceLanguage][undoStatus]}</p>}
      {error ? <p role="alert">{copy.error} <button type="button" className="text-button" onClick={() => setRetry(value => value + 1)}>{copy.retry}</button></p>
        : groups === null ? <p role="status">{copy.loading}</p>
          : groups.length === 0 ? <p>{copy.empty}</p>
            : <><p>{copy.count}: {groups.length}</p><div className="match-groups">{groups.map(group => <article className="match-group" key={group[0].id}>
              <h3 lang={sourceLanguage}>{group[0].term} <span aria-hidden="true">→</span> <span lang={targetLanguage}>{group[0].translation}</span></h3>
              <button type="button" className="secondary" onClick={() => setActiveGroup(group)}>{mergeText[sourceLanguage].open}</button>
              <div className="match-cards">{group.map((word, index) => <div className="match-card" key={word.id}>
                <strong>{copy.card} {index + 1}</strong>
                <p>{word.collectionIds?.length ? word.collectionIds.map(id => collections.find(collection => collection.id === id)?.name).filter(Boolean).join(' · ') || copy.noCollection : copy.noCollection}</p>
                <p><span lang={sourceLanguage}>{word.term}</span> → <span lang={targetLanguage}>{word.translation}</span></p>
                {word.notes && <p>{copy.notes}: {word.notes}</p>}
                <ul>{word.examples.map((example, exampleIndex) => <li key={exampleIndex}><span lang={sourceLanguage}>{example.text}</span>{example.translation && <> → <span lang={targetLanguage}>{example.translation}</span></>}</li>)}</ul>
              </div>)}</div>
            </article>)}</div></>}
    </div>}
    {activeGroup && <MergeDialog group={activeGroup} collections={collections} language={sourceLanguage}
      onClose={() => setActiveGroup(null)} onMerged={() => { setActiveGroup(null); setUndoStatus(null); onMerged(); }} />}
  </section>;
}
