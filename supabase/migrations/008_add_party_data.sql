-- Phase 4: Comprehensive Party Data
-- Intelligence on party positions, manifestos, leadership, voting patterns, and media coverage

-- Base parties table (must be created first)
DROP TABLE IF EXISTS party_comparison_metrics CASCADE;
DROP TABLE IF EXISTS party_governance CASCADE;
DROP TABLE IF EXISTS party_media_mentions CASCADE;
DROP TABLE IF EXISTS party_voting_stats CASCADE;
DROP TABLE IF EXISTS party_statements CASCADE;
DROP TABLE IF EXISTS party_leadership CASCADE;
DROP TABLE IF EXISTS party_policies CASCADE;
DROP TABLE IF EXISTS party_manifestos CASCADE;
DROP TABLE IF EXISTS parties CASCADE;

CREATE TABLE parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_code TEXT UNIQUE NOT NULL,
  party_name TEXT NOT NULL,
  party_name_mt TEXT,
  founded_year INTEGER,
  website_url TEXT,
  logo_url TEXT,
  color_hex TEXT,
  description TEXT,
  ideology TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE party_manifestos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  manifesto_year INTEGER,
  title TEXT,
  source_url TEXT,
  download_url TEXT,
  published_date DATE,
  raw_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE party_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  policy_area TEXT,
  policy_position TEXT,
  priority TEXT,
  confidence NUMERIC,
  source_type TEXT,
  manifesto_id UUID REFERENCES party_manifestos(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE party_leadership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  leader_name TEXT NOT NULL,
  leader_name_mt TEXT,
  role TEXT,
  start_date DATE,
  end_date DATE,
  bio TEXT,
  photo_url TEXT,
  social_links JSONB,
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE party_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  statement_date DATE,
  statement_type TEXT,
  title TEXT,
  content TEXT,
  topic TEXT,
  source_url TEXT,
  sentiment TEXT,
  is_official BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE party_voting_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  parliament_session TEXT,
  total_votes INTEGER,
  attendance_pct NUMERIC,
  internal_agreement_pct NUMERIC,
  major_policy_votes JSONB,
  voting_pattern TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE party_media_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  mention_date DATE,
  article_url TEXT,
  source TEXT,
  headline TEXT,
  excerpt TEXT,
  sentiment TEXT,
  article_type TEXT,
  mentions_leaders TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE party_governance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  governance_type TEXT,
  role TEXT,
  person_name TEXT,
  person_name_mt TEXT,
  start_date DATE,
  end_date DATE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE party_comparison_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  metric_type TEXT,
  metric_value NUMERIC,
  metric_date DATE,
  context TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_parties_code ON parties(party_code);
CREATE INDEX idx_manifestos_party_id ON party_manifestos(party_id);
CREATE INDEX idx_policies_party_id ON party_policies(party_id);
CREATE INDEX idx_policies_area ON party_policies(policy_area);
CREATE INDEX idx_leadership_party_id ON party_leadership(party_id);
CREATE INDEX idx_leadership_current ON party_leadership(is_current);
CREATE INDEX idx_statements_party_id ON party_statements(party_id);
CREATE INDEX idx_statements_date ON party_statements(statement_date DESC);
CREATE INDEX idx_voting_stats_party_id ON party_voting_stats(party_id);
CREATE INDEX idx_media_mentions_party_id ON party_media_mentions(party_id);
CREATE INDEX idx_media_mentions_date ON party_media_mentions(mention_date DESC);
CREATE INDEX idx_governance_party_id ON party_governance(party_id);
CREATE INDEX idx_comparison_metrics_party_id ON party_comparison_metrics(party_id);
