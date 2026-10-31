import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { SpeakingExercise } from './SpeakingExercise';
import type { Word } from './model';

const word: Word = { id: 1, term: 'dormir', translation: 'sleep', sourceLanguage: 'es', targetLanguage: 'en', wordType: 'verb', notes: '', examples: [] };

class FakeRecognition {
  static current: FakeRecognition;
  lang = '';
  continuous = true;
  interimResults = true;
  maxAlternatives = 1;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; [index: number]: { transcript: string } | undefined }> }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  constructor() { FakeRecognition.current = this; }
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('compara el texto reconocido sin presentar la coincidencia como nota de pronunciación', async () => {
  vi.stubGlobal('SpeechRecognition', FakeRecognition);
  const user = userEvent.setup();
  render(<SpeakingExercise words={[word]} language="es" studyLanguage="en" />);
  expect(screen.queryByText('sleep')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Hablar' }));
  expect(FakeRecognition.current.lang).toBe('en-US');
  expect(FakeRecognition.current).toMatchObject({ continuous: false, interimResults: false });
  expect(FakeRecognition.current.start).toHaveBeenCalledOnce();
  expect(FakeRecognition.current.maxAlternatives).toBe(1);
  act(() => FakeRecognition.current.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'Sleep.' } }] }));
  expect(screen.getByRole('status')).toHaveTextContent('Esto no evalúa tu pronunciación');
  expect(screen.getByText('Sleep.')).toBeVisible();
  expect(screen.getByText('sleep')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Resultado' }));
  expect(screen.getByText('1 de 1 coincidencias')).toBeVisible();
});

it('no deja elegir una transcripción alternativa ni cuenta tire como tired', async () => {
  vi.stubGlobal('SpeechRecognition', FakeRecognition);
  const user = userEvent.setup();
  render(<SpeakingExercise words={[{ ...word, term: 'cansado', translation: 'tired' }]} language="es" studyLanguage="en" />);
  await user.click(screen.getByRole('button', { name: 'Hablar' }));
  act(() => FakeRecognition.current.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'tire' } }] }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'tired' })).not.toBeInTheDocument();
  expect(screen.getByText(/El navegador entendió/)).toHaveTextContent('tire');
  await user.click(screen.getByRole('button', { name: 'Mostrar respuesta' }));
  await user.click(screen.getByRole('button', { name: 'Resultado' }));
  expect(screen.getByText('0 de 1 coincidencias')).toBeVisible();
});

it('permite volver a hablar si el navegador solo propone tire', async () => {
  vi.stubGlobal('SpeechRecognition', FakeRecognition);
  const user = userEvent.setup();
  render(<SpeakingExercise words={[{ ...word, term: 'cansado', translation: 'tired' }]} language="es" studyLanguage="en" />);
  await user.click(screen.getByRole('button', { name: 'Hablar' }));
  const firstAttempt = FakeRecognition.current;
  act(() => firstAttempt.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'tire' } }] }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Hablar de nuevo' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Hablar de nuevo' }));
  expect(FakeRecognition.current).not.toBe(firstAttempt);
  expect(FakeRecognition.current.start).toHaveBeenCalledOnce();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  act(() => FakeRecognition.current.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'tired' } }] }));
  expect(screen.getByRole('status')).toHaveTextContent('Coincide con la respuesta guardada');
  await user.click(screen.getByRole('button', { name: 'Resultado' }));
  expect(screen.getByText('1 de 1 coincidencias')).toBeVisible();
});

it('muestra el permiso denegado y permite reintentar', async () => {
  vi.stubGlobal('SpeechRecognition', FakeRecognition);
  const user = userEvent.setup();
  render(<SpeakingExercise words={[word]} language="es" studyLanguage="en" />);
  await user.click(screen.getByRole('button', { name: 'Hablar' }));
  act(() => FakeRecognition.current.onerror?.({ error: 'not-allowed' }));
  expect(screen.getByRole('alert')).toHaveTextContent('No hay permiso');
  expect(screen.getByRole('button', { name: 'Hablar' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Hablar' }));
  const active = FakeRecognition.current;
  await user.click(screen.getByRole('button', { name: 'Detener micrófono' }));
  expect(active.abort).toHaveBeenCalledOnce();
  expect(screen.queryByText('sleep')).not.toBeInTheDocument();
});

it('avisa si no hay reconocimiento y no solicita el micrófono', () => {
  vi.stubGlobal('SpeechRecognition', undefined);
  vi.stubGlobal('webkitSpeechRecognition', undefined);
  render(<SpeakingExercise words={[word]} language="es" studyLanguage="en" />);
  expect(screen.getByRole('alert')).toHaveTextContent('no ofrece reconocimiento de voz');
  expect(screen.getByRole('button', { name: 'Hablar' })).toBeDisabled();
});

it('admite el nombre webkitSpeechRecognition usado por algunos navegadores', async () => {
  vi.stubGlobal('SpeechRecognition', undefined);
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
  const user = userEvent.setup();
  render(<SpeakingExercise words={[word]} language="es" studyLanguage="en" />);
  await user.click(screen.getByRole('button', { name: 'Hablar' }));
  expect(FakeRecognition.current.start).toHaveBeenCalledOnce();
  expect(FakeRecognition.current.lang).toBe('en-US');
});
