import { useEffect, useState } from 'react';
import { request, type StudyRound, type WordInput } from './model';

const historyText: Record<WordInput['sourceLanguage'], {
  title: string; empty: string; loading: string; error: string; retry: string;
  reviewed: string; written: string; matched: string;
}> = {
  es: { title: 'Rondas recientes', empty: 'Todavía no hay rondas guardadas para esta pareja.', loading: 'Cargando rondas…', error: 'No se pudieron cargar las rondas.', retry: 'Reintentar', reviewed: 'Preguntas', written: 'Escritas', matched: 'Coincidencias' },
  en: { title: 'Recent rounds', empty: 'No rounds saved for this language pair yet.', loading: 'Loading rounds…', error: 'Rounds could not be loaded.', retry: 'Retry', reviewed: 'Questions', written: 'Typed', matched: 'Matches' },
  fr: { title: 'Séries récentes', empty: 'Aucune série enregistrée pour cette paire de langues.', loading: 'Chargement des séries…', error: 'Impossible de charger les séries.', retry: 'Réessayer', reviewed: 'Questions', written: 'Écrites', matched: 'Correspondances' },
  de: { title: 'Letzte Runden', empty: 'Für dieses Sprachpaar gibt es noch keine gespeicherten Runden.', loading: 'Runden werden geladen…', error: 'Runden konnten nicht geladen werden.', retry: 'Erneut versuchen', reviewed: 'Fragen', written: 'Geschrieben', matched: 'Übereinstimmungen' },
  it: { title: 'Turni recenti', empty: 'Non ci sono ancora turni salvati per questa coppia di lingue.', loading: 'Caricamento turni…', error: 'Impossibile caricare i turni.', retry: 'Riprova', reviewed: 'Domande', written: 'Scritte', matched: 'Corrispondenze' },
  pt: { title: 'Rondas recentes', empty: 'Ainda não há rondas guardadas para este par de idiomas.', loading: 'A carregar rondas…', error: 'Não foi possível carregar as rondas.', retry: 'Tentar novamente', reviewed: 'Perguntas', written: 'Escritas', matched: 'Correspondências' },
  ja: { title: '最近のラウンド', empty: 'この言語ペアの保存済みラウンドはまだありません。', loading: 'ラウンドを読み込み中…', error: 'ラウンドを読み込めませんでした。', retry: '再試行', reviewed: '復習', written: '入力', matched: '一致' },
};

interface Props {
  sourceLanguage: WordInput['sourceLanguage'];
  targetLanguage: WordInput['targetLanguage'];
  revision: number;
}

export function StudyHistory({ sourceLanguage, targetLanguage, revision }: Props) {
  const copy = historyText[sourceLanguage];
  const [rounds, setRounds] = useState<StudyRound[] | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    setRounds(null);
    const params = new URLSearchParams({ sourceLanguage, targetLanguage });
    request<StudyRound[]>(`/study-rounds?${params}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setRounds(data); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [sourceLanguage, targetLanguage, revision, retry]);

  return <section className="study-history" aria-label={copy.title}>
    <h3>{copy.title}</h3>
    {error ? <p role="alert">{copy.error} <button type="button" className="text-button" onClick={() => setRetry(value => value + 1)}>{copy.retry}</button></p>
      : rounds === null ? <p role="status">{copy.loading}</p>
        : rounds.length === 0 ? <p>{copy.empty}</p>
          : <ol>{rounds.map(round => <li key={round.id}>
            <time dateTime={round.completedAt}>{new Intl.DateTimeFormat(sourceLanguage, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(round.completedAt))}</time>
            <span>{copy.reviewed}: {round.questionCount} · {copy.written}: {round.writtenCount} · {copy.matched}: {round.matchedCount}</span>
          </li>)}</ol>}
  </section>;
}
