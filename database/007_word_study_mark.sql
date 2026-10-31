ALTER TABLE words ADD COLUMN IF NOT EXISTS study_mark VARCHAR(10)
  CHECK (study_mark IN ('known', 'difficult'));
