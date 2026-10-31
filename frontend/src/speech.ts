import type { WordInput } from './model';

const speechLocales: Record<WordInput['targetLanguage'], string> = {
  es: 'es-ES', en: 'en-US', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', pt: 'pt-PT', ja: 'ja-JP',
};

export function speechLocale(language: WordInput['targetLanguage']): string {
  return speechLocales[language];
}

export function canSpeak(): boolean {
  return typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
}

export function stopSpeaking(): void {
  window.speechSynthesis?.cancel();
}

export function speakText(text: string, language: WordInput['targetLanguage'], onError: () => void): SpeechSynthesisUtterance | null {
  if (!canSpeak()) return null;
  try {
    stopSpeaking();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = speechLocale(language);
    utterance.rate = 0.85;
    // Cambiar de palabra cancela la voz anterior; eso no es un fallo de audio.
    utterance.onerror = event => {
      if (event.error !== 'canceled' && event.error !== 'interrupted') onError();
    };
    window.speechSynthesis.speak(utterance);
    return utterance;
  } catch {
    return null;
  }
}
