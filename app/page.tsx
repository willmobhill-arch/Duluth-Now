import Link from 'next/link'
import { getRecentMeetings } from '@/lib/queries'
import { MeetingCard } from '@/components/MeetingCard'

export const revalidate = 3600 // ISR: refresh every hour

export default async function HomePage() {
  let meetings = []
  try {
    meetings = await getRecentMeetings(5)
  } catch {
    // Supabase not yet configured — show empty state
  }

  return (
    <>
      {/* ── Hero ── */}
      <section className="bg-[#0C1F3F] py-16 px-6 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 80% at 15% 60%, rgba(36,85,164,.35) 0%, transparent 70%), radial-gradient(ellipse 40% 60% at 85% 15%, rgba(201,126,10,.12) 0%, transparent 60%)',
          }}
        />
        <div className="max-w-6xl mx-auto relative z-10">
          <p className="font-mono text-xs text-[#C97E0A] tracking-widest uppercase mb-3">
            Duluth, GA · Civic Transparency
          </p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-white leading-tight mb-4">
            Every meeting.<br />Every decision.<br />
            <span className="text-[#C97E0A]">Explained.</span>
          </h1>
          <p className="text-white/70 text-base max-w-xl mb-8 leading-relaxed">
            AI-powered summaries of City Council and committee meetings, an interactive zoning map,
            and searchable records — all in plain English.
          </p>

          {/* Search bar */}
          <form action="/search" className="flex gap-2 max-w-xl">
            <input
              type="search"
              name="q"
              placeholder="Search meetings, addresses, or people…"
              className="flex-1 px-4 py-3 rounded-lg text-sm bg-white/10 text-white placeholder-white/40 border border-white/20 focus:outline-none focus:border-[#C97E0A] focus:bg-white/15"
            />
            <button
              type="submit"
              className="px-5 py-3 bg-[#C97E0A] hover:bg-[#E8950E] text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {/* ── Content ── */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

          {/* Recent meetings (2/3 width) */}
          <section className="lg:col-span-2">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif text-2xl font-bold text-[#0C1F3F]">Recent Meetings</h2>
              <Link href="/meetings" className="text-sm text-[#2455A4] hover:underline font-medium">
                View all →
              </Link>
            </div>

            {meetings.length === 0 ? (
              <div className="bg-white border border-[#D8D7D1] rounded-lg p-8 text-center text-[#6B7280]">
                <p className="font-mono text-sm mb-2">No meetings yet</p>
                <p className="text-xs">Run the pipeline to ingest meetings from duluthga.net.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {meetings.map((m) => (
                  <MeetingCard key={m.id} meeting={m} />
                ))}
              </div>
            )}
          </section>

          {/* Sidebar (1/3 width) */}
          <aside className="flex flex-col gap-6">

            {/* Map preview CTA */}
            <div className="bg-[#0C1F3F] rounded-lg p-5 text-white">
              <h3 className="font-serif text-lg font-semibold mb-2">Zoning Map</h3>
              <p className="text-white/65 text-sm mb-4 leading-relaxed">
                Explore every active and historical zoning case in Duluth on an interactive map.
              </p>
              <Link
                href="/map"
                className="block text-center bg-[#C97E0A] hover:bg-[#E8950E] text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
              >
                Open Map →
              </Link>
            </div>

            {/* How it works */}
            <div className="bg-white border border-[#D8D7D1] rounded-lg p-5">
              <h3 className="font-serif text-lg font-semibold text-[#0C1F3F] mb-3">How it works</h3>
              <ol className="flex flex-col gap-3 text-sm text-[#3D4451]">
                {[
                  ['1', 'Every night we check the city website for new meeting documents.'],
                  ['2', 'AI reads each PDF and writes a plain-English summary.'],
                  ['3', 'Property addresses are geocoded and linked to county parcel data.'],
                  ['4', 'Everything is searchable and connected.'],
                ].map(([n, text]) => (
                  <li key={n} className="flex gap-3">
                    <span className="font-mono text-xs text-[#C97E0A] font-bold mt-0.5 shrink-0">{n}.</span>
                    <span>{text}</span>
                  </li>
                ))}
              </ol>
            </div>

          </aside>
        </div>
      </div>
    </>
  )
}
