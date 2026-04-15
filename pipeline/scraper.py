"""
Elezzjoni.mt — Candidate Enrichment Pipeline
=============================================

Pulls content directly from each candidate's own online presence:
  1. DISCOVER  — searches DuckDuckGo to find their Facebook page + website
                 and saves URLs back to the social_links column in Supabase
  2. SCRAPE    — loads their Facebook page (recent posts) and/or personal site
  3. ENRICH    — runs Gemini on their own text to extract stances + quotes
  4. SAVE      — upserts personal_stances, key_quotes, photo_url to Supabase

Run:
  cd pipeline
  cp ../.env.local .env     # copies SUPABASE_URL, SERVICE_ROLE_KEY, GEMINI_API_KEY
  pip install -r requirements.txt
  playwright install chromium
  python scraper.py

Flags (edit below):
  SKIP_DISCOVERY  = True   skip the search step (use social_links already in DB)
  ENRICH_ALL      = True   re-process candidates that already have stances
  DRY_RUN         = True   print what would be written, don't touch Supabase
"""

import asyncio
import json
import os
import re
import time

import httpx
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from playwright.async_api import async_playwright, Browser
from supabase import create_client, Client
from groq import Groq

load_dotenv(dotenv_path=".env")

# ── Config ────────────────────────────────────────────────────────────────────

# Accept both NEXT_PUBLIC_SUPABASE_URL (Next.js .env.local) and plain SUPABASE_URL
SUPABASE_URL              = os.environ.get("SUPABASE_URL") or os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
GROQ_API_KEY              = os.environ["GROQ_API_KEY"]

GROQ_MODEL     = "llama-3.3-70b-versatile"
DDG_SEARCH_URL = "https://html.duckduckgo.com/html/"

SKIP_DISCOVERY  = False   # True = use social_links already stored in DB
ENRICH_ALL      = os.environ.get("ENRICH_ALL_OVERRIDE", "").lower() == "true"
DRY_RUN         = os.environ.get("DRY_RUN_OVERRIDE",    "").lower() == "true"

# ── Playwright browser user-agent ─────────────────────────────────────────────

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


# ── Stage 1: Discover social links ───────────────────────────────────────────
#
# Search engines (DDG, Bing, Google) all block automated requests.
# Strategy:
#   1. Check FACEBOOK_OVERRIDES dict below — manually curated for known politicians.
#   2. Query Wikidata for Facebook username (P2013) and official website (P856).
#   3. Any remaining gaps: add to FACEBOOK_OVERRIDES and rerun.
#
# To add a candidate, find their Facebook page URL and add it here:
WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"

# Known differences between DB names and Wikipedia article titles
WIKIPEDIA_OVERRIDES: dict[str, str] = {
    "Ivan J Bartolo":             "Ivan J. Bartolo",
    "Jo Etienne Abela":           "Joe Abela (politician)",
    "Robert Abela":               "Robert Abela (politician)",
    "Joe Mizzi":                  "Joe Mizzi (politician)",
    "Marie Louise Coleiro Preca": "Marie Louise Coleiro Preca",
}


async def fetch_wikipedia_bio(name: str, client: httpx.AsyncClient) -> tuple[str | None, str | None]:
    """Returns (extract_text, thumbnail_url) from Wikipedia. Both can be None."""
    title = WIKIPEDIA_OVERRIDES.get(name, name)
    candidates = [title]
    parts = name.split()
    if len(parts) > 2:
        candidates.append(f"{parts[0]} {parts[-1]}")
    seen: set[str] = set()
    for t in candidates:
        if t in seen:
            continue
        seen.add(t)
        try:
            resp = await client.get(
                WIKIPEDIA_API,
                params={
                    "action": "query", "titles": t,
                    "prop": "extracts|pageimages",
                    "exintro": True, "explaintext": True,
                    "pithumbsize": 400, "format": "json", "redirects": 1,
                },
                timeout=15,
            )
            pages = resp.json().get("query", {}).get("pages", {})
            for page in pages.values():
                if page.get("pageid", -1) == -1:
                    continue
                extract = page.get("extract") or None
                thumb   = page.get("thumbnail", {}).get("source") or None
                if extract:
                    return extract, thumb
        except Exception as e:
            print(f"    ⚠ Wikipedia error for '{name}': {e}")
    return None, None


FACEBOOK_OVERRIDES: dict[str, str] = {
    "Robert Abela":              "https://www.facebook.com/robertabela.mt",
    "Bernard Grech":             "https://www.facebook.com/bernardgrechmt",
    "Chris Fearne":              "https://www.facebook.com/chrisfearne.mt",
    "Ian Borg":                  "https://www.facebook.com/IanBorgMalta",
    "Clyde Caruana":             "https://www.facebook.com/ClydeCaruanaOfficial",
    "Silvio Schembri":           "https://www.facebook.com/SilvioSchembri",
    "Owen Bonnici":              "https://www.facebook.com/owenbonnici",
    "Clayton Bartolo":           "https://www.facebook.com/claytonbartolomalta",
    "Julia Farrugia Portelli":   "https://www.facebook.com/JuliaFarrugiaPortelli",
    "Jo Etienne Abela":          "https://www.facebook.com/JoEtienneAbela",
    "Stefan Zrinzo Azzopardi":   "https://www.facebook.com/StefanZrinzoAzzopardi",
    "Clint Camilleri":           "https://www.facebook.com/ClintCamilleriMalta",
    "Miriam Dalli":              "https://www.facebook.com/miriamdalliofficial",
    "Edward Zammit Lewis":       "https://www.facebook.com/EdwardZammitLewis",
    "Rosianne Cutajar":          "https://www.facebook.com/RosianneOfficial",
    "Alex Muscat":               "https://www.facebook.com/alexmuscatmp",
    "Randolph De Battista":      "https://www.facebook.com/randolphdebattista",
    "Michael Farrugia":          "https://www.facebook.com/MichaelFarrugiaMP",
    "Anton Refalo":              "https://www.facebook.com/antonrefalo",
    "Roderick Galdes":           "https://www.facebook.com/roderickgaldes",
    "Clifton Grima":             "https://www.facebook.com/CliftonGrima",
    "Rebecca Buttigieg":         "https://www.facebook.com/RebeccaButtigiegMP",
    "Omar Farrugia":             "https://www.facebook.com/OmarFarrugiaMalta",
    "Malcolm Paul Agius Galea":  "https://www.facebook.com/malcolmpaulagiusgalea",
    "Romilda Baldacchino Zarb":  "https://www.facebook.com/romildabaldacchinozarb",
    "Michael Falzon":            "https://www.facebook.com/michaelfalzonmp",
    "Deo Debattista":            "https://www.facebook.com/deodebattista",
    "Toni Bezzina":              "https://www.facebook.com/tonibezzina.mp",
    "Ian Vassallo Hagi":         "https://www.facebook.com/IanVassalloHagi",
    "Naomi Cachia":              "https://www.facebook.com/naomicachiaPN",
    "Davina Sammut Hili":        "https://www.facebook.com/DavinaSammutHili",
    "Amanda Spiteri Grech":      "https://www.facebook.com/amandaspiteri.grech",
    "Abigail Camilleri":         "https://www.facebook.com/AbigailCamilleriMalta",
    "Cressida Galea":            "https://www.facebook.com/CressidaGalea",
    "Alicia Bugeja Said":        "https://www.facebook.com/AliciaBugejaSaid",
    "Clayton Camilleri":         "https://www.facebook.com/claytonpcamilleri",
    "Claudette Buttigieg":       "https://www.facebook.com/ClaudetteButtigieg",
    "David Casa":                "https://www.facebook.com/DavidCasaMEP",
    "Francis Zammit Dimech":     "https://www.facebook.com/FrancisZammitDimech",
    "Hermann Schiavone":         "https://www.facebook.com/HermannSchiavone",
    "Ivan Bartolo":              "https://www.facebook.com/IvanBartoloPn",
    "Joe Ellis":                 "https://www.facebook.com/JoeEllisMalta",
    "Karl Gouder":               "https://www.facebook.com/KarlGouderPN",
    "Mark Anthony Sammut":       "https://www.facebook.com/MarkAnthonySammut",
    "Peter Agius":               "https://www.facebook.com/PeterAgiusPN",
    "Ryan Callus":               "https://www.facebook.com/RyanCallusPN",
}

WIKIDATA_HEADERS = {"User-Agent": "ElezzjoniMT/1.0 (jacxuereb@gmail.com)", "Accept": "application/json"}


async def wikidata_lookup(name: str, client: httpx.AsyncClient) -> tuple[str | None, str | None, str | None]:
    """
    Returns (facebook_url, website_url, photo_url) from Wikidata.
    Uses P2013 (Facebook username), P856 (official website), P18 (image).
    """
    try:
        # Search for the entity
        resp = await client.get(
            "https://www.wikidata.org/w/api.php",
            params={"action": "wbsearchentities", "search": name, "language": "en",
                    "format": "json", "limit": 3},
            headers=WIKIDATA_HEADERS, timeout=10,
        )
        results = resp.json().get("search", [])
        # Pick the first result that mentions "Malta" or "politician"
        qid = None
        for r in results:
            desc = r.get("description", "").lower()
            if any(w in desc for w in ["malta", "maltese", "politician", "minister", "mep"]):
                qid = r["id"]
                break
        if not qid:
            return None, None, None

        # Get claims
        resp2 = await client.get(
            "https://www.wikidata.org/w/api.php",
            params={"action": "wbgetentities", "ids": qid, "props": "claims", "format": "json"},
            headers=WIKIDATA_HEADERS, timeout=10,
        )
        claims = resp2.json()["entities"][qid].get("claims", {})

        fb_slug  = claims.get("P2013", [{}])[0].get("mainsnak", {}).get("datavalue", {}).get("value")
        fb_url   = f"https://www.facebook.com/{fb_slug}" if fb_slug else None
        web_url  = claims.get("P856", [{}])[0].get("mainsnak", {}).get("datavalue", {}).get("value")
        photo_fn = claims.get("P18", [{}])[0].get("mainsnak", {}).get("datavalue", {}).get("value", {})
        photo_url = None
        if isinstance(photo_fn, str) and photo_fn:
            # Wikimedia Commons thumbnail URL
            from urllib.parse import quote
            encoded = quote(photo_fn.replace(" ", "_"), safe="")
            photo_url = f"https://commons.wikimedia.org/wiki/Special:FilePath/{encoded}?width=400"

        return fb_url, web_url, photo_url

    except Exception as e:
        print(f"    ⚠ Wikidata error for '{name}': {e}")
        return None, None, None


async def discover_links(
    name: str, client: httpx.AsyncClient
) -> tuple[str | None, str | None]:
    """
    Returns (facebook_url, website_url).
    Priority: manual overrides → Wikidata.
    """
    fb_url  = FACEBOOK_OVERRIDES.get(name)
    web_url = None

    if not fb_url:
        wd_fb, wd_web, _ = await wikidata_lookup(name, client)
        fb_url  = fb_url  or wd_fb
        web_url = web_url or wd_web
    else:
        _, wd_web, _ = await wikidata_lookup(name, client)
        web_url = wd_web

    return fb_url, web_url


# ── Stage 2a: Scrape Facebook posts ─────────────────────────────────────────

async def scrape_facebook(url: str, browser: Browser) -> str:
    """
    Loads a public Facebook page and extracts post text.
    Uses the mobile site (m.facebook.com) which is simpler to parse.
    Returns combined post text, or empty string on failure.
    """
    # Convert to mobile URL
    mobile_url = re.sub(r"https?://(www\.)?facebook\.com", "https://m.facebook.com", url)

    try:
        ctx  = await browser.new_context(
            user_agent=UA,
            locale="en-MT",
            viewport={"width": 390, "height": 844},   # iPhone-ish
        )
        page = await ctx.new_page()

        await page.goto(mobile_url, wait_until="domcontentloaded", timeout=20_000)
        await page.wait_for_timeout(3000)

        html = await page.content()
        await ctx.close()

        soup = BeautifulSoup(html, "html.parser")

        # Remove nav / script / style noise
        for tag in soup(["script", "style", "nav", "header", "footer"]):
            tag.decompose()

        # Extract post/story text — mobile FB wraps posts in <div> with data-ft or article tags
        texts: list[str] = []

        # Try 1: article elements (mobile FB)
        for article in soup.find_all("article"):
            t = article.get_text(" ", strip=True)
            if len(t) > 40:
                texts.append(t)

        # Try 2: paragraphs inside the page body that look like posts
        if not texts:
            for p in soup.find_all(["p", "div"]):
                t = p.get_text(" ", strip=True)
                if 80 < len(t) < 2000 and len(t.split()) > 12:
                    texts.append(t)

        combined = "\n\n".join(dict.fromkeys(texts))   # deduplicate

        # Detect Facebook login wall — discard and return empty so website fallback is used
        login_signals = [
            "log in to facebook", "create new account", "forgotten password",
            "sign up for facebook", "facebook login", "you must log in",
            "log into facebook",
        ]
        if any(sig in combined.lower() for sig in login_signals):
            return ""

        return combined[:8000]

    except Exception as e:
        print(f"    ⚠ Facebook scrape error ({url}): {e}")
        return ""


# ── Stage 2b: Scrape personal website ───────────────────────────────────────

async def scrape_website(url: str, client: httpx.AsyncClient) -> str:
    """
    Fetches a personal/campaign website and extracts readable text.
    """
    try:
        resp = await client.get(url, timeout=15, follow_redirects=True)
        soup = BeautifulSoup(resp.text, "html.parser")

        for tag in soup(["script", "style", "nav", "header", "footer", "aside"]):
            tag.decompose()

        # Prefer main content areas
        main = (
            soup.find("main") or
            soup.find("article") or
            soup.find(id=re.compile(r"content|main|body", re.I)) or
            soup.find(class_=re.compile(r"content|main|about|bio", re.I)) or
            soup.body
        )

        if main:
            text = main.get_text(" ", strip=True)
            # Collapse whitespace
            text = re.sub(r"\s{2,}", " ", text)
            return text[:6000]

    except Exception as e:
        print(f"    ⚠ Website scrape error ({url}): {e}")
    return ""


# ── Stage 3: LLM enrichment ──────────────────────────────────────────────────

def build_prompt(name: str, source_label: str, text: str) -> str:
    return f"""You are a neutral political analyst for a civic information portal.

The following text comes directly from {name}'s own {source_label} — their own words.

Extract:
1. Up to 4 concise policy stances (max 25 words each). Focus on concrete positions on
   issues like environment, economy, health, housing, transport etc.  Write in third person.
   Only include stances clearly expressed in the text — do NOT infer or assume.
2. Up to 3 direct quotes from {name} that reveal their positions.

Return ONLY valid JSON — no markdown fences, no extra text:
{{
  "personal_stances": ["stance 1", "stance 2"],
  "key_quotes": ["quote 1", "quote 2"]
}}

If the text contains no policy content, return empty arrays.
Do NOT fabricate anything not present in the text.

Text:
\"\"\"{text}\"\"\"
"""


def _parse_retry_delay(err: str) -> tuple[float, bool]:
    """
    Parses the 'Please try again in Xm Ys' string from a Groq 429 error.
    Returns (delay_seconds, is_daily_limit).
    Daily token limits reset tomorrow — no point retrying in the same run.
    """
    is_daily = "per day" in err.lower() or "tokens per day" in err.lower() or "tpd" in err.lower()

    # "try again in 3m29.952s" or "try again in 45.3s" or "try again in 2h3m"
    total = 0.0
    for unit, multiplier in (("h", 3600), ("m", 60), ("s", 1)):
        m = re.search(rf"(\d+(?:\.\d+)?)\s*{unit}", err, re.I)
        if m:
            total += float(m.group(1)) * multiplier

    return (total if total > 0 else 30.0), is_daily


async def enrich(
    name: str,
    text: str,
    source_label: str,
    client: Groq,
    _retries: int = 3,
) -> tuple[list[str], list[str]]:
    if not text or len(text.strip()) < 80:
        return [], []

    prompt = build_prompt(name, source_label, text[:6000])

    for attempt in range(_retries):
        try:
            response = await asyncio.to_thread(
                client.chat.completions.create,
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
            )
            raw  = response.choices[0].message.content.strip()
            raw  = re.sub(r"^```(?:json)?\s*", "", raw)
            raw  = re.sub(r"\s*```$",           "", raw)
            data = json.loads(raw)
            return data.get("personal_stances", [])[:4], data.get("key_quotes", [])[:3]

        except Exception as e:
            err = str(e)
            if "429" in err or "rate_limit" in err.lower():
                delay, is_daily = _parse_retry_delay(err)
                if is_daily:
                    print(f"    ✋ daily token limit exhausted — skipping remaining LLM calls")
                    raise _DailyLimitError()
                if attempt < _retries - 1:
                    print(f"    ⏳ rate limited — waiting {delay:.0f}s then retrying ({attempt+1}/{_retries})…")
                    await asyncio.sleep(delay + 2)
                    continue
            print(f"    ⚠ LLM error for '{name}': {e}")
            return [], []

    return [], []


class _DailyLimitError(Exception):
    """Raised when Groq's daily token quota is exhausted — abort all further LLM calls."""


# ── Stage 4: Photo fallback via Wikipedia ────────────────────────────────────

async def fetch_wikipedia_photo(name: str, client: httpx.AsyncClient) -> str | None:
    """Last-resort: grab thumbnail from Wikipedia if no Facebook photo available."""
    # Try several title variants: full name, name without middle names, etc.
    parts = name.split()
    candidates = [
        name,
        f"{parts[0]} {parts[-1]}" if len(parts) > 2 else name,
        f"{parts[0]} {parts[-1]} (politician)" if len(parts) >= 2 else name,
    ]
    seen: set[str] = set()
    for title in candidates:
        if title in seen:
            continue
        seen.add(title)
        try:
            resp = await client.get(
                "https://en.wikipedia.org/w/api.php",
                params={
                    "action": "query", "titles": title,
                    "prop": "pageimages", "pithumbsize": 400,
                    "format": "json", "redirects": 1,
                },
                timeout=10,
            )
            pages = resp.json().get("query", {}).get("pages", {})
            for page in pages.values():
                if page.get("pageid", -1) != -1:
                    src = page.get("thumbnail", {}).get("source")
                    if src:
                        return src
        except Exception:
            pass
    return None


# ── Facebook profile photo ────────────────────────────────────────────────────

async def fetch_facebook_photo(fb_url: str, client: httpx.AsyncClient) -> str | None:
    """
    Gets the profile picture for a public Facebook page using the Graph API
    picture endpoint — no login, no Playwright, no scraping.

    e.g. https://www.facebook.com/robertabela.mt
      →  https://graph.facebook.com/robertabela.mt/picture?type=large&redirect=false
    """
    # Extract the page slug from the URL
    m = re.search(r"facebook\.com/(?:pages/[^/]+/)?([^/?#]+)", fb_url)
    if not m:
        return None
    slug = m.group(1).rstrip("/")

    # Try descending sizes: large (200px), normal (100px)
    for size in ("large", "normal"):
        try:
            resp = await client.get(
                f"https://graph.facebook.com/{slug}/picture",
                params={"type": size, "redirect": "false"},
                timeout=10,
            )
            data = resp.json().get("data", {})
            if not data.get("is_silhouette", True):
                url = data.get("url")
                if url and url.startswith("http"):
                    return url
        except Exception:
            pass

    return None


# ── Main ─────────────────────────────────────────────────────────────────────

async def main() -> None:
    print("=== Elezzjoni.mt Candidate Enrichment Pipeline ===\n")
    print(f"  SKIP_DISCOVERY = {SKIP_DISCOVERY}")
    print(f"  ENRICH_ALL     = {ENRICH_ALL}")
    print(f"  DRY_RUN        = {DRY_RUN}\n")

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    groq_client = Groq(api_key=GROQ_API_KEY)
    daily_limit_hit = False   # set True on first TPD exhaustion; skips LLM for remaining candidates

    # Fetch candidates
    q = supabase.table("candidates").select("id, full_name, photo_url, social_links, personal_stances")
    if not ENRICH_ALL:
        q = q.is_("personal_stances", "null")
    rows = q.execute().data

    if not rows:
        print("Nothing to process. Set ENRICH_ALL = True to reprocess everyone.")
        return

    print(f"Processing {len(rows)} candidates…\n")

    sem = asyncio.Semaphore(1)   # sequential — avoids Gemini free-tier rate limits

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)

        async def process(c: dict) -> None:
            nonlocal daily_limit_hit
            async with sem:
                name         = c["full_name"]
                social_links: dict = c.get("social_links") or {}
                fb_url       = social_links.get("facebook")
                web_url      = social_links.get("website")

                print(f"── {name}")

                async with httpx.AsyncClient(headers={"User-Agent": UA}) as http:

                    # Stage 1: Discover links if needed
                    if not SKIP_DISCOVERY and not fb_url:
                        print(f"   🔍 searching for social links…")
                        fb_url, web_url = await discover_links(name, http)
                        if fb_url:
                            print(f"   📘 Facebook: {fb_url}")
                        if web_url:
                            print(f"   🌐 Website:  {web_url}")

                        if (fb_url or web_url) and not DRY_RUN:
                            updated_links = {**social_links}
                            if fb_url:
                                updated_links["facebook"] = fb_url
                            if web_url:
                                updated_links["website"] = web_url
                            supabase.table("candidates").update(
                                {"social_links": updated_links}
                            ).eq("id", c["id"]).execute()

                    # Stage 2: Scrape content
                    all_text    = ""
                    source_used = ""

                    if fb_url:
                        print(f"   📄 scraping Facebook posts…")
                        fb_text = await scrape_facebook(fb_url, browser)
                        if fb_text:
                            all_text    = fb_text
                            source_used = "Facebook page and posts"
                            print(f"   ✓  {len(fb_text.split())} words from Facebook")

                    if web_url and len(all_text) < 500:
                        print(f"   📄 scraping website…")
                        web_text = await scrape_website(web_url, http)
                        if web_text:
                            all_text    = (all_text + "\n\n" + web_text).strip()
                            source_used = source_used or "personal website"
                            print(f"   ✓  {len(web_text.split())} words from website")

                    # Stage 2c: Wikipedia biography fallback
                    if len(all_text) < 300:
                        print(f"   📖 falling back to Wikipedia biography…")
                        wiki_text, wiki_photo = await fetch_wikipedia_bio(name, http)
                        if wiki_text:
                            all_text    = (all_text + "\n\n" + wiki_text).strip()
                            source_used = source_used or "Wikipedia biography"
                            print(f"   ✓  {len(wiki_text.split())} words from Wikipedia")
                        else:
                            print(f"   –  not found on Wikipedia")
                        # Use Wikipedia photo as last resort (stored separately below)
                        if wiki_photo and not c.get("photo_url"):
                            # Keep as candidate for photo fallback
                            _wiki_photo = wiki_photo
                        else:
                            _wiki_photo = None
                    else:
                        _wiki_photo = None

                    # Stage 2b: Photo
                    photo_url = c.get("photo_url")
                    if not photo_url:
                        if fb_url:
                            photo_url = await fetch_facebook_photo(fb_url, http)
                        if not photo_url:
                            # Try Wikidata (Commons) first — higher resolution
                            _, _, wd_photo = await wikidata_lookup(name, http)
                            photo_url = wd_photo
                        if not photo_url:
                            photo_url = _wiki_photo or await fetch_wikipedia_photo(name, http)
                        if photo_url:
                            print(f"   📷 photo found")

                    # Stage 3: LLM enrichment
                    stances, quotes = [], []
                    if daily_limit_hit:
                        print(f"   –  skipping LLM (daily token limit already exhausted)")
                    elif all_text:
                        print(f"   🤖 enriching with LLM…")
                        try:
                            stances, quotes = await enrich(name, all_text, source_used, groq_client)
                        except _DailyLimitError:
                            daily_limit_hit = True
                        if stances:
                            print(f"   ✓  {len(stances)} stances · {len(quotes)} quotes")
                        elif not daily_limit_hit:
                            print(f"   –  no policy content found in scraped text")
                    else:
                        print(f"   –  no content scraped (no links found or pages blocked)")

                    # Stage 4: Save
                    update: dict = {}
                    if stances:
                        update["personal_stances"] = stances
                        update["key_quotes"]        = quotes
                    if photo_url and not c.get("photo_url"):
                        update["photo_url"] = photo_url
                    if update:
                        update["last_updated"] = "now()"
                        if not DRY_RUN:
                            supabase.table("candidates").update(update).eq("id", c["id"]).execute()
                        else:
                            print(f"   [DRY RUN] would write: {list(update.keys())}")

                print()

        await asyncio.gather(*[process(c) for c in rows])
        await browser.close()

    print("=== Done ===")


if __name__ == "__main__":
    asyncio.run(main())
