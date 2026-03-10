-- Duluth Now — Supabase / PostgreSQL Schema
-- Run this in the Supabase SQL editor to create all tables.
-- Requires: PostGIS extension (enabled by default on Supabase).

-- ── Extensions ────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists postgis;

-- ── meetings ──────────────────────────────────────────────────────────────────
create table meetings (
  id               uuid primary key default uuid_generate_v4(),
  committee_type   text not null check (committee_type in ('city_council','planning_commission','bza','other')),
  meeting_date     date not null,
  title            text not null,
  summary          text,
  source_pdf_url   text not null,
  processed_at     timestamptz default now()
);

create index meetings_date_idx on meetings (meeting_date desc);
create index meetings_committee_idx on meetings (committee_type);
create unique index meetings_url_idx on meetings (source_pdf_url);  -- used for dedup + upsert ON CONFLICT

-- ── agenda_items ──────────────────────────────────────────────────────────────
create table agenda_items (
  id           uuid primary key default uuid_generate_v4(),
  meeting_id   uuid not null references meetings on delete cascade,
  item_number  text not null,
  description  text not null,
  outcome      text check (outcome in ('approved','denied','tabled','discussed')),
  raw_text     text
);

create index agenda_items_meeting_idx on agenda_items (meeting_id);

-- ── properties ────────────────────────────────────────────────────────────────
create table properties (
  id               uuid primary key default uuid_generate_v4(),
  address          text not null,
  parcel_id        text,
  owner_name       text,
  lot_size_acres   numeric,
  current_zoning   text,
  assessed_value   numeric,
  latitude         numeric,
  longitude        numeric,
  geom             geometry(Point, 4326),
  gwinnett_gis_url text,
  last_enriched_at timestamptz
);

create unique index properties_address_idx on properties (address);  -- used for dedup + upsert ON CONFLICT
create index properties_parcel_idx on properties (parcel_id);
create index properties_geom_idx on properties using gist (geom);

-- Trigger: keep geom in sync with lat/lon
create or replace function sync_property_geom()
returns trigger language plpgsql as $$
begin
  if new.latitude is not null and new.longitude is not null then
    new.geom := st_setsrid(st_makepoint(new.longitude, new.latitude), 4326);
  end if;
  return new;
end;
$$;

create trigger trg_sync_property_geom
before insert or update on properties
for each row execute function sync_property_geom();

-- ── people ────────────────────────────────────────────────────────────────────
create table people (
  id              uuid primary key default uuid_generate_v4(),
  full_name       text not null,
  role            text not null default 'other'
                  check (role in ('council_member','staff','applicant','attorney','other')),
  title           text,
  bio_url         text,
  first_seen_date date
);

create index people_name_idx on people (full_name);

-- ── meeting_mentions ──────────────────────────────────────────────────────────
-- Links meetings/agenda items to properties or people they mention.
create table meeting_mentions (
  id              uuid primary key default uuid_generate_v4(),
  meeting_id      uuid not null references meetings on delete cascade,
  agenda_item_id  uuid references agenda_items on delete set null,
  entity_type     text not null check (entity_type in ('property','person')),
  entity_id       uuid not null,
  context_snippet text
);

create index mentions_meeting_idx on meeting_mentions (meeting_id);
create index mentions_entity_idx on meeting_mentions (entity_type, entity_id);

-- ── zoning_cases ──────────────────────────────────────────────────────────────
create table zoning_cases (
  id                uuid primary key default uuid_generate_v4(),
  property_id       uuid references properties on delete set null,
  meeting_id        uuid references meetings on delete set null,
  agenda_item_id    uuid references agenda_items on delete set null,
  case_number       text,
  case_type         text not null default 'other'
                    check (case_type in ('rezoning','variance','special_use','annexation','other')),
  requested_zoning  text,
  current_zoning    text,
  outcome           text not null default 'pending'
                    check (outcome in ('approved','denied','tabled','pending')),
  decision_date     date
);

create index zoning_cases_property_idx on zoning_cases (property_id);
create index zoning_cases_outcome_idx on zoning_cases (outcome);

-- ── comments ──────────────────────────────────────────────────────────────────
create table comments (
  id           uuid primary key default uuid_generate_v4(),
  entity_type  text not null check (entity_type in ('meeting','property','person','agenda_item')),
  entity_id    uuid not null,
  author_name  text not null,
  author_email text,
  body         text not null,
  created_at   timestamptz default now(),
  is_approved  boolean not null default false
);

create index comments_entity_idx on comments (entity_type, entity_id);

-- ── pipeline_runs ─────────────────────────────────────────────────────────────
create table pipeline_runs (
  id            uuid primary key default uuid_generate_v4(),
  run_at        timestamptz default now(),
  pdfs_found    int not null default 0,
  pdfs_new      int not null default 0,
  tokens_used   int not null default 0,
  status        text not null check (status in ('success','partial','error')),
  error_message text
);

-- ── Row-Level Security ────────────────────────────────────────────────────────
-- All content is public read-only. Only the service role (pipeline) can write.

alter table meetings       enable row level security;
alter table agenda_items   enable row level security;
alter table properties     enable row level security;
alter table people         enable row level security;
alter table meeting_mentions enable row level security;
alter table zoning_cases   enable row level security;
alter table comments       enable row level security;
alter table pipeline_runs  enable row level security;

-- Public read for all tables
create policy "public read meetings"        on meetings        for select using (true);
create policy "public read agenda_items"    on agenda_items    for select using (true);
create policy "public read properties"      on properties      for select using (true);
create policy "public read people"          on people          for select using (true);
create policy "public read mentions"        on meeting_mentions for select using (true);
create policy "public read zoning_cases"    on zoning_cases    for select using (true);
create policy "public read pipeline_runs"   on pipeline_runs   for select using (true);
-- Comments: only show approved
create policy "public read approved comments" on comments      for select using (is_approved = true);

-- Full text search helper view
create or replace view meetings_fts as
select
  m.id,
  m.committee_type,
  m.meeting_date,
  m.title,
  m.summary,
  to_tsvector('english', coalesce(m.title,'') || ' ' || coalesce(m.summary,'')) as tsv
from meetings m;
