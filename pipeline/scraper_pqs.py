"""
Parliamentary Questions Scraper
================================
Scrapes Malta Parliament's question archive for questions filed by MPs.

What MPs ask reveals real priorities and who they hold to account — often
more informative than stated positions.

Source: https://parlament.mt/en/14th-leg/parliamentary-questions/

Strategy:
  1. Fetch the PQ search form from parlament.mt
  2. Submit search by member last name (GET + POST fallback)
  3. Parse result rows: date, number, type, question text, minister addressed
  4. Follow pagination if present
"""

import asyncio
import re
from datetime import datetime
from typing import Optional

import httpx
from bs4 import BeautifulSoup

PQ_BASE       = "https://parlament.mt"
PQ_SEARCH_URL = "https://parlament.mt/en/14th-leg/parliamentary-questions/"
RATE_LIMIT    = 1.5  # seconds between requests


async def scrape_parliamentary_questions(
    candidate_name: str,
    candidate_id:   str,
    client:         httpx.AsyncClient,
    max_questions:  int = 50,
) -> list[dict]:
    """
    Searches parliament.mt for questions filed by this MP.

    Returns list of dicts ready to upsert into candidate_parliamentary_questions:
      candidate_id, question_date, question_number, question_type,
      question_text, minister_addressed, ministry, source_url
    """
    questions: list[dict] = []
    name_parts = candidate_name.strip().split()
    if not name_parts:
        return []

    last_name  = name_parts[-1]
    first_name = name_parts[0] if len(name_parts) > 1 else ""

    # ── Attempt 1: GET with query params ─────────────────────────────────────
    try:
        resp = await client.get(
            PQ_SEARCH_URL,
            params={"MemberLastName": last_name, "MemberFirstName": first_name},
            timeout=20,
            follow_redirects=True,
        )
        if resp.status_code == 200:
            found = _parse_pq_listing(resp.text, candidate_id, candidate_name)
            questions.extend(found)
            # Follow pagination
            questions.extend(await _follow_pagination(resp.text, candidate_id, candidate_name, client))
    except Exception as e:
        print(f"    ⚠ PQ GET search failed for '{candidate_name}': {e}")

    await asyncio.sleep(RATE_LIMIT)

    # ── Attempt 2: POST form submission ───────────────────────────────────────
    if not questions:
        try:
            form_resp = await client.get(PQ_SEARCH_URL, timeout=15, follow_redirects=True)
            token = _extract_csrf(form_resp.text)

            post_data: dict = {
                "MemberLastName":  last_name,
                "MemberFirstName": first_name,
                "QuestionType":    "",
                "submit":          "Search",
            }
            if token:
                post_data["__RequestVerificationToken"] = token

            resp2 = await client.post(
                PQ_SEARCH_URL,
                data=post_data,
                timeout=20,
                follow_redirects=True,
            )
            if resp2.status_code == 200:
                found = _parse_pq_listing(resp2.text, candidate_id, candidate_name)
                questions.extend(found)
        except Exception as e:
            print(f"    ⚠ PQ POST search failed for '{candidate_name}': {e}")

    await asyncio.sleep(RATE_LIMIT)

    # ── Attempt 3: Fetch the full recent PQ list and filter by name ───────────
    if not questions:
        try:
            resp3 = await client.get(PQ_SEARCH_URL, timeout=15, follow_redirects=True)
            if resp3.status_code == 200:
                questions.extend(
                    _parse_pq_listing(resp3.text, candidate_id, candidate_name, require_name_match=True)
                )
        except Exception as e:
            print(f"    ⚠ PQ full-list fallback failed for '{candidate_name}': {e}")

    # Deduplicate by question_number (or by question_text prefix if no number)
    seen: set[str] = set()
    unique: list[dict] = []
    for q in questions:
        key = q.get("question_number") or q.get("question_text", "")[:60]
        if key not in seen:
            seen.add(key)
            unique.append(q)

    if unique:
        print(f"   📜 {len(unique)} parliamentary questions found for {candidate_name}")
    return unique[:max_questions]


async def _follow_pagination(
    html:          str,
    candidate_id:  str,
    candidate_name: str,
    client:        httpx.AsyncClient,
    max_pages:     int = 5,
) -> list[dict]:
    """Follows 'Next page' links and collects additional questions."""
    results: list[dict] = []
    soup = BeautifulSoup(html, "html.parser")

    for _ in range(max_pages):
        next_link = (
            soup.find("a", string=re.compile(r"next|›|»", re.IGNORECASE))
            or soup.find("a", attrs={"rel": "next"})
            or soup.select_one("li.next a, .pagination .next a")
        )
        if not next_link:
            break

        href = next_link.get("href", "")
        if not href:
            break
        if not href.startswith("http"):
            href = f"{PQ_BASE}{href}"

        try:
            resp = await client.get(href, timeout=15, follow_redirects=True)
            if resp.status_code != 200:
                break
            found = _parse_pq_listing(resp.text, candidate_id, candidate_name)
            if not found:
                break
            results.extend(found)
            soup = BeautifulSoup(resp.text, "html.parser")
            await asyncio.sleep(RATE_LIMIT)
        except Exception:
            break

    return results


def _extract_csrf(html: str) -> Optional[str]:
    """Extracts ASP.NET or generic CSRF token from a form page."""
    soup = BeautifulSoup(html, "html.parser")
    token_input = soup.find("input", {"name": "__RequestVerificationToken"})
    if token_input:
        return token_input.get("value")
    return None


def _parse_pq_listing(
    html:              str,
    candidate_id:      str,
    candidate_name:    str,
    require_name_match: bool = False,
) -> list[dict]:
    """
    Parses a PQ search results page.

    Handles both table-based and card-based parliament.mt layouts.
    When require_name_match=True, only rows containing the candidate's last name
    are accepted (used when scraping the unfiltered list).
    """
    questions: list[dict] = []
    soup = BeautifulSoup(html, "html.parser")
    last_name = candidate_name.strip().split()[-1].lower()

    # ── Strategy A: Table rows ────────────────────────────────────────────────
    for table in soup.find_all("table"):
        header_cells = [th.get_text(strip=True).lower() for th in table.find_all("th")]

        for row in table.find_all("tr"):
            cells = row.find_all("td")
            if len(cells) < 2:
                continue

            row_text = row.get_text(" ", strip=True)
            if require_name_match and last_name not in row_text.lower():
                continue

            q = _build_question(cells, row, candidate_id, header_cells)
            if q:
                questions.append(q)

    # ── Strategy B: Card / list-item elements ─────────────────────────────────
    if not questions:
        selectors = [
            ".question-item", ".pq-item", ".pq-result",
            "article.question", "li.question", ".result-row",
        ]
        for sel in selectors:
            for item in soup.select(sel):
                item_text = item.get_text(" ", strip=True)
                if require_name_match and last_name not in item_text.lower():
                    continue
                q = _build_question_from_div(item, candidate_id)
                if q:
                    questions.append(q)
            if questions:
                break

    return questions


_DATE_RE    = re.compile(r"\b(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2,4})\b")
_NUM_RE     = re.compile(r"\b((?:PQ|OQ|WQ|Q)?\d{3,6}(?:/\d{2,4})?)\b", re.IGNORECASE)
_MINISTER_RE = re.compile(
    r"(?:to\s+the\s+|lill?-?il?l?\s*)(?:minister(?:u)?(?:\s+for)?|prim\s*ministru|secretary)\s+([A-Z][^\n\.;]{3,50})",
    re.IGNORECASE,
)


def _parse_date(text: str) -> Optional[str]:
    m = _DATE_RE.search(text)
    if not m:
        return None
    d, mon, y = m.group(1), m.group(2), m.group(3)
    if len(y) == 2:
        y = "20" + y
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y"):
        try:
            return datetime.strptime(f"{d}/{mon}/{y}", "%d/%m/%Y").date().isoformat()
        except ValueError:
            pass
    return None


def _build_question(cells, row, candidate_id: str, header_cells: list[str]) -> Optional[dict]:
    """Build a question dict from a table row."""
    texts = [c.get_text(" ", strip=True) for c in cells]
    links = [c.find("a") for c in cells]
    full_text = " ".join(texts)

    if len(full_text) < 15:
        return None

    q: dict = {"candidate_id": candidate_id}

    # Date
    q["question_date"] = _parse_date(full_text)

    # Question number — short cell matching number pattern
    for text in texts:
        m = _NUM_RE.match(text.strip())
        if m and len(text.strip()) < 25:
            q["question_number"] = text.strip()
            break

    # Type
    for text in texts:
        tl = text.lower()
        if "oral" in tl or "orali" in tl:
            q["question_type"] = "oral"
            break
        elif "written" in tl or "bil-miktub" in tl or "miktub" in tl:
            q["question_type"] = "written"
            break

    # Minister
    mm = _MINISTER_RE.search(full_text)
    if mm:
        q["minister_addressed"] = mm.group(1).strip()[:100]

    # Question text — longest meaningful cell
    candidates_text = [t for t in texts if len(t) > 20]
    if candidates_text:
        q["question_text"] = max(candidates_text, key=len)[:1500]
    else:
        return None

    # Source URL
    for link in links:
        if link and link.get("href"):
            href = link["href"]
            if not href.startswith("http"):
                href = f"{PQ_BASE}{href}"
            q["source_url"] = href
            break

    if len(q.get("question_text", "")) < 10:
        return None

    return q


def _build_question_from_div(div, candidate_id: str) -> Optional[dict]:
    """Build a question dict from a card/div element."""
    text = div.get_text(" ", strip=True)
    if len(text) < 15:
        return None

    q: dict = {"candidate_id": candidate_id}
    q["question_date"] = _parse_date(text)

    m = _NUM_RE.search(text)
    if m:
        q["question_number"] = m.group(1)

    tl = text.lower()
    if "oral" in tl or "orali" in tl:
        q["question_type"] = "oral"
    elif "written" in tl or "bil-miktub" in tl:
        q["question_type"] = "written"

    mm = _MINISTER_RE.search(text)
    if mm:
        q["minister_addressed"] = mm.group(1).strip()[:100]

    paragraphs = [p.get_text(strip=True) for p in div.find_all(["p", "span", "div"])
                  if len(p.get_text(strip=True)) > 25]
    q["question_text"] = (paragraphs[0] if paragraphs else text)[:1500]

    link = div.find("a", href=True)
    if link:
        href = link["href"]
        if not href.startswith("http"):
            href = f"{PQ_BASE}{href}"
        q["source_url"] = href

    return q if len(q.get("question_text", "")) >= 10 else None


# ── Committee memberships (run once per pipeline, not per candidate) ──────────

async def scrape_committee_memberships(client: httpx.AsyncClient) -> dict[str, list[str]]:
    """
    Scrapes the parliament.mt committees page to build a map of
    { mp_name_normalised: [committee_name, ...] }

    Called once per pipeline run; the caller matches names to candidate IDs.
    """
    committees_url = "https://parlament.mt/en/14th-leg/committees/"
    memberships: dict[str, list[str]] = {}

    try:
        resp = await client.get(committees_url, timeout=20, follow_redirects=True)
        if resp.status_code != 200:
            print(f"  ⚠ Committees page returned {resp.status_code}")
            return memberships

        soup = BeautifulSoup(resp.text, "html.parser")

        # Find committee links
        committee_links: list[tuple[str, str]] = []
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "/committees/" in href and href != committees_url:
                name = a.get_text(strip=True)
                if name and len(name) > 5:
                    if not href.startswith("http"):
                        href = f"{PQ_BASE}{href}"
                    committee_links.append((name, href))

        committee_links = list({url: name for name, url in committee_links}.items())

        for committee_url, committee_name in committee_links[:30]:
            try:
                cr = await client.get(committee_url, timeout=15, follow_redirects=True)
                if cr.status_code != 200:
                    continue

                csoup = BeautifulSoup(cr.text, "html.parser")

                # Look for member lists in the committee page
                for member_el in csoup.select("li, tr, .member, .committee-member"):
                    member_text = member_el.get_text(strip=True)
                    # Skip short or obviously non-name entries
                    if 5 < len(member_text) < 80 and not any(
                        kw in member_text.lower()
                        for kw in ["committee", "kumitat", "parliament", "parlament", "malta"]
                    ):
                        key = _normalise_name(member_text)
                        if key:
                            memberships.setdefault(key, [])
                            if committee_name not in memberships[key]:
                                memberships[key].append(committee_name)

                await asyncio.sleep(RATE_LIMIT)
            except Exception as e:
                print(f"    ⚠ Committee scrape error ({committee_url}): {e}")

    except Exception as e:
        print(f"  ⚠ Committees index error: {e}")

    return memberships


def _normalise_name(name: str) -> str:
    """Lowercase + strip titles/honorifics for fuzzy name matching."""
    remove = ["hon.", "dr.", "prof.", "mr.", "ms.", "mrs.", "rev.", "mp", "mep", "lm.", "(hon)"]
    n = name.lower().strip()
    for prefix in remove:
        n = n.replace(prefix, "")
    return " ".join(n.split())


def match_committee_memberships(
    memberships: dict[str, list[str]],
    candidate_name: str,
) -> list[str]:
    """Returns committee names for a candidate, using fuzzy last-name matching."""
    last = candidate_name.strip().split()[-1].lower()
    first = candidate_name.strip().split()[0].lower() if len(candidate_name.split()) > 1 else ""

    for key, committees in memberships.items():
        if last in key and (not first or first in key):
            return committees

    return []
