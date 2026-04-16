# Elezzjoni.mt: Expand Data Sources

## Overview
You've built the Elezzjoni.mt candidate enrichment pipeline. We're now expanding it to include additional data sources to give voters richer context on candidates: official election registers, parliamentary voting history, and party policy positions.

**Goal:** Automatic scraping only — no manual curation. Reuse existing pipeline patterns (Playwright, trafilatura, Ollama).

---

## Context
- **Current sources:** Facebook, personal websites, Maltese news (via DuckDuckGo), Wikidata/Wikipedia photos
- **Current enrichment:** Ollama llama3.1:8b scores party reliance (0-100) and extracts stances + quotes
- **Candidate base:** Seeded from last election (2022); no official 2025 list published yet
- **Tech stack:** Next.js 16, Supabase, Python pipeline (Playwright + trafilatura), Ollama

---

## Implementation Tasks

### 1. Seed Candidate Register from 2022 Election
**What:** Find and scrape Malta's 2022 electoral register to bootstrap the `candidates` table.
- Source: Electoral Commission archive or Wayback Machine (https://web.archive.org)
- Extract: candidate name, party, constituency, position/rank
- Output: SQL migration or seed script (`supabase/migrations/006_seed_2022_candidates.sql`)
- One-time import, not recurring

**Why:** Establishes the canonical candidate list. Your enrichment pipeline then layers on top.

---

### 2. Add Parliamentary Voting Records for MPs
**What:** Scrape Parliament of Malta (Kamra tad-Deputati) to enrich candidates who are/were MPs.
- Source: https://parlament.mt (public archives)
- Extract per MP: bills voted on, voting pattern (for/against/abstain), committee roles, parliamentary attendance
- New DB columns: `parliamentary_voting_records` (JSONB) with structure:
  ```json
  {
    "bills_voted_on": [
      { "bill_id": "...", "title": "...", "year": 2024, "vote": "for|against|abstain" }
    ],
    "attendance_pct": 95,
    "committee_roles": ["Economy Committee", "..."],
    "last_updated": "2026-04-16"
  }
  ```
- Update: Add to `scraper.py` as a new discovery stage before Ollama enrichment
- Recurring: Monthly CRON via GitHub Actions (parliament updates voting records regularly)

**Why:** Gives voters concrete policy track record. Shows consistency (or flip-flopping) on key issues.

---

### 3. Extract Party Manifestos & Policies
**What:** Scrape party websites to pull manifesto PDFs and structured policy positions.
- Sources: Party websites (PN, PL, and smaller parties)
- Extract: key policy positions, manifesto PDFs, published positions on: economy, health, education, environment, EU relations
- New DB table: `party_policies` with columns:
  - `party_id` (FK to parties)
  - `policy_area` (string: "economy", "health", etc.)
  - `position` (text: extracted via Ollama)
  - `source_url` (where it came from)
  - `last_updated` (timestamp)
- Update: Use Ollama to extract + categorize policy content (similar to candidate stances)
- Recurring: Monthly CRON (manifestos updated before elections)

**Why:** Provides voter context for comparing individual vs. party positions (independence score already does this, but now with explicit policy data).

---

### 4. Enhance Enrichment with Parliamentary Context
**What:** When Ollama scores a candidate, pass parliamentary voting record as additional context.
- Logic in `scraper.py`: If candidate is an MP, include their voting history in the Ollama prompt
- Example: "Candidate X claims to support climate action. Their parliamentary record shows they voted for 3 climate bills and against 1. Are they consistent?"
- Output: Add field `parliament_consistency_score` (0-100) to candidate record

**Why:** Makes the independence score more nuanced and fact-based.

---

## Database Schema Changes

Add migrations:

**006_party_policies.sql:**
```sql
CREATE TABLE party_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES parties(id),
  policy_area TEXT NOT NULL, -- "economy", "health", "education", etc.
  position TEXT NOT NULL,     -- extracted policy text
  source_url TEXT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(party_id, policy_area)
);

ALTER TABLE party_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "party_policies are viewable by anyone" ON party_policies FOR SELECT USING (TRUE);
```

**Update candidates table:**
```sql
ALTER TABLE candidates ADD COLUMN parliamentary_voting_records JSONB;
ALTER TABLE candidates ADD COLUMN parliament_consistency_score INTEGER;
```

---

## Pipeline Changes

### `pipeline/scraper.py` updates:

1. **New function: `scrape_parliament_for_mp(name: str)`**
   - Takes candidate name
   - Searches Parliament of Malta member roster
   - Returns voting record + committee roles
   - Called during discovery stage if candidate is flagged as MP

2. **New function: `enrich_with_parliament_context(name: str, parliamentary_record: dict, text: str)`**
   - Takes existing candidate text + their voting record
   - Builds an Ollama prompt comparing claims to votes
   - Returns `parliament_consistency_score`

3. **Update discovery stage:**
   - Before scraping social links, check if candidate is an MP (via Parliament roster)
   - If yes, fetch voting record
   - Store in DB

4. **Update CRON job** (`.github/workflows/pipeline.yml`):
   - Add monthly parliament scrape + update (sync voting records)
   - Keep existing daily enrichment

---

## Implementation Order

1. **First:** Seed 2022 candidate list (one-time, unblocks everything else)
2. **Second:** Add parliamentary voting record scraper + DB schema
3. **Third:** Add party manifesto scraper + `party_policies` table
4. **Fourth:** Wire parliament context into Ollama enrichment

---

## Notes

- **Scraping approach:** Use Playwright (as you do for Facebook) for JavaScript-heavy sites; trafilatura for clean text extraction
- **Error handling:** Fail gracefully if Parliament website is down; use `DRY_RUN_OVERRIDE=true` for testing
- **Rate limiting:** Keep semaphore = 1 to avoid hammering Parliament/party sites (they're public but be respectful)
- **Fallback:** If a candidate isn't an MP or no voting record found, skip parliament context (non-blocking)
- **Testing:** Run with `DRY_RUN_OVERRIDE=true` first; check that new DB fields populate correctly before merging

---

## Files to Create/Modify

- `supabase/migrations/006_party_policies.sql` (new)
- `supabase/migrations/007_add_parliament_fields.sql` (new)
- `pipeline/scraper.py` (add 2 functions, update main flow)
- `.github/workflows/pipeline.yml` (add monthly parliament sync)
- `lib/supabase/types.ts` (update types for new fields)
- Frontend: Display `party_policies` on `/app/parties/[id]/page.tsx`, parliament voting record on `/app/candidates/[id]/page.tsx`

---

## Success Criteria

- [ ] 2022 candidate list seeded (all candidates in DB)
- [ ] Parliament voting records scraped + stored for MPs
- [ ] Party policies extracted and categorized
- [ ] Ollama can reference parliament context when enriching candidates
- [ ] CRON jobs run monthly without errors
- [ ] UI displays parliament records and party policies on candidate/party pages
