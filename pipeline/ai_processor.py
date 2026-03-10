"""
ai_processor.py — Send parsed PDF text to an LLM via OpenRouter for structured extraction.

Uses the OpenAI-compatible API. Set OPENROUTER_API_KEY in your .env.
Default model: google/gemini-2.0-flash (fast + cheap). Override with OPENROUTER_MODEL.

Returns a dict matching the database schema.
"""

import json
import logging
import os
from typing import Optional

from openai import OpenAI

logger = logging.getLogger(__name__)

client = OpenAI(
    api_key=os.environ["OPENROUTER_API_KEY"],
    base_url="https://openrouter.ai/api/v1",
)

MODEL = os.environ.get("OPENROUTER_MODEL") or "google/gemini-2.0-flash"

# Token budget per call
MAX_INPUT_CHARS = 60_000  # ~15k tokens — leaves room for output


SYSTEM_PROMPT = """You are a civic journalist assistant specializing in local government documents.
You read government meeting documents and extract structured information accurately.
Always return valid JSON. Never invent information not present in the document."""


EXTRACTION_PROMPT = """Extract the following from this government meeting document.
Return ONLY a JSON object with exactly these keys:

{
  "committee_type": "city_council" | "planning_commission" | "bza" | "other",
  "meeting_date": "YYYY-MM-DD",
  "title": "Official meeting title (e.g. 'City Council Regular Meeting')",
  "summary": "2–4 sentence plain-English summary of what happened. Mention key decisions, votes, and outcomes. Write for a general Duluth resident who didn't attend.",
  "agenda_items": [
    {
      "item_number": "1" or "A" or "2.a" etc.,
      "description": "Brief description of this agenda item",
      "outcome": "approved" | "denied" | "tabled" | "discussed" | null
    }
  ],
  "properties": [
    {
      "address": "Full street address as written in document",
      "parcel_id": "Parcel/PIN number if mentioned, else null",
      "context": "1–2 sentence context of why this property was mentioned"
    }
  ],
  "people": [
    {
      "full_name": "Full name",
      "role": "council_member" | "staff" | "applicant" | "attorney" | "other",
      "title": "Job title or designation if stated, else null",
      "context": "1 sentence about this person's role in the meeting"
    }
  ]
}

Rules:
- meeting_date: infer from document text; use null if truly not found
- For agenda_items: include all substantive items; skip procedural items like "Call to Order"
- For outcomes: "approved" if voted yes/unanimously approved; "denied" if rejected/voted no; "tabled" if deferred/continued; "discussed" if mentioned but no vote taken; null if unclear
- Properties: only include if a specific address or parcel was mentioned
- People: include all named individuals who spoke, voted, applied, or were otherwise active participants
- Do not include generic audience members unless specifically named with a role

DOCUMENT:
"""


def truncate_text(text: str, max_chars: int = MAX_INPUT_CHARS) -> str:
    """Truncate text to fit within token budget."""
    if len(text) <= max_chars:
        return text
    logger.warning(f"Truncating document from {len(text)} to {max_chars} chars")
    return text[:max_chars] + "\n\n[... document truncated ...]"


def extract_meeting_data(raw_text: str, source_url: str, committee_type_hint: str) -> Optional[dict]:
    """
    Send document text to GPT-4o and return structured extraction result.
    Returns None on failure.
    """
    truncated = truncate_text(raw_text)

    prompt = EXTRACTION_PROMPT + truncated

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0,
            response_format={"type": "json_object"},
            max_tokens=4096,
        )

        raw_json = response.choices[0].message.content
        data = json.loads(raw_json)

        # Inject source metadata
        data["source_pdf_url"] = source_url
        data["tokens_used"] = response.usage.total_tokens

        # Fall back to hint if committee_type missing or 'other' but hint is more specific
        if not data.get("committee_type") or data["committee_type"] == "other":
            if committee_type_hint != "other":
                data["committee_type"] = committee_type_hint

        logger.info(
            f"Extracted via {MODEL}: {data.get('committee_type')} meeting on {data.get('meeting_date')}, "
            f"{len(data.get('agenda_items', []))} items, "
            f"{len(data.get('properties', []))} properties, "
            f"{len(data.get('people', []))} people. "
            f"Tokens: {data['tokens_used']}"
        )
        return data

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON response: {e}")
        return None
    except Exception as e:
        logger.error(f"OpenRouter API error: {e}")
        return None


def geocode_address(address: str, city: str = "Duluth, GA") -> Optional[dict]:
    """
    Geocode an address using the Mapbox Geocoding API.
    Returns { latitude, longitude } or None.
    """
    import requests
    token = os.environ.get("MAPBOX_TOKEN")
    if not token:
        return None

    query = f"{address}, {city}"
    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{requests.utils.quote(query)}.json"

    try:
        resp = requests.get(url, params={"access_token": token, "limit": 1}, timeout=10)
        resp.raise_for_status()
        features = resp.json().get("features", [])
        if not features:
            return None
        coords = features[0]["center"]  # [longitude, latitude]
        return {"longitude": coords[0], "latitude": coords[1]}
    except Exception as e:
        logger.warning(f"Geocoding failed for '{address}': {e}")
        return None
