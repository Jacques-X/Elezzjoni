# Kandidati.mt: Comprehensive Candidate Data & Analysis Spec

## Vision
Transform Kandidati.mt from a basic candidate directory into a **rigorous, multi-source verification platform** that gives Maltese voters:
- Complete candidate profiles (education, work history, finances, declarations)
- Full parliamentary track record (votes, speeches, bills authored, amendments)
- Policy consistency analysis (claims vs. votes; party alignment vs. independence)
- Media coverage & fact-checking (cross-reference statements with voting record)
- Timeline of position evolution (have they changed stance? when? why?)
- Comparative analysis (compare any 2+ candidates on specific issues)

**Approach:** Automatic scraping + LLM enrichment. Reuse existing pipeline patterns (Playwright, trafilatura, Ollama). No manual curation.

---

## Project Context
- **Stack:** Next.js 16, Supabase, Python pipeline (Playwright + trafilatura), Ollama llama3.1:8b
- **Current data:** Facebook, personal websites, Maltese news, Wikidata photos
- **Current enrichment:** Party reliance score (0-100), stances, quotes
- **Baseline:** 2022 election candidate register (one-time seed)
- **Recurrence:** Daily enrichment; monthly parliament/council/EU updates

---

## Data Sources & Collection

### **Tier 1: Core Candidate Identity (Foundation)**

#### 1a. Electoral Register (2022 baseline)
- **Source:** Electoral Commission archive / Wayback Machine
- **What:** Candidate name, party, constituency, ballot position, status (elected/lost)
- **How:** One-time scrape; seed `candidates` table
- **Output:** SQL migration with 2022 baseline

#### 1b. Parliament Member Roster & Biographical Data
- **Source:** https://parlament.mt/en/Members-of-Parliament
- **What:** Full member list, constituencies, party, current role, biography
- **How:** Scrape & match against candidates; identify MPs
- **Output:** `candidates.is_mp = true`, `candidates.parliament_bio`, `candidates.current_role`

#### 1c. Government Gazette (Declarations & Interest Disclosures)
- **Source:** https://www.xjenza.gov.mt (official government publications)
- **What:** Asset declarations, conflict of interest statements, appointment notices
- **How:** Search candidate names; extract declarations
- **Output:** New table `candidate_disclosures` with: asset_value, properties, directorships, conflict_notes, date_filed

#### 1d. Business Registry (Company Directorships & Ownership)
- **Source:** Malta Business Registry
- **What:** Companies where candidate holds directorship/ownership stake
- **How:** Scrape registry; match candidate names
- **Output:** New table `candidate_business_interests` with: company_name, role, ownership_pct, status (active/dormant)

#### 1e. Court Records (if public)
- **Source:** Malta courts public records (if available online)
- **What:** Any legal disputes, cases, judgments involving candidate
- **How:** Scrape court database if available; fallback to news mentions
- **Output:** New table `candidate_legal_records` with: case_type, date, outcome, severity

---

### **Tier 2: Parliamentary Record (Voting, Speeches, Bills)**

#### 2a. Parliamentary Voting Record
- **Source:** https://parlament.mt (voting records, divisions)
- **What:** Every vote cast by candidate
- **How:** Scrape parliament voting archives; parse divisions (for/against/abstain)
- **Output:** `parliamentary_voting_records` (JSONB) with:
  ```json
  {
    "votes": [
      {
        "bill_id": "...",
        "bill_title": "...",
        "date": "2024-03-15",
        "category": "health|economy|environment|justice|etc",
        "vote": "for|against|abstain",
        "bill_url": "..."
      }
    ],
    "voting_stats": {
      "total_votes": 150,
      "attendance_pct": 92,
      "agreement_with_party_pct": 89
    }
  }
  ```

#### 2b. Bills Authored/Co-Authored
- **Source:** https://parlament.mt (bill database)
- **What:** Primary legislative agenda—shows what candidate prioritizes
- **How:** Scrape parliament bill archives; identify author/co-authors
- **Output:** New table `candidate_bills_authored` with: bill_id, title, date_submitted, co_authors, status (passed/rejected/pending), category

#### 2c. Parliamentary Speeches & Statements
- **Source:** https://parlament.mt (Hansard/parliamentary transcript)
- **What:** Full text of speeches; questions asked; interventions
- **How:** Scrape Hansard; extract by candidate name
- **Output:** New table `candidate_parliamentary_speeches` with: date, speech_text, topic_category, word_count, sentiment

#### 2d. Committee Work & Roles
- **Source:** https://parlament.mt (committee pages)
- **What:** Committee membership, roles, attendance, motions raised
- **How:** Scrape committee rosters & minutes
- **Output:** Update `candidates` with: `committee_roles` (array), and new table `candidate_committee_activity` with: committee_name, role, motions_raised, attendance_pct

#### 2e. Parliamentary Questions & Interventions
- **Source:** https://parlament.mt (questions register)
- **What:** Every question asked, motion raised, urgent questions
- **How:** Scrape question register; track by date, topic, target minister
- **Output:** New table `candidate_questions_asked` with: date, question_text, topic, target, response (if public)

---

### **Tier 3: Local & EU Records**

#### 3a. Local Council Records (if candidate served)
- **Source:** Individual council websites (13 local councils in Malta)
- **What:** Council voting record, motions, role, attendance
- **How:** Scrape council minutes & voting records; identify candidate
- **Output:** New table `candidate_local_council_records` with: council_id, period (years), role, voting_record (JSONB), attendance_pct

#### 3b. EU Parliament Records (if candidate was/is MEP)
- **Source:** https://www.europarl.europa.eu (MEP database, voting records)
- **What:** EU votes, committee roles, political group affiliation, statements
- **How:** Scrape EU Parliament site for Maltese MEPs
- **Output:** New table `candidate_eu_parliament_records` with: mep_id, political_group, committee_roles, votes (JSONB), period (years)

---

### **Tier 4: Policy & Position Data**

#### 4a. Party Manifestos & Platform Documents
- **Source:** Party websites (PN, PL, smaller parties)
- **What:** Structured policy positions on: economy, health, education, environment, EU, justice, immigration, etc.
- **How:** Scrape manifesto PDFs; extract via Ollama LLM
- **Output:** New table `party_policies` with:
  ```json
  {
    "party_id": "...",
    "policy_areas": [
      {
        "area": "healthcare",
        "position": "...",
        "priority": "high|medium|low",
        "source_url": "...",
        "extracted_date": "2024-01-15"
      }
    ]
  }
  ```

#### 4b. Candidate Personal Websites & Campaign Materials
- **Source:** Candidate websites (already scraping via trafilatura)
- **What:** Policy statements, candidate bios, pledges, campaign priorities
- **Output:** Enrich existing `candidates.personal_stances` with better categorization + confidence scores

#### 4c. Media Statements & Press Releases
- **Source:** Candidate websites, party websites, news archives
- **What:** Formal statements on key issues
- **How:** Scrape & extract via trafilatura + Ollama
- **Output:** New table `candidate_public_statements` with: date, statement_text, topic, source, sentiment

---

### **Tier 5: Media Coverage & Fact-Checking**

#### 5a. News Archive Full-Text Search
- **Source:** Maltese news (Times of Malta, Malta Today, Independent, Newsbook, Newsbook, others)
- **What:** Every article mentioning candidate
- **How:** Already scraping via DuckDuckGo; expand to comprehensive archive crawl
- **Output:** New table `candidate_news_mentions` with: date, article_url, source, headline, excerpt, sentiment, mention_context

#### 5b. Fact-Checking Integration
- **Source:** Extracted candidate claims vs. parliamentary voting record + news
- **What:** Automatic detection of contradictions
- **How:** Ollama enrichment: "Candidate claims X, but voting record shows Y"
- **Output:** New table `candidate_claim_verification` with:
  ```json
  {
    "claim": "I support healthcare spending",
    "source": "Facebook post 2024-01-15",
    "claim_date": "2024-01-15",
    "voting_evidence": [
      {
        "bill": "Healthcare Budget Bill 2023",
        "vote": "against",
        "date": "2023-11-20",
        "contradiction": true
      }
    ],
    "verification_status": "contradicted|supported|neutral",
    "confidence": 0.92
  }
  ```

#### 5c. Media Sentiment Analysis
- **Source:** News articles + social media posts
- **What:** Sentiment of coverage (positive/negative/neutral)
- **How:** Ollama sentiment analysis on article text
- **Output:** `candidate_news_mentions.sentiment` (score -1 to +1)

---

### **Tier 6: Social Media & Public Presence**

#### 6a. Facebook Activity & Engagement
- **Source:** Candidate Facebook pages (already scraping)
- **What:** Post frequency, engagement metrics, topic focus
- **How:** Extend existing Playwright scraper to count posts, extract engagement
- **Output:** New table `candidate_social_activity` with: platform, post_count, avg_engagement, topic_distribution, posting_frequency

#### 6b. Twitter/X Feed
- **Source:** Candidate Twitter accounts (if they have them)
- **What:** Tweet frequency, topics, engagement, followers
- **How:** Scrape via Twitter API (if available) or Playwright fallback
- **Output:** `candidate_social_activity` row for Twitter

#### 6c. Instagram & TikTok (optional)
- **Source:** Candidate accounts
- **What:** Post frequency, reach, content type (video/image), engagement
- **How:** Scrape profile pages
- **Output:** `candidate_social_activity` rows

---

## Database Schema

### New Tables

**candidate_disclosures**
```sql
CREATE TABLE candidate_disclosures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  disclosure_type TEXT, -- "assets", "income", "conflict_of_interest", etc.
  disclosed_value TEXT,
  date_filed TIMESTAMP WITH TIME ZONE,
  source_url TEXT,
  raw_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**candidate_business_interests**
```sql
CREATE TABLE candidate_business_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  role TEXT, -- "director", "shareholder", "founder", etc.
  ownership_pct NUMERIC,
  status TEXT, -- "active", "dormant", "dissolved"
  company_registration_id TEXT,
  url TEXT,
  first_registered TIMESTAMP WITH TIME ZONE,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(candidate_id, company_registration_id)
);
```

**candidate_legal_records**
```sql
CREATE TABLE candidate_legal_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  case_type TEXT, -- "civil", "criminal", "administrative", etc.
  case_reference TEXT,
  description TEXT,
  case_date TIMESTAMP WITH TIME ZONE,
  outcome TEXT,
  severity TEXT, -- "high", "medium", "low"
  source_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**candidate_bills_authored**
```sql
CREATE TABLE candidate_bills_authored (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  bill_id TEXT UNIQUE,
  bill_title TEXT NOT NULL,
  date_submitted TIMESTAMP WITH TIME ZONE,
  date_passed TIMESTAMP WITH TIME ZONE,
  co_authors TEXT[], -- array of candidate names
  policy_category TEXT, -- "health", "economy", etc.
  status TEXT, -- "passed", "rejected", "pending", "withdrawn"
  url TEXT,
  summary TEXT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**candidate_parliamentary_speeches**
```sql
CREATE TABLE candidate_parliamentary_speeches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  speech_date TIMESTAMP WITH TIME ZONE,
  speech_text TEXT NOT NULL,
  topic_category TEXT, -- extracted via Ollama
  word_count INTEGER,
  sentiment NUMERIC, -- -1 to +1
  session_url TEXT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**candidate_questions_asked**
```sql
CREATE TABLE candidate_questions_asked (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  question_date TIMESTAMP WITH TIME ZONE,
  question_text TEXT NOT NULL,
  topic TEXT,
  target_minister TEXT,
  response_text TEXT,
  response_date TIMESTAMP WITH TIME ZONE,
  question_url TEXT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**candidate_committee_activity**
```sql
CREATE TABLE candidate_committee_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  committee_name TEXT NOT NULL,
  role TEXT, -- "member", "chair", "vice-chair", etc.
  membership_start TIMESTAMP WITH TIME ZONE,
  membership_end TIMESTAMP WITH TIME ZONE,
  attendance_pct NUMERIC,
  motions_raised INTEGER,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(candidate_id, committee_name, membership_start)
);
```

**candidate_local_council_records**
```sql
CREATE TABLE candidate_local_council_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  council_id TEXT, -- council name
  membership_start TIMESTAMP WITH TIME ZONE,
  membership_end TIMESTAMP WITH TIME ZONE,
  role TEXT, -- "councilor", "mayor", etc.
  attendance_pct NUMERIC,
  voting_record JSONB, -- array of votes
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(candidate_id, council_id, membership_start)
);
```

**candidate_eu_parliament_records**
```sql
CREATE TABLE candidate_eu_parliament_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  mep_id TEXT UNIQUE,
  political_group TEXT,
  term_start TIMESTAMP WITH TIME ZONE,
  term_end TIMESTAMP WITH TIME ZONE,
  committee_roles TEXT[],
  votes_for_pct NUMERIC,
  votes_against_pct NUMERIC,
  abstentions_pct NUMERIC,
  url TEXT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**party_policies**
```sql
CREATE TABLE party_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  policy_area TEXT NOT NULL, -- "healthcare", "economy", "environment", etc.
  position TEXT NOT NULL,
  priority TEXT, -- "high", "medium", "low"
  source_url TEXT,
  extracted_date TIMESTAMP WITH TIME ZONE,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(party_id, policy_area)
);
```

**candidate_public_statements**
```sql
CREATE TABLE candidate_public_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  statement_date TIMESTAMP WITH TIME ZONE,
  statement_text TEXT NOT NULL,
  statement_type TEXT, -- "press_release", "interview", "speech", "social_media", etc.
  topic TEXT,
  source_url TEXT,
  sentiment NUMERIC, -- -1 to +1
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**candidate_news_mentions**
```sql
CREATE TABLE candidate_news_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  mention_date TIMESTAMP WITH TIME ZONE,
  article_url TEXT UNIQUE,
  news_source TEXT, -- "times of malta", "malta today", etc.
  headline TEXT,
  excerpt TEXT,
  full_text TEXT,
  sentiment NUMERIC, -- -1 to +1
  context TEXT, -- "positive coverage", "scandal", "policy announcement", etc.
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**candidate_claim_verification**
```sql
CREATE TABLE candidate_claim_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  claim TEXT NOT NULL,
  claim_source TEXT, -- "Facebook post", "interview", etc.
  claim_date TIMESTAMP WITH TIME ZONE,
  verification_status TEXT, -- "supported", "contradicted", "neutral", "unverifiable"
  confidence NUMERIC, -- 0-1
  supporting_evidence JSONB, -- array of bills/votes that support
  contradicting_evidence JSONB, -- array of bills/votes that contradict
  fact_check_text TEXT,
  last_verified TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**candidate_social_activity**
```sql
CREATE TABLE candidate_social_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  platform TEXT UNIQUE, -- "facebook", "twitter", "instagram", "tiktok"
  follower_count INTEGER,
  post_count INTEGER,
  avg_engagement_rate NUMERIC,
  topic_distribution JSONB, -- { "health": 25, "economy": 40, ... }
  posting_frequency TEXT, -- "daily", "weekly", etc.
  account_url TEXT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Alter Existing Tables

```sql
-- candidates table additions
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS is_mp BOOLEAN DEFAULT FALSE;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS parliament_bio TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS current_role TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS parliamentary_voting_records JSONB;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS parliament_consistency_score INTEGER;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS party_alignment_pct INTEGER; -- avg % agreement with party on votes
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS independence_evolution JSONB; -- scores over time
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS data_completeness_pct INTEGER; -- how much data we have on this candidate
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS last_comprehensive_update TIMESTAMP WITH TIME ZONE;
```

---

## Pipeline Implementation (scraper.py)

### New Functions

**1. Parliament Data Scraping**

```python
async def scrape_parliament_member_roster(client: httpx.AsyncClient) -> dict:
    """Fetch full parliament member list and return { name: { role, constituency, bio } }"""
    # Scrape parlament.mt/en/Members-of-Parliament
    # Return dict mapping candidate names to their MP details

async def scrape_parliamentary_votes(candidate_name: str, client: httpx.AsyncClient) -> dict:
    """Fetch voting record for MP. Return { votes: [...], stats: {...} }"""
    # Scrape parlament.mt voting archives
    # Match candidate to votes
    # Return structured voting record

async def scrape_parliamentary_speeches(candidate_name: str, client: httpx.AsyncClient) -> list:
    """Fetch Hansard speeches by candidate. Return list of { date, text, topic }"""
    # Scrape parlament.mt Hansard
    # Extract speeches by candidate
    # Return array of speech objects

async def scrape_bills_authored(candidate_name: str, client: httpx.AsyncClient) -> list:
    """Fetch bills authored/co-authored by candidate."""
    # Scrape parliament bills database
    # Return array of bills

async def scrape_questions_asked(candidate_name: str, client: httpx.AsyncClient) -> list:
    """Fetch parliamentary questions asked by candidate."""
    # Scrape questions register
    # Return array of questions

async def scrape_committee_roles(candidate_name: str, client: httpx.AsyncClient) -> dict:
    """Fetch committee memberships and activity."""
    # Scrape committee pages
    # Return { committees: [...], total_motions: N, avg_attendance: X% }
```

**2. Business & Disclosure Scraping**

```python
async def scrape_business_registry(candidate_name: str, client: httpx.AsyncClient) -> list:
    """Fetch company directorships from Malta Business Registry."""
    # Query registry for candidate name
    # Extract directorships, ownership stakes
    # Return list of { company_name, role, ownership_pct, status }

async def scrape_government_gazette(candidate_name: str, client: httpx.AsyncClient) -> list:
    """Fetch declarations from Government Gazette."""
    # Search xjenza.gov.mt for declarations mentioning candidate
    # Extract asset values, conflicts
    # Return list of disclosures
```

**3. Media & Fact-Checking**

```python
async def scrape_news_comprehensive(candidate_name: str, client: httpx.AsyncClient) -> list:
    """Comprehensive news search with sentiment analysis."""
    # Scrape Maltese news archives (expand beyond DuckDuckGo search)
    # Extract date, headline, excerpt, full text
    # Analyze sentiment via Ollama
    # Return list of { date, source, url, headline, excerpt, sentiment }

async def verify_candidate_claims(
    candidate_name: str,
    candidate_statements: list[str],
    voting_record: dict
) -> list:
    """Cross-reference candidate claims against voting record.
    Return contradictions and supporting evidence."""
    # For each claim, search voting record for related bills
    # Use Ollama to determine: supported/contradicted/neutral
    # Return { claim, verification_status, evidence, confidence }
```

**4. Social Media Scraping**

```python
async def scrape_facebook_engagement(fb_url: str, browser: Browser) -> dict:
    """Extended Facebook scraping: post count, engagement metrics, topic distribution."""
    # Already have basic scraping; enhance to track:
    # - Post frequency
    # - Engagement per post (likes, comments, shares)
    # - Topic distribution (health vs economy vs social posts)
    # Return { post_count, avg_engagement_rate, topic_distribution, posting_frequency }

async def scrape_twitter_profile(handle: str, client: httpx.AsyncClient) -> dict:
    """Fetch Twitter profile metrics and recent tweets."""
    # Scrape candidate Twitter (if account exists)
    # Return { followers, tweet_count, avg_engagement, recent_topics }
```

**5. Local Council Records**

```python
async def scrape_local_council_records(candidate_name: str, client: httpx.AsyncClient) -> list:
    """Fetch local council voting record if candidate served."""
    # Scrape Malta's 13 local councils for candidate
    # Extract voting records, role, attendance
    # Return list of { council, role, period, voting_record, attendance_pct }
```

**6. EU Parliament Records**

```python
async def scrape_eu_parliament_records(candidate_name: str, client: httpx.AsyncClient) -> dict:
    """Fetch EU Parliament record if candidate was/is MEP."""
    # Scrape europarl.europa.eu for Maltese MEPs
    # Return { mep_id, political_group, voting_record, committee_roles }
```

**7. LLM Enrichment (Enhanced)**

```python
async def enrich_with_full_context(
    candidate_name: str,
    personal_statements: str,
    voting_record: dict,
    parliamentary_speeches: str,
    news_mentions: str,
    party_position: str
) -> dict:
    """
    Enhanced Ollama enrichment using ALL data sources.
    Returns:
    - party_reliance_score (0-100)
    - parliament_consistency_score (0-100) — does voting match statements?
    - contradiction_alerts (array of claims vs votes)
    - key_policy_positions (extracted from all sources)
    - evolution_timeline (how positions changed over time)
    """
    prompt = f"""
    Analyze {candidate_name}'s full political profile:

    PERSONAL STATEMENTS (from website, social media):
    {personal_statements[:3000]}

    PARLIAMENTARY VOTING RECORD:
    {json.dumps(voting_record)[:3000]}

    SPEECHES IN PARLIAMENT:
    {parliamentary_speeches[:3000]}

    MEDIA COVERAGE:
    {news_mentions[:2000]}

    PARTY PLATFORM:
    {party_position[:2000]}

    Return JSON with:
    - party_reliance_score (0-100)
    - parliament_consistency_score (0-100) — how much do their votes match their stated positions?
    - contradictions (array of {{claim, contradicting_vote, confidence}})
    - policy_positions (array of {{area, position, confidence}})
    - overall_assessment (text: independent vs party-aligned, consistent vs flip-flopping)
    """
    # Call Ollama
    # Return structured enrichment
```

### Updated Main Flow

```python
async def main() -> None:
    # ... existing setup ...
    
    # 1. Fetch candidates (unchanged)
    rows = supabase.table("candidates").select("id, full_name, ...").execute().data
    
    for candidate in rows:
        name = candidate["full_name"]
        
        # STAGE 1: Identity Discovery (new)
        # Check if candidate is MP, has business interests, disclosures, etc.
        is_mp = await check_parliament_roster(name, http)
        business_interests = await scrape_business_registry(name, http)
        disclosures = await scrape_government_gazette(name, http)
        legal_records = await scrape_court_records(name, http)
        
        # STAGE 2: Parliamentary Data (new)
        if is_mp:
            voting_record = await scrape_parliamentary_votes(name, http)
            speeches = await scrape_parliamentary_speeches(name, http)
            bills_authored = await scrape_bills_authored(name, http)
            questions = await scrape_questions_asked(name, http)
            committees = await scrape_committee_roles(name, http)
        
        # STAGE 3: Local Council Records (new)
        council_records = await scrape_local_council_records(name, http)
        
        # STAGE 4: EU Parliament Records (new, if applicable)
        eu_records = await scrape_eu_parliament_records(name, http)
        
        # STAGE 5: Policy Data (new)
        party_policies = await fetch_party_policies(candidate["party_id"], http)
        personal_statements = await scrape_candidate_statements(name, http)
        
        # STAGE 6: Media & Social (enhanced)
        news_mentions = await scrape_news_comprehensive(name, http)
        social_metrics = await scrape_social_media(candidate["facebook_url"], browser)
        facebook_engagement = await scrape_facebook_engagement(...)
        
        # STAGE 7: Fact-Checking (new)
        claim_verifications = await verify_candidate_claims(
            name,
            personal_statements,
            voting_record if is_mp else None
        )
        
        # STAGE 8: Full Enrichment (enhanced)
        enrichment = await enrich_with_full_context(
            name,
            personal_statements,
            voting_record if is_mp else {},
            speeches if is_mp else "",
            news_mentions,
            party_policies
        )
        
        # STAGE 9: Save Everything (new massive write)
        update_dict = {
            # Existing
            "party_reliance_score": enrichment.get("party_reliance_score"),
            "personal_stances": enrichment.get("policy_positions"),
            
            # New
            "is_mp": is_mp,
            "parliament_consistency_score": enrichment.get("parliament_consistency_score"),
            "party_alignment_pct": enrichment.get("party_alignment_pct"),
            "independence_evolution": enrichment.get("evolution_timeline"),
            "data_completeness_pct": calculate_completeness(
                is_mp, business_interests, news_mentions, etc.
            ),
            "last_comprehensive_update": now(),
        }
        
        # Write to candidates table
        supabase.table("candidates").update(update_dict).eq("id", candidate["id"]).execute()
        
        # Write to new tables
        if business_interests:
            for interest in business_interests:
                supabase.table("candidate_business_interests").insert({
                    "candidate_id": candidate["id"],
                    **interest
                }).execute()
        
        if voting_record:
            supabase.table("candidate_parliamentary_speeches").insert({
                "candidate_id": candidate["id"],
                "voting_record": voting_record
            }).execute()
        
        # ... etc for all new tables ...
```

---

## GitHub Actions CRON Schedule

**`.github/workflows/comprehensive_enrichment.yml`**

```yaml
name: Comprehensive Candidate Enrichment

on:
  schedule:
    # Daily: lightweight enrichment (news, social, statements)
    - cron: '0 6 * * *'
    # Monthly: heavy lifting (parliament, council, business registry, EU)
    - cron: '0 2 1 * *'
    # Weekly: fact-checking & verification
    - cron: '0 4 * * 1'

jobs:
  enrich:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run enrichment pipeline
        env:
          SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          ENRICH_ALL: false
        run: |
          cd pipeline
          pip install -r requirements.txt
          python scraper.py
```

---

## Frontend Integration

### New Pages

**`/app/candidates/[id]/full-profile`** — Complete profile view
- Bio (from parliament, disclosures)
- Education & work history
- Business interests & assets
- Full voting record (if MP) — table of votes with filters
- Parliamentary speeches — searchable, by topic
- Bills authored — list with descriptions
- Questions asked — list
- Committee roles — timeline
- Local council records — if applicable
- EU records — if applicable
- All media mentions — timeline view
- Fact-checks — contradictions highlighted
- Social media stats — engagement metrics

**`/app/candidates/compare`** — Compare 2+ candidates
- Side-by-side voting records on same bills
- Policy position comparison (on healthcare, economy, environment, etc.)
- Social media engagement comparison
- Media sentiment comparison
- Voting consistency comparison

**`/app/issues/[issue]`** — Issue-based view
- E.g., `/app/issues/healthcare`
- Show all candidates ranked by healthcare voting record
- Show healthcare bills they voted on
- Show their public statements on healthcare
- Show party manifesto on healthcare

**`/app/parliament`** — Parliament activity feed
- Latest speeches, questions, votes
- Grouped by candidate
- Searchable by topic

### Components
- `<VotingRecord />` — Table of votes with bill details
- `<FactCheckAlert />` — Highlight contradictions
- `<ParliamentaryTimeline />` — Timeline of speeches, votes, questions
- `<ClaimComparison />` — "Candidate said X, voted Y"
- `<IssueComparison />` — Compare candidates on single issue
- `<SocialEngagement />` — Social media stats widget

---

## Implementation Phases

### Phase 1: Foundation (No dependencies — do first)
- Seed 2022 candidate register
- Scrape parliament member roster → identify MPs
- Create `candidate_business_interests`, `candidate_disclosures`, `candidate_legal_records` tables
- Scrape business registry & disclosures for all candidates
- Set up monthly CRON for business/disclosure updates

### Phase 2: Parliamentary Record (Depends on Phase 1)
- Scrape parliamentary voting records (full historical)
- Create `candidate_bills_authored`, `candidate_questions_asked`, `candidate_parliamentary_speeches`, `candidate_committee_activity` tables
- Scrape speeches, bills, questions for all MPs
- Calculate `parliament_consistency_score`
- Set up weekly CRON for parliament updates

### Phase 3: Verification & Fact-Checking (Depends on Phase 1 & 2)
- Create `candidate_claim_verification` table
- Build fact-checking logic (claims vs votes)
- Comprehensive news scrape → create `candidate_news_mentions` table
- Add sentiment analysis on news & statements
- Set up weekly CRON for news + fact-checking

### Phase 4: Social Media & Policy (Depends on Phase 1)
- Scrape social media engagement metrics → `candidate_social_activity`
- Scrape & extract party manifestos → `party_policies` table
- Create `candidate_public_statements` table
- Enhance Ollama enrichment with full context
- Set up daily social media updates; monthly manifesto updates

### Phase 5: Local & EU Records (Depends on Phase 1)
- Scrape local council records (13 councils) → `candidate_local_council_records`
- Scrape EU Parliament records → `candidate_eu_parliament_records`
- Integrate into enrichment pipeline
- Set up quarterly CRON for local/EU data

### Phase 6: Frontend & Integration (Depends on all phases)
- Build `/app/candidates/[id]/full-profile` page
- Build `/app/candidates/compare` page
- Build `/app/issues/[issue]` page
- Display all new data fields
- Fact-check highlights & alerts
- Performance optimization and bug fixes

---

## Data Quality & Completeness

**Completeness Score** = % of data fields populated for a candidate
```
Max fields:
  - Business interests (3 fields each)
  - Disclosures (5 fields each)
  - Parliamentary votes (200+ possible)
  - Speeches (50+ possible)
  - Bills authored (10+ possible)
  - Questions asked (20+ possible)
  - News mentions (100+ possible)
  - Social media stats (5 fields)

If candidate has 0% parliament data but is NOT an MP, that's 100% complete.
If candidate is an MP but missing votes, that's incomplete.
```

**Update Frequency:**
- Daily: Facebook, Twitter, news search, statements
- Weekly: Parliament voting record, speeches, questions
- Monthly: Business registry, disclosures, local councils, EU parliament
- Quarterly: Full refresh (regenerate all fact-checks)

---

## Success Criteria

- [ ] All 2022 candidates seeded + 2025 candidates added as they register
- [ ] All MPs have full voting record (200+ votes)
- [ ] All candidates with business interests have those scraped
- [ ] All candidates have news mention timeline
- [ ] 100+ claim verifications completed
- [ ] Party policies extracted for all parties
- [ ] Fact-check page shows contradictions with high accuracy
- [ ] Compare tool works for any 2 candidates on any issue
- [ ] Social media engagement tracked + displayed
- [ ] Data completeness 80%+ for all candidates
- [ ] CRON jobs run reliably without errors
- [ ] Frontend displays all new data fields beautifully
- [ ] Page load times < 3s even with large datasets

---

## Notes for Implementation

- **Scraping strategy:** All sources use Playwright (with fallback to trafilatura for text-only sites)
- **Error handling:** Fail gracefully; if parliament is down, skip that candidate; use DRY_RUN for testing
- **Rate limiting:** Semaphore = 1 keeps scraping sequential and respectful
- **Data validation:** Check that votes sum to 100%, parliament speeches have dates, etc.
- **Caching:** Consider caching parliament member roster (static, yearly updates)
- **Ollama tuning:** May need to increase context window for full enrichment prompts
- **Scalability:** If data grows large, consider pagination on frontend; archive old news mentions
- **Privacy:** Don't scrape personal contact info (phone, email); stick to public records
- **Legal:** Ensure all sources are public; respect robots.txt; see Malta's data protection laws

---

## Files to Create/Modify

**New files:**
- `supabase/migrations/006_add_business_interests.sql`
- `supabase/migrations/007_add_disclosures.sql`
- `supabase/migrations/008_add_parliament_detailed.sql`
- `supabase/migrations/009_add_local_council.sql`
- `supabase/migrations/010_add_eu_parliament.sql`
- `supabase/migrations/011_add_news_and_claims.sql`
- `supabase/migrations/012_add_social_activity.sql`
- `pipeline/scraper_parliament.py` (parliament scraping module)
- `pipeline/scraper_business.py` (business registry module)
- `pipeline/scraper_news.py` (news & fact-checking module)
- `pipeline/scraper_social.py` (social media module)
- `.github/workflows/comprehensive_enrichment.yml` (new CRON)
- `app/candidates/[id]/full-profile/page.tsx` (new page)
- `app/candidates/compare/page.tsx` (new page)
- `app/issues/[issue]/page.tsx` (new page)
- `components/VotingRecord.tsx`
- `components/FactCheckAlert.tsx`
- `components/ParliamentaryTimeline.tsx`
- `components/IssueComparison.tsx`
- `components/CandidateCompare.tsx`

**Modify:**
- `pipeline/scraper.py` (integrate all new scrapers, add full enrichment)
- `lib/supabase/types.ts` (add all new types)
- `.env.local` (add any new API keys if needed)
- `README.md` (document new data sources)

---

This spec gives Sonnet 4.6 everything needed to build a comprehensive, rigorous election platform.
