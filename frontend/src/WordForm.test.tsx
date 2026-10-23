import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WordForm } from './WordForm';
import { ApiError } from './model';

describe('Formulario de vocabulario', () => {
  it('muestra validación y errores de la API en el idioma de la interfaz', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockRejectedValue(new ApiError('invalidError'));
    render(<WordForm referenceLanguage="en" busy={false} onSave={save} onCancel={() => {}} initial={{ term: 'book', translation: 'libro', sourceLanguage: 'en', targetLanguage: 'es', wordType: 'noun', notes: '', examples: ['A book.'] }} />);
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
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ term: 'book', translation: 'libro', examples: ['I read a book.', 'This book is new.'] }));
  });

  it('rechaza idiomas iguales y muestra los fallos del servidor', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockRejectedValue(new Error('No se pudo guardar.'));
    render(<WordForm busy={false} onSave={save} onCancel={() => {}} initial={{ term: 'book', translation: 'libro', sourceLanguage: 'en', targetLanguage: 'es', wordType: 'noun', notes: '', examples: ['A book.'] }} />);
    await user.selectOptions(screen.getByLabelText('Idioma de la traducción *'), 'en');
    await user.click(screen.getByText('Guardar palabra'));
    expect(screen.getByRole('alert')).toHaveTextContent('Selecciona dos idiomas distintos.');
    expect(save).not.toHaveBeenCalled();
    await user.selectOptions(screen.getByLabelText('Idioma de la traducción *'), 'es');
    await user.click(screen.getByText('Guardar palabra'));
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar.');
  });
});
