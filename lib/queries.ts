import { supabase } from './supabase'
import type { Meeting, AgendaItem, Property, Person, ZoningCase } from './types'

// ── Meetings ──────────────────────────────────────────────────────────────────

export async function getRecentMeetings(limit = 10): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .order('meeting_date', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function getMeetings({
  committeeType,
  search,
  page = 1,
  pageSize = 20,
}: {
  committeeType?: string
  search?: string
  page?: number
  pageSize?: number
}): Promise<{ data: Meeting[]; count: number }> {
  let query = supabase
    .from('meetings')
    .select('*', { count: 'exact' })
    .order('meeting_date', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (committeeType && committeeType !== 'all') {
    query = query.eq('committee_type', committeeType)
  }
  if (search) {
    query = query.ilike('title', `%${search}%`)
  }

  const { data, error, count } = await query
  if (error) throw error
  return { data: data ?? [], count: count ?? 0 }
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data
}

export async function getMeetingAgendaItems(meetingId: string): Promise<AgendaItem[]> {
  const { data, error } = await supabase
    .from('agenda_items')
    .select('*')
    .eq('meeting_id', meetingId)
    .order('item_number')

  if (error) throw error
  return data ?? []
}

// ── Properties ────────────────────────────────────────────────────────────────

export async function getProperty(id: string): Promise<Property | null> {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data
}

export async function getPropertyMeetings(propertyId: string): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from('meeting_mentions')
    .select('meetings(*)')
    .eq('entity_type', 'property')
    .eq('entity_id', propertyId)

  if (error) throw error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => r.meetings as Meeting).filter(Boolean)
}

// ── People ────────────────────────────────────────────────────────────────────

export async function getPerson(id: string): Promise<Person | null> {
  const { data, error } = await supabase
    .from('people')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data
}

export async function getPersonMeetings(personId: string): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from('meeting_mentions')
    .select('meetings(*)')
    .eq('entity_type', 'person')
    .eq('entity_id', personId)

  if (error) throw error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => r.meetings as Meeting).filter(Boolean)
}

// ── Zoning cases (for map) ────────────────────────────────────────────────────

export async function getZoningCases(): Promise<(ZoningCase & { properties: Property })[]> {
  const { data, error } = await supabase
    .from('zoning_cases')
    .select('*, properties(*)')
    .not('properties.latitude', 'is', null)

  if (error) throw error
  return data ?? []
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function searchAll(query: string) {
  const [meetings, properties, people] = await Promise.all([
    supabase
      .from('meetings')
      .select('id, title, meeting_date, committee_type, summary')
      .or(`title.ilike.%${query}%,summary.ilike.%${query}%`)
      .limit(5),
    supabase
      .from('properties')
      .select('id, address, current_zoning, owner_name')
      .ilike('address', `%${query}%`)
      .limit(5),
    supabase
      .from('people')
      .select('id, full_name, role, title')
      .ilike('full_name', `%${query}%`)
      .limit(5),
  ])

  return {
    meetings: meetings.data ?? [],
    properties: properties.data ?? [],
    people: people.data ?? [],
  }
}
