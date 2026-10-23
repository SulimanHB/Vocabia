import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import type { Word } from './model';

let words: Word[];
let lastSearch = '';
beforeEach(() => {
  localStorage.clear();
  // jsdom no implementa los diálogos. Las pruebas simulan solo su apertura y cierre.
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
  words = [{ id: 1, term: 'book', translation: 'libro', sourceLanguage: 'es', targetLanguage: 'en', wordType: 'noun', examples: ['A book.'], notes: '' }];
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
    const path = new URL(url, 'http://localhost');
    const method = options.method ?? 'GET';
    if (method === 'GET') {
      lastSearch = path.search;
      const query = path.searchParams.get('search') ?? '';
      return new Response(JSON.stringify(words.filter(word =>
        (word.term.includes(query) || word.translation.includes(query)) &&
        word.sourceLanguage === path.searchParams.get('sourceLanguage') &&
        word.targetLanguage === path.searchParams.get('targetLanguage') &&
        (!path.searchParams.get('wordType') || word.wordType === path.searchParams.get('wordType'))
      )));
    }
    if (method === 'POST') words.push({ ...JSON.parse(options.body as string), id: 2 });
    if (method === 'PUT') words[0] = { ...JSON.parse(options.body as string), id: 1 };
    if (method === 'DELETE') { words = words.filter(word => word.id !== Number(path.pathname.split('/').pop())); return new Response(null, { status: 204 }); }
    return new Response(JSON.stringify(words.at(-1)));
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Colección de palabras', () => {
  it('filtra con los marcadores de tipo, resalta el activo y permite volver a todos sin salir de la pareja', async () => {
    words = [
      { ...words[0], id: 1, term: 'libro', translation: 'book', wordType: 'noun' },
      { ...words[0], id: 2, term: 'correr', translation: 'run', wordType: 'verb' },
      { ...words[0], id: 3, term: 'rápido', translation: 'fast', wordType: 'adjective' },
      { ...words[0], id: 4, term: 'schnell', translation: 'fast', sourceLanguage: 'de', wordType: 'adjective' },
    ];
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'libro' });
    const filters = within(screen.getByRole('group', { name: 'Filtrar por tipo' }));
    expect(filters.getByRole('button', { name: 'Todos los tipos' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(filters.getByRole('button', { name: 'Adjetivos' }));
    expect(filters.getByRole('button', { name: 'Adjetivos' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('heading', { name: 'rápido' })).toBeVisible();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.queryByRole('heading', { name: 'schnell' })).not.toBeInTheDocument();
    await user.click(filters.getByRole('button', { name: 'Verbos' }));
    expect(await screen.findByRole('heading', { name: 'correr' })).toBeVisible();
    expect(filters.getByRole('button', { name: 'Adjetivos' })).toHaveAttribute('aria-pressed', 'false');
    expect(filters.getByRole('button', { name: 'Verbos' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(filters.getByRole('button', { name: 'Sustantivos' }));
    expect(await screen.findByRole('heading', { name: 'libro' })).toBeVisible();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    await user.click(filters.getByRole('button', { name: 'Todos los tipos' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));
    expect(new URLSearchParams(lastSearch).get('wordType')).toBeNull();
    expect(new URLSearchParams(lastSearch).get('sourceLanguage')).toBe('es');
    expect(new URLSearchParams(lastSearch).get('targetLanguage')).toBe('en');
  });

  it('muestra solo español a inglés, cambia a alemán y recupera las tarjetas al volver', async () => {
    words = [
      { ...words[0], id: 1, term: 'libro', translation: 'book' },
      { ...words[0], id: 2, term: 'book', translation: 'libro', sourceLanguage: 'en', targetLanguage: 'es' },
      { ...words[0], id: 3, term: 'libro alemán', translation: 'Buch', targetLanguage: 'de' },
      { ...words[0], id: 4, term: 'livre', translation: 'book', sourceLanguage: 'fr' },
    ];
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'libro' })).toBeVisible();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.queryByRole('heading', { name: 'book' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'livre' })).not.toBeInTheDocument();
    const choices = within(screen.getByRole('group', { name: '¿Qué idioma quieres estudiar?' }));
    await user.click(choices.getByRole('button', { name: 'Alemán' }));
    expect(screen.queryByRole('heading', { name: 'libro' })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'libro alemán' })).toBeVisible();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    await user.click(choices.getByRole('button', { name: 'Inglés' }));
    expect(await screen.findByRole('heading', { name: 'libro' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'libro alemán' })).not.toBeInTheDocument();
    expect(words).toHaveLength(4);
  });

  it('muestra una colección vacía si no hay tarjetas de la pareja seleccionada', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'book' });
    await user.click(within(screen.getByRole('group', { name: '¿Qué idioma quieres estudiar?' })).getByRole('button', { name: 'Italiano' }));
    expect(await screen.findByText('Tu colección empieza con una palabra')).toBeVisible();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.getByText('0 palabras encontradas')).toBeVisible();
  });

  it('ofrece los seis idiomas distintos del principal y guarda palabras desde español hacia el elegido', async () => {
    const user = userEvent.setup();
    render(<App />);
    const choices = within(screen.getByRole('group', { name: '¿Qué idioma quieres estudiar?' }));
    expect(choices.getAllByRole('button')).toHaveLength(6);
    expect(choices.queryByRole('button', { name: 'Español' })).not.toBeInTheDocument();
    expect(choices.getByRole('button', { name: 'Inglés' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(choices.getByRole('button', { name: 'Francés' }));
    expect(choices.getByRole('button', { name: 'Francés' })).toHaveAttribute('aria-pressed', 'true');
    expect(choices.getByRole('button', { name: 'Inglés' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Español → Francés')).toBeVisible();
    expect(document.documentElement.lang).toBe('es');
    await user.click(screen.getByRole('button', { name: /Añadir palabra/ }));
    expect(screen.getByLabelText('Idioma de la palabra *')).toHaveValue('es');
    expect(screen.getByLabelText('Idioma de la traducción *')).toHaveValue('fr');
    await user.type(screen.getByLabelText('Palabra o expresión *'), 'libro');
    await user.type(screen.getByLabelText('Traducción *'), 'livre');
    await user.type(screen.getByLabelText('Ejemplo 1'), 'Este libro es nuevo.');
    await user.click(screen.getByRole('button', { name: 'Guardar palabra' }));
    expect(await screen.findByRole('heading', { name: 'libro' })).toBeVisible();
    const createCall = vi.mocked(fetch).mock.calls.find(([, options]) => options?.method === 'POST');
    expect(JSON.parse(createCall![1]!.body as string)).toMatchObject({ sourceLanguage: 'es', targetLanguage: 'fr', term: 'libro', translation: 'livre' });
  });

  it('recuerda el idioma de estudio y conserva los idiomas de una entrada al editarla', async () => {
    words[0].targetLanguage = 'ja';
    const user = userEvent.setup();
    const firstVisit = render(<App />);
    await user.click(within(screen.getByRole('group', { name: '¿Qué idioma quieres estudiar?' })).getByRole('button', { name: 'Japonés' }));
    firstVisit.unmount();
    render(<App />);
    expect(within(screen.getByRole('group', { name: '¿Qué idioma quieres estudiar?' })).getByRole('button', { name: 'Japonés' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: /Añadir palabra/ }));
    expect(screen.getByLabelText('Idioma de la palabra *')).toHaveValue('es');
    expect(screen.getByLabelText('Idioma de la traducción *')).toHaveValue('ja');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(await screen.findByRole('button', { name: 'Editar book' }));
    expect(screen.getByLabelText('Idioma de la palabra *')).toHaveValue('es');
    expect(screen.getByLabelText('Idioma de la traducción *')).toHaveValue('ja');
  });

  it('reajusta el estudio si el nuevo idioma principal coincide con el elegido', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Mi idioma: Español' }));
    await user.selectOptions(screen.getByLabelText('Idioma de referencia'), 'en');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    const choices = within(screen.getByRole('group', { name: 'Which language do you want to study?' }));
    expect(choices.queryByRole('button', { name: 'English' })).not.toBeInTheDocument();
    expect(choices.getByRole('button', { name: 'Spanish' })).toHaveAttribute('aria-pressed', 'true');
    expect(choices.getAllByRole('button')).toHaveLength(6);
    await user.click(screen.getByRole('button', { name: 'Add word' }));
    expect(screen.getByLabelText('Word language *')).toHaveValue('en');
    expect(screen.getByLabelText('Translation language *')).toHaveValue('es');
  });

  it.each(['es', 'invalid'])('ignora el idioma de estudio guardado %s si no es válido para el idioma principal', saved => {
    localStorage.setItem('vocabia.studyLanguage', saved);
    render(<App />);
    const choices = within(screen.getByRole('group', { name: '¿Qué idioma quieres estudiar?' }));
    expect(choices.getByRole('button', { name: 'Inglés' })).toHaveAttribute('aria-pressed', 'true');
  });

  it.each([
    ['es', 'Mi colección', 'Añadir palabra', 'Idioma de la palabra *', 'Guardar palabra', 'Cancelar'],
    ['en', 'My collection', 'Add word', 'Word language *', 'Save word', 'Cancel'],
    ['fr', 'Ma collection', 'Ajouter un mot', 'Langue du mot *', 'Enregistrer le mot', 'Annuler'],
    ['de', 'Meine Sammlung', 'Wort hinzufügen', 'Sprache des Wortes *', 'Wort speichern', 'Abbrechen'],
    ['it', 'La mia raccolta', 'Aggiungi parola', 'Lingua della parola *', 'Salva parola', 'Annulla'],
    ['pt', 'A minha coleção', 'Adicionar palavra', 'Idioma da palavra *', 'Guardar palavra', 'Cancelar'],
    ['ja', 'マイコレクション', '単語を追加', '単語の言語 *', '単語を保存', 'キャンセル'],
  ])('traduce colección y formulario en %s y conserva las tarjetas', async (code, heading, add, source, save, cancel) => {
    localStorage.setItem('vocabia.referenceLanguage', code);
    words[0].sourceLanguage = code as Word['sourceLanguage'];
    words[0].targetLanguage = code === 'en' ? 'es' : 'en';
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'book' });
    expect(document.documentElement.lang).toBe(code);
    expect(screen.getByRole('heading', { name: heading })).toBeVisible();
    const card = screen.getByRole('article');
    expect(card).toHaveTextContent('libro');
    expect(card).toHaveTextContent('A book.');
    expect(card).toHaveTextContent('Sustantivo');
    const originalCard = card.outerHTML;
    await user.click(screen.getByRole('button', { name: add }));
    expect(screen.getByLabelText(source)).toBeVisible();
    expect(screen.getByRole('button', { name: save })).toBeVisible();
    await user.click(screen.getByRole('button', { name: cancel }));
    expect(screen.getByRole('article').outerHTML).toBe(originalCard);
  });

  it('traduce filtros, contadores y avisos al cambiar a alemán sin cambiar las tarjetas', async () => {
    words.push({ ...words[0], id: 3, sourceLanguage: 'de' });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'book' });
    await user.click(screen.getByRole('button', { name: 'Mi idioma: Español' }));
    await user.selectOptions(screen.getByLabelText('Idioma de referencia'), 'de');
    await user.click(screen.getByRole('button', { name: 'Fertig' }));
    expect(screen.getByRole('heading', { name: 'Meine Sammlung' })).toBeVisible();
    expect(screen.getByPlaceholderText('Nach einem Wort oder einer Übersetzung suchen…')).toBeVisible();
    expect(screen.getByRole('group', { name: 'Nach Wortart filtern' })).toHaveTextContent('Alle Wortarten');
    expect(await screen.findByText('1 Wort gefunden')).toBeVisible();
    expect(screen.getByText('Referenzsprache: Deutsch. Sie wird für neue Übersetzungen verwendet.')).toBeVisible();
    expect(screen.getByRole('article')).toHaveTextContent('A book.');
    expect(screen.getByRole('article')).toHaveTextContent('Alemán');
    await user.click(screen.getByRole('button', { name: 'Borrar book' }));
    expect(screen.getByRole('heading', { name: 'Dieses Wort löschen?' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Behalten' }));
    await user.type(screen.getByRole('searchbox'), 'missing');
    expect(await screen.findByText('Keine passenden Wörter')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }));
    expect(await screen.findByRole('heading', { name: 'book' })).toBeVisible();
  });

  it('traduce un error del servidor que ya estaba visible al cambiar de idioma', async () => {
    words[0].sourceLanguage = 'en';
    words[0].targetLanguage = 'es';
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Mensaje del servidor en español' }), { status: 500 }));
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 500 }));
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo completar la operación.');
    await user.click(screen.getByRole('button', { name: 'Mi idioma: Español' }));
    await user.selectOptions(screen.getByLabelText('Idioma de referencia'), 'en');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not complete the operation. Please try again.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'book' })).toBeVisible();
  });

  it('recuerda el idioma elegido al volver a abrir la aplicación y lo usa en nuevas palabras', async () => {
    words[0].sourceLanguage = 'fr';
    const user = userEvent.setup();
    const firstVisit = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Mi idioma: Español' }));
    await user.selectOptions(screen.getByLabelText('Idioma de referencia'), 'fr');
    await user.click(screen.getByRole('button', { name: 'Terminé' }));
    firstVisit.unmount();
    render(<App />);
    expect(screen.getByRole('button', { name: 'Ma langue : Français' })).toBeVisible();
    expect(screen.getByText('Un monde de mots à découvrir')).toHaveAttribute('lang', 'fr');
    expect(screen.getByRole('button', { name: 'Ma langue : Français' }).querySelector('svg')).toHaveAttribute('data-language', 'fr');
    await user.click(screen.getByRole('button', { name: 'Ajouter un mot' }));
    expect(screen.getByLabelText('Langue du mot *')).toHaveValue('fr');
    expect(screen.getByLabelText('Langue de la traduction *')).toHaveValue('en');
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    await user.click(await screen.findByRole('button', { name: 'Editar book' }));
    expect(screen.getByLabelText('Langue de la traduction *')).toHaveValue('en');
  });

  it('propone idiomas distintos cuando el idioma de referencia es inglés', async () => {
    localStorage.setItem('vocabia.referenceLanguage', 'en');
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText('A world of words to discover')).toHaveAttribute('lang', 'en');
    await user.click(screen.getByRole('button', { name: 'Add word' }));
    expect(screen.getByLabelText('Translation language *')).toHaveValue('es');
    expect(screen.getByLabelText('Word language *')).toHaveValue('en');
  });

  it('cambia los textos de presentación y la bandera al elegir inglés y permite volver a español', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Mi idioma: Español' }));
    await user.selectOptions(screen.getByLabelText('Idioma de referencia'), 'en');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    const englishButton = screen.getByRole('button', { name: 'My language: English' });
    expect(englishButton.querySelector('svg')).toHaveAttribute('data-language', 'en');
    expect(screen.getByText('A world of words to discover')).toBeVisible();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('One more word.A bigger world.');
    expect(screen.getByText('vocabia · Learn at your own pace')).toBeVisible();
    await user.click(englishButton);
    await user.selectOptions(screen.getByLabelText('Reference language'), 'es');
    await user.click(screen.getByRole('button', { name: 'Listo' }));
    expect(screen.getByText('Un mundo de palabras por descubrir')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Mi idioma: Español' }).querySelector('svg')).toHaveAttribute('data-language', 'es');
    expect(await screen.findByRole('heading', { name: 'book' })).toBeVisible();
  });

  it('utiliza español si la preferencia guardada no es un idioma válido', () => {
    localStorage.setItem('vocabia.referenceLanguage', 'invalid');
    render(<App />);
    expect(screen.getByRole('button', { name: 'Mi idioma: Español' })).toBeVisible();
  });

  it('permite elegir un idioma aunque el navegador bloquee el almacenamiento', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Almacenamiento bloqueado'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Almacenamiento bloqueado'); });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Mi idioma: Español' }));
    await user.selectOptions(screen.getByLabelText('Idioma de referencia'), 'de');
    await user.click(screen.getByRole('button', { name: 'Fertig' }));
    expect(screen.getByRole('button', { name: 'Meine Sprache: Deutsch' })).toBeVisible();
    expect(screen.getByText('Sprache übernommen. Der Browser kann sie nicht für deinen nächsten Besuch speichern.')).toBeVisible();
  });

  it('abre el formulario nuevo, añade y muestra una palabra', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'book' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Añadir palabra/ }));
    await user.type(screen.getByLabelText('Palabra o expresión *'), 'apple');
    await user.type(screen.getByLabelText('Traducción *'), 'manzana');
    await user.type(screen.getByLabelText('Ejemplo 1'), 'An apple.');
    await user.click(screen.getByRole('button', { name: 'Guardar palabra' }));
    expect(await screen.findByRole('heading', { name: 'apple' })).toBeVisible();
  });

  it('edita una palabra y permite cancelar o confirmar su borrado', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Editar book' }));
    const term = screen.getByLabelText('Palabra o expresión *');
    await user.clear(term);
    await user.type(term, 'notebook');
    await user.click(screen.getByRole('button', { name: 'Guardar palabra' }));
    await user.click(await screen.findByRole('button', { name: 'Borrar notebook' }));
    await user.click(screen.getByRole('button', { name: 'Conservar' }));
    expect(screen.getByRole('heading', { name: 'notebook' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Borrar notebook' }));
    await user.click(screen.getByRole('button', { name: 'Borrar palabra' }));
    await waitFor(() => expect(screen.getByText('Tu colección empieza con una palabra')).toBeVisible());
  });

  it('envía búsqueda y filtros combinados y permite limpiarlos', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'book' });
    await user.type(screen.getByRole('searchbox'), 'missing');
    await user.click(within(screen.getByRole('group', { name: 'Filtrar por tipo' })).getByRole('button', { name: 'Sustantivos' }));
    expect(await screen.findByText('Ninguna palabra coincide')).toBeVisible();
    expect(new URLSearchParams(lastSearch).get('sourceLanguage')).toBe('es');
    expect(new URLSearchParams(lastSearch).get('targetLanguage')).toBe('en');
    expect(new URLSearchParams(lastSearch).get('wordType')).toBe('noun');
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(await screen.findByRole('heading', { name: 'book' })).toBeVisible();
    expect(new URLSearchParams(lastSearch).get('sourceLanguage')).toBe('es');
    expect(new URLSearchParams(lastSearch).get('targetLanguage')).toBe('en');
    expect(new URLSearchParams(lastSearch).get('wordType')).toBeNull();
  });

  it('muestra errores de conexión y permite reintentar', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Network error'));
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'book' })).toBeVisible());
  });
});
