"""
Electoral History Scraper
==========================
Scrapes Malta's Electoral Commission for candidate vote totals across
general elections (2022, 2017, 2013).

Source: https://electoral.gov.mt

Strategy:
  1. Fetch the general elections index page
  2. For each known election year, navigate to results
  3. Search result tables for candidate name
  4. Extract: first preference votes, final count, elected status, district
"""

import asyncio
import re
from typing import Optional

import httpx
from bs4 import BeautifulSoup
import trafilatura

ELECTORAL_BASE = "https://electoral.gov.mt"
RATE_LIMIT     = 1.5

# Known general election entry points — ordered newest first
ELECTION_YEARS = [
    (2022, [
        "https://electoral.gov.mt/Results/GeneralElection/2022",
        "https://electoral.gov.mt/en/General-Elections/2022-General-Election",
        "https://electoral.gov.mt/en/General-Elections",
    ]),
    (2017, [
        "https://electoral.gov.mt/Results/GeneralElection/2017",
        "https://electoral.gov.mt/en/General-Elections/2017-General-Election",
    ]),
    (2013, [
        "https://electoral.gov.mt/Results/GeneralElection/2013",
        "https://electoral.gov.mt/en/General-Elections/2013-General-Election",
    ]),
]


async def scrape_electoral_history(
    candidate_name: str,
    candidate_id:   str,
    client:         httpx.AsyncClient,
) -> list[dict]:
    """
    Returns a list of dicts for candidate_electoral_history:
      candidate_id, election_year, election_type, district_id,
      first_preference_votes, final_count_votes, elected, source_url
    """
    results: list[dict] = []

    for year, urls in ELECTION_YEARS:
        found = await _try_election_year(candidate_name, candidate_id, year, urls, client)
        if found:
            results.extend(found)
        await asyncio.sleep(RATE_LIMIT)

    if results:
        print(f"   🗳  {len(results)} electoral records found for {candidate_name}")

    return results


async def _try_election_year(
    candidate_name: str,
    candidate_id:   str,
    year:           int,
    urls:           list[str],
    client:         httpx.AsyncClient,
) -> list[dict]:
    """Tries each candidate URL for an election year until one returns data."""
    for url in urls:
        try:
            resp = await client.get(url, timeout=20, follow_redirects=True)
            if resp.status_code != 200:
                continue

            # First try the page itself
            found = _extract_from_page(resp.text, candidate_name, candidate_id, year, url)
            if found:
                return found

            # Otherwise look for district sub-pages linked from this index
            found = await _follow_district_links(
                resp.text, candidate_name, candidate_id, year, url, client
            )
            if found:
                return found

        except Exception as e:
            print(f"    ⚠ Electoral {year} ({url}): {e}")
            continue

    return []


async def _follow_district_links(
    html:           str,
    candidate_name: str,
    candidate_id:   str,
    year:           int,
    base_url:       str,
    client:         httpx.AsyncClient,
) -> list[dict]:
    """Follows links to individual district result pages."""
    soup  = BeautifulSoup(html, "html.parser")
    found: list[dict] = []

    district_urls: list[str] = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(strip=True).lower()
        # District links typically mention "district", "distrett", or a number 1-13
        if any(kw in href.lower() or kw in text for kw in
               ["district", "distrett", "d1", "d2", "d3", "d4", "d5",
                "d6", "d7", "d8", "d9", "d10", "d11", "d12", "d13"]):
            if not href.startswith("http"):
                href = f"{ELECTORAL_BASE}{href}"
            if href not in district_urls and href != base_url:
                district_urls.append(href)

    for district_url in district_urls[:15]:
        try:
            dr = await client.get(district_url, timeout=15, follow_redirects=True)
            if dr.status_code == 200:
                rows = _extract_from_page(dr.text, candidate_name, candidate_id, year, district_url)
                found.extend(rows)
            await asyncio.sleep(0.8)
        except Exception:
            continue

    return found


def _extract_from_page(
    html:           str,
    candidate_name: str,
    candidate_id:   str,
    year:           int,
    source_url:     str,
) -> list[dict]:
    """
    Searches an HTML page for table rows matching the candidate name
    and extracts vote counts.
    """
    results: list[dict] = []
    soup = BeautifulSoup(html, "html.parser")

    name_parts = candidate_name.lower().split()
    last_name  = name_parts[-1]
    # Need at least last name + one other part to avoid false matches
    secondary  = name_parts[0] if len(name_parts) > 1 else ""

    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        for row in rows:
            cells = row.find_all("td")
            if len(cells) < 2:
                continue

            row_text = row.get_text(" ", strip=True)
            row_lower = row_text.lower()

            # Name matching: require last name + at least one other name part
            if last_name not in row_lower:
                continue
            if secondary and secondary not in row_lower:
                continue

            # Extract numbers from the row (vote counts)
            numbers: list[int] = []
            for cell in cells:
                raw = cell.get_text(strip=True).replace(",", "").replace(".", "").strip()
                try:
                    n = int(raw)
                    if 10 <= n <= 99999:  # plausible vote range
                        numbers.append(n)
                except ValueError:
                    pass

            if not numbers:
                continue

            district_id = _extract_district_id(source_url, row_text)

            elected = any(
                kw in row_lower
                for kw in ["elected", "elett", "eletta", "✓", "returned"]
            )

            results.append({
                "candidate_id":          candidate_id,
                "election_year":         year,
                "election_type":         "general",
                "district_id":           district_id,
                "first_preference_votes": numbers[0],
                "final_count_votes":     numbers[-1] if len(numbers) > 1 else numbers[0],
                "elected":               elected,
                "source_url":            source_url,
            })

    # Also try plain-text extraction via trafilatura if table parsing yielded nothing
    if not results:
        results = _extract_from_text(html, candidate_name, candidate_id, year, source_url)

    return results


def _extract_from_text(
    html:           str,
    candidate_name: str,
    candidate_id:   str,
    year:           int,
    source_url:     str,
) -> list[dict]:
    """Fallback: extract votes from plain text surrounding candidate name mentions."""
    text = trafilatura.extract(html) or ""
    if not text:
        return []

    name_parts = candidate_name.lower().split()
    last_name  = name_parts[-1]
    lines      = text.split("\n")
    results: list[dict] = []

    for i, line in enumerate(lines):
        if last_name not in line.lower():
            continue

        # Gather the line plus neighbours to find vote numbers
        context = " ".join(lines[max(0, i - 1): i + 3])
        numbers = [int(m) for m in re.findall(r"\b(\d{3,6})\b", context)
                   if 10 <= int(m) <= 99999]

        if not numbers:
            continue

        results.append({
            "candidate_id":          candidate_id,
            "election_year":         year,
            "election_type":         "general",
            "district_id":           None,
            "first_preference_votes": numbers[0],
            "final_count_votes":     numbers[-1] if len(numbers) > 1 else numbers[0],
            "elected":               any(
                kw in context.lower()
                for kw in ["elected", "elett", "eletta", "returned"]
            ),
            "source_url": source_url,
        })
        break  # one record per page

    return results


def _extract_district_id(url: str, row_text: str) -> Optional[int]:
    """Tries to extract a district number (1–13) from the URL or row text."""
    for pattern in [
        r"district[_\-/]?(\d{1,2})",
        r"distrett[_\-/]?(\d{1,2})",
        r"/d(\d{1,2})/",
        r"district=(\d{1,2})",
    ]:
        m = re.search(pattern, url, re.IGNORECASE) or re.search(pattern, row_text, re.IGNORECASE)
        if m:
            d = int(m.group(1))
            if 1 <= d <= 13:
                return d
    return None
