import { useState, type FormEvent } from 'react';
import type { Word, WordInput } from './model';
import { verbFormsText } from './verbFormsText';

export const studyModeText: Record<WordInput['sourceLanguage'], {
  practice: string; back: string; reveal: string; next: string; prompt: string; progress: string;
  typeAnswer: string; answerLabel: string; baseLabel: string; check: string; correct: string; different: string; newRound: string;
}> = {
  es: { practice: 'Practicar', back: 'Volver a las tarjetas', reveal: 'Mostrar respuesta', next: 'Siguiente pregunta', prompt: '¿Cómo se dice?', progress: '{current} de {total}', typeAnswer: 'Escribir respuesta', answerLabel: 'Escribe la traducción', baseLabel: 'Traducción', check: 'Comprobar', correct: '¡Correcto! Coincide con la respuesta guardada.', different: 'No coincide con la respuesta guardada. También podría haber otras respuestas válidas.', newRound: 'Nueva ronda' },
  en: { practice: 'Practice', back: 'Back to cards', reveal: 'Show answer', next: 'Next question', prompt: 'How do you say it?', progress: '{current} of {total}', typeAnswer: 'Type answer', answerLabel: 'Type the translation', baseLabel: 'Translation', check: 'Check', correct: 'Correct! Matches the saved answer.', different: 'Does not match the saved answer. Other answers may also be valid.', newRound: 'New round' },
  fr: { practice: 'Réviser', back: 'Retour aux fiches', reveal: 'Voir la réponse', next: 'Question suivante', prompt: 'Comment dit-on ?', progress: '{current} sur {total}', typeAnswer: 'Écrire la réponse', answerLabel: 'Écrivez la traduction', baseLabel: 'Traduction', check: 'Vérifier', correct: 'Bonne réponse ! Elle correspond à la réponse enregistrée.', different: 'Ne correspond pas à la réponse enregistrée. D’autres réponses peuvent aussi être valides.', newRound: 'Nouvelle série' },
  de: { practice: 'Üben', back: 'Zurück zu den Karten', reveal: 'Antwort zeigen', next: 'Nächste Frage', prompt: 'Wie sagt man das?', progress: '{current} von {total}', typeAnswer: 'Antwort schreiben', answerLabel: 'Übersetzung eingeben', baseLabel: 'Übersetzung', check: 'Prüfen', correct: 'Richtig! Stimmt mit der gespeicherten Antwort überein.', different: 'Stimmt nicht mit der gespeicherten Antwort überein. Andere Antworten können ebenfalls richtig sein.', newRound: 'Neue Runde' },
  it: { practice: 'Esercitarsi', back: 'Torna alle schede', reveal: 'Mostra la risposta', next: 'Domanda successiva', prompt: 'Come si dice?', progress: '{current} di {total}', typeAnswer: 'Scrivi la risposta', answerLabel: 'Scrivi la traduzione', baseLabel: 'Traduzione', check: 'Verifica', correct: 'Corretto! Corrisponde alla risposta salvata.', different: 'Non corrisponde alla risposta salvata. Anche altre risposte potrebbero essere valide.', newRound: 'Nuovo turno' },
  pt: { practice: 'Praticar', back: 'Voltar aos cartões', reveal: 'Mostrar resposta', next: 'Pergunta seguinte', prompt: 'Como se diz?', progress: '{current} de {total}', typeAnswer: 'Escrever resposta', answerLabel: 'Escreve a tradução', baseLabel: 'Tradução', check: 'Verificar', correct: 'Correto! Corresponde à resposta guardada.', different: 'Não corresponde à resposta guardada. Outras respostas também podem ser válidas.', newRound: 'Nova ronda' },
  ja: { practice: '練習する', back: 'カードに戻る', reveal: '答えを見る', next: '次の問題', prompt: '何と言いますか？', progress: '{total}件中{current}件目', typeAnswer: '答えを入力', answerLabel: '訳を入力', baseLabel: '訳', check: '確認する', correct: '正解！保存した答えと一致しました。', different: '保存した答えとは異なります。ほかの答えも正しい場合があります。', newRound: '次のラウンド' },
};

type QuestionKind = 'base' | 'past' | 'pastParticiple' | 'ing';
interface Question { word: Word; kind: QuestionKind; expected: string }

// Cada campo rellenado genera una pregunta distinta; una tarjeta puede aportar varias.
function makeQuestions(words: Word[]): Question[] {
  return words.flatMap(word => {
    const questions: Question[] = [{ word, kind: 'base', expected: word.translation }];
    if (word.wordType === 'verb' && word.targetLanguage === 'en' && word.englishVerbForms) {
      for (const kind of ['past', 'pastParticiple', 'ing'] as const) {
        const expected = word.englishVerbForms[kind]?.trim() ?? '';
        if (expected) questions.push({ word, kind, expected });
      }
    }
    return questions;
  });
}

// Fisher-Yates: mezcla una copia para visitar cada pregunta exactamente una vez.
function shuffleQuestions(questions: Question[]): Question[] {
  const deck = [...questions];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function normalizeAnswer(value: string, language: WordInput['targetLanguage']): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase(language);
}

interface Props {
  words: Word[];
  language: WordInput['sourceLanguage'];
}

export function StudyMode({ words, language }: Props) {
  const [deck, setDeck] = useState(() => shuffleQuestions(makeQuestions(words)));
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [writing, setWriting] = useState(false);
  const [answer, setAnswer] = useState('');
  const [matches, setMatches] = useState<boolean | null>(null);
  const copy = studyModeText[language];
  const question = deck[index];
  if (!question) return null;
  const word = question.word;
  const kindLabel = question.kind === 'base' ? copy.baseLabel : verbFormsText[language][question.kind];

  function resetQuestion() {
    setRevealed(false);
    setWriting(false);
    setAnswer('');
    setMatches(null);
  }

  function advance() {
    if (index + 1 === deck.length) {
      setDeck(shuffleQuestions(makeQuestions(words)));
      setIndex(0);
    } else {
      setIndex(index + 1);
    }
    resetQuestion();
  }

  function checkAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!answer.trim()) return;
    setMatches(normalizeAnswer(answer, word.targetLanguage) === normalizeAnswer(question.expected, word.targetLanguage));
    setRevealed(true);
  }

  return <section className="practice-card" aria-label={copy.practice}>
    <p className="practice-progress">{copy.progress.replace('{current}', String(index + 1)).replace('{total}', String(deck.length))}</p>
    <p className="practice-prompt">{copy.prompt}</p>
    <p className="practice-kind">{kindLabel}</p>
    <h3 lang={word.sourceLanguage}>{word.term}</h3>
    {writing && !revealed && <form className="practice-form" onSubmit={checkAnswer}>
      <label htmlFor="practice-answer">{question.kind === 'base' ? copy.answerLabel : `${copy.answerLabel}: ${kindLabel}`}</label>
      <input id="practice-answer" lang={word.targetLanguage} value={answer} onChange={event => setAnswer(event.target.value)} maxLength={question.kind === 'base' ? 200 : 120} autoComplete="off" />
      <button type="submit" className="primary" disabled={!answer.trim()}>{copy.check}</button>
    </form>}
    {matches !== null && <p className={`practice-feedback ${matches ? 'is-correct' : 'is-different'}`} role="status"><span aria-hidden="true">{matches ? '✓' : '!'}</span>{matches ? copy.correct : copy.different}</p>}
    {revealed && <p className="practice-answer" lang={word.targetLanguage}>{question.expected}</p>}
    <div className="practice-actions">
      {!revealed
        ? <><button type="button" className="secondary" onClick={() => setRevealed(true)}>{copy.reveal}</button>{!writing && <button type="button" className="primary" onClick={() => setWriting(true)}>{copy.typeAnswer}</button>}</>
        : <button type="button" className="primary" onClick={advance}>{index + 1 === deck.length ? copy.newRound : copy.next}</button>}
    </div>
  </section>;
}
