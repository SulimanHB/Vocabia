import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { WordCard } from './WordCard';
import type { Word } from './model';
import { englishFuture } from './englishFuture';

afterEach(() => { vi.unstubAllGlobals(); });

const verb: Word = {
  id: 1, term: 'dormir', translation: 'sleep', sourceLanguage: 'es', targetLanguage: 'en',
  wordType: 'verb', notes: '', examples: [{ text: 'Duermo.', translation: 'I sleep.' }],
  englishVerbForms: { past: 'slept', pastParticiple: 'slept', ing: 'sleeping' },
};

function renderCard(word: Word, interfaceLanguage: Word['sourceLanguage'] = 'es') {
  return render(<WordCard word={word} interfaceLanguage={interfaceLanguage} inCollection={false} removing={false}
    onRemoveFromCollection={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
}

it('lee el presente, el pasado guardado y el futuro con will', async () => {
  const speak = vi.fn();
  vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn() });
  vi.stubGlobal('SpeechSynthesisUtterance', class { lang = ''; rate = 1; constructor(public text: string) {} });
  renderCard(verb);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Escuchar Presente (forma base): sleep' }));
  await user.click(screen.getByRole('button', { name: 'Escuchar Pasado simple: slept' }));
  await user.click(screen.getByRole('button', { name: 'Escuchar Futuro con will: will sleep' }));
  expect(speak.mock.calls.map(call => call[0].text)).toEqual(['sleep', 'slept', 'will sleep']);
  expect(speak.mock.calls.every(call => call[0].lang === 'en-US')).toBe(true);
  expect(screen.getByRole('button', { name: 'Escuchar Forma -ing: sleeping' })).toBeInTheDocument();
});

it('no inventa un pasado ausente ni un futuro con varias traducciones', () => {
  renderCard({ ...verb, translation: 'sleep / rest', englishVerbForms: {} });
  expect(screen.getByText('Pasado simple')).toBeVisible();
  expect(screen.queryByRole('button', { name: /Escuchar Pasado simple/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Escuchar Futuro con will/ })).not.toBeInTheDocument();
  expect(englishFuture('to sleep')).toBe('will sleep');
  expect(englishFuture('can')).toBeNull();
});

it('conserva las etiquetas de la tarjeta al cambiar el idioma de la interfaz', () => {
  renderCard(verb, 'en');
  expect(screen.getByText('Verbo')).toBeVisible();
  expect(screen.getByRole('article').querySelector('.language-pair')).toHaveTextContent('Español →a Inglés');
  expect(screen.getByRole('button', { name: 'Editar dormir' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Borrar dormir' })).toBeVisible();
});
