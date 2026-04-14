"""
fetch_photos.py — Fetch MP photos from parlament.mt, fall back to Wikipedia.

Usage:
  cd pipeline
  python fetch_photos.py
"""

import asyncio
import os
import re
import httpx
from dotenv import load_dotenv
from playwright.async_api import async_playwright
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

PARLIAMENT_URL = "https://parlament.mt/en/mps/current-mps/"
WIKIPEDIA_API  = "https://en.wikipedia.org/w/api.php"

WIKIPEDIA_OVERRIDES: dict[str, str] = {
    "Ivan J Bartolo":           "Ivan J. Bartolo",
    "Jo Etienne Abela":         "Jo Etienne Abela",
    "Malcolm Paul Agius Galea": "Malcolm Paul Agius Galea",
}


# ── Parliament scraper ─────────────────────────────────────────────────────────

async def scrape_parliament_photos() -> dict[str, str]:
    """
    Returns {normalised_name: photo_url} for all MPs listed on parlament.mt.
    """
    photos: dict[str, str] = {}

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            locale="en-MT",
            viewport={"width": 1280, "height": 800},
        )
        page = await context.new_page()

        print("Loading parlament.mt MP list…")
        await page.goto(PARLIAMENT_URL, wait_until="networkidle", timeout=30000)

        # Dump HTML for debugging if needed
        html = await page.content()
        with open("debug_parliament.html", "w", encoding="utf-8") as f:
            f.write(html)

        # Try common selectors for MP cards on parliament sites
        # Adjust if the actual HTML differs — check debug_parliament.html
        cards = await page.query_selector_all(".mp-card, .member-card, .mp-item, article.mp")

        if not cards:
            # Fallback: look for any card with both a name and an image
            cards = await page.query_selector_all("[class*='mp'], [class*='member']")

        print(f"  Found {len(cards)} MP card elements.")

        for card in cards:
            try:
                # Try to get name
                name_el = await card.query_selector(".mp-name, .member-name, h3, h4, .name")
                if not name_el:
                    continue
                name = (await name_el.inner_text()).strip()
                name = re.sub(r"\s+", " ", name)

                # Try to get photo
                img_el = await card.query_selector("img")
                if not img_el:
                    continue
                src = await img_el.get_attribute("src") or ""
                if not src:
                    src = await img_el.get_attribute("data-src") or ""
                if src and not src.startswith("http"):
                    src = "https://parlament.mt" + src

                if name and src:
                    photos[name.lower()] = src
            except Exception:
                continue

        await browser.close()

    print(f"  Scraped {len(photos)} photos from parlament.mt.")
    return photos


# ── Wikipedia fallback ─────────────────────────────────────────────────────────

async def get_wikipedia_photo(client: httpx.AsyncClient, name: str) -> str | None:
    title = WIKIPEDIA_OVERRIDES.get(name, name)
    try:
        resp = await client.get(WIKIPEDIA_API, params={
            "action": "query",
            "titles": title,
            "prop": "pageimages",
            "pithumbsize": 400,
            "format": "json",
            "redirects": 1,
        }, timeout=10)
        pages = resp.json().get("query", {}).get("pages", {})
        for page in pages.values():
            thumb = page.get("thumbnail", {}).get("source")
            if thumb:
                return thumb
    except Exception as e:
        print(f"    ⚠ Wikipedia error for {name}: {e}")
    return None


# ── Name matching ──────────────────────────────────────────────────────────────

def best_match(name: str, parliament_photos: dict[str, str]) -> str | None:
    """
    Fuzzy-ish name match: exact → last-name → first+last token overlap.
    """
    key = name.lower()

    # 1. Exact match
    if key in parliament_photos:
        return parliament_photos[key]

    # 2. All tokens present anywhere
    tokens = key.split()
    for pname, url in parliament_photos.items():
        if all(t in pname for t in tokens):
            return url

    # 3. Last name match (common enough to be useful)
    last = tokens[-1]
    matches = [(pname, url) for pname, url in parliament_photos.items() if last in pname.split()]
    if len(matches) == 1:
        return matches[0][1]

    return None


# ── Main ───────────────────────────────────────────────────────────────────────

async def main() -> None:
    print("=== Fetching candidate photos ===")

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    response = supabase.table("candidates").select("id, full_name").is_("photo_url", "null").execute()
    candidates = response.data

    if not candidates:
        print("All candidates already have photos.")
        return

    print(f"Found {len(candidates)} candidates without photos.\n")

    # Step 1: scrape parlament.mt
    parliament_photos = await scrape_parliament_photos()

    # Step 2: for each candidate, try parliament then Wikipedia
    updated = 0

    async with httpx.AsyncClient() as http:
        sem = asyncio.Semaphore(5)

        async def process(c: dict) -> None:
            nonlocal updated
            async with sem:
                name = c["full_name"]
                photo_url = best_match(name, parliament_photos)
                source = "parlament.mt"

                if not photo_url:
                    photo_url = await get_wikipedia_photo(http, name)
                    source = "Wikipedia"

                if photo_url:
                    supabase.table("candidates").update({"photo_url": photo_url}).eq("id", c["id"]).execute()
                    print(f"  ✓ {name} ({source})")
                    updated += 1
                else:
                    print(f"  – Not found: {name}")

        await asyncio.gather(*[process(c) for c in candidates])

    print(f"\nDone. Updated {updated}/{len(candidates)} candidates.")
    if updated < len(candidates):
        print("Tip: check debug_parliament.html to verify selectors match the live site.")


if __name__ == "__main__":
    asyncio.run(main())
