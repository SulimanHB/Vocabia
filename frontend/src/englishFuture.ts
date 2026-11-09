// No adivinamos una forma base si la traducción contiene varias alternativas.
export function englishBase(translation: string): string | null {
  const base = translation.trim().replace(/^to\s+/i, '');
  if (!/^[a-z]+(?:[-'][a-z]+)*(?:\s+[a-z]+(?:[-'][a-z]+)*)*$/i.test(base)) return null;
  return base.toLowerCase();
}

export function englishFuture(translation: string): string | null {
  const base = englishBase(translation);
  if (!base) return null;
  if (['can', 'may', 'must', 'shall', 'will'].includes(base.toLowerCase())) return null;
  return `will ${base}`;
}
