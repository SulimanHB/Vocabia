-- Una sola instrucción: la conversión y su registro se guardan juntos.
-- WITH ORDINALITY conserva el orden de los ejemplos originales.
WITH migrated AS (
  UPDATE words
  SET examples = (
    SELECT jsonb_agg(
      CASE WHEN jsonb_typeof(item) = 'string'
        THEN jsonb_build_object('text', item #>> '{}', 'translation', '')
        ELSE item
      END ORDER BY position
    )
    FROM jsonb_array_elements(examples) WITH ORDINALITY AS entry(item, position)
  )
  WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(examples) AS entry(item) WHERE jsonb_typeof(item) = 'string')
    AND NOT EXISTS (SELECT 1 FROM app_migrations WHERE name = '002_example_translations')
  RETURNING id
)
INSERT INTO app_migrations(name) VALUES ('002_example_translations') ON CONFLICT DO NOTHING;
