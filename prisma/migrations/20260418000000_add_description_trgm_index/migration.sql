CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS property_description_trgm_idx
  ON "Property" USING GIN (description gin_trgm_ops);
