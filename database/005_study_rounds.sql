CREATE TABLE IF NOT EXISTS study_rounds (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  question_count INTEGER NOT NULL CHECK (question_count > 0),
  written_count INTEGER NOT NULL CHECK (written_count >= 0 AND written_count <= question_count),
  matched_count INTEGER NOT NULL CHECK (matched_count >= 0 AND matched_count <= written_count),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source_language <> target_language)
);

CREATE INDEX IF NOT EXISTS study_rounds_pair_recent_idx
  ON study_rounds (source_language, target_language, completed_at DESC, id DESC);
