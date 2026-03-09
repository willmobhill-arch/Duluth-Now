export type CommitteeType = 'city_council' | 'planning_commission' | 'bza' | 'other'
export type OutcomeType = 'approved' | 'denied' | 'tabled' | 'discussed' | null
export type PersonRole = 'council_member' | 'staff' | 'applicant' | 'attorney' | 'other'
export type ZoningCaseType = 'rezoning' | 'variance' | 'special_use' | 'annexation' | 'other'

export interface Meeting {
  id: string
  committee_type: CommitteeType
  meeting_date: string
  title: string
  summary: string | null
  source_pdf_url: string
  processed_at: string
  // aggregated counts (from query)
  property_count?: number
  person_count?: number
}

export interface AgendaItem {
  id: string
  meeting_id: string
  item_number: string
  description: string
  outcome: OutcomeType
  raw_text: string | null
}

export interface Property {
  id: string
  address: string
  parcel_id: string | null
  owner_name: string | null
  lot_size_acres: number | null
  current_zoning: string | null
  assessed_value: number | null
  latitude: number | null
  longitude: number | null
  gwinnett_gis_url: string | null
  last_enriched_at: string | null
}

export interface Person {
  id: string
  full_name: string
  role: PersonRole
  title: string | null
  bio_url: string | null
  first_seen_date: string | null
}

export interface MeetingMention {
  id: string
  meeting_id: string
  agenda_item_id: string | null
  entity_type: 'property' | 'person'
  entity_id: string
  context_snippet: string | null
}

export interface ZoningCase {
  id: string
  property_id: string | null
  meeting_id: string | null
  agenda_item_id: string | null
  case_number: string | null
  case_type: ZoningCaseType
  requested_zoning: string | null
  current_zoning: string | null
  outcome: 'approved' | 'denied' | 'tabled' | 'pending'
  decision_date: string | null
}

export interface PipelineRun {
  id: string
  run_at: string
  pdfs_found: number
  pdfs_new: number
  tokens_used: number
  status: 'success' | 'partial' | 'error'
  error_message: string | null
}
