import type { LeadStatus, SavedLead, ScoredLead } from '../lib/types'
import LeadCard from './LeadCard'

type Props = { leads: ScoredLead[]; selectedId?: string; saved: Record<string, SavedLead>; onSelect: (id: string) => void }

export default function LeadList({ leads, selectedId, saved, onSelect }: Props) {
  return (
    <ul className="space-y-2">
      {leads.map((l) => {
        const status: LeadStatus | undefined = saved[l.id]?.status
        return (
          <li key={l.id}>
            <LeadCard lead={l} selected={l.id === selectedId} status={status} onSelect={() => onSelect(l.id)} />
          </li>
        )
      })}
    </ul>
  )
}
