CREATE TABLE IF NOT EXISTS words (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  term VARCHAR(120) NOT NULL CHECK (length(trim(term)) > 0),
  translation VARCHAR(200) NOT NULL CHECK (length(trim(translation)) > 0),
  source_language VARCHAR(10) NOT NULL,
  target_language VARCHAR(10) NOT NULL,
  word_type VARCHAR(20) NOT NULL CHECK (word_type IN ('noun','verb','adjective','adverb','expression','other')),
  notes VARCHAR(2000) NOT NULL DEFAULT '',
  examples JSONB NOT NULL CHECK (jsonb_typeof(examples) = 'array' AND jsonb_array_length(examples) BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source_language <> target_language)
);

-- Registra la carga de demostración una sola vez, incluso si después borras todas las palabras.
CREATE TABLE IF NOT EXISTS app_seeds (name TEXT PRIMARY KEY);
