-- Phase 5: Parliamentary Questions, Electoral History & Committee Memberships

-- ── Parliamentary Questions ───────────────────────────────────────────────────
-- What MPs raise in Parliament reveals their real priorities and who they hold
-- to account — often more revealing than stated positions.

CREATE TABLE IF NOT EXISTS candidate_parliamentary_questions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id     UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  question_date    DATE,
  question_number  TEXT,
  question_type    TEXT,   -- "oral", "written"
  question_text    TEXT NOT NULL,
  minister_addressed TEXT,
  ministry         TEXT,
  source_url       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(candidate_id, question_number)
);

CREATE INDEX IF NOT EXISTS idx_pq_candidate ON candidate_parliamentary_questions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_pq_date     ON candidate_parliamentary_questions(question_date DESC);
CREATE INDEX IF NOT EXISTS idx_pq_minister ON candidate_parliamentary_questions(minister_addressed);

ALTER TABLE candidate_parliamentary_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read pqs" ON candidate_parliamentary_questions FOR SELECT USING (true);

-- ── Electoral History ─────────────────────────────────────────────────────────
-- Vote totals from past elections — essential context for incumbents.

CREATE TABLE IF NOT EXISTS candidate_electoral_history (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id           UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  election_year          INTEGER NOT NULL,
  election_type          TEXT NOT NULL DEFAULT 'general',
  district_id            INTEGER,
  first_preference_votes INTEGER,
  final_count_votes      INTEGER,
  elected                BOOLEAN,
  source_url             TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(candidate_id, election_year, election_type)
);

CREATE INDEX IF NOT EXISTS idx_eh_candidate ON candidate_electoral_history(candidate_id);
CREATE INDEX IF NOT EXISTS idx_eh_year      ON candidate_electoral_history(election_year DESC);

ALTER TABLE candidate_electoral_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read electoral history" ON candidate_electoral_history FOR SELECT USING (true);

-- ── Committee Memberships ─────────────────────────────────────────────────────
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS committee_memberships TEXT[];

-- These fields are written by the scraper but may not have been in earlier migrations
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS party_reliance_score    INTEGER;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS score_justification     TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS score_justification_mt  TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS personal_stances_mt     TEXT[];
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS key_quotes_mt           TEXT[];
