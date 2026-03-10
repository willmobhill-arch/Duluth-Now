import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProperty, getPropertyMeetings } from '@/lib/queries'
import { MeetingCard } from '@/components/MeetingCard'
import type { Meeting } from '@/lib/types'

export const revalidate = 3600

interface Props { params: { id: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const prop = await getProperty(params.id)
  if (!prop) return { title: 'Property Not Found' }
  return { title: prop.address }
}

export default async function PropertyPage({ params }: Props) {
  const prop = await getProperty(params.id)
  if (!prop) notFound()

  let meetings: Meeting[] = []
  try {
    meetings = await getPropertyMeetings(params.id)
  } catch {
    //
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <nav className="text-xs font-mono text-[#6B7280] mb-6">
        <Link href="/search" className="hover:text-[#2455A4]">← Search</Link>
      </nav>

      <header className="mb-8">
        <p className="font-mono text-xs text-[#C97E0A] uppercase tracking-widest mb-2">Property</p>
        <h1 className="font-serif text-3xl font-bold text-[#0C1F3F] mb-4">{prop.address}</h1>

        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            ['Owner', prop.owner_name],
            ['Zoning', prop.current_zoning],
            ['Lot Size', prop.lot_size_acres ? `${prop.lot_size_acres} acres` : null],
            ['Assessed Value', prop.assessed_value ? `$${prop.assessed_value.toLocaleString()}` : null],
            ['Parcel ID', prop.parcel_id],
          ].filter(([, v]) => v).map(([label, value]) => (
            <div key={label as string} className="bg-white border border-[#D8D7D1] rounded-lg p-3">
              <dt className="font-mono text-xs text-[#6B7280] uppercase tracking-wide mb-1">{label}</dt>
              <dd className="text-sm text-[#1A1A1A] font-medium">{value}</dd>
            </div>
          ))}
        </dl>

        {prop.gwinnett_gis_url && (
          <a
            href={prop.gwinnett_gis_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-[#2455A4] hover:underline mt-4"
          >
            View on Gwinnett County GIS →
          </a>
        )}
      </header>

      {meetings.length > 0 && (
        <section>
          <h2 className="font-serif text-xl font-bold text-[#0C1F3F] mb-4">Meeting History</h2>
          <div className="flex flex-col gap-4">
            {meetings.map((m) => <MeetingCard key={m.id} meeting={m} />)}
          </div>
        </section>
      )}
    </div>
  )
}
