-- ============================================================
-- Elezzjoni - Malta Election Portal
-- Initial Schema Migration
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Table: parties
-- ============================================================
CREATE TABLE parties (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  color_hex    TEXT NOT NULL DEFAULT '#6B7280',
  logo_url     TEXT
);

-- ============================================================
-- Table: districts
-- ============================================================
CREATE TABLE districts (
  id           INTEGER PRIMARY KEY,  -- 1–13
  name         TEXT NOT NULL,
  localities   TEXT[] NOT NULL DEFAULT '{}'
);

-- ============================================================
-- Table: candidates
-- ============================================================
CREATE TABLE candidates (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name        TEXT NOT NULL,
  party_id         UUID REFERENCES parties(id) ON DELETE SET NULL,
  districts        INTEGER[] NOT NULL DEFAULT '{}',
  photo_url        TEXT,
  personal_stances TEXT[],
  key_quotes       TEXT[],
  social_links     JSONB,
  incumbent        BOOLEAN NOT NULL DEFAULT FALSE,
  last_updated     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_candidates_party_id ON candidates(party_id);
CREATE INDEX idx_candidates_districts ON candidates USING GIN(districts);
CREATE INDEX idx_candidates_full_name ON candidates(full_name);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE parties    ENABLE ROW LEVEL SECURITY;
ALTER TABLE districts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

-- Public read access (anon + authenticated)
CREATE POLICY "Public read parties"    ON parties    FOR SELECT USING (true);
CREATE POLICY "Public read districts"  ON districts  FOR SELECT USING (true);
CREATE POLICY "Public read candidates" ON candidates FOR SELECT USING (true);

-- Write access only via service role key (bypasses RLS automatically)
-- No additional policies needed — service role always bypasses RLS.

-- ============================================================
-- Seed: 13 Malta Districts
-- ============================================================
INSERT INTO districts (id, name, localities) VALUES
  (1,  'District 1',  ARRAY['Valletta', 'Floriana', 'Ħamrun', 'Marsa']),
  (2,  'District 2',  ARRAY['Msida', 'Gżira', 'Ta'' Xbiex', 'Pietà', 'Santa Venera']),
  (3,  'District 3',  ARRAY['Birkirkara', 'Balzan', 'Lija', 'Attard']),
  (4,  'District 4',  ARRAY['Naxxar', 'San Ġwann', 'Swieqi', 'Pembroke', 'St Julian''s']),
  (5,  'District 5',  ARRAY['Sliema', 'Iklin', 'San Ġwann']),
  (6,  'District 6',  ARRAY['San Pawl il-Baħar', 'Mġarr', 'Mellieħa', 'Mosta']),
  (7,  'District 7',  ARRAY['Mosta', 'Naxxar', 'Gharghur']),
  (8,  'District 8',  ARRAY['Qormi', 'Żebbuġ', 'Siġġiewi']),
  (9,  'District 9',  ARRAY['Żurrieq', 'Safi', 'Kirkop', 'Mqabba', 'Qrendi']),
  (10, 'District 10', ARRAY['Birżebbuġa', 'Gudja', 'Għaxaq', 'Żejtun', 'Marsaxlokk']),
  (11, 'District 11', ARRAY['Paola', 'Tarxien', 'Santa Luċija', 'Fgura']),
  (12, 'District 12', ARRAY['Cospicua', 'Senglea', 'Vittoriosa', 'Żabbar', 'Marsaskala']),
  (13, 'District 13', ARRAY['Gozo', 'Victoria', 'Nadur', 'Xagħra', 'Xewkija', 'Sannat', 'Għarb', 'Għasri', 'Kerċem', 'Munxar', 'Qala', 'Ta'' Kerċem']);

-- ============================================================
-- Seed: Main Parties
-- ============================================================
INSERT INTO parties (id, name, abbreviation, color_hex) VALUES
  (uuid_generate_v4(), 'Partit Laburista',               'PL',  '#CF0A2C'),
  (uuid_generate_v4(), 'Partit Nazzjonalista',            'PN',  '#003DA5'),
  (uuid_generate_v4(), 'Alternattiva Demokratika',        'AD',  '#00A651'),
  (uuid_generate_v4(), 'Moviment Patrijotti Maltin',      'MPM', '#FF8C00'),
  (uuid_generate_v4(), 'Independents',                    'IND', '#6B7280');
