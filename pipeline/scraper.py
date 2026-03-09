"""
scraper.py — Crawl duluthga.net and collect PDF links for meeting documents.

Returns a list of dicts:
  { url: str, committee_type: str, raw_title: str }

Only returns PDFs not already in the `meetings` table.
"""

import re
import logging
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from db import get_processed_urls

logger = logging.getLogger(__name__)

BASE_URL = "https://www.duluthga.net"

# Pages to crawl for meeting documents
MEETING_PAGES = [
    {
        "url": f"{BASE_URL}/government/agendas___minutes/",
        "committee_type": "city_council",
    },
    {
        "url": f"{BASE_URL}/government/planning_commission.php",
        "committee_type": "planning_commission",
    },
    {
        "url": f"{BASE_URL}/government/board_of_zoning_appeals.php",
        "committee_type": "bza",
    },
]

# Additional sub-pages discovered during crawl (committee agendas index pages)
AGENDAS_INDEX_PATTERNS = [
    r"agendas",
    r"minutes",
    r"agenda.*minutes",
]


def classify_committee(url: str, page_committee: str) -> str:
    """Refine committee type from URL text hints."""
    url_lower = url.lower()
    if "planning" in url_lower:
        return "planning_commission"
    if "bza" in url_lower or "zoning_appeal" in url_lower:
        return "bza"
    if "council" in url_lower:
        return "city_council"
    return page_committee


def extract_pdf_links(html: str, base_url: str, committee_type: str) -> list[dict]:
    """Parse HTML and extract all .pdf links with basic metadata."""
    soup = BeautifulSoup(html, "html.parser")
    results = []

    for a in soup.find_all("a", href=True):
        href: str = a["href"]
        if not href.lower().endswith(".pdf"):
            continue

        full_url = urljoin(base_url, href)
        link_text = a.get_text(strip=True) or href.split("/")[-1]
        ct = classify_committee(full_url, committee_type)

        results.append({
            "url": full_url,
            "committee_type": ct,
            "raw_title": link_text,
        })

    return results


def fetch_page(url: str, timeout: int = 20) -> Optional[str]:
    """Fetch a URL and return HTML text, or None on error."""
    try:
        resp = requests.get(url, timeout=timeout, headers={"User-Agent": "DuluthNow/1.0"})
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        logger.warning(f"Failed to fetch {url}: {e}")
        return None


def discover_sub_pages(html: str, base_url: str) -> list[str]:
    """Find sub-pages linked from a meeting index page that may list more PDFs."""
    soup = BeautifulSoup(html, "html.parser")
    sub_pages = []

    for a in soup.find_all("a", href=True):
        href: str = a["href"]
        text = a.get_text(strip=True).lower()
        if any(re.search(pat, text) for pat in AGENDAS_INDEX_PATTERNS):
            sub_pages.append(urljoin(base_url, href))
        elif any(re.search(pat, href.lower()) for pat in AGENDAS_INDEX_PATTERNS):
            sub_pages.append(urljoin(base_url, href))

    # deduplicate
    return list(dict.fromkeys(sub_pages))


def scrape() -> list[dict]:
    """
    Main entry point. Returns new PDFs not yet in the database.
    """
    already_processed = get_processed_urls()
    all_pdfs: list[dict] = []
    seen_urls: set[str] = set()

    for page_config in MEETING_PAGES:
        page_url = page_config["url"]
        committee_type = page_config["committee_type"]

        logger.info(f"Crawling: {page_url}")
        html = fetch_page(page_url)
        if not html:
            continue

        # Direct PDF links on the page
        pdfs = extract_pdf_links(html, page_url, committee_type)
        for pdf in pdfs:
            if pdf["url"] not in seen_urls:
                seen_urls.add(pdf["url"])
                all_pdfs.append(pdf)

        # Also check sub-pages (e.g. year-specific archive pages)
        sub_pages = discover_sub_pages(html, page_url)
        for sub_url in sub_pages[:10]:  # limit to avoid crawl sprawl
            logger.info(f"  Sub-page: {sub_url}")
            sub_html = fetch_page(sub_url)
            if not sub_html:
                continue
            sub_pdfs = extract_pdf_links(sub_html, sub_url, committee_type)
            for pdf in sub_pdfs:
                if pdf["url"] not in seen_urls:
                    seen_urls.add(pdf["url"])
                    all_pdfs.append(pdf)

    # Filter out already-processed PDFs
    new_pdfs = [p for p in all_pdfs if p["url"] not in already_processed]

    logger.info(f"Found {len(all_pdfs)} total PDFs, {len(new_pdfs)} new")
    return new_pdfs


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    results = scrape()
    for r in results[:5]:
        print(r)
