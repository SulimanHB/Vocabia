import { useEffect, useRef, useState } from 'react';
import type { Word, WordInput } from './model';
import { canSpeak, speakText, stopSpeaking } from './speech';
import { shuffle } from './shuffle';

const copy: Record<WordInput['sourceLanguage'], {
  start: string; title: string; help: string; play: string; replay: string; unsupported: string;
  speechError: string; tooFew: string; correct: string; different: string; answer: string;
  progress: string; next: string; results: string; score: string; again: string;
}> = {
  es: { start: 'Escuchar y elegir', title: 'Escucha y elige la traducción', help: 'Pulsa Escuchar y elige la palabra en español. El audio usa la voz de tu navegador.', play: 'Escuchar palabra', replay: 'Volver a escuchar', unsupported: 'Este navegador no ofrece reproducción de voz para este ejercicio.', speechError: 'No se pudo reproducir la palabra. Comprueba el audio del dispositivo o prueba otro navegador.', tooFew: 'Necesitas al menos dos palabras distintas en esta pareja o colección para crear opciones.', correct: '¡Correcto!', different: 'No coincide con la palabra guardada.', answer: 'La palabra era', progress: '{current} de {total}', next: 'Siguiente audio', results: 'Resultado', score: '{correct} de {total} aciertos', again: 'Nueva ronda de escucha' },
  en: { start: 'Listen and choose', title: 'Listen and choose the translation', help: 'Press Listen and choose the word in English. Audio uses your browser voice.', play: 'Listen to word', replay: 'Listen again', unsupported: 'This browser cannot speak words for this exercise.', speechError: 'Could not play the word. Check your device audio or try another browser.', tooFew: 'You need at least two distinct words in this pair or collection to create choices.', correct: 'Correct!', different: 'That does not match the saved word.', answer: 'The word was', progress: '{current} of {total}', next: 'Next audio', results: 'Result', score: '{correct} of {total} correct', again: 'New listening round' },
  fr: { start: 'Écouter et choisir', title: 'Écoutez et choisissez la traduction', help: 'Écoutez le mot, puis choisissez sa traduction. La voix vient du navigateur.', play: 'Écouter le mot', replay: 'Réécouter', unsupported: 'Ce navigateur ne peut pas lire les mots à voix haute.', speechError: 'Lecture impossible. Vérifiez le son ou essayez un autre navigateur.', tooFew: 'Il faut au moins deux mots distincts pour créer des choix.', correct: 'Bonne réponse !', different: 'Ce mot ne correspond pas à celui enregistré.', answer: 'Le mot était', progress: '{current} sur {total}', next: 'Audio suivant', results: 'Résultat', score: '{correct} bonnes réponses sur {total}', again: 'Nouvelle série audio' },
  de: { start: 'Hören und wählen', title: 'Höre zu und wähle die Übersetzung', help: 'Höre das Wort an und wähle die Übersetzung. Die Stimme kommt vom Browser.', play: 'Wort anhören', replay: 'Noch einmal anhören', unsupported: 'Dieser Browser kann Wörter nicht vorlesen.', speechError: 'Wiedergabe fehlgeschlagen. Prüfe den Ton oder versuche einen anderen Browser.', tooFew: 'Für Antwortmöglichkeiten brauchst du mindestens zwei verschiedene Wörter.', correct: 'Richtig!', different: 'Das stimmt nicht mit dem gespeicherten Wort überein.', answer: 'Das Wort war', progress: '{current} von {total}', next: 'Nächstes Audio', results: 'Ergebnis', score: '{correct} von {total} richtig', again: 'Neue Hörrunde' },
  it: { start: 'Ascolta e scegli', title: 'Ascolta e scegli la traduzione', help: 'Ascolta la parola e scegli la traduzione. La voce è del browser.', play: 'Ascolta la parola', replay: 'Riascolta', unsupported: 'Questo browser non può leggere le parole ad alta voce.', speechError: 'Riproduzione non riuscita. Controlla l’audio o prova un altro browser.', tooFew: 'Servono almeno due parole distinte per creare le opzioni.', correct: 'Corretto!', different: 'Non corrisponde alla parola salvata.', answer: 'La parola era', progress: '{current} di {total}', next: 'Audio successivo', results: 'Risultato', score: '{correct} risposte corrette su {total}', again: 'Nuovo turno di ascolto' },
  pt: { start: 'Ouvir e escolher', title: 'Ouve e escolhe a tradução', help: 'Ouve a palavra e escolhe a tradução. A voz é do navegador.', play: 'Ouvir palavra', replay: 'Ouvir novamente', unsupported: 'Este navegador não consegue ler palavras em voz alta.', speechError: 'Não foi possível reproduzir. Verifica o som ou tenta outro navegador.', tooFew: 'Precisas de pelo menos duas palavras diferentes para criar opções.', correct: 'Correto!', different: 'Não corresponde à palavra guardada.', answer: 'A palavra era', progress: '{current} de {total}', next: 'Áudio seguinte', results: 'Resultado', score: '{correct} de {total} certas', again: 'Nova ronda de áudio' },
  ja: { start: '聞いて選ぶ', title: '聞いて訳を選ぶ', help: '音声を聞き、訳を選んでください。ブラウザーの音声を使います。', play: '単語を聞く', replay: 'もう一度聞く', unsupported: 'このブラウザーでは音声を再生できません。', speechError: '再生できませんでした。音量を確認するか、別のブラウザーを試してください。', tooFew: '選択肢を作るには、異なる単語が2つ以上必要です。', correct: '正解！', different: '保存した単語と一致しません。', answer: '正しい単語', progress: '{total}問中{current}問目', next: '次の音声', results: '結果', score: '{total}問中{correct}問正解', again: '新しいリスニング' },
};

interface Question { word: Word; choices: Word[] }

function makeDeck(words: Word[]): Question[] {
  const termCounts = new Map<string, number>();
  const translationCounts = new Map<string, number>();
  for (const word of words) {
    const term = word.term.trim().toLocaleLowerCase();
    const translation = word.translation.trim().toLocaleLowerCase();
    termCounts.set(term, (termCounts.get(term) ?? 0) + 1);
    translationCounts.set(translation, (translationCounts.get(translation) ?? 0) + 1);
  }
  // Comparamos por idioma: «pie» puede ser una palabra distinta en español y en inglés.
  const distinct = words.filter(word => word.term.trim() && word.translation.trim()
    && termCounts.get(word.term.trim().toLocaleLowerCase()) === 1
    && translationCounts.get(word.translation.trim().toLocaleLowerCase()) === 1);
  return shuffle(distinct).map(word => ({
    word,
    choices: shuffle([word, ...shuffle(distinct.filter(item => item.id !== word.id)).slice(0, 3)]),
  }));
}

export function ListeningExercise({ words, language, studyLanguage }: {
  words: Word[]; language: WordInput['sourceLanguage']; studyLanguage: WordInput['targetLanguage'];
}) {
  const [deck, setDeck] = useState(() => makeDeck(words));
  const [index, setIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [played, setPlayed] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const activeSpeech = useRef<SpeechSynthesisUtterance | null>(null);
  const text = copy[language];
  const supported = canSpeak();
  const question = deck[index];

  useEffect(() => () => {
    activeSpeech.current = null;
    stopSpeaking();
  }, [index, supported]);

  function play() {
    if (!question || !supported) return;
    setAudioError(false);
    activeSpeech.current = null;
    let utterance: SpeechSynthesisUtterance | null = null;
    utterance = speakText(question.word.translation, studyLanguage, () => {
      if (activeSpeech.current === utterance) setAudioError(true);
    });
    activeSpeech.current = utterance;
    if (utterance) setPlayed(true);
    else setAudioError(true);
  }

  function choose(id: number) {
    if (!question || selectedId !== null || !played || audioError) return;
    setSelectedId(id);
    if (id === question.word.id) setCorrectCount(count => count + 1);
  }

  function next() {
    setIndex(value => value + 1);
    setSelectedId(null);
    setPlayed(false);
    setAudioError(false);
  }

  function restart() {
    setDeck(makeDeck(words));
    setIndex(0);
    setSelectedId(null);
    setCorrectCount(0);
    setPlayed(false);
    setAudioError(false);
  }

  if (deck.length < 2) return <section className="practice-card listening-card" aria-label={text.start}><h3>{text.title}</h3><p>{text.tooFew}</p></section>;
  if (!question) return <section className="practice-card practice-summary" aria-label={text.start}>
    <h3>{text.results}</h3><p>{text.score.replace('{correct}', String(correctCount)).replace('{total}', String(deck.length))}</p>
    <button type="button" className="primary" onClick={restart}>{text.again}</button>
  </section>;

  return <section className="practice-card listening-card" aria-label={text.start}>
    <p className="practice-progress">{text.progress.replace('{current}', String(index + 1)).replace('{total}', String(deck.length))}</p>
    <h3>{text.title}</h3>
    <p>{text.help}</p>
    {!supported && <p className="study-save-error" role="alert">{text.unsupported}</p>}
    <button type="button" className="primary listening-play" disabled={!supported} onClick={play}><span aria-hidden="true">♪</span> {played ? text.replay : text.play}</button>
    {audioError && <p className="study-save-error" role="alert">{text.speechError}</p>}
    <div className="listening-choices" role="group" aria-label={text.title}>
      {question.choices.map(choice => <button key={choice.id} type="button" lang={language}
        className={selectedId === null ? '' : choice.id === question.word.id ? 'is-correct' : choice.id === selectedId ? 'is-different' : ''}
        disabled={!supported || !played || audioError || selectedId !== null} onClick={() => choose(choice.id)}>{choice.term}</button>)}
    </div>
    {selectedId !== null && <><p className={`practice-feedback ${selectedId === question.word.id ? 'is-correct' : 'is-different'}`} role="status">{selectedId === question.word.id ? text.correct : text.different}</p>
      <p className="listening-answer">{text.answer}: <strong lang={studyLanguage}>{question.word.translation}</strong> → <strong lang={language}>{question.word.term}</strong></p>
      <button type="button" className="primary" onClick={next}>{index + 1 === deck.length ? text.results : text.next}</button></>}
  </section>;
}

export const listeningStartText = Object.fromEntries(Object.entries(copy).map(([language, text]) => [language, text.start])) as Record<WordInput['sourceLanguage'], string>;
