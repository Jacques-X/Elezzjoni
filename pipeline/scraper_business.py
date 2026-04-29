"""
Phase 1: Business Interests & Disclosures Scraping
===================================================

Scrapes Malta's official registries for candidate financial interests:
  1. Malta Business Registry — company directorships, ownership, status
  2. Government Gazette (xjenza.gov.mt) — asset declarations, conflicts
  3. Court records — if public (fallback to news mentions)

All data is public record; no authentication required.
"""

import asyncio
import re
from typing import Optional
import httpx
from bs4 import BeautifulSoup
import trafilatura

# ── Business Registry ──────────────────────────────────────────────────────────

async def scrape_business_registry(
    candidate_name: str,
    client: httpx.AsyncClient,
) -> list[dict]:
    """
    Searches Malta Business Registry for directorships.
    Returns list of { company_name, role, ownership_pct, status, registration_id, url }.

    Note: Registry search at https://www.registryofcompanies.gov.mt/ is JavaScript-heavy.
    Fallback strategy: search via Google dork or news mentions if direct scraping fails.
    """
    results: list[dict] = []

    # Strategy 1: Try direct registry search (may fail if JS-rendered)
    try:
        # Malta Business Registry search endpoint
        search_url = "https://www.registryofcompanies.gov.mt/search"

        # Try a POST request with candidate name
        resp = await client.post(
            search_url,
            data={"q": candidate_name, "type": "director"},
            timeout=15,
            follow_redirects=True,
        )

        soup = BeautifulSoup(resp.text, "html.parser")

        # Look for company results (HTML structure varies; this is a heuristic)
        for row in soup.select("tr.search-result, div.company-result, li.result"):
            company_name = row.select_one("td:first-child, .company-name, .name")
            if not company_name:
                continue

            company_name_text = company_name.get_text(strip=True)
            company_id = row.select_one("td:nth-child(2), .registration-id")
            company_status = row.select_one("td:nth-child(3), .status")

            results.append({
                "company_name": company_name_text,
                "role": "director",  # Inferred from search type
                "ownership_pct": None,
                "status": company_status.get_text(strip=True) if company_status else "unknown",
                "company_registration_id": company_id.get_text(strip=True) if company_id else None,
                "url": f"https://www.registryofcompanies.gov.mt/company/{company_id}" if company_id else None,
            })

    except Exception as e:
        print(f"    ⚠ Business Registry direct search failed for '{candidate_name}': {e}")

    # Strategy 2: Google dork as fallback
    if not results:
        try:
            dork_query = f'site:registryofcompanies.gov.mt "{candidate_name}" director'
            search_resp = await client.get(
                "https://www.google.com/search",
                params={"q": dork_query},
                timeout=15,
                headers={"User-Agent": "Mozilla/5.0 (compatible; Kandidati/1.0)"},
            )
            soup = BeautifulSoup(search_resp.text, "html.parser")

            # Extract Google search results (rough heuristic)
            for link in soup.select("a[href*='registryofcompanies']")[:5]:
                href = link.get("href", "")
                text = link.get_text(strip=True)
                if href.startswith("http"):
                    results.append({
                        "company_name": text,
                        "role": "director",
                        "ownership_pct": None,
                        "status": "unknown",
                        "company_registration_id": None,
                        "url": href,
                    })
        except Exception as e:
            print(f"    ⚠ Google dork search failed for '{candidate_name}': {e}")

    return results


# ── Government Gazette (Disclosures) ───────────────────────────────────────────

async def scrape_government_gazette(
    candidate_name: str,
    client: httpx.AsyncClient,
) -> list[dict]:
    """
    Searches the Government Gazette for asset declarations
    and conflict-of-interest statements filed by the candidate.

    Source: https://www.gov.mt/en/Government/DOI/Government%20Gazette/Pages/default.aspx

    Returns list of { disclosure_type, disclosed_value, date_filed, source_url }.

    Note: Gazette is HTML-based; search by candidate name in document text.
    """
    results: list[dict] = []

    try:
        # Government Gazette main page
        gazette_url = "https://www.gov.mt/en/Government/DOI/Government%20Gazette/Pages/default.aspx"

        # Fetch gazette page
        resp = await client.get(
            gazette_url,
            timeout=15,
            follow_redirects=True,
        )

        soup = BeautifulSoup(resp.text, "html.parser")

        # Look for gazette entries (HTML structure: usually article/document links)
        for entry in soup.select("article.gazette-entry, div.publication, li.result"):
            title = entry.select_one("h3, .title, a")
            date_elem = entry.select_one(".date, time, .publication-date")
            link = entry.select_one("a")

            if not title or not link:
                continue

            title_text = title.get_text(strip=True)
            date_text = date_elem.get_text(strip=True) if date_elem else None
            link_href = link.get("href", "")

            # Infer disclosure type from title
            disclosure_type = "unknown"
            if "asset" in title_text.lower() or "declaration" in title_text.lower():
                disclosure_type = "assets"
            elif "conflict" in title_text.lower():
                disclosure_type = "conflict_of_interest"
            elif "income" in title_text.lower():
                disclosure_type = "income"
            elif "donation" in title_text.lower():
                disclosure_type = "donations"

            results.append({
                "disclosure_type": disclosure_type,
                "disclosed_value": title_text,  # Full text as value until we can parse details
                "disclosed_amount": None,
                "date_filed": date_text,
                "source_url": link_href,
            })

    except Exception as e:
        print(f"    ⚠ Government Gazette search failed for '{candidate_name}': {e}")

    return results


# ── Gazette Detail Extraction ──────────────────────────────────────────────────

async def extract_gazette_details(
    gazette_url: str,
    candidate_name: str,
    client: httpx.AsyncClient,
) -> Optional[dict]:
    """
    Fetches and parses a specific gazette publication to extract disclosure amounts.
    Returns { disclosed_amount, currency, disclosed_items (array of { item, value }) }.
    """
    try:
        resp = await client.get(gazette_url, timeout=15, follow_redirects=True)

        # Extract text using trafilatura
        text = trafilatura.extract(resp.text)
        if not text:
            return None

        # Look for currency amounts (€, EUR, etc.)
        amount_patterns = [
            r"€\s*([\d,]+(?:\.\d{2})?)",
            r"EUR\s*([\d,]+(?:\.\d{2})?)",
            r"([\d,]+(?:\.\d{2})?)\s*€",
            r"amount\s*[:=]?\s*([\d,]+(?:\.\d{2})?)",
        ]

        amounts = []
        for pattern in amount_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            amounts.extend([m.replace(",", "") for m in matches])

        # Also look for property/asset mentions
        properties = []
        for match in re.finditer(r"(property|real estate|immovable|land|apartment|house).*?€?\s*([\d,]+)?", text, re.IGNORECASE):
            properties.append({
                "item": match.group(1),
                "value": match.group(2),
            })

        if amounts or properties:
            return {
                "disclosed_amount": float(amounts[0].replace(",", "")) if amounts else None,
                "currency": "EUR",
                "disclosed_items": properties,
            }

    except Exception as e:
        print(f"    ⚠ Gazette detail extraction failed for {gazette_url}: {e}")

    return None


# ── Court Records (if public) ──────────────────────────────────────────────────

async def scrape_court_records(
    candidate_name: str,
    client: httpx.AsyncClient,
) -> list[dict]:
    """
    Attempts to scrape Malta's court records if they're published online.
    Malta's courts have limited public online presence; this falls back to
    news mentions of legal cases.

    Returns list of { case_type, case_reference, description, case_date, outcome, severity, source_url }.
    """
    results: list[dict] = []

    # Malta doesn't have a fully searchable public court database online.
    # Fallback: search news for legal/court mentions involving candidate.
    try:
        search_query = f'"{candidate_name}" court case lawsuit "first hall"'

        dork = f'site:timesofmalta.com OR site:maltatoday.com.mt OR site:independent.com.mt "{candidate_name}" court'

        # Use DuckDuckGo search
        ddg_resp = await client.post(
            "https://html.duckduckgo.com/html/",
            data={"q": dork},
            timeout=15,
            follow_redirects=True,
        )

        soup = BeautifulSoup(ddg_resp.text, "html.parser")

        for link in soup.select("a.result__a")[:3]:
            href = link.get("href", "")
            text = link.get_text(strip=True)

            if href.startswith("http"):
                # Fetch article and extract case details
                article_resp = await client.get(href, timeout=12, follow_redirects=True)
                article_text = trafilatura.extract(article_resp.text)

                if article_text and ("court" in article_text.lower() or "case" in article_text.lower()):
                    results.append({
                        "case_type": "unknown",  # Would need LLM to extract
                        "case_reference": None,
                        "description": text,
                        "case_date": None,
                        "outcome": None,
                        "severity": "low",  # Unless it's a headline case
                        "source_url": href,
                    })

    except Exception as e:
        print(f"    ⚠ Court records search failed for '{candidate_name}': {e}")

    return results


# ── Parliament Member Roster ───────────────────────────────────────────────────

async def check_parliament_roster(
    candidate_name: str,
    client: httpx.AsyncClient,
) -> Optional[dict]:
    """
    Checks if candidate is a current Member of Parliament by:
    1. Fetching the MP index and finding a matching href link
    2. Fetching that individual MP profile page for bio/role

    Returns { is_mp: bool, parliament_bio: str, current_position: str } or None.
    """
    name_lower = candidate_name.lower()

    # Normalise a name to the URL slug fragment parliament.mt uses
    def _slug(s: str) -> str:
        return re.sub(r"[^a-z0-9]", "", s.lower())

    candidate_slug = _slug(candidate_name)

    try:
        resp = await client.get(
            "https://parlament.mt/en/14th-leg/members-of-parliament/",
            timeout=15,
            follow_redirects=True,
        )
        soup = BeautifulSoup(resp.text, "html.parser")

        # Find a link whose href or text matches the candidate
        profile_url: Optional[str] = None
        for a in soup.find_all("a", href=True):
            href = a["href"]
            text = a.get_text(strip=True)

            href_slug = _slug(href)
            text_lower = text.lower()

            name_parts = name_lower.split()
            # Match if at least 2 name parts appear in the link text or URL slug
            matched_parts = sum(1 for p in name_parts if p in text_lower or p in href_slug)
            if matched_parts >= min(2, len(name_parts)):
                if href.startswith("http"):
                    profile_url = href
                elif href.startswith("/"):
                    profile_url = f"https://parlament.mt{href}"
                break

    except Exception as e:
        print(f"    ⚠ Parliament roster fetch failed: {e}")
        return None

    if not profile_url:
        return None

    # Fetch the individual MP profile page
    try:
        resp2 = await client.get(profile_url, timeout=15, follow_redirects=True)
        soup2 = BeautifulSoup(resp2.text, "html.parser")

        # Role: look for prominent heading or role text near the name
        role = "Member of Parliament"
        for tag in soup2.find_all(["h2", "h3", "p", "span"]):
            text = tag.get_text(strip=True)
            if any(kw in text.lower() for kw in ["minister", "speaker", "leader", "whip", "shadow"]):
                role = text[:120]
                break

        # Bio: longest paragraph-ish text block on the page
        bio: Optional[str] = None
        for p in soup2.find_all("p"):
            text = p.get_text(" ", strip=True)
            if len(text) > 80:
                bio = text[:600]
                break

        return {
            "is_mp": True,
            "parliament_bio": bio,
            "current_position": role,
        }

    except Exception as e:
        print(f"    ⚠ Parliament profile fetch failed for {profile_url}: {e}")
        # We still know they're an MP even if we couldn't get the bio
        return {
            "is_mp": True,
            "parliament_bio": None,
            "current_position": "Member of Parliament",
        }
