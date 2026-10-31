import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StudyMode } from './StudyMode';
import type { StudyRound, Word } from './model';

const deck: Word[] = [
  { id: 1, term: 'dormir', translation: 'sleep', sourceLanguage: 'es', targetLanguage: 'en', wordType: 'verb', notes: '', examples: [{ text: 'Duermo.', translation: '' }] },
  { id: 2, term: 'beber', translation: 'drink', sourceLanguage: 'es', targetLanguage: 'en', wordType: 'verb', notes: '', examples: [{ text: 'Bebo.', translation: '' }] },
  { id: 3, term: 'correr', translation: 'run', sourceLanguage: 'es', targetLanguage: 'en', wordType: 'verb', notes: '', examples: [{ text: 'Corro.', translation: '' }] },
];

let savedRounds: StudyRound[];
let failSave: boolean;
let failMark: boolean;
let savedMarks: { id: number; mark: string }[];
beforeEach(() => {
  savedRounds = [];
  failSave = false;
  failMark = false;
  savedMarks = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    const path = new URL(url, 'http://localhost');
    if (/^\/api\/words\/\d+\/study-mark$/.test(path.pathname) && options?.method === 'PUT') {
      if (failMark) return new Response(null, { status: 500 });
      const mark = JSON.parse(options.body as string).mark;
      const id = Number(path.pathname.split('/')[3]);
      savedMarks.push({ id, mark });
      return new Response(JSON.stringify({ id, studyMark: mark }));
    }
    if (path.pathname !== '/api/study-rounds') return new Response(null, { status: 404 });
    if (options?.method === 'POST') {
      if (failSave) return new Response(null, { status: 500 });
      const round = { ...JSON.parse(options.body as string), id: savedRounds.length + 1, completedAt: '2026-10-29T10:00:00.000Z' };
      savedRounds.push(round);
      return new Response(JSON.stringify(round), { status: 201 });
    }
    return new Response(JSON.stringify(savedRounds.filter(round => round.sourceLanguage === path.searchParams.get('sourceLanguage') && round.targetLanguage === path.searchParams.get('targetLanguage')).reverse()));
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('guarda una valoración personal solo al pulsar el botón y permite corregirla', async () => {
  const user = userEvent.setup();
  render(<StudyMode words={[deck[0]]} language="es" studyLanguage="en" />);
  await user.click(screen.getByRole('button', { name: 'Mostrar respuesta' }));
  expect(savedMarks).toHaveLength(0);
  await user.click(screen.getByRole('button', { name: 'Me costó' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Me costó' })).toHaveAttribute('aria-pressed', 'true'));
  expect(savedMarks).toEqual([{ id: 1, mark: 'difficult' }]);
  await user.click(screen.getByRole('button', { name: 'La sabía' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'La sabía' })).toHaveAttribute('aria-pressed', 'true'));
  expect(savedMarks.at(-1)).toEqual({ id: 1, mark: 'known' });
});

it('permite reintentar si falla el guardado de una marca', async () => {
  failMark = true;
  const user = userEvent.setup();
  render(<StudyMode words={[deck[0]]} language="es" studyLanguage="en" />);
  await user.click(screen.getByRole('button', { name: 'Mostrar respuesta' }));
  await user.click(screen.getByRole('button', { name: 'Me costó' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar la marca');
  expect(screen.getByRole('button', { name: 'Me costó' })).toHaveAttribute('aria-pressed', 'false');
  failMark = false;
  await user.click(screen.getByRole('button', { name: 'Me costó' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Me costó' })).toHaveAttribute('aria-pressed', 'true'));
});

it('recupera las rondas de esta pareja al volver a entrar en Practicar', async () => {
  const user = userEvent.setup();
  const first = render(<StudyMode words={[deck[0]]} language="es" studyLanguage="en" />);
  expect(await within(screen.getByRole('region', { name: 'Rondas recientes' })).findByText('Todavía no hay rondas guardadas para esta pareja.')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Mostrar respuesta' }));
  await user.click(screen.getByRole('button', { name: 'Ver resumen' }));
  expect(await screen.findByText('Ronda guardada en el historial.')).toBeVisible();
  expect(savedRounds).toMatchObject([{ sourceLanguage: 'es', targetLanguage: 'en', questionCount: 1, writtenCount: 0, matchedCount: 0 }]);
  first.unmount();
  render(<StudyMode words={[deck[0]]} language="es" studyLanguage="en" />);
  const history = within(screen.getByRole('region', { name: 'Rondas recientes' }));
  expect(await history.findByText(/Preguntas: 1 · Escritas: 0 · Coincidencias: 0/)).toBeVisible();
});

it('conserva el resumen visible cuando falla el guardado', async () => {
  failSave = true;
  const user = userEvent.setup();
  render(<StudyMode words={[deck[0]]} language="es" studyLanguage="en" />);
  await user.click(screen.getByRole('button', { name: 'Mostrar respuesta' }));
  await user.click(screen.getByRole('button', { name: 'Ver resumen' }));
  expect(await screen.findByText(/No se pudo confirmar si la ronda se guardó/)).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Resumen de la ronda' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Nueva ronda' })).toBeEnabled();
  expect(savedRounds).toHaveLength(0);
});

it('permite practicar un verbo anterior a la migración que aún no tiene formas', async () => {
  const user = userEvent.setup();
  render(<StudyMode words={[{ ...deck[0], englishVerbForms: {} }]} language="es" studyLanguage="en" />);
  const exercise = within(screen.getByRole('region', { name: 'Practicar' }));
  expect(exercise.getByText('1 de 1')).toBeVisible();
  await user.click(exercise.getByRole('button', { name: 'Mostrar respuesta' }));
  expect(exercise.getByText('sleep')).toBeVisible();
});

it('practica solo los ejemplos que tienen traducción como frases completas', async () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.999999);
  const user = userEvent.setup();
  const word: Word = { ...deck[0], examples: [
    { text: 'Quiero dormir.', translation: 'I want to sleep.' },
    { text: 'Duermo.', translation: '' },
  ] };
  render(<StudyMode words={[word]} language="es" studyLanguage="en" />);
  const exercise = within(screen.getByRole('region', { name: 'Practicar' }));
  expect(exercise.getByText('1 de 2')).toBeVisible();
  await user.click(exercise.getByRole('button', { name: 'Mostrar respuesta' }));
  await user.click(exercise.getByRole('button', { name: 'Siguiente pregunta' }));
  expect(exercise.getByText('Frase completa')).toBeVisible();
  expect(exercise.getByRole('heading', { name: 'Quiero dormir.' })).toHaveAttribute('lang', 'es');
  expect(exercise.queryByText('I want to sleep.')).not.toBeInTheDocument();
  await user.click(exercise.getByRole('button', { name: 'Escribir respuesta' }));
  const answer = exercise.getByRole('textbox', { name: 'Escribe la traducción: Frase completa' });
  expect(answer).toHaveAttribute('lang', 'en');
  expect(answer).toHaveAttribute('maxlength', '500');
  await user.type(answer, '  I WANT TO SLEEP.  ');
  await user.click(exercise.getByRole('button', { name: 'Comprobar' }));
  expect(exercise.getByRole('status')).toHaveClass('is-correct');
  expect(exercise.getByText('I want to sleep.')).toBeVisible();
  expect(exercise.getByRole('button', { name: 'Ver resumen' })).toBeVisible();
});

it('pregunta por cada forma inglesa rellena y distingue la forma -ing de una oración completa', async () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.999999);
  const user = userEvent.setup();
  const verb: Word = { ...deck[0], englishVerbForms: { past: 'slept', pastParticiple: '', ing: 'sleeping' } };
  render(<StudyMode words={[verb]} language="es" studyLanguage="en" />);
  const exercise = within(screen.getByRole('region', { name: 'Practicar' }));
  expect(exercise.getByText('1 de 3')).toBeVisible();
  expect(exercise.getByText('Traducción')).toBeVisible();
  await user.click(exercise.getByRole('button', { name: 'Mostrar respuesta' }));
  expect(exercise.getByText('sleep')).toBeVisible();
  await user.click(exercise.getByRole('button', { name: 'Siguiente pregunta' }));
  expect(exercise.getByText('Pasado simple')).toBeVisible();
  expect(exercise.queryByText('slept')).not.toBeInTheDocument();
  await user.click(exercise.getByRole('button', { name: 'Escribir respuesta' }));
  await user.type(exercise.getByRole('textbox', { name: 'Escribe la traducción: Pasado simple' }), 'SLEPT');
  await user.click(exercise.getByRole('button', { name: 'Comprobar' }));
  expect(exercise.getByRole('status')).toHaveClass('is-correct');
  expect(exercise.getByText('slept')).toBeVisible();
  await user.click(exercise.getByRole('button', { name: 'Siguiente pregunta' }));
  expect(exercise.getByText('Forma -ing')).toBeVisible();
  expect(exercise.queryByText('Participio pasado')).not.toBeInTheDocument();
  await user.click(exercise.getByRole('button', { name: 'Escribir respuesta' }));
  await user.type(exercise.getByRole('textbox', { name: 'Escribe la traducción: Forma -ing' }), 'am sleeping');
  await user.click(exercise.getByRole('button', { name: 'Comprobar' }));
  expect(exercise.getByRole('status')).toHaveClass('is-different');
  expect(exercise.getByText('sleeping')).toBeVisible();
  expect(exercise.getByRole('button', { name: 'Ver resumen' })).toBeVisible();
  await user.click(exercise.getByRole('button', { name: 'Ver resumen' }));
  expect(exercise.getByText('Preguntas repasadas').nextElementSibling).toHaveTextContent('3');
  expect(exercise.getByText('Respuestas escritas').nextElementSibling).toHaveTextContent('2');
  expect(exercise.getByText('Coincidencias con lo guardado').nextElementSibling).toHaveTextContent('1');
  await waitFor(() => expect(exercise.getByText('Ronda guardada en el historial.')).toBeVisible());
});

it('mezcla una ronda sin repetir tarjetas y permite iniciar otra', async () => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const user = userEvent.setup();
  render(<StudyMode words={deck} language="es" studyLanguage="en" />);
  const exercise = within(screen.getByRole('region', { name: 'Practicar' }));
  const visited: string[] = [];
  for (let step = 0; step < deck.length; step++) {
    visited.push(exercise.getByRole('heading').textContent ?? '');
    await user.click(exercise.getByRole('button', { name: 'Mostrar respuesta' }));
    await user.click(exercise.getByRole('button', { name: step === deck.length - 1 ? 'Ver resumen' : 'Siguiente pregunta' }));
  }
  expect(visited).toEqual(['beber', 'correr', 'dormir']);
  expect(new Set(visited).size).toBe(deck.length);
  expect(exercise.getByRole('heading', { name: 'Resumen de la ronda' })).toBeVisible();
  expect(exercise.getByText('Preguntas repasadas').nextElementSibling).toHaveTextContent('3');
  expect(exercise.getByText('Respuestas escritas').nextElementSibling).toHaveTextContent('0');
  expect(exercise.getByText('Coincidencias con lo guardado').nextElementSibling).toHaveTextContent('0');
  await waitFor(() => expect(exercise.getByText('Ronda guardada en el historial.')).toBeVisible());
  await user.click(exercise.getByRole('button', { name: 'Nueva ronda' }));
  expect(exercise.getByText('1 de 3')).toBeVisible();
  expect(exercise.queryByText('drink')).not.toBeInTheDocument();
});

it('compara la respuesta escrita con la traducción guardada y muestra el resultado', async () => {
  const user = userEvent.setup();
  render(<StudyMode words={[deck[0]]} language="es" studyLanguage="en" />);
  const exercise = within(screen.getByRole('region', { name: 'Practicar' }));
  await user.click(exercise.getByRole('button', { name: 'Escribir respuesta' }));
  const answer = exercise.getByRole('textbox', { name: 'Escribe la traducción' });
  expect(answer).toHaveAttribute('lang', 'en');
  expect(exercise.getByRole('button', { name: 'Comprobar' })).toBeDisabled();
  await user.type(answer, '  SLEEP  ');
  expect(exercise.queryByText('sleep')).not.toBeInTheDocument();
  await user.click(exercise.getByRole('button', { name: 'Comprobar' }));
  expect(exercise.getByRole('status')).toHaveClass('is-correct');
  expect(exercise.getByRole('status').querySelector('span')).toHaveTextContent('✓');
  expect(exercise.getByRole('status')).toHaveTextContent('¡Correcto!');
  expect(exercise.getByRole('status')).toHaveTextContent('Coincide con la respuesta guardada.');
  expect(exercise.getByText('sleep')).toHaveAttribute('lang', 'en');
  await user.click(exercise.getByRole('button', { name: 'Ver resumen' }));
  expect(exercise.getByText('Respuestas escritas').nextElementSibling).toHaveTextContent('1');
  expect(exercise.getByText('Coincidencias con lo guardado').nextElementSibling).toHaveTextContent('1');
  await waitFor(() => expect(exercise.getByText('Ronda guardada en el historial.')).toBeVisible());
  await user.click(exercise.getByRole('button', { name: 'Nueva ronda' }));
  expect(exercise.queryByText('sleep')).not.toBeInTheDocument();
  await user.click(exercise.getByRole('button', { name: 'Escribir respuesta' }));
  await user.type(exercise.getByRole('textbox', { name: 'Escribe la traducción' }), 'nap');
  await user.click(exercise.getByRole('button', { name: 'Comprobar' }));
  expect(exercise.getByRole('status')).toHaveClass('is-different');
  expect(exercise.getByRole('status')).toHaveTextContent('También podría haber otras respuestas válidas.');
  expect(exercise.getByText('sleep')).toBeVisible();
  await user.click(exercise.getByRole('button', { name: 'Ver resumen' }));
  expect(exercise.getByText('Respuestas escritas').nextElementSibling).toHaveTextContent('1');
  expect(exercise.getByText('Coincidencias con lo guardado').nextElementSibling).toHaveTextContent('0');
});
