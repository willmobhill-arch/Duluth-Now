"""
parser.py — Download a PDF and extract clean text using pdfplumber.

Returns a dict:
  { text: str, page_count: int, is_scanned: bool }
"""

import io
import logging
import re
import tempfile
from typing import Optional

import pdfplumber
import requests

logger = logging.getLogger(__name__)

# Heuristic: if fewer than 50 chars per page on average, likely scanned
SCANNED_CHARS_THRESHOLD = 50


def download_pdf(url: str, timeout: int = 30) -> Optional[bytes]:
    """Download a PDF and return raw bytes."""
    try:
        resp = requests.get(url, timeout=timeout, headers={"User-Agent": "DuluthNow/1.0"})
        resp.raise_for_status()
        if "application/pdf" not in resp.headers.get("Content-Type", ""):
            logger.warning(f"Non-PDF content type at {url}")
        return resp.content
    except Exception as e:
        logger.error(f"Failed to download {url}: {e}")
        return None


def clean_text(text: str) -> str:
    """Remove excessive whitespace and common PDF artifacts."""
    # Collapse multiple blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Remove page number lines like "Page 1 of 12"
    text = re.sub(r'(?im)^page\s+\d+\s+of\s+\d+\s*$', '', text)
    # Remove repeated dashes/underscores used as dividers
    text = re.sub(r'[-_]{10,}', '', text)
    return text.strip()


def extract_text(pdf_bytes: bytes) -> dict:
    """
    Extract text from PDF bytes using pdfplumber.
    Returns { text, page_count, is_scanned }.
    """
    pages_text = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        page_count = len(pdf.pages)

        for page in pdf.pages:
            # Try extracting with word ordering (handles multi-column layouts better)
            page_text = page.extract_text(x_tolerance=3, y_tolerance=3) or ""

            # Strip headers/footers (first and last 2 lines of each page are often boilerplate)
            lines = page_text.splitlines()
            if len(lines) > 6:
                lines = lines[2:-2]
            pages_text.append("\n".join(lines))

    full_text = "\n\n--- PAGE BREAK ---\n\n".join(pages_text)
    full_text = clean_text(full_text)

    avg_chars = len(full_text) / max(page_count, 1)
    is_scanned = avg_chars < SCANNED_CHARS_THRESHOLD

    return {
        "text": full_text,
        "page_count": page_count,
        "is_scanned": is_scanned,
    }


def parse_pdf(url: str) -> Optional[dict]:
    """
    Download and parse a PDF from a URL.
    Returns None if download or parse fails.
    """
    logger.info(f"Downloading PDF: {url}")
    pdf_bytes = download_pdf(url)
    if not pdf_bytes:
        return None

    logger.info(f"Parsing PDF: {url} ({len(pdf_bytes):,} bytes)")
    result = extract_text(pdf_bytes)

    if result["is_scanned"]:
        logger.warning(f"PDF appears to be scanned (low text density): {url}")

    logger.info(f"Extracted {len(result['text'])} chars from {result['page_count']} pages")
    return result


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO)
    url = sys.argv[1] if len(sys.argv) > 1 else "https://www.duluthga.net/government/agendas___minutes/"
    result = parse_pdf(url)
    if result:
        print(result["text"][:2000])
