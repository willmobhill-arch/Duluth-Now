import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { getPerson, getPersonMeetings } from '@/lib/queries'
import { MeetingCard } from '@/components/MeetingCard'

export const revalidate = 3600

interface Props { params: { id: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const person = await getPerson(params.id)
  if (!person) return { title: 'Person Not Found' }
  return { title: person.full_name }
}

export default async function PersonPage({ params }: Props) {
  const person = await getPerson(params.id)
  if (!person) notFound()

  let meetings = []
  try {
    meetings = await getPersonMeetings(params.id)
  } catch {
    //
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <nav className="text-xs font-mono text-[#6B7280] mb-6">
        <Link href="/search" className="hover:text-[#2455A4]">← Search</Link>
      </nav>

      <header className="mb-8">
        <p className="font-mono text-xs text-[#C97E0A] uppercase tracking-widest mb-2 capitalize">
          {person.role.replace(/_/g, ' ')}
        </p>
        <h1 className="font-serif text-3xl font-bold text-[#0C1F3F] mb-2">{person.full_name}</h1>
        {person.title && <p className="text-[#3D4451] text-base mb-3">{person.title}</p>}

        <div className="flex flex-wrap gap-4 text-xs font-mono text-[#6B7280]">
          {person.first_seen_date && (
            <span>First seen {format(new Date(person.first_seen_date), 'MMMM yyyy')}</span>
          )}
          {person.bio_url && (
            <a href={person.bio_url} target="_blank" rel="noopener noreferrer" className="text-[#2455A4] hover:underline">
              Official bio →
            </a>
          )}
        </div>
      </header>

      {meetings.length > 0 && (
        <section>
          <h2 className="font-serif text-xl font-bold text-[#0C1F3F] mb-4">
            Appearances ({meetings.length})
          </h2>
          <div className="flex flex-col gap-4">
            {meetings.map((m) => <MeetingCard key={m.id} meeting={m} />)}
          </div>
        </section>
      )}

      {meetings.length === 0 && (
        <p className="text-sm text-[#6B7280]">No meeting appearances recorded yet.</p>
      )}
    </div>
  )
}
