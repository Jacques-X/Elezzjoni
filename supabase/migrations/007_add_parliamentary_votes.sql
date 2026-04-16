-- Phase 2: Parliamentary Voting Records
-- Stores how MPs voted on bills and motions during plenary sessions

CREATE TABLE IF NOT EXISTS parliamentary_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  session_date DATE,
  session_name TEXT,
  session_url TEXT,
  bill_name TEXT,
  vote_type TEXT,  -- "Third Reading", "Adjournment", "Committee Stage", etc.
  vote_choice TEXT, -- "yes", "no", "abstain"
  raw_text_excerpt TEXT,  -- Original ~800-word context from PDF
  llm_confidence NUMERIC,  -- 0-1 confidence score from LLM
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parliamentary_votes_candidate_id ON parliamentary_votes(candidate_id);
CREATE INDEX IF NOT EXISTS idx_parliamentary_votes_session_date ON parliamentary_votes(session_date DESC);
CREATE INDEX IF NOT EXISTS idx_parliamentary_votes_bill_name ON parliamentary_votes(bill_name);
CREATE INDEX IF NOT EXISTS idx_parliamentary_votes_vote_choice ON parliamentary_votes(vote_choice);
