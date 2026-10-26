import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import type { Collection, Word } from './model';
import { downloadExport } from './exportWords';

vi.mock('./exportWords', () => ({ downloadExport: vi.fn() }));

let words: Word[];
let collections: Collection[];
let lastSearch = '';
beforeEach(() => {
  vi.mocked(downloadExport).mockClear();
  localStorage.clear();
  // jsdom no implementa los diálogos. Las pruebas simulan solo su apertura y cierre.
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
  words = [{ id: 1, term: 'book', translation: 'libro', sourceLanguage: 'es', targetLanguage: 'en', wordType: 'noun', examples: [{ text: 'A book.', translation: '' }], notes: '' }];
  collections = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
    const path = new URL(url, 'http://localhost');
    const method = options.method ?? 'GET';
    if (path.pathname === '/api/collections' && method === 'GET') {
      return new Response(JSON.stringify(collections.filter(collection =>
        (!path.searchParams.get('sourceLanguage') || collection.sourceLanguage === path.searchParams.get('sourceLanguage')) &&
        (!path.searchParams.get('targetLanguage') || collection.targetLanguage === path.searchParams.get('targetLanguage'))
      )));
    }
    if (method === 'GET') {
      lastSearch = path.search;
      const query = path.searchParams.get('search') ?? '';
      return new Response(JSON.stringify(words.filter(word =>
        (word.term.includes(query) || word.translation.includes(query)) &&
        (!path.searchParams.get('sourceLanguage') || word.sourceLanguage === path.searchParams.get('sourceLanguage')) &&
        (!path.searchParams.get('targetLanguage') || word.targetLanguage === path.searchParams.get('targetLanguage')) &&
        (!path.searchParams.get('wordType') || word.wordType === path.searchParams.get('wordType')) &&
        (!path.searchParams.get('collectionId') || word.collectionIds?.includes(Number(path.searchParams.get('collectionId'))))
      )));
    }
    if (path.pathname === '/api/collections' && method === 'POST') {
      const collection = { ...JSON.parse(options.body as string), id: collections.length + 1, wordCount: 0 };
      collections.push(collection);
      return new Response(JSON.stringify(collection), { status: 201 });
    }
    if (path.pathname.startsWith('/api/collections/') && path.pathname.includes('/words/')) {
      const [, , , collectionId, , wordId] = path.pathname.split('/');
      const word = words.find(item => item.id === Number(wordId));
      if (method === 'POST' && word) word.collectionIds = [...(word.collectionIds ?? []), Number(collectionId)];
      if (method === 'DELETE' && word) word.collectionIds = (word.collectionIds ?? []).filter(id => id !== Number(collectionId));
      collections = collections.map(collection => collection.id === Number(collectionId) ? { ...collection, wordCount: words.filter(item => item.collectionIds?.includes(collection.id)).length } : collection);
      return new Response(null, { status: 204 });
    }
    if (path.pathname.startsWith('/api/collections/') && method === 'DELETE') {
      const id = Number(path.pathname.split('/').pop());
      collections = collections.filter(collection => collection.id !== id);
      words.forEach(word => { word.collectionIds = word.collectionIds?.filter(collectionId => collectionId !== id); });
      return new Response(null, { status: 204 });
    }
    if (method === 'POST') words.push({ ...JSON.parse(options.body as string), id: 2 });
    if (method === 'PUT') words[0] = { ...JSON.parse(options.body as string), id: 1 };
    if (method === 'DELETE') { words = words.filter(word => word.id !== Number(path.pathname.split('/').pop())); return new Response(null, { status: 204 }); }
    return new Response(JSON.stringify(words.at(-1)));
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Colección de palabras', () => {
  it('crea una colección mixta, añade una palabra existente y conserva las tarjetas al quitarla', async () => {
    words = [
      { ...words[0], id: 1, term: 'dormir', translation: 'sleep', wordType: 'verb' },
      { ...words[0], id: 2, term: 'cansado', translation: 'tired', wordType: 'adjective' },
      { ...words[0], id: 3, term: 'Buch', translation: 'book', sourceLanguage: 'de' },
    ];
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'dormir' });
    await user.click(screen.getByRole('button', { name: '+ Nueva colección' }));
    await user.type(screen.getByLabelText('Nombre de la colección'), 'A1');
    await user.click(screen.getByRole('button', { name: 'Crear colección' }));
    const groups = within(screen.getByRole('group', { name: 'Colecciones' }));
    await waitFor(() => expect(groups.getByRole('button', { name: 'A1 0' })).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.queryByRole('heading', { name: 'dormir' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Añadir palabra existente' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Añadir palabra existente: A1' }));
    expect(dialog.getByRole('option', { name: 'dormir → sleep' })).toBeInTheDocument();
    expect(dialog.getByRole('option', { name: 'cansado → tired' })).toBeInTheDocument();
    expect(dialog.queryByRole('option', { name: 'Buch → book' })).not.toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Añadir a la colección' }));
    expect(await screen.findByRole('heading', { name: 'dormir' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'cansado' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Quitar de la colección: dormir' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'dormir' })).not.toBeInTheDocument());
    await user.click(groups.getByRole('button', { name: 'Todas' }));
    expect(await screen.findByRole('heading', { name: 'dormir' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'cansado' })).toBeVisible();
  });

  it('muestra un error de exportación sin ocultar la colección', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'book' });
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Network error'));
    await user.click(screen.getByRole('button', { name: 'Exportar colecciones' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron descargar las colecciones.');
    expect(screen.getByRole('heading', { name: 'book' })).toBeVisible();
    expect(downloadExport).not.toHaveBeenCalled();
  });

  it('exporta todas las parejas aunque la pantalla muestre solo una', async () => {
    words = [
      { ...words[0], id: 1, term: 'dormir', translation: 'sleep', wordType: 'verb', englishVerbForms: { past: 'slept', ing: 'sleeping' } },
      { ...words[0], id: 2, term: 'Buch', translation: 'libro', sourceLanguage: 'de', targetLanguage: 'es' },
    ];
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'dormir' });
    expect(screen.queryByRole('heading', { name: 'Buch' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Exportar colecciones' }));
    await waitFor(() => expect(downloadExport).toHaveBeenCalledWith(words, collections));
    expect(lastSearch).toBe('');
    expect(screen.getByText('Archivo de colecciones preparado.')).toBeVisible();
  });

  it('muestra formas inglesas guardadas en la tarjeta del verbo', async () => {
    words = [{ ...words[0], term: 'dormir', translation: 'sleep', wordType: 'verb', englishVerbForms: { past: 'slept', pastParticiple: '', ing: 'sleeping' } }];
    render(<App />);
    expect(await screen.findByText('sleeping')).toHaveAttribute('lang', 'en');
    expect(screen.getByText('Pasado simple')).toBeVisible();
    expect(screen.queryByText('Participio pasado')).not.toBeInTheDocument();
  });

  it('practica solo las palabras filtradas y oculta la respuesta hasta pedirla', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);
    words = [
      { ...words[0], id: 1, term: 'dormir', translation: 'sleep', wordType: 'verb' },
      { ...words[0], id: 2, term: 'beber', translation: 'drink', wordType: 'verb' },
      { ...words[0], id: 3, term: 'cansado', translation: 'tired', wordType: 'adjective' },
    ];
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'dormir' });
    await user.click(within(screen.getByRole('group', { name: 'Filtrar por tipo' })).getByRole('button', { name: 'Verbos' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
    await user.click(screen.getByRole('button', { name: 'Practicar' }));
    const exercise = within(screen.getByRole('region', { name: 'Practicar' }));
    expect(exercise.getByRole('heading', { name: 'dormir' })).toBeVisible();
    expect(exercise.queryByText('sleep')).not.toBeInTheDocument();
    expect(exercise.queryByText('tired')).not.toBeInTheDocument();
    await user.click(exercise.getByRole('button', { name: 'Mostrar respuesta' }));
    expect(exercise.getByText('sleep')).toHaveAttribute('lang', 'en');
    await user.click(exercise.getByRole('button', { name: 'Siguiente pregunta' }));
    expect(exercise.getByRole('heading', { name: 'beber' })).toBeVisible();
    expect(exercise.queryByText('drink')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Volver a las tarjetas' }));
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  it('muestra la traducción debajo de su ejemplo y conserva los idiomas del contenido', async () => {
    words[0].examples = [{ text: 'Leo un libro.', translation: 'I read a book.' }];
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText('Leo un libro.')).toHaveAttribute('lang', 'es');
    expect(screen.getByText('I read a book.')).toHaveAttribute('lang', 'en');
    await user.click(screen.getByRole('button', { name: 'Editar book' }));
    expect(screen.getByLabelText('Ejemplo 1')).toHaveValue('Leo un libro.');
    expect(screen.getByLabelText('Traducción del ejemplo 1')).toHaveValue('I read a book.');
  });

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
    const regularFetch = vi.mocked(fetch).getMockImplementation()!;
    let failures = 2;
    vi.mocked(fetch).mockImplementation((url, options) => {
      if (new URL(String(url), 'http://localhost').pathname === '/api/words' && failures-- > 0) {
        return Promise.resolve(new Response(null, { status: 500 }));
      }
      return regularFetch(url, options);
    });
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
    const regularFetch = vi.mocked(fetch).getMockImplementation()!;
    let failOnce = true;
    vi.mocked(fetch).mockImplementation((url, options) => {
      if (new URL(String(url), 'http://localhost').pathname === '/api/words' && failOnce) {
        failOnce = false;
        return Promise.reject(new TypeError('Network error'));
      }
      return regularFetch(url, options);
    });
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'book' })).toBeVisible());
  });
});
