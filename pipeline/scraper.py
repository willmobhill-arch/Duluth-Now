"""
scraper.py — Crawl duluthga.net and collect PDF links for meeting documents.

Returns a list of dicts:
  { url: str, committee_type: str, raw_title: str }

Only returns PDFs not already in the `meetings` table.

URL notes for duluthga.net:
- The site uses a <base> tag pointing to the site root, so all hrefs are
  root-relative (e.g. "03-09-2026 Agenda.pdf?t=...").
- Meeting PDFs always have a ?t= cache-busting timestamp; sidebar/nav PDFs don't.
- We hit the per-committee subpages directly (no crawling needed).
"""

import logging
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from db import get_processed_urls

logger = logging.getLogger(__name__)

BASE_URL = "https://www.duluthga.net"

# Direct URLs to each committee's agendas & minutes page
MEETING_PAGES = [
    {
        "url": f"{BASE_URL}/government/agendas___minutes/mayor___council_agendas___minutes.php",
        "committee_type": "city_council",
    },
    {
        "url": f"{BASE_URL}/government/agendas___minutes/planning_commission_agendas___minutes.php",
        "committee_type": "planning_commission",
    },
    {
        "url": f"{BASE_URL}/government/agendas___minutes/zoning_board_of_appeals_agendas___minutes.php",
        "committee_type": "bza",
    },
]


def get_base_href(soup: BeautifulSoup) -> str:
    """
    duluthga.net embeds a <base href="..."> tag. Use it as the base for urljoin
    so root-relative hrefs resolve correctly (instead of resolving relative to
    the current page path, which would double the subdirectory).
    """
    tag = soup.find("base")
    if tag and tag.get("href"):
        return tag["href"]
    return BASE_URL


def classify_committee(url: str, page_committee: str) -> str:
    """Refine committee type from URL hints."""
    u = url.lower()
    if "planning" in u:
        return "planning_commission"
    if "zoning" in u or "appeals" in u or "bza" in u:
        return "bza"
    if "council" in u or "mayor" in u:
        return "city_council"
    return page_committee


def extract_pdf_links(html: str, committee_type: str) -> list[dict]:
    """
    Parse HTML and return meeting document PDF links.
    Filters to links with .pdf AND ?t= timestamp (CMS-served meeting docs).
    Sidebar/nav PDFs (proclamation, ballot, etc.) lack the ?t= param.
    """
    soup = BeautifulSoup(html, "html.parser")
    base = get_base_href(soup)
    results = []

    for a in soup.find_all("a", href=True):
        href: str = a["href"]
        # Must contain .pdf (may have ?t= query string after)
        if ".pdf" not in href.lower():
            continue
        # ?t= timestamp distinguishes CMS meeting docs from static sidebar PDFs
        if "?t=" not in href:
            continue

        full_url = urljoin(base, href)
        link_text = (
            a.get_text(strip=True)
            .replace("Opens in new window", "")
            .strip()
        )
        ct = classify_committee(full_url, committee_type)

        results.append({
            "url": full_url,
            "committee_type": ct,
            "raw_title": link_text or href.split("/")[-1].split("?")[0],
        })

    return results


def fetch_page(url: str, timeout: int = 20) -> Optional[str]:
    """Fetch a URL and return HTML, or None on error."""
    try:
        resp = requests.get(
            url,
            timeout=timeout,
            headers={"User-Agent": "DuluthNow/1.0"},
        )
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        logger.warning(f"Failed to fetch {url}: {e}")
        return None


def scrape() -> list[dict]:
    """Main entry point. Returns new PDFs not yet in the database."""
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

        pdfs = extract_pdf_links(html, committee_type)
        logger.info(f"  Found {len(pdfs)} PDF links")
        for pdf in pdfs:
            if pdf["url"] not in seen_urls:
                seen_urls.add(pdf["url"])
                all_pdfs.append(pdf)

    new_pdfs = [p for p in all_pdfs if p["url"] not in already_processed]
    logger.info(f"Found {len(all_pdfs)} total PDFs, {len(new_pdfs)} new")
    return new_pdfs


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    results = scrape()
    for r in results[:5]:
        print(r)
