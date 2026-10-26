import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { StudyMode } from './StudyMode';
import type { Word } from './model';

const deck: Word[] = [
  { id: 1, term: 'dormir', translation: 'sleep', sourceLanguage: 'es', targetLanguage: 'en', wordType: 'verb', notes: '', examples: [{ text: 'Duermo.', translation: '' }] },
  { id: 2, term: 'beber', translation: 'drink', sourceLanguage: 'es', targetLanguage: 'en', wordType: 'verb', notes: '', examples: [{ text: 'Bebo.', translation: '' }] },
  { id: 3, term: 'correr', translation: 'run', sourceLanguage: 'es', targetLanguage: 'en', wordType: 'verb', notes: '', examples: [{ text: 'Corro.', translation: '' }] },
];

afterEach(() => vi.restoreAllMocks());

it('permite practicar un verbo anterior a la migración que aún no tiene formas', async () => {
  const user = userEvent.setup();
  render(<StudyMode words={[{ ...deck[0], englishVerbForms: {} }]} language="es" />);
  const exercise = within(screen.getByRole('region', { name: 'Practicar' }));
  expect(exercise.getByText('1 de 1')).toBeVisible();
  await user.click(exercise.getByRole('button', { name: 'Mostrar respuesta' }));
  expect(exercise.getByText('sleep')).toBeVisible();
});

it('pregunta por cada forma inglesa rellena y distingue la forma -ing de una oración completa', async () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.999999);
  const user = userEvent.setup();
  const verb: Word = { ...deck[0], englishVerbForms: { past: 'slept', pastParticiple: '', ing: 'sleeping' } };
  render(<StudyMode words={[verb]} language="es" />);
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
  expect(exercise.getByRole('button', { name: 'Nueva ronda' })).toBeVisible();
});

it('mezcla una ronda sin repetir tarjetas y permite iniciar otra', async () => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const user = userEvent.setup();
  render(<StudyMode words={deck} language="es" />);
  const exercise = within(screen.getByRole('region', { name: 'Practicar' }));
  const visited: string[] = [];
  for (let step = 0; step < deck.length; step++) {
    visited.push(exercise.getByRole('heading').textContent ?? '');
    await user.click(exercise.getByRole('button', { name: 'Mostrar respuesta' }));
    await user.click(exercise.getByRole('button', { name: step === deck.length - 1 ? 'Nueva ronda' : 'Siguiente pregunta' }));
  }
  expect(visited).toEqual(['beber', 'correr', 'dormir']);
  expect(new Set(visited).size).toBe(deck.length);
  expect(exercise.getByText('1 de 3')).toBeVisible();
  expect(exercise.queryByText('drink')).not.toBeInTheDocument();
});

it('compara la respuesta escrita con la traducción guardada y muestra el resultado', async () => {
  const user = userEvent.setup();
  render(<StudyMode words={[deck[0]]} language="es" />);
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
  await user.click(exercise.getByRole('button', { name: 'Nueva ronda' }));
  expect(exercise.queryByText('sleep')).not.toBeInTheDocument();
  await user.click(exercise.getByRole('button', { name: 'Escribir respuesta' }));
  await user.type(exercise.getByRole('textbox', { name: 'Escribe la traducción' }), 'nap');
  await user.click(exercise.getByRole('button', { name: 'Comprobar' }));
  expect(exercise.getByRole('status')).toHaveClass('is-different');
  expect(exercise.getByRole('status')).toHaveTextContent('También podría haber otras respuestas válidas.');
  expect(exercise.getByText('sleep')).toBeVisible();
});
