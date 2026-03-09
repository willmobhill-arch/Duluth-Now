import type { OutcomeType } from '@/lib/types'

const styles: Record<string, string> = {
  approved:  'bg-[#DCFCE7] text-[#166534]',
  denied:    'bg-[#FEE2E2] text-[#991B1B]',
  tabled:    'bg-[#FEF3C7] text-[#78350F]',
  discussed: 'bg-[#DBEAFE] text-[#1E3A8A]',
}

export function OutcomeBadge({ outcome }: { outcome: OutcomeType }) {
  if (!outcome) return null
  return (
    <span className={`inline-block text-xs font-mono font-medium uppercase tracking-wide px-2 py-0.5 rounded ${styles[outcome] ?? 'bg-gray-100 text-gray-600'}`}>
      {outcome}
    </span>
  )
}
