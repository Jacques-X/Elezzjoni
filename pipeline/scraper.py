"""
Elezzjoni.mt — Data Pipeline
Scrapes electoral.gov.mt and party sites, enriches with LLM, upserts to Supabase.
"""

import asyncio
import json
import os
import re
from dataclasses import dataclass, field
from typing import Optional

from bs4 import BeautifulSoup
from dotenv import load_dotenv
from playwright.async_api import async_playwright
from supabase import create_client, Client
import google.generativeai as genai

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]

ELECTORAL_BASE = "https://electoral.gov.mt"

# ─────────────────────────────────────────────
# Data models
# ─────────────────────────────────────────────

@dataclass
class ScrapedCandidate:
    full_name: str
    party_abbreviation: str
    districts: list[int]
    photo_url: Optional[str] = None
    facebook: Optional[str] = None
    instagram: Optional[str] = None
    website: Optional[str] = None
    bio_text: Optional[str] = None
    incumbent: bool = False


@dataclass
class EnrichedCandidate(ScrapedCandidate):
    personal_stances: list[str] = field(default_factory=list)
    key_quotes: list[str] = field(default_factory=list)


# ─────────────────────────────────────────────
# Scraper
# ─────────────────────────────────────────────

async def scrape_candidates() -> list[ScrapedCandidate]:
    """
    Scrapes the Electoral Commission candidate list.
    URL pattern: https://electoral.gov.mt/ElectionResults/Candidates
    Adjust selectors to match the live site structure.
    """
    candidates: list[ScrapedCandidate] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        page = await browser.new_page()

        print("Loading electoral.gov.mt candidate list…")
        await page.goto(f"{ELECTORAL_BASE}/ElectionResults/Candidates", wait_until="networkidle")
        html = await page.content()
        soup = BeautifulSoup(html, "html.parser")

        # Adjust selector to match actual site structure
        rows = soup.select("table.candidates-table tbody tr")
        if not rows:
            # Fallback: try a card-based layout
            rows = soup.select(".candidate-card, .candidate-item")

        for row in rows:
            try:
                name_el = row.select_one(".candidate-name, td:nth-child(1)")
                party_el = row.select_one(".candidate-party, td:nth-child(2)")
                district_el = row.select_one(".candidate-district, td:nth-child(3)")

                if not name_el:
                    continue

                full_name = name_el.get_text(strip=True)
                party_abbr = party_el.get_text(strip=True) if party_el else "IND"

                # Parse district numbers from text like "District 1, District 3"
                district_text = district_el.get_text(strip=True) if district_el else ""
                district_nums = [int(n) for n in re.findall(r"\b(\d{1,2})\b", district_text)
                                 if 1 <= int(n) <= 13]

                photo_el = row.select_one("img")
                photo_url = photo_el.get("src") if photo_el else None
                if photo_url and not photo_url.startswith("http"):
                    photo_url = ELECTORAL_BASE + photo_url

                candidates.append(ScrapedCandidate(
                    full_name=full_name,
                    party_abbreviation=party_abbr,
                    districts=district_nums,
                    photo_url=photo_url,
                ))
            except Exception as e:
                print(f"  ⚠ Error parsing row: {e}")
                continue

        await browser.close()

    print(f"Scraped {len(candidates)} candidates.")
    return candidates


# ─────────────────────────────────────────────
# LLM enrichment
# ─────────────────────────────────────────────

def build_llm_prompt(candidate_name: str, bio_text: str) -> str:
    return f"""
You are a neutral political analyst. Analyse the following text about {candidate_name} and extract:
1. Up to 3 concise bullet-point stances on policy issues (max 20 words each).
2. Up to 3 direct quotes attributed to the candidate.

Return ONLY valid JSON in this exact schema:
{{
  "personal_stances": ["stance 1", "stance 2", "stance 3"],
  "key_quotes": ["quote 1", "quote 2"]
}}

If there is insufficient information for stances or quotes, return empty arrays.
Do not fabricate information. Only use what is in the text.

Text:
\"\"\"
{bio_text[:4000]}
\"\"\"
"""


async def enrich_candidate(
    candidate: ScrapedCandidate,
    model: genai.GenerativeModel,
) -> EnrichedCandidate:
    enriched = EnrichedCandidate(**candidate.__dict__)

    if not candidate.bio_text or len(candidate.bio_text.strip()) < 50:
        return enriched

    try:
        prompt = build_llm_prompt(candidate.full_name, candidate.bio_text)
        response = await asyncio.to_thread(model.generate_content, prompt)
        text = response.text.strip()

        # Strip markdown code fences if present
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

        data = json.loads(text)
        enriched.personal_stances = data.get("personal_stances", [])[:3]
        enriched.key_quotes = data.get("key_quotes", [])[:3]
    except Exception as e:
        print(f"  ⚠ LLM enrichment failed for {candidate.full_name}: {e}")

    return enriched


# ─────────────────────────────────────────────
# Supabase upsert
# ─────────────────────────────────────────────

def get_party_map(supabase: Client) -> dict[str, str]:
    """Returns {abbreviation: party_uuid}"""
    response = supabase.table("parties").select("id, abbreviation").execute()
    return {row["abbreviation"]: row["id"] for row in response.data}


def upsert_candidates(supabase: Client, candidates: list[EnrichedCandidate]) -> None:
    party_map = get_party_map(supabase)

    records = []
    for c in candidates:
        party_id = party_map.get(c.party_abbreviation) or party_map.get("IND")

        social_links: dict[str, str] = {}
        if c.facebook:
            social_links["facebook"] = c.facebook
        if c.instagram:
            social_links["instagram"] = c.instagram
        if c.website:
            social_links["website"] = c.website

        record: dict = {
            "full_name": c.full_name,
            "party_id": party_id,
            "districts": c.districts,
            "photo_url": c.photo_url,
            "social_links": social_links or None,
            "incumbent": c.incumbent,
            "last_updated": "now()",
        }

        if c.personal_stances:
            record["personal_stances"] = c.personal_stances
        if c.key_quotes:
            record["key_quotes"] = c.key_quotes

        records.append(record)

    if not records:
        print("No records to upsert.")
        return

    # Upsert in batches of 50
    batch_size = 50
    for i in range(0, len(records), batch_size):
        batch = records[i : i + batch_size]
        supabase.table("candidates").upsert(
            batch,
            on_conflict="full_name,party_id",
        ).execute()
        print(f"  ✓ Upserted batch {i // batch_size + 1} ({len(batch)} records)")


# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────

async def main() -> None:
    print("=== Elezzjoni.mt Data Pipeline ===")

    # Init Supabase (service role bypasses RLS)
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    # Init Gemini
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-1.5-flash")

    # 1. Scrape
    scraped = await scrape_candidates()

    if not scraped:
        print("No candidates scraped — check selectors.")
        return

    # 2. Enrich with LLM (concurrent, max 5 at a time to respect rate limits)
    print(f"Enriching {len(scraped)} candidates with LLM…")
    semaphore = asyncio.Semaphore(5)

    async def enrich_with_limit(c: ScrapedCandidate) -> EnrichedCandidate:
        async with semaphore:
            return await enrich_candidate(c, model)

    enriched = await asyncio.gather(*[enrich_with_limit(c) for c in scraped])

    # 3. Upsert to Supabase
    print("Upserting to Supabase…")
    upsert_candidates(supabase, list(enriched))

    print("=== Pipeline complete ===")


if __name__ == "__main__":
    asyncio.run(main())
