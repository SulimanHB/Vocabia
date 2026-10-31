import { useRef, useState, type FormEvent } from 'react';
import { request, type StudyRound, type Word, type WordInput } from './model';
import { verbFormsText } from './verbFormsText';
import { StudyHistory } from './StudyHistory';
import { studyMarkText } from './studyMarkText';
import { normalizeStudyAnswer } from './studyAnswers';
import { shuffle } from './shuffle';

export const studyModeText: Record<WordInput['sourceLanguage'], {
  practice: string; back: string; reveal: string; next: string; prompt: string; progress: string;
  typeAnswer: string; answerLabel: string; baseLabel: string; check: string; correct: string; different: string; newRound: string;
}> = {
  es: { practice: 'Practicar', back: 'Volver a Estudio', reveal: 'Mostrar respuesta', next: 'Siguiente pregunta', prompt: '¿Cómo se dice?', progress: '{current} de {total}', typeAnswer: 'Escribir respuesta', answerLabel: 'Escribe la traducción', baseLabel: 'Traducción', check: 'Comprobar', correct: '¡Correcto! Coincide con la respuesta guardada.', different: 'No coincide con la respuesta guardada. También podría haber otras respuestas válidas.', newRound: 'Nueva ronda' },
  en: { practice: 'Practice', back: 'Back to Study', reveal: 'Show answer', next: 'Next question', prompt: 'How do you say it?', progress: '{current} of {total}', typeAnswer: 'Type answer', answerLabel: 'Type the translation', baseLabel: 'Translation', check: 'Check', correct: 'Correct! Matches the saved answer.', different: 'Does not match the saved answer. Other answers may also be valid.', newRound: 'New round' },
  fr: { practice: 'Réviser', back: 'Retour à l’étude', reveal: 'Voir la réponse', next: 'Question suivante', prompt: 'Comment dit-on ?', progress: '{current} sur {total}', typeAnswer: 'Écrire la réponse', answerLabel: 'Écrivez la traduction', baseLabel: 'Traduction', check: 'Vérifier', correct: 'Bonne réponse ! Elle correspond à la réponse enregistrée.', different: 'Ne correspond pas à la réponse enregistrée. D’autres réponses peuvent aussi être valides.', newRound: 'Nouvelle série' },
  de: { practice: 'Üben', back: 'Zurück zum Lernen', reveal: 'Antwort zeigen', next: 'Nächste Frage', prompt: 'Wie sagt man das?', progress: '{current} von {total}', typeAnswer: 'Antwort schreiben', answerLabel: 'Übersetzung eingeben', baseLabel: 'Übersetzung', check: 'Prüfen', correct: 'Richtig! Stimmt mit der gespeicherten Antwort überein.', different: 'Stimmt nicht mit der gespeicherten Antwort überein. Andere Antworten können ebenfalls richtig sein.', newRound: 'Neue Runde' },
  it: { practice: 'Esercitarsi', back: 'Torna allo studio', reveal: 'Mostra la risposta', next: 'Domanda successiva', prompt: 'Come si dice?', progress: '{current} di {total}', typeAnswer: 'Scrivi la risposta', answerLabel: 'Scrivi la traduzione', baseLabel: 'Traduzione', check: 'Verifica', correct: 'Corretto! Corrisponde alla risposta salvata.', different: 'Non corrisponde alla risposta salvata. Anche altre risposte potrebbero essere valide.', newRound: 'Nuovo turno' },
  pt: { practice: 'Praticar', back: 'Voltar ao estudo', reveal: 'Mostrar resposta', next: 'Pergunta seguinte', prompt: 'Como se diz?', progress: '{current} de {total}', typeAnswer: 'Escrever resposta', answerLabel: 'Escreve a tradução', baseLabel: 'Tradução', check: 'Verificar', correct: 'Correto! Corresponde à resposta guardada.', different: 'Não corresponde à resposta guardada. Outras respostas também podem ser válidas.', newRound: 'Nova ronda' },
  ja: { practice: '練習する', back: '学習に戻る', reveal: '答えを見る', next: '次の問題', prompt: '何と言いますか？', progress: '{total}件中{current}件目', typeAnswer: '答えを入力', answerLabel: '訳を入力', baseLabel: '訳', check: '確認する', correct: '正解！保存した答えと一致しました。', different: '保存した答えとは異なります。ほかの答えも正しい場合があります。', newRound: '次のラウンド' },
};

const sentenceLabels: Record<WordInput['sourceLanguage'], string> = {
  es: 'Frase completa', en: 'Full sentence', fr: 'Phrase complète', de: 'Ganzer Satz',
  it: 'Frase completa', pt: 'Frase completa', ja: '文全体',
};

const roundSummaryText: Record<WordInput['sourceLanguage'], {
  view: string; title: string; reviewed: string; written: string; matched: string; help: string;
  saving: string; saved: string; saveError: string;
}> = {
  es: { view: 'Ver resumen', title: 'Resumen de la ronda', reviewed: 'Preguntas repasadas', written: 'Respuestas escritas', matched: 'Coincidencias con lo guardado', help: 'Mostrar una respuesta no cuenta como intento. Otra traducción también podría ser válida.', saving: 'Guardando la ronda…', saved: 'Ronda guardada en el historial.', saveError: 'No se pudo confirmar si la ronda se guardó. Consulta el historial antes de repetirla.' },
  en: { view: 'View summary', title: 'Round summary', reviewed: 'Questions reviewed', written: 'Answers typed', matched: 'Matches with saved answers', help: 'Revealing an answer does not count as an attempt. Another translation may also be valid.', saving: 'Saving round…', saved: 'Round saved to history.', saveError: 'Could not confirm whether the round was saved. Check the history before repeating it.' },
  fr: { view: 'Voir le résumé', title: 'Résumé de la série', reviewed: 'Questions révisées', written: 'Réponses écrites', matched: 'Correspondances avec les réponses enregistrées', help: 'Afficher une réponse ne compte pas comme une tentative. Une autre traduction peut aussi être valable.', saving: 'Enregistrement de la série…', saved: 'Série enregistrée dans l’historique.', saveError: 'Impossible de confirmer l’enregistrement. Vérifiez l’historique avant de recommencer.' },
  de: { view: 'Zusammenfassung ansehen', title: 'Rundenübersicht', reviewed: 'Geübte Fragen', written: 'Geschriebene Antworten', matched: 'Übereinstimmungen mit gespeicherten Antworten', help: 'Das Anzeigen einer Antwort zählt nicht als Versuch. Eine andere Übersetzung kann ebenfalls richtig sein.', saving: 'Runde wird gespeichert…', saved: 'Runde im Verlauf gespeichert.', saveError: 'Es konnte nicht bestätigt werden, ob die Runde gespeichert wurde. Prüfe den Verlauf vor einer Wiederholung.' },
  it: { view: 'Vedi riepilogo', title: 'Riepilogo del turno', reviewed: 'Domande ripassate', written: 'Risposte scritte', matched: 'Corrispondenze con le risposte salvate', help: 'Mostrare una risposta non conta come tentativo. Anche un’altra traduzione può essere valida.', saving: 'Salvataggio del turno…', saved: 'Turno salvato nella cronologia.', saveError: 'Impossibile confermare il salvataggio. Controlla la cronologia prima di ripetere il turno.' },
  pt: { view: 'Ver resumo', title: 'Resumo da ronda', reviewed: 'Perguntas revistas', written: 'Respostas escritas', matched: 'Correspondências com as respostas guardadas', help: 'Mostrar uma resposta não conta como tentativa. Outra tradução também pode ser válida.', saving: 'A guardar a ronda…', saved: 'Ronda guardada no histórico.', saveError: 'Não foi possível confirmar se a ronda foi guardada. Consulta o histórico antes de a repetir.' },
  ja: { view: '結果を見る', title: 'ラウンドの結果', reviewed: '復習した問題', written: '入力した回答', matched: '保存済みの回答と一致', help: '答えを表示するだけでは回答に数えません。ほかの訳も正しい場合があります。', saving: 'ラウンドを保存中…', saved: '履歴に保存しました。', saveError: '保存できたか確認できませんでした。もう一度行う前に履歴を確認してください。' },
};

type QuestionKind = 'base' | 'past' | 'pastParticiple' | 'ing' | 'example';
interface Question { word: Word; kind: QuestionKind; prompt: string; expected: string }

// Cada campo rellenado genera una pregunta distinta; una tarjeta puede aportar varias.
function makeQuestions(words: Word[]): Question[] {
  return words.flatMap(word => {
    const questions: Question[] = [{ word, kind: 'base', prompt: word.term, expected: word.translation }];
    if (word.wordType === 'verb' && word.targetLanguage === 'en' && word.englishVerbForms) {
      for (const kind of ['past', 'pastParticiple', 'ing'] as const) {
        const expected = word.englishVerbForms[kind]?.trim() ?? '';
        if (expected) questions.push({ word, kind, prompt: word.term, expected });
      }
    }
    for (const example of word.examples) {
      if (example.translation.trim()) {
        questions.push({ word, kind: 'example', prompt: example.text, expected: example.translation });
      }
    }
    return questions;
  });
}

interface Props {
  words: Word[];
  language: WordInput['sourceLanguage'];
  studyLanguage: WordInput['targetLanguage'];
  difficultOnly?: boolean;
  onMark?: (wordId: number, mark: 'known' | 'difficult') => void;
  onNoWords?: () => void;
}

export function StudyMode({ words, language, studyLanguage, difficultOnly = false, onMark, onNoWords }: Props) {
  const [deck, setDeck] = useState(() => shuffle(makeQuestions(words)));
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [writing, setWriting] = useState(false);
  const [answer, setAnswer] = useState('');
  const [matches, setMatches] = useState<boolean | null>(null);
  const [finished, setFinished] = useState(false);
  const [writtenCount, setWrittenCount] = useState(0);
  const [matchedCount, setMatchedCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [historyRevision, setHistoryRevision] = useState(0);
  const [ratedWords, setRatedWords] = useState<Record<number, 'known' | 'difficult'>>({});
  const [ratingBusy, setRatingBusy] = useState(false);
  const [ratingError, setRatingError] = useState(false);
  const saveStarted = useRef(false);
  const copy = studyModeText[language];
  const summary = roundSummaryText[language];
  const markCopy = studyMarkText[language];
  const question = deck[index];
  if (!question) return null;
  const word = question.word;
  const currentMark = ratedWords[word.id] ?? word.studyMark ?? null;
  const kindLabel = question.kind === 'base' ? copy.baseLabel
    : question.kind === 'example' ? sentenceLabels[language] : verbFormsText[language][question.kind];

  function resetQuestion() {
    setRevealed(false);
    setWriting(false);
    setAnswer('');
    setMatches(null);
    setRatingError(false);
  }

  function advance() {
    if (index + 1 === deck.length) {
      if (saveStarted.current) return;
      saveStarted.current = true;
      setFinished(true);
      setSaveStatus('saving');
      void request<StudyRound>('/study-rounds', {
        method: 'POST', body: JSON.stringify({
          sourceLanguage: language, targetLanguage: studyLanguage,
          questionCount: deck.length, writtenCount, matchedCount,
        }),
      }).then(() => {
        setSaveStatus('saved');
        setHistoryRevision(value => value + 1);
      }).catch(() => {
        setSaveStatus('error');
        setHistoryRevision(value => value + 1);
      });
    } else {
      setIndex(index + 1);
      resetQuestion();
    }
  }

  function startRound() {
    const nextWords = difficultOnly ? words.filter(item => (ratedWords[item.id] ?? item.studyMark) === 'difficult') : words;
    if (nextWords.length === 0) { onNoWords?.(); return; }
    saveStarted.current = false;
    setDeck(shuffle(makeQuestions(nextWords)));
    setIndex(0);
    setFinished(false);
    setWrittenCount(0);
    setMatchedCount(0);
    setSaveStatus('idle');
    resetQuestion();
  }

  async function rate(mark: 'known' | 'difficult') {
    if (ratingBusy) return;
    setRatingBusy(true);
    setRatingError(false);
    try {
      await request(`/words/${word.id}/study-mark`, { method: 'PUT', body: JSON.stringify({ mark }) });
      setRatedWords(current => ({ ...current, [word.id]: mark }));
      onMark?.(word.id, mark);
    } catch { setRatingError(true); }
    finally { setRatingBusy(false); }
  }

  function checkAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!answer.trim() || revealed) return;
    const correct = normalizeStudyAnswer(answer, word.targetLanguage) === normalizeStudyAnswer(question.expected, word.targetLanguage);
    setMatches(correct);
    setWrittenCount(count => count + 1);
    if (correct) setMatchedCount(count => count + 1);
    setRevealed(true);
  }

  if (finished) return <><section className="practice-card practice-summary" aria-label={copy.practice}>
    <h3>{summary.title}</h3>
    <dl>
      <div><dt>{summary.reviewed}</dt><dd>{deck.length}</dd></div>
      <div><dt>{summary.written}</dt><dd>{writtenCount}</dd></div>
      <div><dt>{summary.matched}</dt><dd>{matchedCount}</dd></div>
    </dl>
    <p>{summary.help}</p>
    <p className={saveStatus === 'error' ? 'study-save-error' : 'study-save-status'} role="status">{saveStatus === 'saving' ? summary.saving : saveStatus === 'saved' ? summary.saved : saveStatus === 'error' ? summary.saveError : ''}</p>
    <button type="button" className="primary" disabled={saveStatus === 'saving'} onClick={startRound}>{copy.newRound}</button>
  </section><StudyHistory sourceLanguage={language} targetLanguage={studyLanguage} revision={historyRevision} /></>;

  return <><section className="practice-card" aria-label={copy.practice}>
    <p className="practice-progress">{copy.progress.replace('{current}', String(index + 1)).replace('{total}', String(deck.length))}</p>
    <p className="practice-prompt">{copy.prompt}</p>
    <p className="practice-kind">{kindLabel}</p>
    <h3 className={question.kind === 'example' ? 'practice-sentence' : undefined} lang={word.sourceLanguage}>{question.prompt}</h3>
    {writing && !revealed && <form className="practice-form" onSubmit={checkAnswer}>
      <label htmlFor="practice-answer">{question.kind === 'base' ? copy.answerLabel : `${copy.answerLabel}: ${kindLabel}`}</label>
      <input id="practice-answer" lang={word.targetLanguage} value={answer} onChange={event => setAnswer(event.target.value)} maxLength={question.kind === 'example' ? 500 : question.kind === 'base' ? 200 : 120} autoComplete="off" />
      <button type="submit" className="primary" disabled={!answer.trim()}>{copy.check}</button>
    </form>}
    {matches !== null && <p className={`practice-feedback ${matches ? 'is-correct' : 'is-different'}`} role="status"><span aria-hidden="true">{matches ? '✓' : '!'}</span>{matches ? copy.correct : copy.different}</p>}
    {revealed && <p className={`practice-answer${question.kind === 'example' ? ' practice-sentence' : ''}`} lang={word.targetLanguage}>{question.expected}</p>}
    {revealed && <div className="practice-mark-actions" role="group" aria-label={markCopy.retryDifficult}>
      <button type="button" aria-pressed={currentMark === 'known'} disabled={ratingBusy} onClick={() => void rate('known')}>{markCopy.known}</button>
      <button type="button" aria-pressed={currentMark === 'difficult'} disabled={ratingBusy} onClick={() => void rate('difficult')}>{markCopy.difficult}</button>
    </div>}
    {ratingError && <p role="alert" className="study-save-error">{markCopy.saveError}</p>}
    <div className="practice-actions">
      {!revealed
        ? <><button type="button" className="secondary" onClick={() => setRevealed(true)}>{copy.reveal}</button>{!writing && <button type="button" className="primary" onClick={() => setWriting(true)}>{copy.typeAnswer}</button>}</>
        : <button type="button" className="primary" disabled={ratingBusy} onClick={advance}>{index + 1 === deck.length ? summary.view : copy.next}</button>}
    </div>
  </section><StudyHistory sourceLanguage={language} targetLanguage={studyLanguage} revision={historyRevision} /></>;
}
