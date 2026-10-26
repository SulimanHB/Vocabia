-- Una columna nueva conserva todas las palabras y deja vacías las formas antiguas.
ALTER TABLE words ADD COLUMN IF NOT EXISTS english_verb_forms JSONB NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(english_verb_forms) = 'object');
