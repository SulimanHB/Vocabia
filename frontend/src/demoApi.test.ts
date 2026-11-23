// @vitest-environment node
import { expect, it } from 'vitest';
import { demoFetch } from './demoApi';

it('ejecuta la API de la demo dentro del navegador con respuestas HTTP reales', async () => {
  const words = await demoFetch('/words?sourceLanguage=es&targetLanguage=en');
  expect(words.status).toBe(200);
  expect(await words.json()).toHaveLength(20);
  const invalid = await demoFetch('/words', { method: 'POST', body: JSON.stringify({ term: '' }) });
  expect(invalid.status).toBe(400);
  const created = await (await demoFetch('/collections', { method: 'POST', body: JSON.stringify({ name: 'Prueba', sourceLanguage: 'es', targetLanguage: 'en' }) })).json();
  const removed = await demoFetch(`/collections/${created.id}`, { method: 'DELETE' });
  expect(removed.status).toBe(204);
  expect(await removed.text()).toBe('');
}, 30000);
