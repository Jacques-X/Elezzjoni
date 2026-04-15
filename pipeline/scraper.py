"""
Elezzjoni.mt — Enrichment Pipeline

Reads candidates already in the Supabase database, then for each one:
  1. Fetches biography text + thumbnail from Wikipedia (public API, no scraping)
  2. Enriches with Gemini LLM → personal_stances + key_quotes
  3. Updates photo_url from Wikipedia if the candidate has none
  4. Writes back to Supabase

Usage:
  cd pipeline
  # Copy env vars from your .env.local, or export them manually:
  #   export SUPABASE_URL=...
  #   export SUPABASE_SERVICE_ROLE_KEY=...
  #   export GEMINI_API_KEY=...
  python scraper.py

Flags (edit at the top of this file):
  ENRICH_ALL   = True  → re-enrich even candidates that already have stances
  PHOTOS_ONLY  = True  → skip LLM, only fill in missing photos
"""

import asyncio
import json
import os
import re

import httpx
from dotenv import load_dotenv
from supabase import create_client, Client
import google.generativeai as genai

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL             = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
GEMINI_API_KEY           = os.environ["GEMINI_API_KEY"]

GEMINI_MODEL = "gemini-1.5-flash"   # or "gemini-2.0-flash" if available on your key
WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"

ENRICH_ALL  = False   # Set True to re-enrich candidates that already have stances
PHOTOS_ONLY = False   # Set True to only update missing photos, skip LLM

# Known name differences between our DB and Wikipedia article titles
WIKIPEDIA_OVERRIDES: dict[str, str] = {
    "Ivan J Bartolo":           "Ivan J. Bartolo",
    "Jo Etienne Abela":         "Joe Abela (politician)",
    "Silvio Schembri":          "Silvio Schembri",
    "Glenn Bedingfield":        "Glenn Bedingfield",
    "Byron Camilleri":          "Byron Camilleri",
    "Edward Zammit Lewis":      "Edward Zammit Lewis",
    "Miriam Dalli":             "Miriam Dalli",
    "Chris Fearne":             "Chris Fearne",
    "Robert Abela":             "Robert Abela (politician)",
    "Bernard Grech":            "Bernard Grech",
    "Adrian Delia":             "Adrian Delia",
    "Simon Busuttil":           "Simon Busuttil",
    "Lawrence Gonzi":           "Lawrence Gonzi",
    "Jason Azzopardi":          "Jason Azzopardi",
    "Roberta Metsola":          "Roberta Metsola",
    "Ian Borg":                 "Ian Borg",
    "Stefan Zrinzo Azzopardi":  "Stefan Zrinzo Azzopardi",
    "Clyde Caruana":            "Clyde Caruana",
    "Owen Bonnici":             "Owen Bonnici",
    "Evarist Bartolo":          "Evarist Bartolo",
    "George Vella":             "George Vella",
    "Marie Louise Coleiro Preca": "Marie Louise Coleiro Preca",
    "Carmelo Abela":            "Carmelo Abela",
    "Joe Mizzi":                "Joe Mizzi (politician)",
    "Konrad Mizzi":             "Konrad Mizzi",
    "Franco Mercieca":          "Franco Mercieca",
    "Justyne Caruana":          "Justyne Caruana",
    "Rosianne Cutajar":         "Rosianne Cutajar",
}

# ── Wikipedia ─────────────────────────────────────────────────────────────────

async def fetch_wikipedia(
    client: httpx.AsyncClient,
    name: str,
) -> tuple[str | None, str | None]:
    """
    Returns (extract_text, thumbnail_url) for the given name.
    Both can be None if the page doesn't exist or has no image.
    """
    title = WIKIPEDIA_OVERRIDES.get(name, name)

    try:
        resp = await client.get(
            WIKIPEDIA_API,
            params={
                "action":      "query",
                "titles":      title,
                "prop":        "extracts|pageimages",
                "exintro":     True,
                "explaintext": True,
                "pithumbsize": 400,
                "format":      "json",
                "redirects":   1,
            },
            timeout=15,
        )
        pages = resp.json().get("query", {}).get("pages", {})
        for page in pages.values():
            if page.get("pageid", -1) == -1:
                return None, None   # "missing" page
            extract = page.get("extract") or None
            thumb   = page.get("thumbnail", {}).get("source") or None
            return extract, thumb
    except Exception as e:
        print(f"    ⚠ Wikipedia error for '{name}': {e}")
    return None, None


# ── LLM enrichment ────────────────────────────────────────────────────────────

def build_prompt(name: str, bio: str) -> str:
    return f"""You are a neutral political analyst writing for a civic information portal.
Analyse the following Wikipedia biography of {name} and extract:

1. Up to 4 concise policy stances (max 25 words each) — focus on concrete positions,
   not career facts.  Write in third person.
2. Up to 3 direct quotes attributed to {name} from public record.

Return ONLY valid JSON — no markdown, no extra text:
{{
  "personal_stances": ["stance 1", "stance 2"],
  "key_quotes": ["quote 1", "quote 2"]
}}

If there is insufficient information return empty arrays. Do NOT fabricate.

Biography:
\"\"\"{bio[:5000]}\"\"\"
"""


async def enrich_with_llm(
    name: str,
    bio: str,
    model: genai.GenerativeModel,
) -> tuple[list[str], list[str]]:
    try:
        prompt   = build_prompt(name, bio)
        response = await asyncio.to_thread(model.generate_content, prompt)
        text     = response.text.strip()
        text     = re.sub(r"^```(?:json)?\s*", "", text)
        text     = re.sub(r"\s*```$", "",        text)
        data     = json.loads(text)
        stances  = data.get("personal_stances", [])[:4]
        quotes   = data.get("key_quotes", [])[:3]
        return stances, quotes
    except Exception as e:
        print(f"    ⚠ LLM error for '{name}': {e}")
        return [], []


# ── Main ──────────────────────────────────────────────────────────────────────

async def main() -> None:
    print("=== Elezzjoni.mt Enrichment Pipeline ===\n")

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(GEMINI_MODEL)

    # Fetch candidates to process
    query = supabase.table("candidates").select("id, full_name, photo_url, personal_stances")
    if not ENRICH_ALL:
        # Only process candidates missing stances (or photos if PHOTOS_ONLY)
        if PHOTOS_ONLY:
            query = query.is_("photo_url", "null")
        else:
            query = query.is_("personal_stances", "null")

    response   = query.execute()
    candidates = response.data

    if not candidates:
        print("Nothing to process — all candidates already enriched.")
        print("Set ENRICH_ALL = True at the top of scraper.py to re-run on everyone.")
        return

    print(f"Processing {len(candidates)} candidates…\n")

    updated_photos   = 0
    updated_stances  = 0
    not_found        = []

    sem = asyncio.Semaphore(4)   # limit concurrent Wikipedia + LLM calls

    async def process(c: dict) -> None:
        nonlocal updated_photos, updated_stances
        async with sem:
            name = c["full_name"]
            print(f"  {name}")

            async with httpx.AsyncClient() as http:
                bio, thumb = await fetch_wikipedia(http, name)

            update: dict = {}

            # Photo
            if thumb and not c.get("photo_url"):
                update["photo_url"] = thumb
                updated_photos += 1
                print(f"    📷  photo found")
            elif not thumb:
                print(f"    –   no Wikipedia photo")

            # LLM enrichment
            if not PHOTOS_ONLY and bio and len(bio.strip()) > 100:
                stances, quotes = await enrich_with_llm(name, bio, model)
                if stances:
                    update["personal_stances"] = stances
                    update["key_quotes"]        = quotes
                    updated_stances += 1
                    print(f"    ✓   {len(stances)} stances, {len(quotes)} quotes")
                else:
                    print(f"    –   LLM returned no stances")
            elif not PHOTOS_ONLY and not bio:
                not_found.append(name)
                print(f"    –   not found on Wikipedia")

            if update:
                update["last_updated"] = "now()"
                supabase.table("candidates").update(update).eq("id", c["id"]).execute()

    await asyncio.gather(*[process(c) for c in candidates])

    print(f"\n{'─'*40}")
    print(f"Photos updated : {updated_photos}")
    if not PHOTOS_ONLY:
        print(f"Stances updated: {updated_stances}")
    print(f"Not on Wikipedia ({len(not_found)}): {', '.join(not_found) or 'none'}")
    print("=== Done ===")


if __name__ == "__main__":
    asyncio.run(main())
