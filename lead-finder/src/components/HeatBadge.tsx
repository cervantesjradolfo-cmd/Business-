import clsx from 'clsx'
import { Flame } from 'lucide-react'
import type { ScoredLead } from '../lib/types'

// "Heat 4": how good a moment it is to reach out. Hover for the reasons.
export default function HeatBadge({ lead }: { lead: Pick<ScoredLead, 'heat' | 'heatReasons'> }) {
  if (lead.heat < 2) return null
  return (
    <span
      title={lead.heatReasons.map((r) => r.label).join('\n')}
      className={clsx(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium',
        lead.heat >= 4 ? 'bg-orange-100 text-orange-800' : 'bg-amber-50 text-amber-800',
      )}
    >
      <Flame className="h-3 w-3" aria-hidden />Heat {lead.heat}
    </span>
  )
}
