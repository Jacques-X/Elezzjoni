@AGENTS.md

# Kandidati.mt — Project Guide

Kandidati.mt is a civic-tech platform for Maltese voters. It profiles electoral candidates and political parties with data scraped from public sources and enriched via local LLM.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Auth | None — public read-only site |
| Pipeline | Python 3.13, Playwright, httpx, trafilatura, pdfplumber, Ollama |
| LLM | llama3.1:8b via Ollama (local, no API keys needed) |
| Hosting | Vercel (frontend) + Supabase (DB) |

---

## Running the Frontend

```bash
npm run dev        # dev server at localhost:3000
npm run build      # production build
npm run lint       # eslint
```

---

## Running the Scraper

```bash
cd pipeline
cp ../.env.local .env          # copy env vars
pip install -r requirements.txt
playwright install chromium

python3 scraper.py             # default: unenriched candidates only
```

**Scrape modes:**

```bash
FULL_RESCRAPE_OVERRIDE=true python3 scraper.py     # delete everything, start fresh
INCREMENTAL_ONLY=true python3 scraper.py           # only new candidates (null last_comprehensive_update)
ENRICH_ALL_OVERRIDE=true python3 scraper.py        # reprocess all (ignore existing scores)
DRY_RUN_OVERRIDE=true python3 scraper.py           # print what would happen, no DB writes
SKIP_DISCOVERY=true python3 scraper.py             # skip social link discovery
```

**Facebook auth (unlocks candidate pages):**

```bash
cd pipeline
playwright codegen --save-storage=state.json https://www.facebook.com
# log in with a BURNER ACCOUNT, then Ctrl+C
python3 scraper.py   # auto-detects state.json
```

---

## Project Structure

```
app/                        Next.js app router pages
  page.tsx                  Home
  candidates/page.tsx       Candidates directory
  candidates/[id]/page.tsx  Candidate profile
  parties/page.tsx          Parties directory
  parties/[id]/page.tsx     Party profile
  districts/page.tsx        Electoral districts
  districts/[id]/page.tsx   District detail
  ballot/page.tsx           My Ballot (localStorage)
  compare/page.tsx          Compare two candidates
  stv/page.tsx              STV explainer

components/
  navbar.tsx                Top navigation
  footer.tsx                Footer
  candidate-card.tsx        Card used in listings
  candidates-filter.tsx     Search + filter bar
  global-search.tsx         Cmd+K search
  malta-map.tsx             SVG district map
  ballot-star.tsx           Star/favourite button
  ballot-preview.tsx        Ballot preview modal
  compare-button.tsx        Compare trigger
  postcode-lookup.tsx       Postcode → district lookup

lib/
  strings.ts                ALL UI copy (Maltese). Edit here for text changes.
  types.ts                  TypeScript interfaces (Candidate, Party, District)
  ballot.ts                 localStorage ballot logic
  postal-districts.ts       Postcode → district map
  utils.ts                  clsx/tailwind helpers
  supabase/
    client.ts               Browser Supabase client
    server.ts               Server Supabase client (RSC)

pipeline/
  scraper.py                Main orchestrator — runs all phases
  scraper_business.py       Phase 1: business registry, gazette, court records
  scraper_parliament.py     Phase 2: parliamentary voting from PDFs
  scraper_parties.py        Phase 4: party manifestos, policies, leadership
  fetch_photos.py           Standalone photo fetcher
  requirements.txt          Python dependencies
  state.json                Playwright Facebook auth (gitignored, use burner account)

supabase/migrations/
  001_initial_schema.sql    Base: candidates, parties, districts
  002_seed_mps.sql          MP seed data
  003_party_logos.sql       Party logos
  004_priority_tags.sql     Priority tags array
  005_fix_district_localities.sql
  006_add_business_interests.sql   Phase 1 tables
  007_add_parliamentary_votes.sql  Phase 2 table
  008_add_party_data.sql           Phase 4 tables
```

---

## Database Schema

### Core tables (migration 001)

**candidates**
- `id`, `full_name`, `party_id`, `districts` (int[]), `photo_url`
- `social_links` (JSONB: `{facebook, instagram, website}`)
- `incumbent` (bool), `priority_tags` (text[])
- `party_reliance_score` (0-100), `score_justification`
- `personal_stances` (text[]), `personal_stances_mt` (text[])
- `key_quotes` (text[]), `key_quotes_mt` (text[])
- `is_mp`, `parliament_bio`, `current_position`
- `data_completeness_pct` (0-100), `last_comprehensive_update`

**parties**
- `id`, `name`, `abbreviation`, `color_hex`, `logo_url`

**districts**
- `id` (1-13), `name`, `localities` (text[])

### Phase 1 tables (migration 006)

**candidate_business_interests** — company directorships  
**candidate_disclosures** — asset declarations, conflicts of interest  
**candidate_legal_records** — court cases and legal matters  

### Phase 2 table (migration 007)

**parliamentary_votes** — how each MP voted on bills, with LLM confidence score

### Phase 4 tables (migration 008)

**parties** (extended), **party_manifestos**, **party_policies**, **party_leadership**,  
**party_statements**, **party_voting_stats**, **party_media_mentions**, **party_governance**,  
**party_comparison_metrics**

---

## Scraper Pipeline (scraper.py)

Runs three phases sequentially per `python3 scraper.py`:

**Phase 1 (per candidate):**
1. Parliament roster check (is_mp, current_position)
2. Malta Business Registry scrape (directorships)
3. Government Gazette search (asset declarations)
4. Court records search (news fallback)
5. Social link discovery (Facebook/website)
6. Content scraping: Facebook → website → news (Google dorks)
7. Ollama enrichment: party_reliance_score (0-100), stances, quotes
8. MyMemory translation to Maltese
9. Save to Supabase

**Phase 2 (once, after all candidates):**
1. Fetch plenary session PDF index from parlament.mt
2. Download PDF Minutes
3. Search for "Diviżjoni" / "Iva" / "Le" voting keywords
4. Extract ~800-word context per vote
5. Ollama parses vote_type, bill_name, votes dict
6. Save to parliamentary_votes with confidence score

**Phase 4 (per party: PN, PL, AD):**
1. Scrape party website (manifesto links, statements, leadership)
2. Download manifesto PDF
3. Ollama extracts structured policy positions
4. Scrape news mentions via DuckDuckGo
5. Save to party_* tables

---

## Key Conventions

### All UI text lives in `lib/strings.ts`
Never hardcode Maltese strings in components. Use `s.section.key`.

### Supabase clients
- `lib/supabase/server.ts` — use in Server Components and route handlers
- `lib/supabase/client.ts` — use in Client Components (`'use client'`)

### Candidate query pattern
```ts
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()
const { data } = await supabase
  .from('candidates')
  .select('*, party:parties(*)')
  .order('full_name')
```

### Images
All external image domains must be declared in `next.config.ts` under `remotePatterns`. Current: Wikimedia, fbcdn.net, cdninstagram.com, Maltese news sites.

### Tailwind
Using Tailwind v4 — config is in `app/globals.css`, not `tailwind.config.js`. No config file exists.

---

## Environment Variables

Stored in `.env.local` (frontend) and `pipeline/.env` (scraper). Copy with:
```bash
cp .env.local pipeline/.env
```

Required:
```
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

No cloud LLM keys needed — Ollama runs locally.

---

## Phases Status

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ Done | Business interests, disclosures, court records per candidate |
| 2 | ✅ Done | Parliamentary voting records from PDFs |
| 3 | ❌ Skipped | Local/EU records — dropped |
| 4 | ✅ Done | Party intelligence (manifestos, policies, leadership) |
| 5 | ⏸ Paused | Media coverage & fact-checking |
| 6 | ⏸ Paused | Advanced analysis & comparison |
