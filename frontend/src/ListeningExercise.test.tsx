import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { ListeningExercise } from './ListeningExercise';
import type { Word } from './model';

const words: Word[] = [
  { id: 1, term: 'dormir', translation: 'sleep', sourceLanguage: 'es', targetLanguage: 'en', wordType: 'verb', notes: '', examples: [] },
  { id: 2, term: 'beber', translation: 'drink', sourceLanguage: 'es', targetLanguage: 'en', wordType: 'verb', notes: '', examples: [] },
  { id: 3, term: 'correr', translation: 'run', sourceLanguage: 'es', targetLanguage: 'en', wordType: 'verb', notes: '', examples: [] },
  { id: 4, term: 'comer', translation: 'eat', sourceLanguage: 'es', targetLanguage: 'en', wordType: 'verb', notes: '', examples: [] },
];

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('pronuncia la palabra estudiada y corrige la opción sin revelarla antes', async () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.99999);
  const speak = vi.fn();
  const cancel = vi.fn();
  class Utterance { lang = ''; rate = 1; onerror?: () => void; constructor(public text: string) {} }
  vi.stubGlobal('speechSynthesis', { speak, cancel });
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
  const user = userEvent.setup();
  render(<ListeningExercise words={words} language="es" studyLanguage="en" />);

  const exercise = within(screen.getByRole('region', { name: 'Escuchar y elegir' }));
  expect(exercise.queryByText('sleep')).not.toBeInTheDocument();
  expect(exercise.getByRole('button', { name: 'dormir' })).toBeDisabled();
  await user.click(exercise.getByRole('button', { name: 'Escuchar palabra' }));
  expect(speak).toHaveBeenCalledOnce();
  expect(speak.mock.calls[0][0]).toMatchObject({ text: 'sleep', lang: 'en-US', rate: 0.85 });
  expect(exercise.queryByText('sleep')).not.toBeInTheDocument();

  await user.click(exercise.getByRole('button', { name: 'beber' }));
  expect(exercise.getByRole('status')).toHaveTextContent('No coincide');
  expect(exercise.getByText('sleep')).toBeVisible();
  expect(exercise.getByRole('button', { name: 'dormir' })).toHaveClass('is-correct');
  await user.click(exercise.getByRole('button', { name: 'Siguiente audio' }));
  expect(cancel).toHaveBeenCalled();
  expect(exercise.queryByText('sleep')).not.toBeInTheDocument();
  expect(exercise.getByText('2 de 4')).toBeVisible();
});

it('explica cuándo no hay opciones inequívocas o el navegador carece de voz', () => {
  const ambiguous = [{ ...words[0] }, { ...words[1], translation: 'sleep' }];
  const first = render(<ListeningExercise words={ambiguous} language="es" studyLanguage="en" />);
  expect(screen.getByText(/Necesitas al menos dos palabras distintas/)).toBeVisible();
  first.unmount();
  render(<ListeningExercise words={words} language="es" studyLanguage="en" />);
  expect(screen.getByRole('alert')).toHaveTextContent('Este navegador no ofrece reproducción de voz');
  expect(screen.getByRole('button', { name: 'Escuchar palabra' })).toBeDisabled();
});

it('conserva palabras iguales en idiomas diferentes si las respuestas son inequívocas', () => {
  vi.stubGlobal('speechSynthesis', { speak: vi.fn(), cancel: vi.fn() });
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
  render(<ListeningExercise words={[
    { ...words[0], term: 'pie', translation: 'foot' },
    { ...words[1], term: 'pastel', translation: 'pie' },
  ]} language="es" studyLanguage="en" />);
  const exercise = within(screen.getByRole('region', { name: 'Escuchar y elegir' }));
  expect(exercise.getByRole('button', { name: 'pie' })).toBeInTheDocument();
  expect(exercise.getByRole('button', { name: 'pastel' })).toBeInTheDocument();
});
