"""
Phase 4: Comprehensive Party Intelligence
==========================================

Scrapes and enriches detailed data on political parties (PN, PL, minor parties):
  1. Party manifestos (extract policy positions via PDF mining)
  2. Party websites (platform positions, news, statements)
  3. Party leadership (names, roles, photos, bios)
  4. Party governance structure
  5. Official statements & press releases
  6. Media coverage & sentiment analysis
  7. Voting statistics & patterns (aggregate from MPs)

All data is public record; no authentication required.
"""

import asyncio
import io
import json
import re
from typing import Optional
from datetime import datetime, timezone

import httpx
import pdfplumber
from bs4 import BeautifulSoup
import trafilatura

# ── Rate limiting ──────────────────────────────────────────────────────────────

RATE_LIMIT_DELAY = 1.5  # seconds between requests


# ── Maltese Parties ────────────────────────────────────────────────────────────

PARTIES = [
    {
        "code": "PN",
        "name": "Nationalist Party",
        "name_mt": "Partit Nazzjonalista",
        "website": "https://www.pn.org.mt",
        "color": "#FF6B35",
    },
    {
        "code": "PL",
        "name": "Labour Party",
        "name_mt": "Partit Laburista",
        "website": "https://www.pl.org.mt",
        "color": "#FF0000",
    },
    {
        "code": "AD",
        "name": "Alternattiva Demokratika",
        "name_mt": "Alternattiva Demokratika",
        "website": "https://www.alternattiva.com.mt",
        "color": "#00AA00",
    },
]


# ── Party Website Scraping ─────────────────────────────────────────────────────

async def scrape_party_website(
    party_code: str,
    party_website: str,
    client: httpx.AsyncClient,
) -> dict:
    """
    Scrapes party website for manifesto links, statements, and policy information.

    Returns: {
        manifesto_url: str or None,
        statements: [{ date, title, url, content }],
        leadership_section_url: str or None,
        policies_section: str or None,
    }
    """
    try:
        resp = await client.get(
            party_website,
            timeout=15,
            follow_redirects=True,
        )

        soup = BeautifulSoup(resp.text, "html.parser")

        # Look for manifesto PDF link
        manifesto_url = None
        for link in soup.select("a[href*='.pdf'], a[href*='manifesto'], a[href*='programme']"):
            href = link.get("href", "")
            text = link.get_text(strip=True).lower()

            if "manifesto" in text or "programme" in text or "platform" in text:
                if href.startswith("http"):
                    manifesto_url = href
                elif href.startswith("/"):
                    manifesto_url = f"{party_website.rstrip('/')}{href}"
                break

        # Extract statements/news
        statements = []
        for article in soup.select("article, div.news-item, div.post, li.post")[:5]:
            title_elem = article.select_one("h2, h3, .title, a")
            date_elem = article.select_one(".date, time, .published")
            link_elem = article.select_one("a")

            if title_elem and link_elem:
                title = title_elem.get_text(strip=True)
                date_text = date_elem.get_text(strip=True) if date_elem else None
                href = link_elem.get("href", "")

                if href.startswith("http"):
                    url = href
                elif href.startswith("/"):
                    url = f"{party_website.rstrip('/')}{href}"
                else:
                    continue

                statements.append({
                    "title": title,
                    "date": date_text,
                    "url": url,
                })

        # Look for leadership section
        leadership_url = None
        for link in soup.select("a"):
            text = link.get_text(strip=True).lower()
            if "leader" in text or "management" in text or "governance" in text:
                href = link.get("href", "")
                if href.startswith("http"):
                    leadership_url = href
                elif href.startswith("/"):
                    leadership_url = f"{party_website.rstrip('/')}{href}"
                break

        return {
            "manifesto_url": manifesto_url,
            "statements": statements,
            "leadership_url": leadership_url,
        }

    except Exception as e:
        print(f"    ⚠ Failed to scrape party website {party_website}: {e}")
        return {
            "manifesto_url": None,
            "statements": [],
            "leadership_url": None,
        }


# ── Manifesto PDF Extraction ───────────────────────────────────────────────────

async def extract_manifesto_text(
    manifesto_url: str,
    client: httpx.AsyncClient,
) -> Optional[str]:
    """
    Downloads and extracts text from party manifesto PDF.
    Returns full manifesto text or None if extraction fails.
    """
    try:
        resp = await client.get(
            manifesto_url,
            timeout=20,
            follow_redirects=True,
        )

        if resp.status_code != 200:
            return None

        # Extract text from PDF
        with pdfplumber.open(io.BytesIO(resp.content)) as pdf:
            text = ""
            for page in pdf.pages:
                text += page.extract_text() or ""
                text += "\n"
            return text if text else None

    except Exception as e:
        print(f"    ⚠ Failed to extract manifesto from {manifesto_url}: {e}")
        return None


# ── Policy Extraction via LLM ──────────────────────────────────────────────────

async def extract_party_policies(
    party_code: str,
    manifesto_text: str,
    ollama_url: str = "http://localhost:11434",
    ollama_model: str = "llama3.1:8b",
) -> list[dict]:
    """
    Parses party manifesto text using Ollama to extract structured policy positions.

    Returns: [
        {
            "policy_area": "healthcare",
            "position": "...",
            "priority": "high|medium|low",
            "confidence": 0.85
        },
        ...
    ]
    """

    system_prompt = (
        "You are analyzing a political party's manifesto from Malta. "
        "Extract structured policy positions on key areas: healthcare, economy, education, "
        "environment, justice, immigration, EU relations, social welfare, tourism, energy, etc.\n"
        "For each area, identify:\n"
        "1. policy_area: The policy domain\n"
        "2. position: 1-3 sentence summary of party stance\n"
        "3. priority: How important this is (high/medium/low) based on manifesto emphasis\n"
        "4. confidence: 0-1 score for how clearly this is stated\n"
        "\n"
        "Return ONLY a JSON array. If manifesto doesn't address an area clearly, skip it."
    )

    user_prompt = f"""
Extract policy positions from this {party_code} party manifesto excerpt. Return JSON array only.

MANIFESTO TEXT:
{manifesto_text[:3000]}  {' [truncated]' if len(manifesto_text) > 3000 else ''}
"""

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{ollama_url}/api/chat",
                json={
                    "model": ollama_model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "format": "json",
                    "stream": False,
                },
                timeout=30,
            )

            if resp.status_code != 200:
                return []

            response_data = resp.json()
            response_text = response_data.get("message", {}).get("content", "").strip()

            if not response_text:
                return []

            # Parse JSON response
            policies = json.loads(response_text)

            if not isinstance(policies, list):
                return []

            # Validate structure
            return [
                p for p in policies
                if all(key in p for key in ["policy_area", "position", "priority", "confidence"])
            ]

    except json.JSONDecodeError:
        return []
    except Exception as e:
        print(f"    ⚠ LLM policy extraction failed: {e}")
        return []


# ── Party Leadership Scraping ──────────────────────────────────────────────────

async def scrape_party_leadership(
    party_code: str,
    leadership_url: str,
    client: httpx.AsyncClient,
) -> list[dict]:
    """
    Scrapes party leadership page to extract leader names, roles, bios.

    Returns: [
        {
            "name": "John Doe",
            "role": "Party Leader",
            "bio": "...",
            "photo_url": "...",
        },
        ...
    ]
    """
    leaders = []

    try:
        resp = await client.get(
            leadership_url,
            timeout=15,
            follow_redirects=True,
        )

        soup = BeautifulSoup(resp.text, "html.parser")

        # Look for member cards/profiles
        for member in soup.select("div.member, div.leader, div.officer, li.profile, article.person"):
            name_elem = member.select_one("h3, h4, .name, a")
            role_elem = member.select_one(".role, .position, .title, span.role")
            bio_elem = member.select_one(".bio, .description, p")
            photo_elem = member.select_one("img")

            if not name_elem:
                continue

            name = name_elem.get_text(strip=True)
            role = role_elem.get_text(strip=True) if role_elem else "Member"
            bio = bio_elem.get_text(strip=True) if bio_elem else None
            photo_url = photo_elem.get("src") if photo_elem else None

            # Make photo URL absolute if relative
            if photo_url and not photo_url.startswith("http"):
                base = leadership_url.rsplit("/", 1)[0]
                photo_url = f"{base}/{photo_url}" if not photo_url.startswith("/") else f"https://{leadership_url.split('/')[2]}{photo_url}"

            leaders.append({
                "name": name,
                "role": role,
                "bio": bio,
                "photo_url": photo_url,
            })

    except Exception as e:
        print(f"    ⚠ Failed to scrape leadership from {leadership_url}: {e}")

    return leaders


# ── Party News Search ──────────────────────────────────────────────────────────

async def scrape_party_news(
    party_code: str,
    party_name: str,
    client: httpx.AsyncClient,
    limit: int = 10,
) -> list[dict]:
    """
    Searches for recent news mentions of party.

    Returns: [
        {
            "date": "2024-04-16",
            "headline": "...",
            "source": "timesofmalta.com",
            "url": "...",
            "excerpt": "...",
        },
        ...
    ]
    """
    mentions = []

    try:
        # Search via DuckDuckGo
        dork = f'"{party_name}" OR "{party_code}" site:timesofmalta.com OR site:maltatoday.com.mt OR site:independent.com.mt'

        resp = await client.post(
            "https://html.duckduckgo.com/html/",
            data={"q": dork},
            timeout=15,
            follow_redirects=True,
        )

        soup = BeautifulSoup(resp.text, "html.parser")

        for link in soup.select("a.result__a")[:limit]:
            href = link.get("href", "")
            text = link.get_text(strip=True)

            if href.startswith("http"):
                # Extract source domain
                source = href.split("/")[2] if "/" in href.split("://")[1] else "unknown"

                mentions.append({
                    "headline": text,
                    "source": source,
                    "url": href,
                    "excerpt": None,  # Could fetch and extract via trafilatura
                })

    except Exception as e:
        print(f"    ⚠ Failed to scrape party news for {party_code}: {e}")

    return mentions


# ── Entry Point ────────────────────────────────────────────────────────────────

async def scrape_party_intelligence(
    party_codes: Optional[list[str]] = None,
    ollama_url: str = "http://localhost:11434",
    ollama_model: str = "llama3.1:8b",
) -> list[dict]:
    """
    Main entry point for Phase 4 party intelligence scraper.

    Args:
        party_codes: List of party codes to scrape (defaults to all in PARTIES)
        ollama_url: Ollama server URL
        ollama_model: Model name for policy extraction

    Returns: List of party results with manifestos, policies, leadership, news.
    """

    results: list[dict] = []

    # Filter parties if codes specified
    parties_to_scrape = [
        p for p in PARTIES
        if not party_codes or p["code"] in party_codes
    ]

    async with httpx.AsyncClient(headers={
        "User-Agent": "Mozilla/5.0 (compatible; Kandidati/1.0)"
    }) as client:

        print(f"  Scraping {len(parties_to_scrape)} party(ies)…\n")

        for party in parties_to_scrape:
            party_code = party["code"]
            party_name = party["name"]
            party_website = party["website"]

            print(f"  {party_code}: {party_name}")

            # Rate limit
            await asyncio.sleep(RATE_LIMIT_DELAY)

            # Scrape website
            print(f"    📄 scraping website…")
            website_data = await scrape_party_website(party_code, party_website, client)

            # Extract manifesto
            manifesto_text = None
            if website_data["manifesto_url"]:
                print(f"    📋 downloading manifesto…")
                await asyncio.sleep(RATE_LIMIT_DELAY * 2)
                manifesto_text = await extract_manifesto_text(website_data["manifesto_url"], client)
                if manifesto_text:
                    print(f"    ✓  {len(manifesto_text)} chars extracted")

            # Extract policies
            policies = []
            if manifesto_text:
                print(f"    🤖 extracting policies with LLM…")
                policies = await extract_party_policies(
                    party_code,
                    manifesto_text,
                    ollama_url,
                    ollama_model,
                )
                print(f"    ✓  {len(policies)} policy areas extracted")

            # Scrape leadership
            leadership = []
            if website_data["leadership_url"]:
                print(f"    👥 scraping leadership…")
                await asyncio.sleep(RATE_LIMIT_DELAY)
                leadership = await scrape_party_leadership(
                    party_code,
                    website_data["leadership_url"],
                    client,
                )
                print(f"    ✓  {len(leadership)} leader(s) found")

            # Scrape news
            print(f"    📰 searching news…")
            await asyncio.sleep(RATE_LIMIT_DELAY)
            news = await scrape_party_news(party_code, party_name, client)
            print(f"    ✓  {len(news)} article(s) found")

            results.append({
                "party_code": party_code,
                "party_name": party_name,
                "party_name_mt": party["name_mt"],
                "website": party_website,
                "color": party["color"],
                "manifesto_url": website_data["manifesto_url"],
                "manifesto_text": manifesto_text,
                "policies": policies,
                "leadership": leadership,
                "statements": website_data["statements"],
                "news_mentions": news,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            })

            print()

    return results
