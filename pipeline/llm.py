"""
LLM router — Groq (cloud) or Ollama (local).

Set GROQ_API_KEY env var to use Groq; otherwise falls back to Ollama
at OLLAMA_URL (default http://localhost:11434).

Usage:
    from llm import chat, parse_json, USE_GROQ

    raw = await chat(system_prompt, user_prompt)
    data = parse_json(raw)
"""

import json
import os
import re

import httpx

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL   = "llama-3.1-8b-instant"

OLLAMA_URL   = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = "llama3.1:8b"

USE_GROQ = bool(GROQ_API_KEY)


async def chat(
    system:    str,
    user:      str,
    *,
    json_mode: bool = True,
    timeout:   int  = 120,
) -> str:
    """
    Returns the raw content string from the LLM.
    Routes to Groq if GROQ_API_KEY is set, otherwise Ollama.
    Raises httpx.HTTPStatusError on non-2xx responses.
    """
    if USE_GROQ:
        return await _groq(system, user, json_mode=json_mode, timeout=timeout)
    return await _ollama(system, user, json_mode=json_mode, timeout=timeout)


async def _groq(system: str, user: str, *, json_mode: bool, timeout: int) -> str:
    body: dict = {
        "model":       GROQ_MODEL,
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            GROQ_URL,
            json=body,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type":  "application/json",
            },
            timeout=timeout,
        )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"].strip()


async def _ollama(system: str, user: str, *, json_mode: bool, timeout: int) -> str:
    body: dict = {
        "model":   OLLAMA_MODEL,
        "stream":  False,
        "options": {"temperature": 0.2},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
    }
    if json_mode:
        body["format"] = "json"

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{OLLAMA_URL}/api/chat",
            json=body,
            timeout=timeout,
        )
    resp.raise_for_status()
    return resp.json()["message"]["content"].strip()


def parse_json(raw: str) -> dict | list:
    """Strip accidental markdown fences and parse JSON."""
    raw = re.sub(r"^```(?:json)?\s*", "", raw.strip())
    raw = re.sub(r"\s*```$",           "", raw)
    return json.loads(raw)
