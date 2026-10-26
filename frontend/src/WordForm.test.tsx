import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WordForm } from './WordForm';
import { ApiError } from './model';

describe('Formulario de vocabulario', () => {
  it('edita formas inglesas de un verbo y las limpia al cambiar a otro idioma', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    render(<WordForm busy={false} onSave={save} onCancel={() => {}} initial={{ term: 'dormir', translation: 'sleep', sourceLanguage: 'es', targetLanguage: 'en', wordType: 'verb', notes: '', examples: [{ text: 'Duermo.', translation: '' }], englishVerbForms: { past: 'slept', pastParticiple: 'slept', ing: 'sleeping' } }} />);
    expect(screen.getByLabelText(/Pasado simple/)).toHaveValue('slept');
    expect(screen.getByLabelText(/Forma -ing/)).toHaveValue('sleeping');
    await user.clear(screen.getByLabelText(/Forma -ing/));
    await user.type(screen.getByLabelText(/Forma -ing/), 'sleeping');
    await user.click(screen.getByRole('button', { name: 'Guardar palabra' }));
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ englishVerbForms: { past: 'slept', pastParticiple: 'slept', ing: 'sleeping' } }));
    await user.selectOptions(screen.getByLabelText('Idioma de la traducción *'), 'fr');
    expect(screen.queryByLabelText(/Pasado simple/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar palabra' }));
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ englishVerbForms: { past: '', pastParticiple: '', ing: '' } }));
  });

  it('edita pares de ejemplo y traducción, añade y quita pares completos y admite traducciones vacías', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    const initial = { term: 'libro', translation: 'book', sourceLanguage: 'es' as const, targetLanguage: 'en' as const, wordType: 'noun' as const, notes: '', examples: [
      { text: 'Leo un libro.', translation: 'I read a book.' }, { text: 'Otro libro.', translation: '' },
    ] };
    render(<WordForm busy={false} initial={initial} onSave={save} onCancel={() => {}} />);
    expect(screen.getByLabelText('Traducción del ejemplo 1')).toHaveValue('I read a book.');
    expect(screen.getByLabelText('Ejemplo 1')).toHaveAttribute('lang', 'es');
    expect(screen.getByLabelText('Traducción del ejemplo 1')).toHaveAttribute('lang', 'en');
    await user.clear(screen.getByLabelText('Traducción del ejemplo 1'));
    await user.type(screen.getByLabelText('Traducción del ejemplo 1'), 'I am reading a book.');
    await user.click(screen.getByRole('button', { name: 'Quitar ejemplo 2' }));
    await user.click(screen.getByRole('button', { name: '+ Añadir otro ejemplo' }));
    expect(screen.getByLabelText('Traducción del ejemplo 2')).toHaveValue('');
    await user.type(screen.getByLabelText('Ejemplo 2'), 'Un libro nuevo.');
    await user.click(screen.getByRole('button', { name: 'Guardar palabra' }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ examples: [
      { text: 'Leo un libro.', translation: 'I am reading a book.' }, { text: 'Un libro nuevo.', translation: '' },
    ] }));
    expect(initial.examples[0].translation).toBe('I read a book.');
  });

  it('muestra validación y errores de la API en el idioma de la interfaz', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockRejectedValue(new ApiError('invalidError'));
    render(<WordForm referenceLanguage="en" busy={false} onSave={save} onCancel={() => {}} initial={{ term: 'book', translation: 'libro', sourceLanguage: 'en', targetLanguage: 'es', wordType: 'noun', notes: '', examples: [{ text: 'A book.', translation: '' }] }} />);
    await user.selectOptions(screen.getByLabelText('Translation language *'), 'en');
    await user.click(screen.getByRole('button', { name: 'Save word' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Select two different languages.');
    expect(save).not.toHaveBeenCalled();
    await user.selectOptions(screen.getByLabelText('Translation language *'), 'es');
    await user.click(screen.getByRole('button', { name: 'Save word' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Check the fields and filters:');
  });

  it('permite añadir varios ejemplos y guardar los datos', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<WordForm busy={false} onSave={save} onCancel={() => {}} />);
    await user.type(screen.getByLabelText('Palabra o expresión *'), 'book');
    await user.type(screen.getByLabelText('Traducción *'), 'libro');
    await user.type(screen.getByLabelText('Ejemplo 1'), 'I read a book.');
    await user.click(screen.getByText('+ Añadir otro ejemplo'));
    await user.type(screen.getByLabelText('Ejemplo 2'), 'This book is new.');
    await user.click(screen.getByText('Guardar palabra'));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ term: 'book', translation: 'libro', examples: [{ text: 'I read a book.', translation: '' }, { text: 'This book is new.', translation: '' }] }));
  });

  it('rechaza idiomas iguales y muestra los fallos del servidor', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockRejectedValue(new Error('No se pudo guardar.'));
    render(<WordForm busy={false} onSave={save} onCancel={() => {}} initial={{ term: 'book', translation: 'libro', sourceLanguage: 'en', targetLanguage: 'es', wordType: 'noun', notes: '', examples: [{ text: 'A book.', translation: '' }] }} />);
    await user.selectOptions(screen.getByLabelText('Idioma de la traducción *'), 'en');
    await user.click(screen.getByText('Guardar palabra'));
    expect(screen.getByRole('alert')).toHaveTextContent('Selecciona dos idiomas distintos.');
    expect(save).not.toHaveBeenCalled();
    await user.selectOptions(screen.getByLabelText('Idioma de la traducción *'), 'es');
    await user.click(screen.getByText('Guardar palabra'));
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar.');
  });
});
