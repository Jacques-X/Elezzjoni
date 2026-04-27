"""
Phase 2: Parliamentary Voting Records
======================================

Scrapes voting records from Malta's Parliament website by extracting
voting data from Plenary Session PDF Minutes. The voting information
is not available in HTML; it's embedded in official PDF documents.

Strategy:
  1. Fetch Plenary Session index: https://parlament.mt/en/14th-leg/plenary-session/
  2. Find links to individual sessions
  3. For each session, locate "Minutes: Download the Document" link
  4. Download PDF to memory
  5. Extract text and search for "Diviżjoni", "Iva", "Le" (voting keywords)
  6. Extract surrounding context (~800 words)
  7. Pass to LLM for structured vote parsing

All data is public record; no authentication required.
"""

import asyncio
import io
import json
import re
import time
from typing import Optional
from datetime import datetime, timezone

import httpx
import pdfplumber
from bs4 import BeautifulSoup
from llm import chat as llm_chat, parse_json as llm_parse_json

# ── Rate limiting ──────────────────────────────────────────────────────────────
# Respectful delays to avoid overloading Parliament servers
RATE_LIMIT_DELAY = 2.0  # seconds between requests
RATE_LIMIT_PDF = 3.0    # seconds between PDF downloads


# ── Plenary Session Index ──────────────────────────────────────────────────────

async def fetch_plenary_sessions(
    client: httpx.AsyncClient,
) -> list[dict]:
    """
    Fetches the main Plenary Session page and extracts links to individual sessions.

    Returns list of { session_name, session_url, parliament_leg }.
    Example: { "2nd December 2024", "https://parlament.mt/en/14th-leg/plenary-session/2nd-december-2024/", "14th" }
    """
    sessions: list[dict] = []

    try:
        plenary_index_url = "https://parlament.mt/en/14th-leg/plenary-session/"

        resp = await client.get(
            plenary_index_url,
            timeout=15,
            follow_redirects=True,
        )

        soup = BeautifulSoup(resp.text, "html.parser")

        # Look for session links — typically in divs with session names and dates
        # HTML structure varies; look for common patterns
        for link in soup.select("a[href*='/plenary-session/']"):
            href = link.get("href", "")
            text = link.get_text(strip=True)

            # Skip the index page itself
            if href.endswith("/plenary-session/"):
                continue

            # Extract parliament leg from URL
            leg_match = re.search(r"/(\d+\w+)-leg/", href)
            leg = leg_match.group(1) if leg_match else "unknown"

            if href.startswith("http"):
                sessions.append({
                    "session_name": text,
                    "session_url": href,
                    "parliament_leg": leg,
                })

        print(f"  ✓ Found {len(sessions)} plenary sessions")

    except Exception as e:
        print(f"  ⚠ Failed to fetch plenary sessions: {e}")

    return sessions


# ── Session Minutes Download ───────────────────────────────────────────────────

async def fetch_session_minutes_pdf(
    session_url: str,
    client: httpx.AsyncClient,
) -> Optional[bytes]:
    """
    Fetches a plenary session page and finds the PDF link labeled "Minutes: Download the Document".
    Downloads the PDF and returns the raw bytes.

    Returns: PDF content as bytes, or None if not found or download fails.
    """
    try:
        resp = await client.get(
            session_url,
            timeout=15,
            follow_redirects=True,
        )

        soup = BeautifulSoup(resp.text, "html.parser")

        # Look for links containing "Minutes" or "Document" near each other
        # The exact text is "Minutes: Download the Document" or similar
        pdf_link = None

        # Strategy 1: Look for explicit "Minutes" link
        for link in soup.select("a"):
            text = link.get_text(strip=True).lower()
            href = link.get("href", "")

            if ("minutes" in text or "download" in text) and href.endswith(".pdf"):
                pdf_link = href
                break

        # Strategy 2: Look in divs with document section headers
        if not pdf_link:
            for div in soup.select("div"):
                div_text = div.get_text(strip=True).lower()
                if "documents" in div_text or "minutes" in div_text:
                    # Look for PDF links within this section
                    for link in div.select("a[href$='.pdf']"):
                        pdf_link = link.get("href", "")
                        if pdf_link:
                            break
                if pdf_link:
                    break

        # Make URL absolute if it's relative
        if pdf_link and not pdf_link.startswith("http"):
            base = session_url.rsplit("/", 1)[0]
            pdf_link = f"{base}/{pdf_link}" if not pdf_link.startswith("/") else f"https://parlament.mt{pdf_link}"

        if not pdf_link:
            return None

        # Rate limit before PDF download
        await asyncio.sleep(RATE_LIMIT_PDF)

        # Download PDF
        pdf_resp = await client.get(
            pdf_link,
            timeout=20,
            follow_redirects=True,
        )

        if pdf_resp.status_code == 200:
            return pdf_resp.content

    except Exception as e:
        print(f"    ⚠ Failed to fetch minutes PDF from {session_url}: {e}")

    return None


# ── PDF Text Extraction ────────────────────────────────────────────────────────

async def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Extracts all text from a PDF using pdfplumber.
    Returns the concatenated text from all pages.
    """
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            text = ""
            for page in pdf.pages:
                text += page.extract_text() or ""
                text += "\n"
            return text
    except Exception as e:
        print(f"    ⚠ Failed to extract text from PDF: {e}")
        return ""


# ── Vote Extraction ────────────────────────────────────────────────────────────

async def extract_votes_from_pdf(
    pdf_text: str,
) -> list[dict]:
    """
    Searches the PDF text for voting keywords ("Diviżjoni", "Iva", "Le") and
    extracts surrounding context (~800 words) for LLM parsing.

    Returns list of { vote_section_text, keywords_found, position_in_text }.
    """
    vote_sections: list[dict] = []

    # Keywords indicating a vote or division
    vote_keywords = [
        r"\bdiviżjoni\b",           # Maltese for "division" (vote)
        r"\biva\b",                 # Maltese for "yes"
        r"\ble\b",                  # Maltese for "no"
    ]

    # Search for keyword matches
    matches = []
    for pattern in vote_keywords:
        for match in re.finditer(pattern, pdf_text, re.IGNORECASE):
            matches.append({
                "keyword": match.group(0),
                "position": match.start(),
            })

    # Sort by position
    matches.sort(key=lambda m: m["position"])

    # Extract context around each match (~800 words)
    word_context = 400  # 400 words before + 400 words after = ~800 total

    processed_positions = set()

    for match in matches:
        pos = match["position"]

        # Skip if we've already processed a match very close to this one
        if any(abs(pos - p) < 500 for p in processed_positions):
            continue

        processed_positions.add(pos)

        # Extract words around this position
        # Go back 'word_context' words
        before = pdf_text[:pos].split()[-word_context:]
        after = pdf_text[pos:].split()[:word_context]

        context_text = " ".join(before + after)

        vote_sections.append({
            "vote_section_text": context_text,
            "keywords_found": [m["keyword"] for m in matches if abs(m["position"] - pos) < 500],
            "position_in_text": pos,
        })

    return vote_sections


# ── LLM-based Vote Parsing ────────────────────────────────────────────────────

async def extract_votes_via_llm(
    text_chunk: str,
    candidate_names: list[str],
    ollama_url: str = "http://localhost:11434",
    ollama_model: str = "llama3.1:8b",
) -> Optional[dict]:
    """
    Parses a vote section using Ollama to extract structured voting data.

    Extracts:
      - Vote type (e.g., "Third Reading", "Adjournment")
      - Bill/Motion name
      - MP names → voting choice ("yes"/"iva", "no"/"le", "abstain")

    Args:
        text_chunk: ~800 words of context around voting keywords
        candidate_names: List of MP/candidate names to match against
        ollama_url: Ollama server URL
        ollama_model: Model name (default llama3.1:8b)

    Returns:
    {
        "vote_type": "Third Reading",
        "bill_name": "Some Act Amendment",
        "votes": {
            "MP Name": "yes",
            "Another MP": "no",
        },
        "confidence": 0.85
    }
    Or None if parsing fails.
    """

    system_prompt = (
        "You are analyzing a Maltese Parliament voting record from official meeting minutes. "
        "Extract the following from the text:\n"
        "1. vote_type: Type of vote (e.g., 'Third Reading', 'Adjournment Motion', 'Committee Stage')\n"
        "2. bill_name: The name of the bill or motion being voted on\n"
        "3. votes: A dictionary mapping MP names to their vote choice ('yes', 'no', 'abstain')\n"
        "\n"
        "The text may contain Maltese voting keywords:\n"
        "- 'Iva' or 'Ivas' = 'yes'\n"
        "- 'Le' or 'Les' = 'no'\n"
        "- 'Imtaħħad' or 'Astensjoni' = 'abstain'\n"
        "- 'Diviżjoni' = indicates a vote/division\n"
        "\n"
        "Return ONLY a valid JSON object with these exact keys: "
        "vote_type (string), bill_name (string), votes (object mapping name → choice), "
        "confidence (0-1 float indicating how confident you are in the parsing). "
        "If you cannot parse meaningful vote data, return confidence of 0.0. "
        "No markdown, no extra text."
    )

    user_prompt = f"""
Parse this Parliament voting excerpt. Match the vote choices to these MP/candidate names if they appear:
{', '.join(candidate_names)}

---TEXT---
{text_chunk}
---END---

Return JSON only.
"""

    try:
        raw    = await llm_chat(system_prompt, user_prompt, timeout=30)
        parsed = llm_parse_json(raw)

        # Validate structure
        if not all(key in parsed for key in ["vote_type", "bill_name", "votes", "confidence"]):
            return None

        if not isinstance(parsed.get("votes"), dict):
            parsed["votes"] = {}

        parsed["confidence"] = float(parsed.get("confidence", 0.0))
        return parsed

    except json.JSONDecodeError:
        return None
    except Exception as e:
        print(f"    ⚠ LLM parsing failed: {e}")
        return None


# ── Session Pipeline ───────────────────────────────────────────────────────────

async def scrape_session_votes(
    session_url: str,
    candidate_names: list[str],
    client: httpx.AsyncClient,
    ollama_url: str = "http://localhost:11434",
    ollama_model: str = "llama3.1:8b",
) -> dict:
    """
    Full pipeline for a single plenary session:
    1. Fetch session page and find PDF
    2. Download PDF
    3. Extract text
    4. Find vote sections
    5. Parse votes via LLM

    Returns { session_name, votes_found (list of vote records) }.
    """

    # Extract session name from URL
    session_name = session_url.strip("/").split("/")[-1]

    print(f"   📄 fetching session: {session_name}")

    # Rate limit
    await asyncio.sleep(RATE_LIMIT_DELAY)

    # Fetch PDF
    pdf_bytes = await fetch_session_minutes_pdf(session_url, client)
    if not pdf_bytes:
        print(f"   ⚠ no PDF found for {session_name}")
        return {
            "session_name": session_name,
            "votes_found": [],
        }

    print(f"   📦 extracted PDF ({len(pdf_bytes)} bytes)")

    # Extract text from PDF
    pdf_text = await extract_text_from_pdf(pdf_bytes)
    if not pdf_text:
        print(f"   ⚠ could not extract text from PDF")
        return {
            "session_name": session_name,
            "votes_found": [],
        }

    print(f"   📝 extracted {len(pdf_text)} chars from PDF")

    # Find vote sections
    vote_sections = await extract_votes_from_pdf(pdf_text)
    print(f"   ✓ found {len(vote_sections)} potential vote section(s)")

    # Parse each section with LLM
    votes_found = []
    for i, section in enumerate(vote_sections):
        vote_data = await extract_votes_via_llm(
            section["vote_section_text"],
            candidate_names,
            ollama_url,
            ollama_model,
        )
        if vote_data and vote_data.get("confidence", 0) > 0.3:
            votes_found.append({
                **vote_data,
                "raw_text_excerpt": section["vote_section_text"][:500] + "…",
            })

    return {
        "session_name": session_name,
        "votes_found": votes_found,
    }


# ── Entry Point ────────────────────────────────────────────────────────────────

async def scrape_parliamentary_votes(
    candidate_names: list[str],
    limit_sessions: Optional[int] = None,
    ollama_url: str = "http://localhost:11434",
    ollama_model: str = "llama3.1:8b",
) -> list[dict]:
    """
    Main entry point for Phase 2 parliamentary voting scraper.

    Args:
        candidate_names: List of MP/candidate names to extract votes for
        limit_sessions: If set, only scrape this many sessions (useful for testing)
        ollama_url: Ollama server URL
        ollama_model: Model name for vote parsing

    Returns: List of session results with extracted votes.
    """

    results: list[dict] = []

    async with httpx.AsyncClient(headers={
        "User-Agent": "Mozilla/5.0 (compatible; Kandidati/1.0)"
    }) as client:

        print("  Fetching parliament plenary session index…\n")

        # Get all plenary sessions
        sessions = await fetch_plenary_sessions(client)

        if not sessions:
            print("  No sessions found")
            return results

        # Limit for testing
        if limit_sessions:
            sessions = sessions[:limit_sessions]

        print(f"  Processing {len(sessions)} session(s)…\n")

        for i, session in enumerate(sessions, 1):
            print(f"  [{i}/{len(sessions)}] {session['session_name']}")

            session_result = await scrape_session_votes(
                session["session_url"],
                candidate_names,
                client,
                ollama_url,
                ollama_model,
            )

            session_result["session_url"] = session["session_url"]
            session_result["parliament_leg"] = session["parliament_leg"]
            session_result["fetched_at"] = datetime.now(timezone.utc).isoformat()

            results.append(session_result)

            print()

    return results
