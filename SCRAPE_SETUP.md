# Kandidati.mt Scraper — Setup for Tonight

Complete build of Phase 1 (Business Interests) + Phase 2 (Parliamentary Voting) ready to run.

## Prerequisites

### 1. Database Migrations
The two new migrations must be applied to your Supabase project:
```
supabase/migrations/006_add_business_interests.sql  — Phase 1 tables
supabase/migrations/007_add_parliamentary_votes.sql  — Phase 2 tables
```

**If using Supabase CLI**: 
```bash
supabase db push
```

**If using web dashboard**: 
Copy each SQL file into the SQL editor and execute.

**Tables created**:
- `candidate_business_interests` — directorships, company roles
- `candidate_disclosures` — asset declarations, conflicts of interest
- `candidate_legal_records` — court cases, legal matters
- `parliamentary_votes` — how MPs voted on bills/motions

### 2. Environment Setup
```bash
cd pipeline
cp ../.env.local .env
```

Ensure `.env` has:
```
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 3. Dependencies
```bash
pip install -r requirements.txt
playwright install chromium
```

### 4. Ollama
The scraper will auto-start Ollama if needed. Ensure it's installed:
```bash
brew install ollama  # macOS
ollama pull llama3.1:8b
```

## Running the Scraper

### Phase 1 Only (Business Interests)
```bash
cd pipeline
python scraper.py
```

This will:
- ✓ Check parliament roster (MPs)
- ✓ Scrape Malta Business Registry for directorships
- ✓ Search Government Gazette for asset declarations
- ✓ Search for court records
- ✓ Scrape enrichment content (Facebook, website, news)
- ✓ Enrich with Ollama (party reliance scores, policy stances)
- ✓ **Skip** parliamentary voting (Phase 2)

**Duration**: ~20-30 minutes for 68 candidates (depends on network/Ollama speed)

### With Phase 2 (Parliamentary Voting)
```bash
cd pipeline
python scraper.py
```

The scraper automatically includes Phase 2 after Phase 1 completes:
- ✓ Downloads plenary session PDFs
- ✓ Extracts voting records using PDF mining
- ✓ Parses votes with Ollama
- ✓ Saves votes to `parliamentary_votes` table per candidate

**Duration**: Adds ~15-30 minutes depending on number of sessions (3-5 currently)

### Testing Mode (Limit Sessions for Phase 2)
To test Phase 2 without processing all sessions:
1. Edit [scraper.py:937](pipeline/scraper.py#L937)
2. Change `limit_sessions=None` to `limit_sessions=2`
3. Run: `python scraper.py`

## Dry Run (Preview Changes)
See what would be written without touching database:
```bash
cd pipeline
DRY_RUN_OVERRIDE=true python scraper.py
```

## Options

```bash
# Re-process all candidates (including those with scores)
ENRICH_ALL_OVERRIDE=true python scraper.py

# Skip link discovery (use existing social_links from DB)
SKIP_DISCOVERY=true python scraper.py

# Combine flags
ENRICH_ALL_OVERRIDE=true DRY_RUN_OVERRIDE=true python scraper.py
```

## Facebook Auth (Optional)
If you have Facebook credentials and want to scrape authenticated content:

```bash
cd pipeline
playwright codegen --save-storage=state.json https://www.facebook.com
# Log in manually, then Ctrl+C
python scraper.py  # Will auto-use state.json
```

## Output

### Phase 1 Output (Console)
```
=== Elezzjoni.mt Candidate Enrichment Pipeline ===

Processing 68 candidates…

── Carmelo Abela
   🏛️  checking parliament roster…
   ✓  Member of Parliament
   💼 scraping business registry…
   ✓  1 director role(s)
   📋 searching government gazette…
   ✓  2 disclosure(s)
   ⚖️  searching court records…
   –  no records found
   🔍 discovering social links…
   📘 Facebook: https://www.facebook.com/...
   📄 scraping Facebook…
   ✓  400 words from Facebook
   🤖 enriching with llama3.1:8b…
   ✓  score=65 · 3 stances · 2 quotes
   🇲🇹 translating to Maltese…
```

### Phase 2 Output (Console)
```
=== Phase 2: Parliamentary Voting Records ===

  Fetching parliament plenary session index…

  ✓ Found 42 plenary sessions
  Processing 42 session(s)…

  [1/42] 2nd-december-2024
     📄 fetching session: 2nd-december-2024
     📦 extracted PDF (245,000 bytes)
     📝 extracted 450,000 chars from PDF
     ✓ found 3 potential vote section(s)

  [2/42] 9th-december-2024
     ...

  Found 156 total votes
```

### Database Records Created
- **candidate_business_interests**: All directorships found
- **candidate_disclosures**: All asset declarations found
- **candidate_legal_records**: All legal matters found
- **parliamentary_votes**: Voting records with confidence scores
- **candidates table updates**:
  - `is_mp`: true/false
  - `parliament_bio`: MP biography
  - `current_position`: Current parliament role
  - `data_completeness_pct`: 0-100 (based on Phase 1 data found)
  - `party_reliance_score`: 0-100 (from enrichment)
  - `personal_stances`: Policy stances (English)
  - `personal_stances_mt`: Policy stances (Maltese)
  - `key_quotes`: Direct quotes from sources
  - `photo_url`: Best available photo

## Troubleshooting

### Ollama not starting
```bash
ollama serve &  # Start manually in background
python scraper.py
```

### Supabase connection fails
Check `.env` has correct URL and service role key.

### Parliament PDF download fails
This is normal for some sessions. The scraper logs warnings and continues.

### Memory issues on large runs
Reduce browser concurrency in scraper.py (change `Semaphore(2)` to `Semaphore(1)`).

## Next Steps

After scraping completes:
1. Check Supabase dashboard to verify data was saved
2. Frontend will auto-display: business interests, disclosures, court records, voting records
3. For Phase 3+ enrichment: Implement social media analysis, policy stances

## File Structure
```
pipeline/
  scraper.py                 — Main orchestrator (Phase 1 + 2 + 3+)
  scraper_business.py        — Phase 1: Business interests collection
  scraper_parliament.py      — Phase 2: Parliamentary voting extraction
  requirements.txt           — Dependencies (includes pdfplumber)
  
supabase/migrations/
  006_add_business_interests.sql  — Phase 1 schema
  007_add_parliamentary_votes.sql  — Phase 2 schema
```
