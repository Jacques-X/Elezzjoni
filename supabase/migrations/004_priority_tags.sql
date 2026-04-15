-- Add priority_tags column to candidates
-- Tags are drawn from a fixed vocabulary (enforced at the app layer)
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS priority_tags text[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_candidates_priority_tags
  ON candidates USING GIN(priority_tags);
