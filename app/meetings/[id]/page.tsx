import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { getMeeting, getMeetingAgendaItems } from '@/lib/queries'
import { CommitteeBadge } from '@/components/CommitteeBadge'
import { OutcomeBadge } from '@/components/OutcomeBadge'

export const revalidate = 3600

interface Props { params: { id: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const meeting = await getMeeting(params.id)
  if (!meeting) return { title: 'Meeting Not Found' }
  return { title: meeting.title }
}

export default async function MeetingDetailPage({ params }: Props) {
  const [meeting, items] = await Promise.all([
    getMeeting(params.id),
    getMeetingAgendaItems(params.id),
  ])

  if (!meeting) notFound()

  const date = new Date(meeting.meeting_date + 'T00:00:00')

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Breadcrumb */}
      <nav className="text-xs font-mono text-[#6B7280] mb-6">
        <Link href="/meetings" className="hover:text-[#2455A4]">← Meetings</Link>
      </nav>

      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <CommitteeBadge type={meeting.committee_type} />
          <time className="font-mono text-sm text-[#6B7280]">
            {format(date, 'MMMM d, yyyy')}
          </time>
        </div>
        <h1 className="font-serif text-3xl font-bold text-[#0C1F3F] leading-tight mb-4">
          {meeting.title}
        </h1>

        {meeting.source_pdf_url && (
          <a
            href={meeting.source_pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-[#2455A4] hover:underline font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Source Document (PDF)
          </a>
        )}
      </header>

      {/* AI Summary */}
      {meeting.summary && (
        <section className="bg-white border border-[#D8D7D1] rounded-lg p-6 mb-8">
          <h2 className="font-mono text-xs text-[#C97E0A] uppercase tracking-widest mb-3">
            AI Summary
          </h2>
          <p className="text-[#1A1A1A] leading-relaxed text-base">
            {meeting.summary}
          </p>
        </section>
      )}

      {/* Agenda Items */}
      {items.length > 0 && (
        <section className="mb-8">
          <h2 className="font-serif text-xl font-bold text-[#0C1F3F] mb-4">Agenda Items</h2>
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <article key={item.id} className="bg-white border border-[#D8D7D1] rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <span className="font-mono text-xs text-[#6B7280] shrink-0 mt-0.5">
                    Item {item.item_number}
                  </span>
                  <OutcomeBadge outcome={item.outcome} />
                </div>
                <p className="text-sm text-[#3D4451] leading-relaxed">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Meta */}
      <div className="text-xs font-mono text-[#6B7280] border-t border-[#D8D7D1] pt-6">
        Processed {meeting.processed_at ? format(new Date(meeting.processed_at), 'MMM d, yyyy') : 'unknown'}
        {' '}· Data from{' '}
        <a href="https://duluthga.net" target="_blank" rel="noopener noreferrer" className="underline">
          duluthga.net
        </a>
      </div>
    </div>
  )
}
