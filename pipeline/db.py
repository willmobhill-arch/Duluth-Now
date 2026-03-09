"""
db.py — Supabase client and upsert helpers for the pipeline.
"""

import os
from supabase import create_client, Client

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_KEY"]
        _client = create_client(url, key)
    return _client


def get_processed_urls() -> set[str]:
    """Return all source_pdf_url values already in the meetings table."""
    client = get_client()
    resp = client.table("meetings").select("source_pdf_url").execute()
    return {row["source_pdf_url"] for row in (resp.data or [])}


def upsert_meeting(extracted: dict) -> str:
    """
    Insert a meeting row and return its UUID.
    extracted keys: committee_type, meeting_date, title, summary, source_pdf_url
    """
    client = get_client()
    row = {
        "committee_type": extracted["committee_type"],
        "meeting_date":   extracted["meeting_date"],
        "title":          extracted["title"],
        "summary":        extracted.get("summary"),
        "source_pdf_url": extracted["source_pdf_url"],
    }
    resp = client.table("meetings").upsert(row, on_conflict="source_pdf_url").execute()
    return resp.data[0]["id"]


def upsert_agenda_items(meeting_id: str, items: list[dict]) -> list[str]:
    """Insert agenda items for a meeting. Returns list of inserted IDs."""
    client = get_client()
    rows = [
        {
            "meeting_id":   meeting_id,
            "item_number":  item["item_number"],
            "description":  item["description"],
            "outcome":      item.get("outcome"),
            "raw_text":     item.get("raw_text"),
        }
        for item in items
    ]
    if not rows:
        return []
    resp = client.table("agenda_items").insert(rows).execute()
    return [r["id"] for r in resp.data]


def upsert_property(address: str, parcel_id: str | None, geocode: dict | None) -> str:
    """
    Upsert a property by address and return its UUID.
    """
    client = get_client()
    row = {
        "address":   address,
        "parcel_id": parcel_id,
    }
    if geocode:
        row["latitude"]  = geocode["latitude"]
        row["longitude"] = geocode["longitude"]

    resp = client.table("properties").upsert(row, on_conflict="address").execute()
    return resp.data[0]["id"]


def find_or_create_person(full_name: str, role: str, title: str | None, first_seen: str) -> str:
    """
    Find existing person by name (case-insensitive) or create a new one.
    Returns the person UUID.
    """
    client = get_client()

    # Fuzzy match: exact name (case-insensitive)
    resp = client.table("people").select("id").ilike("full_name", full_name).limit(1).execute()
    if resp.data:
        return resp.data[0]["id"]

    # Create new
    row = {
        "full_name":       full_name,
        "role":            role,
        "title":           title,
        "first_seen_date": first_seen,
    }
    resp = client.table("people").insert(row).execute()
    return resp.data[0]["id"]


def insert_mention(
    meeting_id: str,
    agenda_item_id: str | None,
    entity_type: str,
    entity_id: str,
    context_snippet: str | None,
):
    client = get_client()
    client.table("meeting_mentions").insert({
        "meeting_id":     meeting_id,
        "agenda_item_id": agenda_item_id,
        "entity_type":    entity_type,
        "entity_id":      entity_id,
        "context_snippet": context_snippet,
    }).execute()


def log_pipeline_run(
    pdfs_found: int,
    pdfs_new: int,
    tokens_used: int,
    status: str,
    error_message: str | None = None,
):
    client = get_client()
    client.table("pipeline_runs").insert({
        "pdfs_found":    pdfs_found,
        "pdfs_new":      pdfs_new,
        "tokens_used":   tokens_used,
        "status":        status,
        "error_message": error_message,
    }).execute()
