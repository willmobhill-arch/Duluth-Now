"""
main.py — Duluth Now nightly pipeline entry point.

Steps:
  1. Scrape duluthga.net for new PDF links
  2. Download and parse each PDF (pdfplumber)
  3. Extract structured data with OpenAI GPT-4o
  4. Geocode property addresses (Mapbox)
  5. Write everything to Supabase
"""

import logging
import os
import sys
from datetime import date

from dotenv import load_dotenv

load_dotenv()  # loads .env file if present (local dev); GitHub Actions uses repo secrets

from scraper import scrape
from parser import parse_pdf
from ai_processor import extract_meeting_data, geocode_address
from db import (
    upsert_meeting,
    upsert_agenda_items,
    upsert_property,
    find_or_create_person,
    insert_mention,
    log_pipeline_run,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("pipeline")


def run():
    total_tokens = 0
    errors = []

    # ── Step 1: Scrape ───────────────────────────────────────────────────────
    logger.info("=== Step 1: Scraping duluthga.net ===")
    new_pdfs = scrape()
    pdfs_found = len(new_pdfs)
    logger.info(f"Found {pdfs_found} new PDF(s) to process")

    if not new_pdfs:
        log_pipeline_run(0, 0, 0, "success")
        logger.info("Nothing new. Pipeline complete.")
        return

    # ── Step 2–5: Process each PDF ───────────────────────────────────────────
    pdfs_processed = 0

    for pdf_meta in new_pdfs:
        url = pdf_meta["url"]
        committee_hint = pdf_meta["committee_type"]
        logger.info(f"\n--- Processing: {url} ---")

        # Parse
        parse_result = parse_pdf(url)
        if not parse_result:
            errors.append(f"Parse failed: {url}")
            continue

        if parse_result["is_scanned"]:
            logger.warning(f"Scanned PDF — extraction may be poor: {url}")

        # AI extraction
        extracted = extract_meeting_data(parse_result["text"], url, committee_hint)
        if not extracted:
            errors.append(f"AI extraction failed: {url}")
            continue

        total_tokens += extracted.get("tokens_used", 0)

        # Validate required fields
        if not extracted.get("meeting_date"):
            logger.warning(f"No meeting_date extracted for {url} — skipping")
            errors.append(f"No date: {url}")
            continue

        try:
            # ── Write meeting ─────────────────────────────────────────────────
            meeting_id = upsert_meeting(extracted)
            logger.info(f"Meeting upserted: {meeting_id}")

            # ── Write agenda items ────────────────────────────────────────────
            agenda_item_ids = upsert_agenda_items(meeting_id, extracted.get("agenda_items", []))
            logger.info(f"Inserted {len(agenda_item_ids)} agenda items")

            today_str = date.today().isoformat()

            # ── Write properties + mentions ───────────────────────────────────
            for prop in extracted.get("properties", []):
                address = prop.get("address", "").strip()
                if not address:
                    continue

                geocode = geocode_address(address)
                property_id = upsert_property(address, prop.get("parcel_id"), geocode)
                insert_mention(
                    meeting_id=meeting_id,
                    agenda_item_id=None,
                    entity_type="property",
                    entity_id=property_id,
                    context_snippet=prop.get("context"),
                )
                logger.info(f"  Property: {address} → {property_id}")

            # ── Write people + mentions ────────────────────────────────────────
            for person in extracted.get("people", []):
                name = person.get("full_name", "").strip()
                if not name:
                    continue

                person_id = find_or_create_person(
                    full_name=name,
                    role=person.get("role", "other"),
                    title=person.get("title"),
                    first_seen=today_str,
                )
                insert_mention(
                    meeting_id=meeting_id,
                    agenda_item_id=None,
                    entity_type="person",
                    entity_id=person_id,
                    context_snippet=person.get("context"),
                )
                logger.info(f"  Person: {name} → {person_id}")

            pdfs_processed += 1

        except Exception as e:
            logger.error(f"Database write failed for {url}: {e}", exc_info=True)
            errors.append(f"DB error for {url}: {e}")

    # ── Log pipeline run ─────────────────────────────────────────────────────
    status = "success" if not errors else ("partial" if pdfs_processed > 0 else "error")
    error_msg = "\n".join(errors) if errors else None

    log_pipeline_run(
        pdfs_found=pdfs_found,
        pdfs_new=pdfs_processed,
        tokens_used=total_tokens,
        status=status,
        error_message=error_msg,
    )

    logger.info(
        f"\n=== Pipeline complete: {pdfs_processed}/{pdfs_found} PDFs processed, "
        f"{total_tokens:,} tokens used, status={status} ==="
    )

    if errors:
        logger.warning(f"Errors:\n" + "\n".join(errors))
        sys.exit(1 if status == "error" else 0)


if __name__ == "__main__":
    run()
