-- Fix party-candidate relationship broken by migration 008 dropping parties CASCADE.
--
-- Old UUIDs (from migration 001, now orphaned in candidates):
--   7d412538-270c-4924-ab25-7b62c5262fcf  →  PN
--   c47ef3c3-c9ca-4f04-8331-38a0e4780f0e  →  PL
--
-- New UUIDs (created by scraper Phase 4):
--   2c7775ff-409b-4e63-a935-160f4041ab98  →  Nationalist Party (PN)
--   9b01bad4-835b-42f6-8e53-5f548b6a717a  →  Labour Party (PL)

-- 1. Remap old PN UUID → new PN UUID
UPDATE candidates
SET party_id = '2c7775ff-409b-4e63-a935-160f4041ab98'
WHERE party_id = '7d412538-270c-4924-ab25-7b62c5262fcf';

-- 2. Remap old PL UUID → new PL UUID
UPDATE candidates
SET party_id = '9b01bad4-835b-42f6-8e53-5f548b6a717a'
WHERE party_id = 'c47ef3c3-c9ca-4f04-8331-38a0e4780f0e';

-- 3. Null out any remaining orphaned party_ids that don't exist in parties
UPDATE candidates
SET party_id = NULL
WHERE party_id IS NOT NULL
  AND party_id NOT IN (SELECT id FROM parties);

-- 4. Re-add the FK constraint (NOT VALID skips checking existing rows,
--    which is safe since we've already cleaned up orphans above)
ALTER TABLE candidates
  DROP CONSTRAINT IF EXISTS fk_candidates_party;

ALTER TABLE candidates
  ADD CONSTRAINT fk_candidates_party
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE SET NULL
  NOT VALID;

-- 5. Fix party display names and colours to Maltese
UPDATE parties SET
  name       = 'Partit Nazzjonalista',
  color_hex  = '#003DA5'
WHERE abbreviation = 'PN';

UPDATE parties SET
  name       = 'Partit Laburista',
  color_hex  = '#CF0A2C'
WHERE abbreviation = 'PL';

UPDATE parties SET
  name       = 'Alternattiva Demokratika',
  color_hex  = '#00A651'
WHERE abbreviation = 'AD';
