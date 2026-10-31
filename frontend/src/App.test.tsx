import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import type { Collection, Word } from './model';
import { downloadExport } from './exportWords';
import { createExportDocument } from './exportWords';

vi.mock('./exportWords', async importOriginal => ({ ...await importOriginal<typeof import('./exportWords')>(), downloadExport: vi.fn() }));

let words: Word[];
let collections: Collection[];
let lastSearch = '';
let mergeBackup: { keep: Word; source: Word } | null;
beforeEach(() => {
  vi.mocked(downloadExport).mockClear();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  // jsdom no implementa los diálogos. Las pruebas simulan solo su apertura y cierre.
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
  words = [{ id: 1, term: 'book', translation: 'libro', sourceLanguage: 'es', targetLanguage: 'en', wordType: 'noun', examples: [{ text: 'A book.', translation: '' }], notes: '' }];
  collections = [];
  mergeBackup = null;
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
    const path = new URL(url, 'http://localhost');
    const method = options.method ?? 'GET';
    if (path.pathname === '/api/collections' && method === 'GET') {
      return new Response(JSON.stringify(collections.filter(collection =>
        (!path.searchParams.get('sourceLanguage') || collection.sourceLanguage === path.searchParams.get('sourceLanguage')) &&
        (!path.searchParams.get('targetLanguage') || collection.targetLanguage === path.searchParams.get('targetLanguage'))
      )));
    }
    if (path.pathname === '/api/study-rounds' && method === 'GET') return new Response(JSON.stringify([]));
    if (path.pathname === '/api/words/merge/latest' && method === 'GET') {
      return new Response(JSON.stringify(mergeBackup ? { id: 1, term: mergeBackup.keep.term, translation: mergeBackup.keep.translation } : null));
    }
    if (/^\/api\/words\/\d+\/study-mark$/.test(path.pathname) && method === 'PUT') {
      const id = Number(path.pathname.split('/')[3]);
      const mark = JSON.parse(options.body as string).mark;
      const item = words.find(word => word.id === id)!;
      item.studyMark = mark;
      return new Response(JSON.stringify({ id, studyMark: mark }));
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
    if (path.pathname === '/api/import' && method === 'POST') {
      const { document, mode } = JSON.parse(options.body as string);
      let createdCollections = 0;
      let reusedCollections = 0;
      let createdWords = 0;
      let skippedWords = 0;
      for (const group of document.collections) {
        if (collections.some(current => current.name.toLowerCase() === group.name.toLowerCase() && current.sourceLanguage === group.sourceLanguage && current.targetLanguage === group.targetLanguage)) reusedCollections++;
        else { collections.push({ ...group, id: Math.max(0, ...collections.map(item => item.id)) + 1, wordCount: 0 }); createdCollections++; }
      }
      for (const item of document.words) {
        if (mode === 'skipMatches' && words.some(current => current.term.toLowerCase() === item.term.toLowerCase() && current.translation.toLowerCase() === item.translation.toLowerCase() && current.sourceLanguage === item.sourceLanguage && current.targetLanguage === item.targetLanguage)) { skippedWords++; continue; }
        const collectionIds = item.collections.map((name: string) => collections.find(group => group.name === name && group.sourceLanguage === item.sourceLanguage && group.targetLanguage === item.targetLanguage)!.id);
        words.push({ ...item, id: Math.max(0, ...words.map(word => word.id)) + 1, collectionIds });
        collections = collections.map(group => collectionIds.includes(group.id) ? { ...group, wordCount: group.wordCount + 1 } : group);
        createdWords++;
      }
      return new Response(JSON.stringify({ createdCollections, reusedCollections, createdWords, skippedWords }), { status: 201 });
    }
    if (path.pathname === '/api/words/merge' && method === 'POST') {
      const { keepId, sourceId, deleteSource, word } = JSON.parse(options.body as string);
      const keep = words.find(item => item.id === keepId)!;
      const source = words.find(item => item.id === sourceId)!;
      mergeBackup = { keep: structuredClone(keep), source: structuredClone(source) };
      Object.assign(keep, word, { collectionIds: [...new Set([...(keep.collectionIds ?? []), ...(source.collectionIds ?? [])])] });
      if (deleteSource) words = words.filter(item => item.id !== sourceId);
      collections = collections.map(collection => ({ ...collection, wordCount: words.filter(item => item.collectionIds?.includes(collection.id)).length }));
      return new Response(JSON.stringify(keep));
    }
    if (path.pathname === '/api/words/merge/1/undo' && method === 'POST' && mergeBackup) {
      words = words.filter(item => item.id !== mergeBackup!.keep.id && item.id !== mergeBackup!.source.id);
      words.push(mergeBackup.keep, mergeBackup.source);
      mergeBackup = null;
      collections = collections.map(collection => ({ ...collection, wordCount: words.filter(item => item.collectionIds?.includes(collection.id)).length }));
      return new Response(JSON.stringify({ restored: true }));
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
    if (method === 'POST') {
      const collectionId = path.searchParams.get('collectionId');
      const created = { ...JSON.parse(options.body as string), id: Math.max(0, ...words.map(word => word.id)) + 1, collectionIds: collectionId ? [Number(collectionId)] : [] };
      words.push(created);
      if (collectionId) collections = collections.map(collection => collection.id === Number(collectionId) ? { ...collection, wordCount: collection.wordCount + 1 } : collection);
      return new Response(JSON.stringify(created), { status: 201 });
    }
    if (method === 'PUT') words[0] = { ...JSON.parse(options.body as string), id: 1 };
    if (method === 'DELETE') { words = words.filter(word => word.id !== Number(path.pathname.split('/').pop())); return new Response(null, { status: 204 }); }
    return new Response(JSON.stringify(words.at(-1)));
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Colección de palabras', () => {
  it('separa Diccionario y Estudio en URLs y responde a atrás y adelante', async () => {
    const user = userEvent.setup();
    render(<App />);
    const nav = within(screen.getByRole('navigation', { name: 'Secciones' }));
    expect(nav.getByRole('link', { name: 'Diccionario' })).toHaveAttribute('aria-current', 'page');
    document.documentElement.scrollTop = 480;
    await user.click(nav.getByRole('link', { name: 'Estudio' }));
    expect(window.location.pathname).toBe('/estudio');
    expect(document.documentElement.scrollTop).toBe(0);
    expect(nav.getByRole('link', { name: 'Estudio' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('button', { name: '+ Nueva colección' })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Palabras disponibles: 1' })).toBeVisible();
    window.history.back();
    await waitFor(() => expect(nav.getByRole('link', { name: 'Diccionario' })).toHaveAttribute('aria-current', 'page'));
    expect(window.location.pathname).toBe('/');
    window.history.forward();
    await waitFor(() => expect(nav.getByRole('link', { name: 'Estudio' })).toHaveAttribute('aria-current', 'page'));
    expect(window.location.pathname).toBe('/estudio');
  });

  it('abre Estudio directamente desde su URL', async () => {
    window.history.replaceState(null, '', '/estudio');
    render(<App />);
    expect(screen.getByRole('navigation', { name: 'Secciones' }).querySelector('[aria-current="page"]')).toHaveTextContent('Estudio');
    expect(await screen.findByRole('heading', { name: 'Palabras disponibles: 1' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Mi colección' })).not.toBeInTheDocument();
  });
  it('muestra coincidencias de A1 y A2 con sus ejemplos sin modificar tarjetas', async () => {
    collections = [
      { id: 1, name: 'A1', sourceLanguage: 'es', targetLanguage: 'en', wordCount: 1 },
      { id: 2, name: 'A2', sourceLanguage: 'es', targetLanguage: 'en', wordCount: 1 },
    ];
    words = [
      { ...words[0], id: 1, term: 'dormir', translation: 'sleep', collectionIds: [1], examples: [{ text: 'Quiero dormir.', translation: 'I want to sleep.' }] },
      { ...words[0], id: 2, term: 'Dormir', translation: 'SLEEP', collectionIds: [2], examples: [{ text: 'Duermo.', translation: 'I sleep.' }] },
      { ...words[0], id: 3, term: 'dormir', translation: 'to rest', collectionIds: [] },
    ];
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Buscar coincidencias' }));
    const matches = within(screen.getByRole('region', { name: 'Posibles coincidencias' }));
    expect(await matches.findByText('Grupos encontrados: 1')).toBeVisible();
    expect(matches.getByText('Quiero dormir.')).toBeVisible();
    expect(matches.getByText('Duermo.')).toBeVisible();
    expect(matches.getByText('A1')).toBeVisible();
    expect(matches.getByText('A2')).toBeVisible();
    expect(matches.queryByText('to rest')).not.toBeInTheDocument();
    expect(words).toHaveLength(3);
    expect(vi.mocked(fetch).mock.calls.filter(([, options]) => options?.method && options.method !== 'GET')).toHaveLength(0);
  });

  it('permite preparar y confirmar una fusión con ejemplos, notas, formas y ambas colecciones', async () => {
    collections = [
      { id: 1, name: 'A1', sourceLanguage: 'es', targetLanguage: 'en', wordCount: 1 },
      { id: 2, name: 'A2', sourceLanguage: 'es', targetLanguage: 'en', wordCount: 1 },
    ];
    words = [
      { ...words[0], id: 1, term: 'dormir', translation: 'sleep', wordType: 'verb', notes: 'Nota A1',
        collectionIds: [1], examples: [{ text: 'Duermo.', translation: 'I sleep.' }], englishVerbForms: { past: 'slept', ing: '' } },
      { ...words[0], id: 2, term: 'dormir', translation: 'sleep', wordType: 'verb', notes: 'Nota A2',
        collectionIds: [2], examples: [{ text: 'Quiero dormir.', translation: 'I want to sleep.' }], englishVerbForms: { ing: 'sleeping' } },
    ];
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Buscar coincidencias' }));
    const matches = within(screen.getByRole('region', { name: 'Posibles coincidencias' }));
    await user.click(await matches.findByRole('button', { name: 'Preparar fusión' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Preparar fusión de tarjetas' }));
    await user.click(dialog.getByRole('button', { name: 'Añadir' }));
    const result = within(dialog.getByRole('region', { name: 'Vista previa del resultado' }));
    expect(result.getByText('Duermo.')).toBeVisible();
    expect(result.getByText('Quiero dormir.')).toBeVisible();
    await user.click(dialog.getByRole('button', { name: 'Unir notas' }));
    expect(dialog.getByLabelText('Notas')).toHaveValue('Nota A1\nNota A2');
    await user.click(dialog.getByRole('button', { name: 'Usar de la segunda: sleeping' }));
    await user.click(dialog.getByRole('checkbox', { name: 'Eliminar la segunda tarjeta después de fusionar' }));
    await user.click(dialog.getByRole('button', { name: 'Revisar antes de guardar' }));
    expect(dialog.getByText(/La segunda tarjeta se eliminará/)).toBeVisible();
    expect(words).toHaveLength(2);
    await user.click(dialog.getByRole('button', { name: 'Confirmar fusión' }));
    await waitFor(() => expect(words).toHaveLength(1));
    expect(words[0]).toMatchObject({ id: 1, notes: 'Nota A1\nNota A2', collectionIds: [1, 2],
      examples: [{ text: 'Duermo.', translation: 'I sleep.' }, { text: 'Quiero dormir.', translation: 'I want to sleep.' }],
      englishVerbForms: { past: 'slept', ing: 'sleeping' } });
    expect(await matches.findByText('No hay coincidencias en esta pareja.')).toBeVisible();
  });

  it('muestra las dos tarjetas completas y permite unirlas directamente en la vista previa', async () => {
    collections = [
      { id: 1, name: 'A1', sourceLanguage: 'es', targetLanguage: 'en', wordCount: 1 },
      { id: 2, name: 'A2', sourceLanguage: 'es', targetLanguage: 'en', wordCount: 1 },
    ];
    words = [
      { ...words[0], id: 1, term: 'dormir', translation: 'sleep', wordType: 'verb', notes: 'Nota A1',
        collectionIds: [1], examples: [{ text: 'Duermo.', translation: 'I sleep.' }], englishVerbForms: { past: 'slept' } },
      { ...words[0], id: 2, term: 'dormir', translation: 'sleep', wordType: 'verb', notes: 'Nota A2',
        collectionIds: [2], examples: [{ text: 'Quiero dormir.', translation: 'I want to sleep.' }], englishVerbForms: { ing: 'sleeping' } },
    ];
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Buscar coincidencias' }));
    await user.click(await screen.findByRole('button', { name: 'Preparar fusión' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Preparar fusión de tarjetas' }));
    const first = within(dialog.getByRole('region', { name: 'Tarjeta A · base del resultado' }));
    const second = within(dialog.getByRole('region', { name: 'Tarjeta B · para unir' }));
    expect(first.getByText('Nota A1')).toBeVisible();
    expect(first.getByText('slept')).toBeVisible();
    expect(second.getByText('Nota A2')).toBeVisible();
    expect(second.getByText('sleeping')).toBeVisible();
    await user.click(dialog.getByRole('button', { name: 'Unir ambas en el resultado' }));
    const result = within(dialog.getByRole('region', { name: 'Vista previa del resultado' }));
    expect(result.getByText('Duermo.')).toBeVisible();
    expect(result.getByText('Quiero dormir.')).toBeVisible();
    expect(result.getByLabelText('Notas')).toHaveValue('Nota A1\nNota A2');
    expect(result.getByLabelText('Forma -ing')).toHaveValue('sleeping');
    expect(dialog.getByRole('checkbox', { name: 'Eliminar la segunda tarjeta después de fusionar' })).toBeChecked();
    expect(words).toHaveLength(2);
    await user.click(dialog.getByRole('button', { name: 'Revisar antes de guardar' }));
    await user.click(dialog.getByRole('button', { name: 'Confirmar fusión' }));
    await waitFor(() => expect(words).toHaveLength(1));
    expect(words[0]).toMatchObject({ id: 1, collectionIds: [1, 2], notes: 'Nota A1\nNota A2',
      examples: [{ text: 'Duermo.', translation: 'I sleep.' }, { text: 'Quiero dormir.', translation: 'I want to sleep.' }],
      englishVerbForms: { past: 'slept', ing: 'sleeping' } });
  });

  it('permite deshacer la última fusión y recuperar las dos tarjetas', async () => {
    words = [
      { ...words[0], id: 1, term: 'dormir', translation: 'sleep', notes: 'A1', examples: [{ text: 'Duermo.', translation: 'I sleep.' }] },
      { ...words[0], id: 2, term: 'dormir', translation: 'sleep', notes: 'A2', examples: [{ text: 'Dormí.', translation: 'I slept.' }] },
    ];
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Buscar coincidencias' }));
    await user.click(await screen.findByRole('button', { name: 'Preparar fusión' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Preparar fusión de tarjetas' }));
    await user.click(dialog.getByRole('button', { name: 'Unir ambas en el resultado' }));
    await user.click(dialog.getByRole('button', { name: 'Revisar antes de guardar' }));
    await user.click(dialog.getByRole('button', { name: 'Confirmar fusión' }));
    await waitFor(() => expect(words).toHaveLength(1));
    await user.click(await screen.findByRole('button', { name: 'Deshacer última fusión: dormir → sleep' }));
    await waitFor(() => expect(words).toHaveLength(2));
    expect(words[0].notes).toBe('A1');
    expect(words[1].notes).toBe('A2');
    expect(await screen.findByText('Fusión deshecha. Las tarjetas originales se han recuperado.')).toBeVisible();
  });

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
    await waitFor(() => expect(groups.getByRole('button', { name: 'A1 1' })).toHaveAttribute('aria-pressed', 'true'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Quitar de la colección: dormir' })).toBeEnabled());
    expect(screen.queryByRole('heading', { name: 'cansado' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Quitar de la colección: dormir' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'dormir' })).not.toBeInTheDocument());
    await user.click(groups.getByRole('button', { name: 'Todas' }));
    expect(await screen.findByRole('heading', { name: 'dormir' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'cansado' })).toBeVisible();
  });

  it('añade una palabra nueva a la colección activa y también la muestra en Todas', async () => {
    collections = [{ id: 7, name: 'A1', sourceLanguage: 'es', targetLanguage: 'en', wordCount: 0 }];
    words = [];
    const user = userEvent.setup();
    render(<App />);
    const groups = within(screen.getByRole('group', { name: 'Colecciones' }));
    await user.click(await groups.findByRole('button', { name: 'A1 0' }));
    await user.click(screen.getByRole('button', { name: 'Añadir palabra' }));
    await user.type(screen.getByLabelText('Palabra o expresión *'), 'dormir');
    await user.type(screen.getByLabelText('Traducción *'), 'sleep');
    await user.type(screen.getByLabelText('Ejemplo 1'), 'Quiero dormir.');
    await user.click(screen.getByRole('button', { name: 'Guardar palabra' }));
    expect(await screen.findByRole('heading', { name: 'dormir' })).toBeVisible();
    expect(groups.getByRole('button', { name: 'A1 1' })).toHaveAttribute('aria-pressed', 'true');
    const createCall = vi.mocked(fetch).mock.calls.find(([url, options]) => String(url).startsWith('/api/words?collectionId=') && options?.method === 'POST');
    expect(createCall?.[0]).toBe('/api/words?collectionId=7');
    await user.click(groups.getByRole('button', { name: 'Todas' }));
    expect(await screen.findByRole('heading', { name: 'dormir' })).toBeVisible();
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

  it('previsualiza un JSON exportado sin enviar datos ni cambiar las tarjetas', async () => {
    collections = [{ id: 5, name: 'A1', sourceLanguage: 'es', targetLanguage: 'en', wordCount: 1 }];
    words[0].collectionIds = [5];
    const content = JSON.stringify(createExportDocument(words, collections, new Date('2026-10-28T10:00:00.000Z')));
    const file = new File([content], 'vocabia-colecciones.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: () => Promise.resolve(content) });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'book' });
    await user.click(screen.getByRole('button', { name: 'Previsualizar importación' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Revisar un archivo' }));
    await user.upload(dialog.getByLabelText('Archivo JSON'), file);
    expect(await dialog.findByText('vocabia-colecciones.json')).toBeVisible();
    expect(dialog.getByRole('heading', { name: 'Colecciones 1' })).toBeVisible();
    expect(dialog.getByRole('heading', { name: 'Palabras 1' })).toBeVisible();
    const comparison = within(await dialog.findByRole('region', { name: 'Comparación con tus datos' }));
    expect(comparison.getByText('Colecciones existentes:', { exact: false })).toHaveTextContent('1');
    expect(comparison.getByText('Posibles coincidencias:', { exact: false })).toHaveTextContent('1');
    expect(dialog.getByText('Solo vista previa:', { exact: false })).toBeVisible();
    expect(vi.mocked(fetch).mock.calls.filter(([, options]) => options?.method && options.method !== 'GET')).toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'book' })).toBeVisible();
  });

  it('confirma la importación omitiendo coincidencias y refresca las tarjetas', async () => {
    const group: Collection = { id: 7, name: 'A1', sourceLanguage: 'es', targetLanguage: 'en', wordCount: 2 };
    const newWord: Word = { ...words[0], id: 8, term: 'casa', translation: 'house', collectionIds: [7] };
    const savedWord: Word = { ...words[0], collectionIds: [7] };
    const content = JSON.stringify(createExportDocument([savedWord, newWord], [group], new Date('2026-10-28T10:00:00.000Z')));
    const file = new File([content], 'mis-palabras.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: () => Promise.resolve(content) });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'book' });
    await user.click(screen.getByRole('button', { name: 'Previsualizar importación' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Revisar un archivo' }));
    await user.upload(dialog.getByLabelText('Archivo JSON'), file);
    await dialog.findByRole('region', { name: 'Comparación con tus datos' });
    expect(dialog.getByRole('radio', { name: 'Importarlas igualmente (predeterminado)' })).toBeChecked();
    await user.click(dialog.getByRole('radio', { name: 'Omitirlas' }));
    await user.click(dialog.getByRole('button', { name: 'Confirmar importación' }));
    expect(await dialog.findByRole('heading', { name: 'Importación completada' })).toBeVisible();
    expect(dialog.getByText('Palabras creadas: 1', { exact: false })).toBeVisible();
    expect(dialog.getByText('Palabras omitidas: 1', { exact: false })).toBeVisible();
    expect(await screen.findByRole('heading', { name: 'casa' })).toBeVisible();
    expect(words.filter(item => item.term === 'book')).toHaveLength(1);
    const importCall = vi.mocked(fetch).mock.calls.find(([url, options]) => url === '/api/import' && options?.method === 'POST');
    expect(JSON.parse(importCall![1]!.body as string).mode).toBe('skipMatches');
  });

  it('permite importar igualmente una coincidencia si el usuario lo elige', async () => {
    const content = JSON.stringify(createExportDocument(words, [], new Date('2026-10-28T10:00:00.000Z')));
    const file = new File([content], 'otra-acepcion.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: () => Promise.resolve(content) });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'book' });
    await user.click(screen.getByRole('button', { name: 'Previsualizar importación' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Revisar un archivo' }));
    await user.upload(dialog.getByLabelText('Archivo JSON'), file);
    await dialog.findByRole('region', { name: 'Comparación con tus datos' });
    expect(dialog.getByRole('radio', { name: 'Importarlas igualmente (predeterminado)' })).toBeChecked();
    await user.click(dialog.getByRole('button', { name: 'Confirmar importación' }));
    expect(await dialog.findByRole('heading', { name: 'Importación completada' })).toBeVisible();
    expect(words.filter(item => item.term === 'book')).toHaveLength(2);
    const importCall = vi.mocked(fetch).mock.calls.find(([url, options]) => url === '/api/import' && options?.method === 'POST');
    expect(JSON.parse(importCall![1]!.body as string).mode).toBe('includeMatches');
  });

  it('evita repetir a ciegas una importación si se pierde la respuesta del servidor', async () => {
    const content = JSON.stringify(createExportDocument(words, [], new Date('2026-10-28T10:00:00.000Z')));
    const file = new File([content], 'respaldo.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: () => Promise.resolve(content) });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'book' });
    await user.click(screen.getByRole('button', { name: 'Previsualizar importación' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Revisar un archivo' }));
    await user.upload(dialog.getByLabelText('Archivo JSON'), file);
    await dialog.findByRole('region', { name: 'Comparación con tus datos' });
    const normalFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation((url, options) =>
      url === '/api/import' && options?.method === 'POST' ? Promise.reject(new TypeError('Sin conexión')) : normalFetch(url, options));
    await user.click(dialog.getByRole('button', { name: 'Confirmar importación' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('Revisa tus tarjetas antes de repetir');
    expect(dialog.getByRole('button', { name: 'Confirmar importación' })).toBeDisabled();
    expect(words).toHaveLength(1);
  });

  it('rechaza un JSON dañado sin alterar las palabras guardadas', async () => {
    const file = new File(['{'], 'dañado.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: () => Promise.resolve('{') });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'book' });
    await user.click(screen.getByRole('button', { name: 'Previsualizar importación' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Revisar un archivo' }));
    await user.upload(dialog.getByLabelText('Archivo JSON'), file);
    expect(await dialog.findByRole('alert')).toHaveTextContent('El archivo no contiene un JSON válido.');
    expect(screen.getByRole('heading', { name: 'book' })).toBeVisible();
    expect(vi.mocked(fetch).mock.calls.filter(([, options]) => options?.method && options.method !== 'GET')).toHaveLength(0);
  });

  it('conserva la vista previa y permite reintentar si falla la consulta de comparación', async () => {
    const content = JSON.stringify(createExportDocument(words, [], new Date('2026-10-28T10:00:00.000Z')));
    const file = new File([content], 'respaldo.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: () => Promise.resolve(content) });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'book' });
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Sin conexión'));
    await user.click(screen.getByRole('button', { name: 'Previsualizar importación' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Revisar un archivo' }));
    await user.upload(dialog.getByLabelText('Archivo JSON'), file);
    expect(await dialog.findByRole('alert')).toHaveTextContent('La vista previa sigue disponible.');
    expect(dialog.getByText('respaldo.json')).toBeVisible();
    await user.click(dialog.getByRole('button', { name: 'Reintentar' }));
    expect(await dialog.findByRole('region', { name: 'Comparación con tus datos' })).toBeVisible();
    expect(vi.mocked(fetch).mock.calls.filter(([, options]) => options?.method && options.method !== 'GET')).toHaveLength(0);
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
      { ...words[0], id: 1, term: 'dormir', translation: 'sleep', wordType: 'verb', collectionIds: [1] },
      { ...words[0], id: 2, term: 'beber', translation: 'drink', wordType: 'verb', collectionIds: [1] },
      { ...words[0], id: 3, term: 'cansado', translation: 'tired', wordType: 'adjective', collectionIds: [2] },
    ];
    collections = [
      { id: 1, name: 'A1', sourceLanguage: 'es', targetLanguage: 'en', wordCount: 2 },
      { id: 2, name: 'A2', sourceLanguage: 'es', targetLanguage: 'en', wordCount: 1 },
    ];
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'dormir' });
    await user.click(await within(screen.getByRole('group', { name: 'Colecciones' })).findByRole('button', { name: 'A1 2' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
    await user.click(within(screen.getByRole('navigation', { name: 'Secciones' })).getByRole('link', { name: 'Estudio' }));
    expect(window.location.pathname).toBe('/estudio');
    await user.click(await screen.findByRole('button', { name: 'Practicar' }));
    const exercise = within(screen.getByRole('region', { name: 'Practicar' }));
    expect(exercise.getByRole('heading', { name: 'dormir' })).toBeVisible();
    expect(exercise.queryByText('sleep')).not.toBeInTheDocument();
    expect(exercise.queryByText('tired')).not.toBeInTheDocument();
    await user.click(exercise.getByRole('button', { name: 'Mostrar respuesta' }));
    expect(exercise.getByText('sleep')).toHaveAttribute('lang', 'en');
    await user.click(exercise.getByRole('button', { name: 'Siguiente pregunta' }));
    expect(exercise.getByRole('heading', { name: 'beber' })).toBeVisible();
    expect(exercise.queryByText('drink')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Volver a Estudio' }));
    expect(screen.getByRole('heading', { name: 'Palabras disponibles: 2' })).toBeVisible();
  });

  it('limita el ejercicio de escucha a la colección seleccionada', async () => {
    words = [
      { ...words[0], id: 1, term: 'dormir', translation: 'sleep', collectionIds: [1] },
      { ...words[0], id: 2, term: 'beber', translation: 'drink', collectionIds: [1] },
      { ...words[0], id: 3, term: 'correr', translation: 'run', collectionIds: [2] },
    ];
    collections = [
      { id: 1, name: 'A1', sourceLanguage: 'es', targetLanguage: 'en', wordCount: 2 },
      { id: 2, name: 'A2', sourceLanguage: 'es', targetLanguage: 'en', wordCount: 1 },
    ];
    const user = userEvent.setup();
    render(<App />);
    await user.click(await within(screen.getByRole('group', { name: 'Colecciones' })).findByRole('button', { name: 'A1 2' }));
    await user.click(within(screen.getByRole('navigation', { name: 'Secciones' })).getByRole('link', { name: 'Estudio' }));
    await user.click(await screen.findByRole('button', { name: 'Escuchar y elegir' }));
    const exercise = within(screen.getByRole('region', { name: 'Escuchar y elegir' }));
    expect(exercise.getByRole('button', { name: 'dormir' })).toBeInTheDocument();
    expect(exercise.getByRole('button', { name: 'beber' })).toBeInTheDocument();
    expect(exercise.queryByRole('button', { name: 'correr' })).not.toBeInTheDocument();
  });

  it('abre la práctica hablada desde Estudio con la pareja seleccionada', async () => {
    words = [{ ...words[0], term: 'dormir', translation: 'sleep' }];
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: 'Secciones' })).getByRole('link', { name: 'Estudio' }));
    await user.click(await screen.findByRole('button', { name: 'Hablar y comprobar' }));
    const exercise = within(screen.getByRole('region', { name: 'Hablar y comprobar' }));
    expect(exercise.getByRole('heading', { name: 'dormir' })).toHaveAttribute('lang', 'es');
    expect(exercise.queryByText('sleep')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Volver a Estudio' }));
    expect(screen.getByRole('heading', { name: 'Palabras disponibles: 1' })).toBeVisible();
  });

  it('repasa solo las difíciles de la colección seleccionada y sale al resolver la última', async () => {
    collections = [
      { id: 1, name: 'A1', sourceLanguage: 'es', targetLanguage: 'en', wordCount: 2 },
      { id: 2, name: 'A2', sourceLanguage: 'es', targetLanguage: 'en', wordCount: 1 },
    ];
    words = [
      { ...words[0], id: 1, term: 'dormir', translation: 'sleep', collectionIds: [1], studyMark: 'difficult' },
      { ...words[0], id: 2, term: 'beber', translation: 'drink', collectionIds: [1], studyMark: 'known' },
      { ...words[0], id: 3, term: 'correr', translation: 'run', collectionIds: [2], studyMark: 'difficult' },
    ];
    const user = userEvent.setup();
    render(<App />);
    await user.click(await within(screen.getByRole('group', { name: 'Colecciones' })).findByRole('button', { name: 'A1 2' }));
    await user.click(within(screen.getByRole('navigation', { name: 'Secciones' })).getByRole('link', { name: 'Estudio' }));
    const difficultButton = await screen.findByRole('button', { name: 'Practicar las difíciles (1)' });
    await user.click(difficultButton);
    const exercise = within(screen.getByRole('region', { name: 'Practicar' }));
    expect(exercise.getByRole('heading', { name: 'dormir' })).toBeVisible();
    expect(exercise.getByText('1 de 1')).toBeVisible();
    await user.click(exercise.getByRole('button', { name: 'Mostrar respuesta' }));
    await user.click(exercise.getByRole('button', { name: 'La sabía' }));
    await waitFor(() => expect(words[0].studyMark).toBe('known'));
    await user.click(exercise.getByRole('button', { name: 'Ver resumen' }));
    await user.click(exercise.getByRole('button', { name: 'Nueva ronda' }));
    expect(await screen.findByRole('button', { name: 'Practicar las difíciles (0)' })).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'Palabras disponibles: 2' })).toBeVisible();
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

  it('pronuncia la traducción de la tarjeta en el idioma de estudio', async () => {
    words = [{ ...words[0], term: 'dormir', translation: 'sleep' }];
    const speak = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn() });
    vi.stubGlobal('SpeechSynthesisUtterance', class { lang = ''; rate = 1; constructor(public text: string) {} });
    const user = userEvent.setup();
    render(<App />);
    const play = await screen.findByRole('button', { name: 'Escuchar: sleep' });
    await user.click(play);
    expect(speak).toHaveBeenCalledOnce();
    expect(speak.mock.calls[0][0]).toMatchObject({ text: 'sleep', lang: 'en-US', rate: 0.85 });
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
