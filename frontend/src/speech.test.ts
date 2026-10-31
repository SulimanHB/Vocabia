import { afterEach, expect, it, vi } from 'vitest';
import { speakText } from './speech';

afterEach(() => { vi.unstubAllGlobals(); });

it('no informa como fallo la cancelación normal al cambiar de palabra', () => {
  const speak = vi.fn();
  vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn() });
  vi.stubGlobal('SpeechSynthesisUtterance', class { onerror?: (event: { error: string }) => void; constructor(public text: string) {} });
  const onError = vi.fn();
  speakText('sleep', 'en', onError);
  const first = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
  first.onerror?.({ error: 'canceled' } as SpeechSynthesisErrorEvent);
  first.onerror?.({ error: 'interrupted' } as SpeechSynthesisErrorEvent);
  expect(onError).not.toHaveBeenCalled();
  first.onerror?.({ error: 'audio-busy' } as SpeechSynthesisErrorEvent);
  expect(onError).toHaveBeenCalledOnce();
});
