-- Fix parties table column names to match the frontend
-- Migration 008 renamed name→party_name and abbreviation→party_code, breaking all queries.
-- Rename them back. Uses conditional blocks so it's safe to run on any DB state.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parties' AND column_name = 'party_name'
  ) THEN
    ALTER TABLE parties RENAME COLUMN party_name TO name;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parties' AND column_name = 'party_code'
  ) THEN
    ALTER TABLE parties RENAME COLUMN party_code TO abbreviation;
  END IF;
END $$;
