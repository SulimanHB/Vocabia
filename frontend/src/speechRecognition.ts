// Esta interfaz describe solo lo que usa Vocabia. Algunos navegadores exponen
// SpeechRecognition con el prefijo webkitSpeechRecognition.
interface RecognitionResult { isFinal: boolean; [index: number]: { transcript: string } | undefined }
interface RecognitionEvent { results: ArrayLike<RecognitionResult> }

export interface BrowserRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionWindow = Window & {
  SpeechRecognition?: new () => BrowserRecognition;
  webkitSpeechRecognition?: new () => BrowserRecognition;
};

export function createRecognition(): BrowserRecognition | null {
  const browser = window as RecognitionWindow;
  const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
  if (!Constructor) return null;
  try { return new Constructor(); }
  catch { return null; }
}

export function canRecognize(): boolean {
  const browser = window as RecognitionWindow;
  return Boolean(browser.SpeechRecognition ?? browser.webkitSpeechRecognition);
}
