"""
Kandidati.mt — Comprehensive Candidate Enrichment Pipeline
===========================================================

Phase 1: Business Interests & Disclosures (Foundation)
  1. IDENTITY   — check parliament roster, scrape business registry, asset disclosures, court records
  2. SAVE       — populate candidates table + candidate_business_interests, candidate_disclosures, candidate_legal_records tables

Phase 2: Parliamentary Voting Records
  1. FETCH      — downloads plenary session PDFs from parlament.mt
  2. EXTRACT    — searches for voting keywords ("Diviżjoni", "Iva", "Le") in PDF text
  3. PARSE      — uses llama3.1:8b to extract vote type, bill name, and individual votes
  4. SAVE       — stores voting records to parliamentary_votes table per candidate

Phase 3: (skipped)

Phase 4: Party Intelligence (Comprehensive Party Data)
  1. FETCH      — downloads party manifestos, leadership pages, website content
  2. EXTRACT    — manifesto PDFs via pdfplumber, leadership from HTML
  3. ENRICH     — uses llama3.1:8b to extract structured policy positions from manifestos
  4. PARSE      — scrapes party statements, media coverage, governance structure
  5. SAVE       — stores manifestos, policies, leadership, news mentions by party

Phase 5+: (on pause)
  - Media coverage & fact-checking
  - Advanced policy analysis & comparison

Run:
  cd pipeline
  cp ../.env.local .env
  pip install -r requirements.txt
  playwright install chromium
  python scraper.py

Facebook auth (optional — gets past login walls):
  playwright codegen --save-storage=state.json https://www.facebook.com
  Log in manually, then Ctrl+C. Re-run scraper.py — it will pick up state.json.

Env overrides:
  FULL_RESCRAPE_OVERRIDE=true    delete all Phase 1+2 data and start fresh
  INCREMENTAL_ONLY=true          only process candidates without Phase 1 data (since last run)
  ENRICH_ALL_OVERRIDE=true       re-process candidates that already have scores
  DRY_RUN_OVERRIDE=true          print what would be written; don't touch Supabase
  SKIP_DISCOVERY=true            skip link discovery (use social_links already in DB)

Scrape modes:
  Default (no flags):
    Phase 1: Run for all candidates (idempotent — skips existing data)
    Phase 2: Run for all candidates (enrichment only if no party_reliance_score)

  INCREMENTAL_ONLY=true:
    Phase 1: Only new candidates (where last_comprehensive_update is null)
    Phase 2: Only enrichment for candidates without scores

  FULL_RESCRAPE_OVERRIDE=true:
    Phase 1: Delete all Phase 1+2 data first, then re-scrape everything
    Phase 2: Re-scrape everything, fill voting records from scratch
"""

import asyncio
import json
import os
import re
import subprocess
from datetime import datetime, timezone

import httpx
import trafilatura
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from playwright.async_api import async_playwright, Browser
from supabase import create_client, Client

# Phase 1: Business & Disclosures
from scraper_business import (
    scrape_business_registry,
    scrape_government_gazette,
    scrape_court_records,
    check_parliament_roster,
    extract_gazette_details,
)

# Phase 2: Parliamentary Voting Records
from scraper_parliament import (
    scrape_parliamentary_votes,
)

# Phase 4: Party Intelligence
from scraper_parties import (
    scrape_party_intelligence,
)

# LLM router (Groq cloud or Ollama local)
from llm import chat as llm_chat, parse_json as llm_parse_json, USE_GROQ

# Phase 5: Parliamentary Questions & Committee Memberships
from scraper_pqs import (
    scrape_parliamentary_questions,
    scrape_committee_memberships,
    match_committee_memberships,
)

# Phase 6: Electoral History
from scraper_electoral_history import (
    scrape_electoral_history,
)

load_dotenv(dotenv_path=".env")

# ── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL              = os.environ.get("SUPABASE_URL") or os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

OLLAMA_URL   = "http://localhost:11434"
OLLAMA_MODEL = "llama3.1:8b"
WIKIPEDIA_API  = "https://en.wikipedia.org/w/api.php"
DDG_SEARCH_URL = "https://html.duckduckgo.com/html/"

# Minimum words from any single source before we consider it usable
MIN_WORDS = 100

# Maltese news sites targeted in the news search Google dork
MALTESE_NEWS_SITES = [
    "timesofmalta.com",
    "maltatoday.com.mt",
    "independent.com.mt",
    "newsbook.com.mt",
    "lovinmalta.com",
]

SKIP_DISCOVERY      = os.environ.get("SKIP_DISCOVERY",           "").lower() == "true"
ENRICH_ALL          = os.environ.get("ENRICH_ALL_OVERRIDE",      "").lower() == "true"
DRY_RUN             = os.environ.get("DRY_RUN_OVERRIDE",         "").lower() == "true"
FULL_RESCRAPE       = os.environ.get("FULL_RESCRAPE_OVERRIDE",   "").lower() == "true"
INCREMENTAL_ONLY    = os.environ.get("INCREMENTAL_ONLY",         "").lower() == "true"

# Path to Playwright auth state — generated by: playwright codegen --save-storage=state.json
STATE_JSON = os.path.join(os.path.dirname(__file__), "state.json")

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

# ── Text validation ───────────────────────────────────────────────────────────

# Phrases that indicate a login wall or generic boilerplate rather than real content
_BOILERPLATE_SIGNALS = [
    "log in to facebook", "log into facebook", "create new account",
    "forgotten password", "forgot password", "sign up for facebook",
    "facebook login", "you must log in", "allow all cookies",
    "see more on facebook", "connect with friends", "see photos and videos",
    "to see more from", "sign in to continue", "join facebook",
    "cookie policy", "privacy policy", "terms of service",
]


def is_valid_political_text(text: str) -> bool:
    """
    Returns False if the text is dominated by login-wall / cookie-banner
    boilerplate rather than real candidate content.
    Checks both hard phrase matches and a boilerplate-density heuristic.
    """
    if not text or len(text.split()) < 30:
        return False

    lower = text.lower()

    # Hard reject: any login-wall phrase present
    if any(sig in lower for sig in _BOILERPLATE_SIGNALS):
        return False

    return True


SYSTEM_PROMPT = (
    "You are analyzing text about a Maltese parliamentary candidate or sitting MP. "
    "The text may be a social media post, news article, or government announcement. "
    "Your job is to extract what this person stands for and how independently they act. "
    "\n\n"
    "Calculate an 'Independence Score' (party_reliance_score) 0-100: "
    "100 = constantly promotes the party line / leader / manifesto; "
    "0 = consistently promotes their own local/personal vision. "
    "Look for pronouns ('I' vs 'We'), mentions of the party leader, and party manifesto language. "
    "\n\n"
    "For personal_stances: extract any position, priority, or area of work — "
    "including government projects, constituency service, community initiatives, "
    "infrastructure, social causes, or policy areas they emphasise. "
    "Even event attendance or ministerial announcements reveal priorities. "
    "Write each stance in third person, max 25 words. "
    "\n\n"
    "Only return party_reliance_score of -1 if the text is entirely unrelated to the "
    "person's public role (e.g. a recipe, a sports result with no political context). "
    "Any political, governmental, or community-related content should be scored 0-100. "
    "\n\n"
    "Return ONLY a valid JSON object with exactly these keys: "
    "party_reliance_score (integer 0-100, or -1 only if completely non-political), "
    "score_justification (string, 1-2 sentences), "
    "personal_stances (array of up to 4 strings, third person, max 25 words each), "
    "key_quotes (array of up to 3 direct quote strings). No markdown, no extra text."
)


# ── Ollama lifecycle ──────────────────────────────────────────────────────────

async def ensure_ollama_running() -> subprocess.Popen | None:
    """
    Returns None immediately when using Groq (no local process needed).
    Otherwise checks if Ollama is running and starts it if not.
    Returns the Popen object if we started it (so main() can stop it later).
    """
    if USE_GROQ:
        print("  ☁️  using Groq API — skipping Ollama\n")
        return None

    async with httpx.AsyncClient() as c:
        try:
            await c.get(f"{OLLAMA_URL}/api/tags", timeout=2)
            return None   # already running
        except Exception:
            pass

    print("  🦙 starting Ollama…")
    proc = subprocess.Popen(
        ["ollama", "serve"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    # Poll until the server is ready (up to 20s)
    for _ in range(40):
        await asyncio.sleep(0.5)
        try:
            async with httpx.AsyncClient() as c:
                await c.get(f"{OLLAMA_URL}/api/tags", timeout=2)
            print("  ✓  Ollama ready\n")
            return proc
        except Exception:
            continue

    proc.terminate()
    raise RuntimeError("Ollama failed to start within 20 seconds — is it installed? (brew install ollama)")

# ── Known name overrides ──────────────────────────────────────────────────────

# DB name → Wikipedia article title (only needed when they differ)
WIKIPEDIA_OVERRIDES: dict[str, str] = {
    "Ivan J Bartolo":             "Ivan J. Bartolo",
    "Jo Etienne Abela":           "Joe Abela (politician)",
    "Robert Abela":               "Robert Abela (politician)",
    "Joe Mizzi":                  "Joe Mizzi (politician)",
    "Marie Louise Coleiro Preca": "Marie Louise Coleiro Preca",
}

# Manually curated Facebook page URLs — used before Wikidata lookup
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

WIKIDATA_HEADERS = {"User-Agent": "KandidatiMT/1.0 (jacxuereb@gmail.com)", "Accept": "application/json"}


# ── Stage 1: Discover social links ───────────────────────────────────────────

async def wikidata_lookup(name: str, client: httpx.AsyncClient) -> tuple[str | None, str | None, str | None]:
    """
    Returns (facebook_url, website_url, photo_url) from Wikidata.
    Properties: P2013 (Facebook username), P856 (official website), P18 (image).
    """
    try:
        resp = await client.get(
            "https://www.wikidata.org/w/api.php",
            params={"action": "wbsearchentities", "search": name, "language": "en",
                    "format": "json", "limit": 3},
            headers=WIKIDATA_HEADERS, timeout=10,
        )
        results = resp.json().get("search", [])

        # Pick the first result that looks Maltese/political
        qid = None
        for r in results:
            desc = r.get("description", "").lower()
            if any(w in desc for w in ["malta", "maltese", "politician", "minister", "mep"]):
                qid = r["id"]
                break
        if not qid:
            return None, None, None

        resp2 = await client.get(
            "https://www.wikidata.org/w/api.php",
            params={"action": "wbgetentities", "ids": qid, "props": "claims", "format": "json"},
            headers=WIKIDATA_HEADERS, timeout=10,
        )
        claims = resp2.json()["entities"][qid].get("claims", {})

        fb_slug  = claims.get("P2013", [{}])[0].get("mainsnak", {}).get("datavalue", {}).get("value")
        fb_url   = f"https://www.facebook.com/{fb_slug}" if fb_slug else None
        web_url  = claims.get("P856", [{}])[0].get("mainsnak", {}).get("datavalue", {}).get("value")
        photo_fn = claims.get("P18",  [{}])[0].get("mainsnak", {}).get("datavalue", {}).get("value", {})

        photo_url = None
        if isinstance(photo_fn, str) and photo_fn:
            from urllib.parse import quote
            encoded   = quote(photo_fn.replace(" ", "_"), safe="")
            photo_url = f"https://commons.wikimedia.org/wiki/Special:FilePath/{encoded}?width=400"

        return fb_url, web_url, photo_url

    except Exception as e:
        print(f"    ⚠ Wikidata error for '{name}': {e}")
        return None, None, None


async def discover_links(name: str, client: httpx.AsyncClient) -> tuple[str | None, str | None]:
    """
    Returns (facebook_url, website_url).
    Priority: FACEBOOK_OVERRIDES → Wikidata.
    """
    fb_url  = FACEBOOK_OVERRIDES.get(name)
    web_url = None

    # Always check Wikidata for the website URL regardless of FB override
    wd_fb, wd_web, _ = await wikidata_lookup(name, client)
    if not fb_url:
        fb_url = wd_fb
    web_url = wd_web

    return fb_url, web_url


# ── Stage 2a: Scrape Facebook posts ──────────────────────────────────────────

async def scrape_facebook(url: str, browser: Browser) -> str:
    """
    Loads a public Facebook page and returns post text.
    Uses the mobile site which is easier to parse.

    If state.json exists it loads that auth session, bypassing the login wall.
    Falls back to anonymous scraping if the file is missing.
    """
    mobile_url = re.sub(r"https?://(www\.)?facebook\.com", "https://m.facebook.com", url)

    ctx_kwargs: dict = {
        "user_agent": UA,
        "locale":     "en-MT",
        "viewport":   {"width": 390, "height": 844},
    }

    # Load saved auth session if available
    if os.path.exists(STATE_JSON):
        ctx_kwargs["storage_state"] = STATE_JSON
        print(f"   🔑 using saved Facebook session")

    try:
        ctx  = await browser.new_context(**ctx_kwargs)
        page = await ctx.new_page()

        await page.goto(mobile_url, wait_until="domcontentloaded", timeout=20_000)
        await page.wait_for_timeout(3000)

        html = await page.content()
        await ctx.close()

        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "nav", "header", "footer"]):
            tag.decompose()

        texts: list[str] = []

        # Mobile FB wraps posts in <article> elements
        for article in soup.find_all("article"):
            t = article.get_text(" ", strip=True)
            if len(t) > 40:
                texts.append(t)

        # Fallback: grab any substantial paragraph/div text
        if not texts:
            for p in soup.find_all(["p", "div"]):
                t = p.get_text(" ", strip=True)
                if 80 < len(t) < 2000 and len(t.split()) > 12:
                    texts.append(t)

        combined = "\n\n".join(dict.fromkeys(texts))

        if not is_valid_political_text(combined):
            print(f"   ⚠ Facebook login wall / boilerplate — run: playwright codegen --save-storage=state.json https://www.facebook.com")
            return ""

        return combined[:8000]

    except Exception as e:
        print(f"    ⚠ Facebook scrape error ({url}): {e}")
        return ""


def _og_image(html: str) -> str | None:
    """Extracts og:image (or twitter:image) from an HTML page — reliable headshot source."""
    soup = BeautifulSoup(html, "html.parser")
    for attr in ("og:image", "twitter:image"):
        tag = soup.find("meta", property=attr) or soup.find("meta", attrs={"name": attr})
        if tag:
            content = tag.get("content", "").strip()
            if content.startswith("http"):
                return content
    return None


# ── Stage 2b: Scrape personal website ────────────────────────────────────────

async def scrape_website(url: str, client: httpx.AsyncClient) -> tuple[str, str | None]:
    """
    Fetches a personal/campaign website.
    Returns (body_text, og_image_url). Either can be empty/None on failure.
    trafilatura strips navs, footers, cookie banners automatically.
    """
    try:
        resp = await client.get(url, timeout=15, follow_redirects=True)
        text = await asyncio.to_thread(
            trafilatura.extract,
            resp.text,
            include_comments=False,
            include_tables=False,
            no_fallback=False,
        )
        photo = _og_image(resp.text)
        return (text[:6000] if text else ""), photo
    except Exception as e:
        print(f"    ⚠ Website scrape error ({url}): {e}")
    return "", None


# ── Stage 2c: Local news search fallback ─────────────────────────────────────

async def scrape_news(name: str, client: httpx.AsyncClient) -> tuple[str, str | None]:
    """
    Uses a Google dork targeting top Maltese journalism sites to find articles
    about the candidate, then extracts text + og:image via trafilatura.
    Returns (text, og_image_url).
    """
    site_filter = " OR ".join(f"site:{s}" for s in MALTESE_NEWS_SITES)
    query = f'"{name}" ({site_filter})'

    try:
        resp = await client.post(
            DDG_SEARCH_URL,
            data={"q": query, "b": "", "kl": ""},
            headers={"User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded"},
            timeout=15,
            follow_redirects=True,
        )
        soup = BeautifulSoup(resp.text, "html.parser")

        # Collect URLs that belong to one of our target news sites
        result_urls: list[str] = []
        for a in soup.select("a.result__a"):
            href = a.get("href", "")
            if href.startswith("http") and any(site in href for site in MALTESE_NEWS_SITES):
                result_urls.append(href)
            if len(result_urls) >= 3:
                break

        for article_url in result_urls:
            try:
                article_resp = await client.get(article_url, timeout=12, follow_redirects=True)
                text = await asyncio.to_thread(
                    trafilatura.extract,
                    article_resp.text,
                    include_comments=False,
                    include_tables=False,
                    no_fallback=False,
                )
                if text and len(text.split()) >= MIN_WORDS:
                    print(f"   📰 {article_url}")
                    photo = _og_image(article_resp.text)
                    return text[:5000], photo
            except Exception:
                continue

    except Exception as e:
        print(f"    ⚠ News search error for '{name}': {e}")

    return "", None


# ── Stage 3: LLM enrichment via Ollama ───────────────────────────────────────

def build_prompt(name: str, source_label: str, text: str) -> str:
    return (
        f"The following text comes from {name}'s {source_label} — their own words "
        f"or news coverage about them.\n\n"
        f"Candidate name: {name}\n\n"
        f"Text:\n\"\"\"\n{text}\n\"\"\""
    )


async def enrich(name: str, text: str, source_label: str) -> dict:
    """
    Calls llama3.1:8b via Ollama to score party reliance and extract stances
    + quotes. The `format: "json"` option constrains the model to valid JSON.
    Returns a dict with all four fields, or empty dict on failure.
    """
    if not text or len(text.strip()) < 80:
        return {}

    prompt = build_prompt(name, source_label, text[:6000])

    try:
        raw  = await llm_chat(SYSTEM_PROMPT, prompt, timeout=120)
        data = llm_parse_json(raw)
        data["personal_stances"]     = data.get("personal_stances", [])[:4]
        data["key_quotes"]           = data.get("key_quotes",       [])[:3]
        score = int(data.get("party_reliance_score", 50))
        data["party_reliance_score"] = score
        # -1 means "no political content" — treat as no enrichment
        if score == -1:
            return {}
        return data

    except Exception as e:
        print(f"    ⚠ LLM error for '{name}': {e}")
        return {}


# ── Translation ───────────────────────────────────────────────────────────────

async def translate_to_maltese(texts: list[str]) -> list[str]:
    """
    Translates a list of English strings to Maltese using the MyMemory free
    REST API (no key needed, 1000 req/day free tier).
    Falls back to the original English string on any error.
    """
    results: list[str] = []
    async with httpx.AsyncClient() as client:
        for text in texts:
            if not text or not text.strip():
                results.append(text)
                continue
            try:
                resp = await client.get(
                    "https://api.mymemory.translated.net/get",
                    params={"q": text, "langpair": "en|mt"},
                    timeout=10,
                )
                data = resp.json()
                translated = data.get("responseData", {}).get("translatedText", "")
                # MyMemory returns the original text when it can't translate
                results.append(translated if translated else text)
            except Exception:
                results.append(text)   # fall back to English silently
    return results


# ── Photo: Facebook Graph API ─────────────────────────────────────────────────

async def fetch_facebook_photo(fb_url: str, client: httpx.AsyncClient) -> str | None:
    """
    Fetches the profile picture for a public Facebook page via the Graph API
    picture endpoint — no login, no Playwright needed.

    e.g. https://www.facebook.com/robertabela.mt
      →  GET graph.facebook.com/robertabela.mt/picture?type=large&redirect=false
    """
    m = re.search(r"facebook\.com/(?:pages/[^/]+/)?([^/?#]+)", fb_url)
    if not m:
        return None
    slug = m.group(1).rstrip("/")

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


# ── Photo: Wikipedia thumbnail fallback ──────────────────────────────────────

async def fetch_wikipedia_photo(name: str, client: httpx.AsyncClient) -> str | None:
    """Grabs a thumbnail from Wikipedia as a last resort for photos."""
    parts = name.split()
    candidates = [
        WIKIPEDIA_OVERRIDES.get(name, name),
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
                WIKIPEDIA_API,
                params={"action": "query", "titles": title, "prop": "pageimages",
                        "pithumbsize": 400, "format": "json", "redirects": 1},
                timeout=10,
            )
            for page in resp.json().get("query", {}).get("pages", {}).values():
                if page.get("pageid", -1) != -1:
                    src = page.get("thumbnail", {}).get("source")
                    if src:
                        return src
        except Exception:
            pass
    return None


# ── Main ─────────────────────────────────────────────────────────────────────

async def main() -> None:
    print("=== Kandidati.mt Candidate Enrichment Pipeline ===\n")
    print(f"  MODE: ", end="")
    if FULL_RESCRAPE:
        print("FULL RESCRAPE (clear & restart)")
    elif INCREMENTAL_ONLY:
        print("INCREMENTAL (new candidates only)")
    else:
        print("DEFAULT (unenriched candidates)")
    print(f"  SKIP_DISCOVERY = {SKIP_DISCOVERY}")
    print(f"  ENRICH_ALL     = {ENRICH_ALL}")
    print(f"  DRY_RUN        = {DRY_RUN}")
    print(f"  AUTH STATE     = {'state.json found' if os.path.exists(STATE_JSON) else 'not found (anonymous)'}\n")

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    # Start Ollama if it isn't already running
    ollama_proc = await ensure_ollama_running()

    # ── FULL_RESCRAPE: Delete all Phase 1+2 data ──────────────────────────
    if FULL_RESCRAPE and not DRY_RUN:
        print("  🗑️  Clearing Phase 1+2 data (business interests, disclosures, legal records, votes)…\n")
        try:
            supabase.table("candidate_business_interests").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
            supabase.table("candidate_disclosures").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
            supabase.table("candidate_legal_records").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
            supabase.table("parliamentary_votes").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
            supabase.table("candidates").update({
                "is_mp": None,
                "parliament_bio": None,
                "current_position": None,
                "data_completeness_pct": 0,
                "last_comprehensive_update": None,
            }).neq("id", "00000000-0000-0000-0000-000000000000").execute()
            print("  ✓ Cleared\n")
        except Exception as e:
            print(f"  ⚠ Failed to clear data: {e}\n")

    # Fetch candidates
    q = supabase.table("candidates").select(
        "id, full_name, photo_url, social_links, party_reliance_score, last_comprehensive_update"
    )

    if FULL_RESCRAPE or ENRICH_ALL:
        # Rescrape everyone
        pass
    elif INCREMENTAL_ONLY:
        # Only get candidates without Phase 1 data (null last_comprehensive_update)
        q = q.is_("last_comprehensive_update", "null")
    else:
        # Default: only get candidates without enrichment (null party_reliance_score)
        q = q.is_("party_reliance_score", "null")

    rows = q.execute().data

    if not rows:
        if FULL_RESCRAPE:
            print("Nothing to process.")
        elif INCREMENTAL_ONLY:
            print("No new candidates since last Phase 1 run. Set ENRICH_ALL_OVERRIDE=true to reprocess.")
        else:
            print("No unenriched candidates. Set ENRICH_ALL_OVERRIDE=true to reprocess.")
        return

    print(f"Processing {len(rows)} candidates…\n")

    # Semaphore = 1 keeps calls sequential, which also naturally respects Gemini's 15 RPM
    sem = asyncio.Semaphore(1)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)

        async def process(c: dict) -> None:
            async with sem:
                name         = c["full_name"]
                social_links = c.get("social_links") or {}
                fb_url       = social_links.get("facebook")
                web_url      = social_links.get("website")

                print(f"── {name}")

                async with httpx.AsyncClient(headers={"User-Agent": UA}) as http:

                    # ── PHASE 1: Business Interests & Disclosures ─────────
                    phase1_data = {}

                    # Check parliament roster
                    print(f"   🏛️  checking parliament roster…")
                    parliament_info = await check_parliament_roster(name, http)
                    if parliament_info:
                        phase1_data["is_mp"] = parliament_info["is_mp"]
                        phase1_data["parliament_bio"] = parliament_info["parliament_bio"]
                        phase1_data["current_position"] = parliament_info["current_position"]
                        print(f"   ✓  {parliament_info['current_position']}")

                    # Scrape business registry
                    print(f"   💼 scraping business registry…")
                    business_interests = await scrape_business_registry(name, http)
                    if business_interests:
                        print(f"   ✓  {len(business_interests)} director role(s)")

                    # Scrape government gazette
                    print(f"   📋 searching government gazette…")
                    disclosures = await scrape_government_gazette(name, http)
                    if disclosures:
                        print(f"   ✓  {len(disclosures)} disclosure(s)")
                        # Extract details from each disclosure
                        for disclosure in disclosures:
                            if disclosure.get("source_url"):
                                details = await extract_gazette_details(
                                    disclosure["source_url"], name, http
                                )
                                if details:
                                    # Store full details in raw_json, update only schema fields
                                    disclosure["raw_json"] = details
                                    if details.get("disclosed_amount"):
                                        disclosure["disclosed_amount"] = details["disclosed_amount"]
                                    if details.get("currency"):
                                        disclosure["currency"] = details["currency"]

                    # Scrape court records (fallback to news)
                    print(f"   ⚖️  searching court records…")
                    court_records = await scrape_court_records(name, http)
                    if court_records:
                        print(f"   ✓  {len(court_records)} record(s)")

                    # ── Stage 1: Discover links ───────────────────────────
                    if not SKIP_DISCOVERY and not fb_url:
                        print(f"   🔍 discovering social links…")
                        fb_url, web_url = await discover_links(name, http)
                        if fb_url:  print(f"   📘 Facebook: {fb_url}")
                        if web_url: print(f"   🌐 Website:  {web_url}")

                        if (fb_url or web_url) and not DRY_RUN:
                            updated = {**social_links}
                            if fb_url:  updated["facebook"] = fb_url
                            if web_url: updated["website"]  = web_url
                            supabase.table("candidates").update(
                                {"social_links": updated}
                            ).eq("id", c["id"]).execute()

                    # ── Stage 2: Scrape content ───────────────────────────
                    all_text    = ""
                    source_used = ""

                    # 2a: Facebook
                    if fb_url:
                        print(f"   📄 scraping Facebook…")
                        fb_text = await scrape_facebook(fb_url, browser)
                        if fb_text:
                            all_text    = fb_text
                            source_used = "Facebook page and posts"
                            print(f"   ✓  {len(fb_text.split())} words from Facebook")

                    scraped_photo: str | None = None   # og:image collected during scraping

                    # 2b: Personal website (trafilatura)
                    if web_url and len(all_text.split()) < MIN_WORDS:
                        print(f"   📄 scraping website…")
                        web_text, web_photo = await scrape_website(web_url, http)
                        if web_text:
                            all_text    = (all_text + "\n\n" + web_text).strip()
                            source_used = source_used or "personal website"
                            print(f"   ✓  {len(web_text.split())} words from website")
                        if web_photo and not scraped_photo:
                            scraped_photo = web_photo

                    # 2c: Local news search fallback
                    if len(all_text.split()) < MIN_WORDS:
                        print(f"   🔎 searching local news…")
                        news_text, news_photo = await scrape_news(name, http)
                        if news_text:
                            all_text    = (all_text + "\n\n" + news_text).strip()
                            source_used = source_used or "local news"
                            print(f"   ✓  {len(news_text.split())} words from news")
                        else:
                            print(f"   –  no news found")
                        if news_photo and not scraped_photo:
                            scraped_photo = news_photo

                    # ── Stage 2 (photo): resolve in priority order ────────
                    # 1. Facebook Graph API  2. og:image from scraped pages
                    # 3. Wikidata Commons    4. Wikipedia thumbnail
                    photo_url = c.get("photo_url")
                    if not photo_url:
                        if fb_url:
                            photo_url = await fetch_facebook_photo(fb_url, http)
                        if not photo_url and scraped_photo:
                            photo_url = scraped_photo
                        if not photo_url:
                            _, _, wd_photo = await wikidata_lookup(name, http)
                            photo_url = wd_photo
                        if not photo_url:
                            photo_url = await fetch_wikipedia_photo(name, http)
                        if photo_url:
                            print(f"   📷 photo found")

                    # ── Stage 3: Ollama enrichment ────────────────────────
                    enrichment: dict = {}
                    if all_text:
                        print(f"   🤖 enriching with {OLLAMA_MODEL}…")
                        enrichment = await enrich(name, all_text, source_used)

                        if enrichment.get("personal_stances"):
                            score = enrichment.get("party_reliance_score", "?")
                            n_stances = len(enrichment["personal_stances"])
                            n_quotes  = len(enrichment.get("key_quotes", []))
                            print(f"   ✓  score={score} · {n_stances} stances · {n_quotes} quotes")

                            # Translate to Maltese
                            print(f"   🇲🇹 translating to Maltese…")
                            all_en = (
                                enrichment["personal_stances"] +
                                enrichment.get("key_quotes", []) +
                                [enrichment.get("score_justification", "")]
                            )
                            all_mt = await translate_to_maltese(all_en)
                            n_stances = len(enrichment["personal_stances"])
                            n_quotes  = len(enrichment.get("key_quotes", []))
                            enrichment["personal_stances_mt"]    = all_mt[:n_stances]
                            enrichment["key_quotes_mt"]          = all_mt[n_stances:n_stances + n_quotes]
                            enrichment["score_justification_mt"] = all_mt[-1]
                        else:
                            print(f"   –  no policy content found in scraped text")
                    else:
                        print(f"   –  no content scraped (no links found or all sources blocked)")

                    # ── Stage 4: Save to Supabase ─────────────────────────

                    # PHASE 1: Save business interests, disclosures, court records
                    if not DRY_RUN:
                        # Update candidates table with Phase 1 data
                        phase1_update = {}
                        if phase1_data:
                            phase1_update.update(phase1_data)

                        # Calculate data completeness (simple heuristic)
                        data_completeness = 10  # base for having basic profile
                        if parliament_info:
                            data_completeness += 20
                        if business_interests:
                            data_completeness += 15
                        if disclosures:
                            data_completeness += 15
                        if court_records:
                            data_completeness += 10
                        phase1_update["data_completeness_pct"] = min(data_completeness, 100)
                        phase1_update["last_comprehensive_update"] = datetime.now(timezone.utc).isoformat()

                        if phase1_update:
                            supabase.table("candidates").update(phase1_update).eq("id", c["id"]).execute()

                        # Insert business interests
                        for bi in business_interests:
                            try:
                                supabase.table("candidate_business_interests").insert({
                                    "candidate_id": c["id"],
                                    **bi,
                                    "last_updated": datetime.now(timezone.utc).isoformat(),
                                }).execute()
                            except Exception as e:
                                print(f"    ⚠ Failed to insert business interest: {e}")

                        # Insert disclosures
                        for disc in disclosures:
                            try:
                                supabase.table("candidate_disclosures").insert({
                                    "candidate_id": c["id"],
                                    **disc,
                                    "created_at": datetime.now(timezone.utc).isoformat(),
                                    "last_updated": datetime.now(timezone.utc).isoformat(),
                                }).execute()
                            except Exception as e:
                                print(f"    ⚠ Failed to insert disclosure: {e}")

                        # Insert court records
                        for cr in court_records:
                            try:
                                supabase.table("candidate_legal_records").insert({
                                    "candidate_id": c["id"],
                                    **cr,
                                    "created_at": datetime.now(timezone.utc).isoformat(),
                                    "last_updated": datetime.now(timezone.utc).isoformat(),
                                }).execute()
                            except Exception as e:
                                print(f"    ⚠ Failed to insert legal record: {e}")

                    # Phase 2+: Save enrichment data
                    update: dict = {}

                    if enrichment:
                        update["party_reliance_score"]    = enrichment.get("party_reliance_score")
                        update["score_justification"]     = enrichment.get("score_justification")
                        update["personal_stances"]        = enrichment.get("personal_stances", [])
                        update["key_quotes"]              = enrichment.get("key_quotes", [])
                        update["score_justification_mt"]  = enrichment.get("score_justification_mt")
                        update["personal_stances_mt"]     = enrichment.get("personal_stances_mt", [])
                        update["key_quotes_mt"]           = enrichment.get("key_quotes_mt", [])

                    if photo_url:
                        update["photo_url"] = photo_url

                    if update:
                        update["last_updated"] = datetime.now(timezone.utc).isoformat()
                        if DRY_RUN:
                            print(f"   [DRY RUN] would write: {list(update.keys())}")
                            if "party_reliance_score" in update:
                                print(f"   [DRY RUN] score={update['party_reliance_score']} — {update.get('score_justification', '')}")
                        else:
                            supabase.table("candidates").update(update).eq("id", c["id"]).execute()

                    # ── Phase 5: Parliamentary Questions (MPs only) ────────
                    is_mp = phase1_data.get("is_mp") or c.get("is_mp")
                    if is_mp:
                        print(f"   📜 scraping parliamentary questions…")
                        pqs = await scrape_parliamentary_questions(name, c["id"], http)
                        if pqs and not DRY_RUN:
                            for pq in pqs:
                                try:
                                    supabase.table("candidate_parliamentary_questions").upsert(
                                        pq, on_conflict="candidate_id,question_number"
                                    ).execute()
                                except Exception as e:
                                    print(f"    ⚠ Failed to insert PQ: {e}")
                        elif DRY_RUN and pqs:
                            print(f"   [DRY RUN] would insert {len(pqs)} parliamentary questions")

                    # ── Phase 6: Electoral History ─────────────────────────
                    print(f"   🗳  scraping electoral history…")
                    electoral_records = await scrape_electoral_history(name, c["id"], http)
                    if electoral_records and not DRY_RUN:
                        for er in electoral_records:
                            try:
                                supabase.table("candidate_electoral_history").upsert(
                                    er, on_conflict="candidate_id,election_year,election_type"
                                ).execute()
                            except Exception as e:
                                print(f"    ⚠ Failed to insert electoral record: {e}")
                    elif DRY_RUN and electoral_records:
                        print(f"   [DRY RUN] would insert {len(electoral_records)} electoral records")

                print()

        await asyncio.gather(*[process(c) for c in rows])
        await browser.close()

    # ── PHASE 2: Parliamentary Voting Records ──────────────────────────────
    print("\n=== Phase 2: Parliamentary Voting Records ===\n")

    try:
        # Get list of candidate names for vote matching
        candidate_names = [r["full_name"] for r in rows]

        # Scrape parliamentary votes from PDFs
        parliamentary_results = await scrape_parliamentary_votes(
            candidate_names,
            limit_sessions=None,  # Set to e.g. 2 for testing
            ollama_url=OLLAMA_URL,
            ollama_model=OLLAMA_MODEL,
        )

        print(f"\n  Found {sum(len(r['votes_found']) for r in parliamentary_results)} total votes\n")

        # Save voting records to database
        if not DRY_RUN:
            for session_result in parliamentary_results:
                for vote_record in session_result.get("votes_found", []):
                    # Extract session date from session name (heuristic)
                    session_name = session_result["session_name"]

                    # For each vote, we need to match it to individual candidates
                    # The vote record has: vote_type, bill_name, votes (dict of name→choice)
                    votes_dict = vote_record.get("votes", {})

                    for mp_name, vote_choice in votes_dict.items():
                        # Try to match the MP name to a candidate
                        matched_candidate = None
                        for cand in rows:
                            if cand["full_name"].lower() == mp_name.lower():
                                matched_candidate = cand
                                break

                        if not matched_candidate:
                            continue  # Skip if no match found

                        try:
                            supabase.table("parliamentary_votes").insert({
                                "candidate_id": matched_candidate["id"],
                                "session_name": session_name,
                                "session_url": session_result["session_url"],
                                "session_date": None,  # Could parse from session_name
                                "bill_name": vote_record.get("bill_name"),
                                "vote_type": vote_record.get("vote_type"),
                                "vote_choice": vote_choice,
                                "raw_text_excerpt": vote_record.get("raw_text_excerpt"),
                                "llm_confidence": vote_record.get("confidence", 0.0),
                            }).execute()
                        except Exception as e:
                            print(f"    ⚠ Failed to insert vote for {mp_name}: {e}")
        else:
            print("  [DRY RUN] would insert parliamentary voting records")

    except Exception as e:
        print(f"  ⚠ Parliamentary voting scraper failed: {e}")

    # ── PHASE 4: Party Intelligence ────────────────────────────────────────
    print("\n=== Phase 4: Party Intelligence ===\n")

    try:
        # Scrape comprehensive party data
        party_results = await scrape_party_intelligence(
            party_codes=None,  # Scrape all parties
            ollama_url=OLLAMA_URL,
            ollama_model=OLLAMA_MODEL,
        )

        print(f"\n  Scraped {len(party_results)} party(ies)\n")

        # Save party data to database
        if not DRY_RUN:
            for party_data in party_results:
                try:
                    # Upsert party into parties table
                    party_id = supabase.table("parties").upsert({
                        "abbreviation": party_data["party_code"],
                        "name":         party_data["party_name"],
                        "website_url":  party_data["website"],
                        "color_hex":    party_data["color"],
                        "last_updated": party_data["fetched_at"],
                    }, on_conflict="abbreviation").execute().data[0]["id"]

                    # Save manifesto if available
                    if party_data["manifesto_url"] and party_data["manifesto_text"]:
                        try:
                            supabase.table("party_manifestos").insert({
                                "party_id": party_id,
                                "title": f"{party_data['party_name']} Manifesto",
                                "source_url": party_data["manifesto_url"],
                                "raw_text": party_data["manifesto_text"],
                            }).execute()
                        except Exception as e:
                            print(f"    ⚠ Failed to insert manifesto for {party_data['party_code']}: {e}")

                    # Save policies
                    for policy in party_data["policies"]:
                        try:
                            supabase.table("party_policies").insert({
                                "party_id": party_id,
                                "policy_area": policy.get("policy_area"),
                                "policy_position": policy.get("position"),
                                "priority": policy.get("priority"),
                                "confidence": policy.get("confidence"),
                                "source_type": "manifesto",
                            }).execute()
                        except Exception as e:
                            print(f"    ⚠ Failed to insert policy: {e}")

                    # Save leadership
                    for leader in party_data["leadership"]:
                        try:
                            supabase.table("party_leadership").insert({
                                "party_id": party_id,
                                "leader_name": leader.get("name"),
                                "role": leader.get("role"),
                                "bio": leader.get("bio"),
                                "photo_url": leader.get("photo_url"),
                                "is_current": True,  # Assume current unless date info available
                            }).execute()
                        except Exception as e:
                            print(f"    ⚠ Failed to insert leader {leader.get('name')}: {e}")

                    # Save statements
                    for statement in party_data["statements"]:
                        try:
                            supabase.table("party_statements").insert({
                                "party_id": party_id,
                                "statement_type": "news",
                                "title": statement.get("title"),
                                "source_url": statement.get("url"),
                                "is_official": False,
                            }).execute()
                        except Exception as e:
                            print(f"    ⚠ Failed to insert statement: {e}")

                    # Save news mentions
                    for mention in party_data["news_mentions"]:
                        try:
                            supabase.table("party_media_mentions").insert({
                                "party_id": party_id,
                                "article_url": mention.get("url"),
                                "source": mention.get("source"),
                                "headline": mention.get("headline"),
                            }).execute()
                        except Exception as e:
                            print(f"    ⚠ Failed to insert media mention: {e}")

                except Exception as e:
                    print(f"    ⚠ Failed to save party data for {party_data['party_code']}: {e}")
        else:
            print("  [DRY RUN] would insert party intelligence data")

    except Exception as e:
        print(f"  ⚠ Party intelligence scraper failed: {e}")

    # ── PHASE 5b: Committee Memberships (once per run) ─────────────────────────
    print("\n=== Phase 5b: Committee Memberships ===\n")
    try:
        async with httpx.AsyncClient(headers={"User-Agent": UA}) as http:
            memberships = await scrape_committee_memberships(http)

        if memberships:
            print(f"  Found committee data for {len(memberships)} members")
            # Fetch all candidates to do name matching
            all_candidates = supabase.table("candidates").select("id, full_name").execute().data or []
            if not DRY_RUN:
                for cand in all_candidates:
                    committees = match_committee_memberships(memberships, cand["full_name"])
                    if committees:
                        supabase.table("candidates").update(
                            {"committee_memberships": committees}
                        ).eq("id", cand["id"]).execute()
                        print(f"   ✓  {cand['full_name']}: {', '.join(committees)}")
            else:
                for cand in all_candidates:
                    committees = match_committee_memberships(memberships, cand["full_name"])
                    if committees:
                        print(f"   [DRY RUN] {cand['full_name']}: {committees}")
        else:
            print("  No committee data found (parlament.mt structure may have changed)")
    except Exception as e:
        print(f"  ⚠ Committee memberships scraper failed: {e}")

    # Stop Ollama if we were the ones who started it
    if ollama_proc is not None:
        print("  🦙 stopping Ollama…")
        ollama_proc.terminate()

    print("=== Done ===")


if __name__ == "__main__":
    asyncio.run(main())
