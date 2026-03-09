import Link from 'next/link'
import { format } from 'date-fns'
import type { Meeting } from '@/lib/types'
import { CommitteeBadge } from './CommitteeBadge'

export function MeetingCard({ meeting }: { meeting: Meeting }) {
  const date = new Date(meeting.meeting_date + 'T00:00:00')

  return (
    <Link href={`/meetings/${meeting.id}`} className="block group">
      <article className="bg-white border border-[#D8D7D1] rounded-lg p-5 hover:border-[#2455A4] hover:shadow-md transition-all duration-150">
        <div className="flex items-start justify-between gap-3 mb-3">
          <CommitteeBadge type={meeting.committee_type} />
          <time className="font-mono text-xs text-[#6B7280] whitespace-nowrap mt-0.5">
            {format(date, 'MMM d, yyyy')}
          </time>
        </div>

        <h3 className="font-serif font-semibold text-[#0C1F3F] text-lg leading-snug mb-2 group-hover:text-[#2455A4] transition-colors">
          {meeting.title}
        </h3>

        {meeting.summary && (
          <p className="text-sm text-[#3D4451] leading-relaxed line-clamp-2 mb-3">
            {meeting.summary}
          </p>
        )}

        <div className="flex items-center gap-4 text-xs font-mono text-[#6B7280]">
          {(meeting.property_count ?? 0) > 0 && (
            <span>{meeting.property_count} {meeting.property_count === 1 ? 'property' : 'properties'}</span>
          )}
          {(meeting.person_count ?? 0) > 0 && (
            <span>{meeting.person_count} {meeting.person_count === 1 ? 'person' : 'people'}</span>
          )}
          <span className="ml-auto text-[#2455A4] group-hover:underline">Read more →</span>
        </div>
      </article>
    </Link>
  )
}
