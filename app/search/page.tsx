import type { Metadata } from 'next'
import Link from 'next/link'
import { format } from 'date-fns'
import { searchAll } from '@/lib/queries'
import { CommitteeBadge } from '@/components/CommitteeBadge'

export const metadata: Metadata = { title: 'Search' }

interface Props { searchParams: { q?: string } }

export default async function SearchPage({ searchParams }: Props) {
  const q = (searchParams.q ?? '').trim()
  let results = { meetings: [] as { id: string; title: string; meeting_date: string; committee_type: string; summary: string | null }[], properties: [] as { id: string; address: string; current_zoning: string | null; owner_name: string | null }[], people: [] as { id: string; full_name: string; role: string; title: string | null }[] }

  if (q) {
    try {
      results = await searchAll(q) as typeof results
    } catch {
      // not connected
    }
  }

  const totalResults = results.meetings.length + results.properties.length + results.people.length

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="font-serif text-3xl font-bold text-[#0C1F3F] mb-6">Search</h1>

      {/* Search form */}
      <form className="flex gap-2 mb-10">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search meetings, addresses, or people…"
          autoFocus
          className="flex-1 px-4 py-3 text-sm border border-[#D8D7D1] rounded-lg bg-white focus:outline-none focus:border-[#2455A4]"
        />
        <button type="submit" className="px-5 py-3 bg-[#0C1F3F] hover:bg-[#1A3664] text-white text-sm font-semibold rounded-lg transition-colors">
          Search
        </button>
      </form>

      {q && (
        <>
          <p className="text-xs font-mono text-[#6B7280] mb-6">
            {totalResults} result{totalResults !== 1 ? 's' : ''} for &ldquo;{q}&rdquo;
          </p>

          {/* Meetings */}
          {results.meetings.length > 0 && (
            <section className="mb-8">
              <h2 className="font-mono text-xs text-[#C97E0A] uppercase tracking-widest mb-3">Meetings</h2>
              <div className="flex flex-col gap-3">
                {results.meetings.map((m) => (
                  <Link key={m.id} href={`/meetings/${m.id}`} className="block bg-white border border-[#D8D7D1] rounded-lg p-4 hover:border-[#2455A4] transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <CommitteeBadge type={m.committee_type as never} />
                      <time className="font-mono text-xs text-[#6B7280]">
                        {format(new Date(m.meeting_date + 'T00:00:00'), 'MMM d, yyyy')}
                      </time>
                    </div>
                    <p className="font-semibold text-[#0C1F3F] text-sm">{m.title}</p>
                    {m.summary && <p className="text-xs text-[#6B7280] mt-1 line-clamp-2">{m.summary}</p>}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Properties */}
          {results.properties.length > 0 && (
            <section className="mb-8">
              <h2 className="font-mono text-xs text-[#C97E0A] uppercase tracking-widest mb-3">Properties</h2>
              <div className="flex flex-col gap-3">
                {results.properties.map((p) => (
                  <Link key={p.id} href={`/properties/${p.id}`} className="block bg-white border border-[#D8D7D1] rounded-lg p-4 hover:border-[#2455A4] transition-colors">
                    <p className="font-semibold text-[#0C1F3F] text-sm">{p.address}</p>
                    <p className="text-xs text-[#6B7280] mt-1">
                      {[p.current_zoning, p.owner_name].filter(Boolean).join(' · ')}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* People */}
          {results.people.length > 0 && (
            <section className="mb-8">
              <h2 className="font-mono text-xs text-[#C97E0A] uppercase tracking-widest mb-3">People</h2>
              <div className="flex flex-col gap-3">
                {results.people.map((p) => (
                  <Link key={p.id} href={`/people/${p.id}`} className="block bg-white border border-[#D8D7D1] rounded-lg p-4 hover:border-[#2455A4] transition-colors">
                    <p className="font-semibold text-[#0C1F3F] text-sm">{p.full_name}</p>
                    <p className="text-xs text-[#6B7280] mt-1 capitalize">
                      {p.title ?? p.role.replace(/_/g, ' ')}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {totalResults === 0 && (
            <div className="bg-white border border-[#D8D7D1] rounded-lg p-10 text-center text-[#6B7280]">
              <p className="font-mono text-sm">No results found for &ldquo;{q}&rdquo;</p>
            </div>
          )}
        </>
      )}

      {!q && (
        <div className="text-[#6B7280] text-sm text-center py-10">
          <p>Search across all meetings, properties, and people in Duluth.</p>
        </div>
      )}
    </div>
  )
}
