import type { CommitteeType } from '@/lib/types'

const labels: Record<CommitteeType, string> = {
  city_council:        'City Council',
  planning_commission: 'Planning Commission',
  bza:                 'Board of Zoning Appeals',
  other:               'Other',
}

const colors: Record<CommitteeType, string> = {
  city_council:        'bg-[#1A3664] text-white',
  planning_commission: 'bg-[#145241] text-white',
  bza:                 'bg-[#6B2D00] text-white',
  other:               'bg-gray-600 text-white',
}

export function CommitteeBadge({ type }: { type: CommitteeType }) {
  return (
    <span className={`inline-block text-xs font-mono font-medium uppercase tracking-wider px-2.5 py-1 rounded ${colors[type]}`}>
      {labels[type]}
    </span>
  )
}
