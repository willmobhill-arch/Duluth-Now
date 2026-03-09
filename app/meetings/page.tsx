import type { Metadata } from 'next'
import { getMeetings } from '@/lib/queries'
import { MeetingCard } from '@/components/MeetingCard'
import type { CommitteeType } from '@/lib/types'

export const metadata: Metadata = { title: 'Meetings' }
export const revalidate = 3600

const COMMITTEE_TYPES: { value: string; label: string }[] = [
  { value: 'all',                label: 'All Committees' },
  { value: 'city_council',       label: 'City Council' },
  { value: 'planning_commission',label: 'Planning Commission' },
  { value: 'bza',                label: 'Board of Zoning Appeals' },
  { value: 'other',              label: 'Other' },
]

interface PageProps {
  searchParams: { committee?: string; q?: string; page?: string }
}

export default async function MeetingsPage({ searchParams }: PageProps) {
  const { committee = 'all', q = '', page = '1' } = searchParams
  const currentPage = Math.max(1, parseInt(page, 10))

  let data: Awaited<ReturnType<typeof getMeetings>> = { data: [], count: 0 }
  try {
    data = await getMeetings({
      committeeType: committee,
      search: q || undefined,
      page: currentPage,
      pageSize: 20,
    })
  } catch {
    // not connected yet
  }

  const totalPages = Math.ceil(data.count / 20)

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="font-serif text-3xl font-bold text-[#0C1F3F] mb-6">Meetings</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <form className="flex gap-2 flex-1">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by title…"
            className="flex-1 px-3 py-2 text-sm border border-[#D8D7D1] rounded-lg bg-white focus:outline-none focus:border-[#2455A4]"
          />
          {committee !== 'all' && <input type="hidden" name="committee" value={committee} />}
          <button type="submit" className="px-4 py-2 bg-[#0C1F3F] text-white text-sm rounded-lg hover:bg-[#1A3664]">
            Search
          </button>
        </form>

        <div className="flex gap-1 flex-wrap">
          {COMMITTEE_TYPES.map(({ value, label }) => {
            const params = new URLSearchParams()
            if (value !== 'all') params.set('committee', value)
            if (q) params.set('q', q)
            const href = `/meetings${params.size ? '?' + params.toString() : ''}`
            return (
              <a
                key={value}
                href={href}
                className={`text-xs font-mono uppercase tracking-wide px-3 py-1.5 rounded border transition-colors whitespace-nowrap ${
                  committee === value || (value === 'all' && !committee)
                    ? 'bg-[#0C1F3F] text-white border-[#0C1F3F]'
                    : 'bg-white text-[#3D4451] border-[#D8D7D1] hover:border-[#2455A4]'
                }`}
              >
                {label}
              </a>
            )
          })}
        </div>
      </div>

      {/* Results count */}
      {data.count > 0 && (
        <p className="text-xs font-mono text-[#6B7280] mb-4">
          {data.count} meeting{data.count !== 1 ? 's' : ''} found
        </p>
      )}

      {/* Meeting cards */}
      {data.data.length === 0 ? (
        <div className="bg-white border border-[#D8D7D1] rounded-lg p-12 text-center text-[#6B7280]">
          <p className="font-mono text-sm mb-2">No meetings found</p>
          <p className="text-xs">
            {q || committee !== 'all'
              ? 'Try adjusting your filters.'
              : 'Run the pipeline to ingest meetings from duluthga.net.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 mb-8">
          {data.data.map((m) => <MeetingCard key={m.id} meeting={m} />)}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex gap-2 justify-center">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
            const params = new URLSearchParams()
            if (committee !== 'all') params.set('committee', committee)
            if (q) params.set('q', q)
            if (p > 1) params.set('page', String(p))
            return (
              <a
                key={p}
                href={`/meetings?${params.toString()}`}
                className={`w-8 h-8 flex items-center justify-center text-sm font-mono rounded border transition-colors ${
                  p === currentPage
                    ? 'bg-[#0C1F3F] text-white border-[#0C1F3F]'
                    : 'bg-white text-[#3D4451] border-[#D8D7D1] hover:border-[#2455A4]'
                }`}
              >
                {p}
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
