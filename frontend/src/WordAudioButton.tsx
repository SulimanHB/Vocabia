import { useRef, useState } from 'react';
import type { WordInput } from './model';
import { canSpeak, speakText } from './speech';

const audioText: Record<WordInput['sourceLanguage'], { listen: string; slow: string; unsupported: string; error: string }> = {
  es: { listen: 'Escuchar', slow: 'Escuchar despacio', unsupported: 'Audio no disponible en este navegador', error: 'No se pudo reproducir la palabra.' },
  en: { listen: 'Listen', slow: 'Listen slowly', unsupported: 'Audio is unavailable in this browser', error: 'Could not play the word.' },
  fr: { listen: 'Écouter', slow: 'Écouter lentement', unsupported: 'Audio indisponible dans ce navigateur', error: 'Lecture du mot impossible.' },
  de: { listen: 'Anhören', slow: 'Langsam anhören', unsupported: 'Audio ist in diesem Browser nicht verfügbar', error: 'Das Wort konnte nicht abgespielt werden.' },
  it: { listen: 'Ascolta', slow: 'Ascolta lentamente', unsupported: 'Audio non disponibile in questo browser', error: 'Impossibile riprodurre la parola.' },
  pt: { listen: 'Ouvir', slow: 'Ouvir devagar', unsupported: 'Áudio indisponível neste navegador', error: 'Não foi possível reproduzir a palavra.' },
  ja: { listen: '聞く', slow: 'ゆっくり聞く', unsupported: 'このブラウザーでは音声を利用できません', error: '単語を再生できませんでした。' },
};

// La mitad de lo normal: el caracol sirve para oír cada sílaba.
const slowRate = 0.5;

export function WordAudioButton({ text, language, interfaceLanguage, context, compact = false }: {
  text: string; language: WordInput['targetLanguage']; interfaceLanguage: WordInput['sourceLanguage'];
  context?: string; compact?: boolean;
}) {
  const [error, setError] = useState(false);
  const activeSpeech = useRef<SpeechSynthesisUtterance | null>(null);
  const labels = audioText[interfaceLanguage];
  const label = (action: string) => `${action}${context ? ` ${context}` : ''}: ${text}`;
  const actionLabel = label(labels.listen);
  const supported = canSpeak();

  function play(rate?: number) {
    setError(false);
    activeSpeech.current = null;
    let utterance: SpeechSynthesisUtterance | null = null;
    utterance = speakText(text, language, () => {
      if (activeSpeech.current === utterance) setError(true);
    }, rate);
    activeSpeech.current = utterance;
    if (!utterance) setError(true);
  }

  return <>
    <button type="button" className={`word-audio-button${compact ? ' compact' : ''}`} disabled={!supported} title={supported ? actionLabel : labels.unsupported}
      aria-label={actionLabel} onClick={() => play()}><span aria-hidden="true">♪</span>{!compact && labels.listen}</button>
    {!compact && <button type="button" className="word-audio-button compact word-audio-slow" disabled={!supported}
      title={supported ? label(labels.slow) : labels.unsupported} aria-label={label(labels.slow)} onClick={() => play(slowRate)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 16.6a5.6 5.6 0 1 1 5.6-5.6 3.7 3.7 0 0 1-3.7 3.7 2.2 2.2 0 0 1-2.2-2.2 1 1 0 0 1 1-1" /><path d="M6.2 18.6H19a2.2 2.2 0 0 0 2-1.3" /><path d="M6.2 18.6A3 3 0 0 1 3.4 15.4v-1.6" /><path d="m3.6 13.6-1-3.4M4.6 13.9l1.3-3.3" /><circle cx="2.5" cy="9.6" r="1.1" /><circle cx="6.1" cy="9.9" r="1.1" /></svg>
    </button>}
    {error && <span className="word-audio-error" role="alert">{labels.error}</span>}
  </>;
}
