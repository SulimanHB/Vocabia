CREATE TABLE IF NOT EXISTS merge_history (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_language VARCHAR(10) NOT NULL,
  target_language VARCHAR(10) NOT NULL,
  keep_before JSONB NOT NULL,
  source_before JSONB NOT NULL,
  keep_after JSONB NOT NULL,
  source_deleted BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  undone_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS merge_history_latest_idx
  ON merge_history(source_language, target_language, id DESC)
  WHERE undone_at IS NULL;
