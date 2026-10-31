import { useRef, useState } from 'react';
import type { WordInput } from './model';
import { canSpeak, speakText } from './speech';

const audioText: Record<WordInput['sourceLanguage'], { listen: string; unsupported: string; error: string }> = {
  es: { listen: 'Escuchar', unsupported: 'Audio no disponible en este navegador', error: 'No se pudo reproducir la palabra.' },
  en: { listen: 'Listen', unsupported: 'Audio is unavailable in this browser', error: 'Could not play the word.' },
  fr: { listen: 'Écouter', unsupported: 'Audio indisponible dans ce navigateur', error: 'Lecture du mot impossible.' },
  de: { listen: 'Anhören', unsupported: 'Audio ist in diesem Browser nicht verfügbar', error: 'Das Wort konnte nicht abgespielt werden.' },
  it: { listen: 'Ascolta', unsupported: 'Audio non disponibile in questo browser', error: 'Impossibile riprodurre la parola.' },
  pt: { listen: 'Ouvir', unsupported: 'Áudio indisponível neste navegador', error: 'Não foi possível reproduzir a palavra.' },
  ja: { listen: '聞く', unsupported: 'このブラウザーでは音声を利用できません', error: '単語を再生できませんでした。' },
};

export function WordAudioButton({ text, language, interfaceLanguage }: {
  text: string; language: WordInput['targetLanguage']; interfaceLanguage: WordInput['sourceLanguage'];
}) {
  const [error, setError] = useState(false);
  const activeSpeech = useRef<SpeechSynthesisUtterance | null>(null);
  const labels = audioText[interfaceLanguage];
  const supported = canSpeak();

  function play() {
    setError(false);
    activeSpeech.current = null;
    let utterance: SpeechSynthesisUtterance | null = null;
    utterance = speakText(text, language, () => {
      if (activeSpeech.current === utterance) setError(true);
    });
    activeSpeech.current = utterance;
    if (!utterance) setError(true);
  }

  return <>
    <button type="button" className="word-audio-button" disabled={!supported} title={supported ? `${labels.listen}: ${text}` : labels.unsupported}
      aria-label={`${labels.listen}: ${text}`} onClick={play}><span aria-hidden="true">♪</span>{labels.listen}</button>
    {error && <span className="word-audio-error" role="alert">{labels.error}</span>}
  </>;
}
