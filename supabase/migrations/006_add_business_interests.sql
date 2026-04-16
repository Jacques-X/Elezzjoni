-- Phase 1: Business Interests & Disclosures
-- Comprehensive tracking of candidate financial interests, directorships, and asset declarations

CREATE TABLE IF NOT EXISTS candidate_business_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  role TEXT, -- "director", "shareholder", "founder", "secretary", etc.
  ownership_pct NUMERIC,
  status TEXT, -- "active", "dormant", "dissolved"
  company_registration_id TEXT,
  url TEXT,
  first_registered TIMESTAMP WITH TIME ZONE,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(candidate_id, company_registration_id)
);

CREATE INDEX IF NOT EXISTS idx_business_interests_candidate_id ON candidate_business_interests(candidate_id);
CREATE INDEX IF NOT EXISTS idx_business_interests_company_name ON candidate_business_interests(company_name);

CREATE TABLE IF NOT EXISTS candidate_disclosures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  disclosure_type TEXT, -- "assets", "income", "conflict_of_interest", "donations", etc.
  disclosed_value TEXT,
  disclosed_amount NUMERIC,
  currency TEXT DEFAULT 'EUR',
  date_filed TIMESTAMP WITH TIME ZONE,
  source_url TEXT,
  raw_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disclosures_candidate_id ON candidate_disclosures(candidate_id);
CREATE INDEX IF NOT EXISTS idx_disclosures_type ON candidate_disclosures(disclosure_type);
CREATE INDEX IF NOT EXISTS idx_disclosures_date ON candidate_disclosures(date_filed DESC);

CREATE TABLE IF NOT EXISTS candidate_legal_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  case_type TEXT, -- "civil", "criminal", "administrative", "employment", etc.
  case_reference TEXT,
  description TEXT,
  case_date TIMESTAMP WITH TIME ZONE,
  outcome TEXT, -- "dismissed", "settled", "verdict", "ongoing", etc.
  severity TEXT, -- "high", "medium", "low"
  source_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legal_records_candidate_id ON candidate_legal_records(candidate_id);
CREATE INDEX IF NOT EXISTS idx_legal_records_severity ON candidate_legal_records(severity);

-- Alter candidates table to add completeness & identity fields
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS is_mp BOOLEAN DEFAULT FALSE;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS parliament_bio TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS current_position TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS data_completeness_pct INTEGER DEFAULT 0;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS last_comprehensive_update TIMESTAMP WITH TIME ZONE;
