-- Las colecciones son propias de una pareja y las palabras pueden estar en varias.
CREATE TABLE IF NOT EXISTS collections (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(80) NOT NULL CHECK (length(trim(name)) > 0),
  source_language VARCHAR(10) NOT NULL,
  target_language VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source_language <> target_language)
);

CREATE UNIQUE INDEX IF NOT EXISTS collections_pair_name_unique
  ON collections(source_language, target_language, lower(name));

CREATE TABLE IF NOT EXISTS collection_words (
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  PRIMARY KEY (collection_id, word_id)
);

CREATE INDEX IF NOT EXISTS collection_words_word_id_idx ON collection_words(word_id);
