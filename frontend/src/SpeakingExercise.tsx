import { useEffect, useRef, useState } from 'react';
import type { Word, WordInput } from './model';
import { canRecognize, createRecognition, type BrowserRecognition } from './speechRecognition';
import { speechLocale } from './speech';
import { normalizeSpokenAnswer } from './studyAnswers';
import { shuffle } from './shuffle';

const retryText: Record<WordInput['sourceLanguage'], { retry: string; hint: string }> = {
  es: { retry: 'Hablar de nuevo', hint: 'No coincide con la respuesta guardada. Si el navegador te entendió mal, vuelve a hablar.' },
  en: { retry: 'Speak again', hint: 'This does not match the saved answer. If the browser misheard you, speak again.' },
  fr: { retry: 'Parler à nouveau', hint: 'Cela ne correspond pas à la réponse enregistrée. Si le navigateur vous a mal compris, réessayez.' },
  de: { retry: 'Noch einmal sprechen', hint: 'Das stimmt nicht mit der gespeicherten Antwort überein. Wenn der Browser dich falsch verstanden hat, sprich erneut.' },
  it: { retry: 'Parla di nuovo', hint: 'Non corrisponde alla risposta salvata. Se il browser ha capito male, riprova.' },
  pt: { retry: 'Falar novamente', hint: 'Não corresponde à resposta guardada. Se o navegador entendeu mal, tenta novamente.' },
  ja: { retry: 'もう一度話す', hint: '保存された答えと一致しません。ブラウザーが聞き間違えた場合は、もう一度話してください。' },
};

export const speakingText: Record<WordInput['sourceLanguage'], {
  start: string; title: string; help: string; privacy: string; unsupported: string; listen: string; stop: string;
  reveal: string; heard: string; expected: string; match: string; different: string; noSpeech: string;
  permission: string; failure: string; next: string; result: string; again: string; score: string; progress: string;
}> = {
  es: { start: 'Hablar y comprobar', title: 'Di la traducción', help: 'Lee la palabra y di su traducción en el idioma que estudias.', privacy: 'El navegador pedirá permiso para el micrófono. Según el navegador, puede procesar tu voz fuera del dispositivo. Vocabia no guarda el audio.', unsupported: 'Este navegador no ofrece reconocimiento de voz.', listen: 'Hablar', stop: 'Detener micrófono', reveal: 'Mostrar respuesta', heard: 'El navegador entendió', expected: 'Respuesta guardada', match: 'Coincide con la respuesta guardada. Esto no evalúa tu pronunciación.', different: 'No coincide con la respuesta guardada. El reconocimiento puede equivocarse.', noSpeech: 'No se reconoció ninguna palabra. Puedes intentarlo de nuevo.', permission: 'No hay permiso para usar el micrófono. Revisa los permisos del navegador.', failure: 'No se pudo reconocer la voz. Puedes intentarlo de nuevo.', next: 'Siguiente palabra', result: 'Resultado', again: 'Nueva ronda hablada', score: '{correct} de {total} coincidencias', progress: '{current} de {total}' },
  en: { start: 'Speak and check', title: 'Say the translation', help: 'Read the word and say its translation in the language you are studying.', privacy: 'Your browser will ask for microphone permission. It may process your voice off-device. Vocabia does not save audio.', unsupported: 'This browser does not support speech recognition.', listen: 'Speak', stop: 'Stop microphone', reveal: 'Show answer', heard: 'The browser heard', expected: 'Saved answer', match: 'Matches the saved answer. This does not assess pronunciation.', different: 'Does not match the saved answer. Recognition can make mistakes.', noSpeech: 'No word was recognized. You can try again.', permission: 'Microphone permission was denied. Check your browser settings.', failure: 'Speech could not be recognized. You can try again.', next: 'Next word', result: 'Result', again: 'New speaking round', score: '{correct} of {total} matches', progress: '{current} of {total}' },
  fr: { start: 'Parler et vérifier', title: 'Dites la traduction', help: 'Lisez le mot et dites sa traduction.', privacy: 'Le navigateur demandera le micro. Il peut traiter votre voix hors de l’appareil. Vocabia ne garde pas l’audio.', unsupported: 'Ce navigateur ne prend pas en charge la reconnaissance vocale.', listen: 'Parler', stop: 'Arrêter le micro', reveal: 'Voir la réponse', heard: 'Le navigateur a compris', expected: 'Réponse enregistrée', match: 'Correspond à la réponse enregistrée. La prononciation n’est pas évaluée.', different: 'Ne correspond pas à la réponse enregistrée. La reconnaissance peut se tromper.', noSpeech: 'Aucun mot reconnu. Réessayez.', permission: 'Accès au micro refusé. Vérifiez les permissions.', failure: 'Reconnaissance impossible. Réessayez.', next: 'Mot suivant', result: 'Résultat', again: 'Nouvelle série orale', score: '{correct} correspondances sur {total}', progress: '{current} sur {total}' },
  de: { start: 'Sprechen und prüfen', title: 'Sag die Übersetzung', help: 'Lies das Wort und sage die Übersetzung.', privacy: 'Der Browser fragt nach dem Mikrofon. Er kann deine Stimme außerhalb des Geräts verarbeiten. Vocabia speichert kein Audio.', unsupported: 'Dieser Browser unterstützt keine Spracherkennung.', listen: 'Sprechen', stop: 'Mikrofon stoppen', reveal: 'Antwort zeigen', heard: 'Der Browser verstand', expected: 'Gespeicherte Antwort', match: 'Stimmt mit der gespeicherten Antwort überein. Die Aussprache wird nicht bewertet.', different: 'Stimmt nicht überein. Die Erkennung kann sich irren.', noSpeech: 'Kein Wort erkannt. Versuche es erneut.', permission: 'Mikrofonzugriff verweigert. Prüfe die Berechtigungen.', failure: 'Sprache konnte nicht erkannt werden. Versuche es erneut.', next: 'Nächstes Wort', result: 'Ergebnis', again: 'Neue Sprechrunde', score: '{correct} von {total} Übereinstimmungen', progress: '{current} von {total}' },
  it: { start: 'Parla e verifica', title: 'Di’ la traduzione', help: 'Leggi la parola e pronuncia la traduzione.', privacy: 'Il browser chiederà il microfono. Può elaborare la voce fuori dal dispositivo. Vocabia non salva audio.', unsupported: 'Questo browser non supporta il riconoscimento vocale.', listen: 'Parla', stop: 'Ferma microfono', reveal: 'Mostra risposta', heard: 'Il browser ha capito', expected: 'Risposta salvata', match: 'Corrisponde alla risposta salvata. La pronuncia non viene valutata.', different: 'Non corrisponde alla risposta salvata. Il riconoscimento può sbagliare.', noSpeech: 'Nessuna parola riconosciuta. Riprova.', permission: 'Accesso al microfono negato. Controlla i permessi.', failure: 'Impossibile riconoscere la voce. Riprova.', next: 'Parola successiva', result: 'Risultato', again: 'Nuovo turno parlato', score: '{correct} corrispondenze su {total}', progress: '{current} di {total}' },
  pt: { start: 'Falar e verificar', title: 'Diz a tradução', help: 'Lê a palavra e diz a tradução.', privacy: 'O navegador pedirá acesso ao microfone. Pode processar a voz fora do dispositivo. A Vocabia não guarda áudio.', unsupported: 'Este navegador não suporta reconhecimento de voz.', listen: 'Falar', stop: 'Parar microfone', reveal: 'Mostrar resposta', heard: 'O navegador entendeu', expected: 'Resposta guardada', match: 'Corresponde à resposta guardada. A pronúncia não é avaliada.', different: 'Não corresponde à resposta guardada. O reconhecimento pode falhar.', noSpeech: 'Nenhuma palavra reconhecida. Tenta novamente.', permission: 'Acesso ao microfone recusado. Verifica as permissões.', failure: 'Não foi possível reconhecer a voz. Tenta novamente.', next: 'Palavra seguinte', result: 'Resultado', again: 'Nova ronda falada', score: '{correct} de {total} correspondências', progress: '{current} de {total}' },
  ja: { start: '話して確認', title: '訳を話す', help: '単語を読み、学習中の言語で訳を話してください。', privacy: 'ブラウザーがマイクの許可を求めます。音声が外部で処理される場合があります。Vocabiaは音声を保存しません。', unsupported: 'このブラウザーでは音声認識を利用できません。', listen: '話す', stop: 'マイクを止める', reveal: '答えを見る', heard: '認識された言葉', expected: '保存した答え', match: '保存した答えと一致します。発音の評価ではありません。', different: '保存した答えと異なります。音声認識が間違うこともあります。', noSpeech: '言葉を認識できませんでした。もう一度試してください。', permission: 'マイクの許可がありません。ブラウザーの設定を確認してください。', failure: '音声を認識できませんでした。もう一度試してください。', next: '次の単語', result: '結果', again: '新しい発話練習', score: '{total}問中{correct}問一致', progress: '{total}問中{current}問目' },
};

export function SpeakingExercise({ words, language, studyLanguage }: {
  words: Word[]; language: WordInput['sourceLanguage']; studyLanguage: WordInput['targetLanguage'];
}) {
  const [deck, setDeck] = useState(() => shuffle(words.filter(word => word.term.trim() && word.translation.trim())));
  const [index, setIndex] = useState(0);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [matches, setMatches] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [error, setError] = useState<'permission' | 'noSpeech' | 'failure' | null>(null);
  const active = useRef<BrowserRecognition | null>(null);
  const copy = speakingText[language];
  const retry = retryText[language];
  const word = deck[index];

  useEffect(() => () => {
    const recognition = active.current;
    active.current = null;
    try { recognition?.abort(); } catch { /* La página ya está saliendo. */ }
  }, []);

  function stop() {
    const recognition = active.current;
    active.current = null;
    try { recognition?.abort(); } catch { /* El navegador puede haber cerrado la escucha. */ }
    setListening(false);
  }

  function start() {
    if (!word || listening || revealed) return;
    setError(null);
    setTranscript(null);
    const recognition = createRecognition();
    if (!recognition) { setError('failure'); return; }
    recognition.lang = speechLocale(studyLanguage);
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = event => {
      if (active.current !== recognition) return;
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result?.isFinal) continue;
        const heard = result[0]?.transcript?.trim();
        if (!heard) continue;
        active.current = null;
        try { recognition.stop(); } catch { /* Ya tenemos el resultado final. */ }
        setListening(false);
        setTranscript(heard);
        const correct = normalizeSpokenAnswer(heard, studyLanguage) === normalizeSpokenAnswer(word.translation, studyLanguage);
        if (correct) {
          setMatches(true);
          setCorrectCount(count => count + 1);
          setRevealed(true);
        }
        return;
      }
    };
    recognition.onerror = event => {
      if (active.current !== recognition || event.error === 'aborted') return;
      active.current = null;
      setListening(false);
      setError(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'permission' : event.error === 'no-speech' ? 'noSpeech' : 'failure');
    };
    recognition.onend = () => {
      if (active.current !== recognition) return;
      active.current = null;
      setListening(false);
      setError('noSpeech');
    };
    active.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      active.current = null;
      setListening(false);
      setError('failure');
    }
  }

  function next() {
    stop();
    setIndex(current => current + 1);
    setTranscript(null);
    setRevealed(false);
    setMatches(false);
    setError(null);
  }

  function restart() {
    stop();
    setDeck(shuffle(words.filter(item => item.term.trim() && item.translation.trim())));
    setIndex(0);
    setTranscript(null);
    setRevealed(false);
    setMatches(false);
    setCorrectCount(0);
    setError(null);
  }

  if (deck.length === 0) return null;
  if (!word) return <section className="practice-card practice-summary" aria-label={copy.start}>
    <h3>{copy.result}</h3><p>{copy.score.replace('{correct}', String(correctCount)).replace('{total}', String(deck.length))}</p>
    <button type="button" className="primary" onClick={restart}>{copy.again}</button>
  </section>;

  return <section className="practice-card speaking-card" aria-label={copy.start}>
    <p className="practice-progress">{copy.progress.replace('{current}', String(index + 1)).replace('{total}', String(deck.length))}</p>
    <p className="practice-prompt">{copy.title}</p>
    <h3 lang={word.sourceLanguage}>{word.term}</h3>
    <p className="speaking-help">{copy.help}</p>
    <p className="speaking-privacy">{copy.privacy}</p>
    {!canRecognize() && <p className="study-save-error" role="alert">{copy.unsupported}</p>}
    {!revealed && transcript === null && <div className="practice-actions">
      <button type="button" className="primary" disabled={!canRecognize()} onClick={listening ? stop : start}>{listening ? copy.stop : copy.listen}</button>
      <button type="button" className="secondary" onClick={() => { stop(); setRevealed(true); }}>{copy.reveal}</button>
    </div>}
    {!revealed && transcript !== null && <div className="speaking-review">
      <p>{copy.heard}: <strong lang={studyLanguage}>{transcript}</strong></p>
      <p>{retry.hint}</p>
      <div className="practice-actions"><button type="button" className="primary" onClick={start}>{retry.retry}</button>
        <button type="button" className="secondary" onClick={() => setRevealed(true)}>{copy.reveal}</button></div>
    </div>}
    {error && <p className="study-save-error speaking-error" role="alert">{copy[error]}</p>}
    {revealed && <>
      {matches && <p className="practice-feedback is-correct" role="status">{copy.match}</p>}
      {transcript !== null && <p className="speaking-transcript">{copy.heard}: <strong lang={studyLanguage}>{transcript}</strong></p>}
      <p className="speaking-transcript">{copy.expected}: <strong lang={studyLanguage}>{word.translation}</strong></p>
      <button type="button" className="primary" onClick={next}>{index + 1 === deck.length ? copy.result : copy.next}</button>
    </>}
  </section>;
}
