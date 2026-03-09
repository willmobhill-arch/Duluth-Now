# Duluth Now — Design Document
*Civic information platform for Duluth, GA*
*Created: 2026-03-08*

---

## Overview

Duluth Now is a public-facing civic transparency website that automatically ingests government meeting PDFs from the City of Duluth, GA, extracts structured data using AI, and presents it in a searchable, interactive format. Residents can read plain-English meeting summaries, click on any property or official mentioned to see their full profile, and explore all zoning activity on an interactive map.

**Primary audience:** General Duluth residents — people who want to stay informed about their city but don't have time to read dense government PDFs.

**Core value proposition:** Every meeting, every property decision, every named official — connected, searchable, and explained in plain English.

---

## Architecture

### Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router) |
| Hosting | Vercel (free tier) |
| Database | Supabase (Postgres + PostGIS) |
| Automated pipeline | GitHub Actions (nightly cron) |
| AI processing | OpenAI GPT-4o |
| Map | Mapbox GL JS |
| Geocoding | Mapbox Geocoding API |
| Property/parcel data | Gwinnett County ArcGIS REST API |
| PDF parsing | pdfplumber (Python, runs in GitHub Actions) |

### System Diagram

```
City of Duluth Website (duluthga.net)
        │  PDFs (agendas / minutes)
        ▼
GitHub Actions — nightly cron job
  ├── 1. Scraper: detect new PDFs, download
  ├── 2. Parser: extract text with pdfplumber
  ├── 3. AI Processor: OpenAI GPT-4o
  │     ├── Meeting summary (2-4 sentences)
  │     ├── Property addresses → geocoded
  │     └── Named officials + applicants
  └── 4. Writer: upsert into Supabase
        │
        ▼
Supabase (Postgres + PostGIS)
        │
        ▼
Next.js on Vercel
  ├── / (Home)
  ├── /meetings (Feed)
  ├── /meetings/[id] (Detail)
  ├── /map (Interactive zoning map)
  ├── /properties/[id] (Property profile)
  ├── /people/[id] (Person profile)
  └── /search (Full-text search)

External APIs:
  ├── Gwinnett County GIS — parcel / zoning / owner data
  ├── OpenAI API — summarization + entity extraction
  └── Mapbox — map tiles + geocoding
```

---

## Data Pipeline

### 1. Scraper
- Runs nightly at 2:00 AM ET via GitHub Actions cron
- Crawls `duluthga.net` for committee meeting pages
- Identifies PDF links for agendas and minutes
- Compares against `meetings.source_pdf_url` to skip already-processed documents
- Downloads new PDFs to a temporary GitHub Actions workspace

### 2. Parser
- Uses `pdfplumber` to extract raw text
- Handles multi-column layouts common in government agendas
- Strips headers/footers/page numbers to reduce noise
- Splits text into agenda item chunks where possible

### 3. AI Processor (OpenAI GPT-4o)
Two-pass approach to manage token costs:

**Pass 1 — Classification:** Determine if a page is substantive content (vs. boilerplate). Skip boilerplate.

**Pass 2 — Structured extraction prompt:**
```
Given this government meeting document, extract:
1. A 2-4 sentence plain-English summary of the meeting
2. Meeting type (City Council / Planning Commission / BZA / other)
3. Meeting date
4. All property addresses or parcel IDs mentioned — list each one
5. All named individuals — name, role (official / applicant / attorney / other)
6. For each agenda item: item number, brief description, outcome (Approved / Denied / Tabled / Discussed / No outcome)

Return as structured JSON.
```

### 4. Enrichment
- **Properties:** Geocode each address via Mapbox → query Gwinnett County ArcGIS REST API by parcel → store owner, lot size, current zoning, assessed value
- **People:** Check if person already exists in `people` table by name fuzzy match → create if new
- **Zoning cases:** Identify agenda items that constitute a formal zoning case → create/update `zoning_cases` record

### 5. Writer
- Upserts all data into Supabase via Python `supabase-py` client
- Logs token usage, PDFs processed, and any errors to a `pipeline_runs` table
- On failure: sends error summary to a configurable email address

---

## Database Schema

### `meetings`
```sql
id               uuid PRIMARY KEY
committee_type   text  -- 'city_council' | 'planning_commission' | 'bza' | 'other'
meeting_date     date
title            text
summary          text  -- AI-generated plain-English summary
source_pdf_url   text
processed_at     timestamptz
```

### `agenda_items`
```sql
id           uuid PRIMARY KEY
meeting_id   uuid REFERENCES meetings
item_number  text
description  text
outcome      text  -- 'approved' | 'denied' | 'tabled' | 'discussed' | null
raw_text     text  -- extracted text for this item
```

### `properties`
```sql
id               uuid PRIMARY KEY
address          text
parcel_id        text  -- Gwinnett County parcel ID
owner_name       text
lot_size_acres   numeric
current_zoning   text
assessed_value   numeric
latitude         numeric
longitude        numeric
geom             geometry(Point, 4326)  -- PostGIS
gwinnett_gis_url text
last_enriched_at timestamptz
```

### `people`
```sql
id             uuid PRIMARY KEY
full_name      text
role           text  -- 'council_member' | 'staff' | 'applicant' | 'attorney' | 'other'
title          text
bio_url        text  -- link to official bio if public official
first_seen_date date
```

### `meeting_mentions`
```sql
id              uuid PRIMARY KEY
meeting_id      uuid REFERENCES meetings
agenda_item_id  uuid REFERENCES agenda_items
entity_type     text  -- 'property' | 'person'
entity_id       uuid  -- references either properties.id or people.id
context_snippet text  -- the 1-2 sentences that mentioned this entity
```

### `zoning_cases`
```sql
id                uuid PRIMARY KEY
property_id       uuid REFERENCES properties
meeting_id        uuid REFERENCES meetings
agenda_item_id    uuid REFERENCES agenda_items
case_number       text
case_type         text  -- 'rezoning' | 'variance' | 'special_use' | 'annexation' | 'other'
requested_zoning  text
current_zoning    text
outcome           text  -- 'approved' | 'denied' | 'tabled' | 'pending'
decision_date     date
```

### `comments`
```sql
id           uuid PRIMARY KEY
entity_type  text  -- 'meeting' | 'property' | 'person' | 'agenda_item'
entity_id    uuid
author_name  text
author_email text  -- optional
body         text
created_at   timestamptz
is_approved  boolean DEFAULT false  -- moderated before display
```

### `pipeline_runs`
```sql
id            uuid PRIMARY KEY
run_at        timestamptz
pdfs_found    int
pdfs_new      int
tokens_used   int
status        text  -- 'success' | 'partial' | 'error'
error_message text
```

---

## Frontend Pages

### `/` — Home
- Hero with prominent search bar ("Search meetings, addresses, or people in Duluth")
- Recent Meetings feed: 5 most recent, each with committee badge, date, AI summary, and counts of properties/people mentioned
- Mini zoning map preview with CTA to full map
- "How this works" explainer section for new visitors

### `/meetings` — Meetings Feed
- Filterable by: committee type, date range, keyword
- Each card: committee badge, date, title, AI summary excerpt, property + person mention counts
- Infinite scroll or pagination

### `/meetings/[id]` — Meeting Detail
- Full AI summary at top
- "Source Document" button linking to original PDF
- Each agenda item listed with outcome badge
- Inline property and person chips — clicking opens a right-side panel with their full profile (without navigating away)
- Comments section at bottom (moderated)

### `/map` — Interactive Zoning Map
- Mapbox GL JS, centered on Duluth city limits
- Each zoning case: colored circle (green = approved, red = denied, yellow = tabled/pending)
- Click popup: address, case type, requested zoning, outcome, date, link to meeting
- Filter panel: date range, outcome, case type
- Layer toggle: show/hide approved, denied, pending cases

### `/properties/[id]` — Property Detail
- Address, owner, lot size, current zoning, assessed value
- Small embedded Mapbox map showing the parcel
- Meeting history timeline: all meetings where this property was mentioned, with outcome badges
- Link to Gwinnett County official record
- Comments section

### `/people/[id]` — Person Profile
- Name, role, title
- If public official: link to bio
- Appearance timeline: all meetings this person appeared in and in what capacity
- For council members: aggregated voting/decision record from agenda outcomes

### `/search` — Search
- Full-text search across meetings, properties, and people
- Results grouped by type with match highlighting

---

## Visual Design

**Direction:** Clean & civic — professional, trustworthy, high readability.

**Color palette:**
- Primary: Deep navy blue (`#1B3A6B`) — headers, buttons, badges
- Secondary: Medium blue (`#2B6CB0`) — links, interactive elements
- Accent: Warm amber (`#D97706`) — outcome badges (approved), calls to action
- Neutral: Slate grays (`#374151`, `#6B7280`, `#F3F4F6`)
- Backgrounds: White and very light gray (`#F9FAFB`)
- Error / denied: Muted red (`#DC2626`)
- Pending / tabled: Amber (`#F59E0B`)

**Typography:**
- Headings: Inter (semibold/bold)
- Body: Inter (regular)
- Data/labels: Inter (medium, slightly smaller)

**Design principles:**
- Every page leads with the most important information first
- Outcome badges are always color-coded and consistent
- Maps and property cards are visual entry points; text is secondary
- Mobile-responsive — many residents will access on phones

---

## Technical Constraints & Notes

**Gwinnett County GIS:** Parcel data available via ArcGIS REST services (public, no API key). Endpoint: `https://gis.gwinnettcounty.com/server/rest/services/...` — to be confirmed during implementation. Filter to Duluth city limits using a bounding polygon or `MUNICIPALITY = 'DULUTH'` filter.

**OpenAI cost estimate:** GPT-4o at ~$5/1M input tokens. An average agenda PDF is ~5,000 tokens. Processing 10 new PDFs/week = ~50,000 tokens/week ≈ $0.25/week. Very manageable.

**Mapbox free tier:** 50,000 map loads/month — more than sufficient for a local civic site.

**Authentication:** MVP is fully public — no login required. Comments require only name and optional email. Moderation via Supabase dashboard.

**Privacy:** No private citizen data is stored. Only named officials and applicants (who have voluntarily entered the public record) are profiled.

---

## Out of Scope for MVP

- User accounts or saved searches
- Email/SMS notification subscriptions
- Video transcript processing
- Neighborhood/subdivision filtering
- Mobile app
- Coverage of Gwinnett County-level meetings (Duluth-only for MVP)

---

## Success Criteria

1. New meetings are automatically detected, processed, and live on the site within 24 hours of being posted to the city website
2. Every meeting has an AI summary, and every property mention links to a property detail page with parcel data from Gwinnett GIS
3. The zoning map shows all historical zoning cases with correct color coding
4. Site loads in under 2 seconds on mobile
5. Residents can find any meeting, property, or official via search
