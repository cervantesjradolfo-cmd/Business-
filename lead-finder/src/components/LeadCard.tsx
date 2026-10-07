import clsx from 'clsx'
import { Loader2, MapPin } from 'lucide-react'
import { formatRange } from '../lib/format'
import { STATUS_LABELS } from '../lib/csv'
import type { LeadStatus, ScoredLead } from '../lib/types'
import ScoreBadge from './ScoreBadge'

// client: a client profile's lead, shown by how to reach it instead of website gaps and score.
type Props = { lead: ScoredLead; selected: boolean; status?: LeadStatus; onSelect: () => void; client?: boolean }

const CONTACTS = [['phone', 'Phone'], ['email', 'Email'], ['website', 'Website']] as const

export default function LeadCard({ lead, selected, status, onSelect, client = false }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={clsx(
        'w-full rounded-xl border bg-white p-3 text-left shadow-sm transition-colors hover:border-brand/50',
        selected ? 'border-brand ring-2 ring-brand/30' : 'border-slate-200',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900">{lead.name}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
            <span>{lead.category}</span>
            <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" aria-hidden />{lead.distanceKm.toFixed(1)} km</span>
          </p>
        </div>
        {!client && <ScoreBadge score={lead.score} />}
      </div>
      {client ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {CONTACTS.filter(([k]) => lead[k]?.trim()).map(([k, label]) => (
            <span key={k} className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-800">{label}</span>
          ))}
          {CONTACTS.every(([k]) => !lead[k]?.trim()) && <span className="text-xs text-slate-400">No contact details listed</span>}
          {lead.isChain && <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">Chain / franchise</span>}
          {status && <span className="ml-auto rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-brand">{STATUS_LABELS[status]}</span>}
        </div>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-1">
            {lead.gaps.slice(0, 3).map((g) => (
              <span key={g.id} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">{g.label}</span>
            ))}
            {lead.isChain && <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">Chain / franchise</span>}
            {lead.gaps.length === 0 && lead.auditState !== 'pending' && <span className="text-xs text-slate-400">No gaps found</span>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {lead.dealValue.max > 0 && <span className="font-medium text-slate-700">{formatRange(lead.dealValue)}</span>}
            {lead.auditState === 'pending' && (
              <span className="inline-flex items-center gap-1 text-slate-500"><Loader2 className="h-3 w-3 animate-spin" aria-hidden />Auditing…</span>
            )}
            {lead.auditState === 'done' && !lead.audit && <span className="text-slate-400">Website not checked</span>}
            {status && (
              <span className="ml-auto rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-brand">{STATUS_LABELS[status]}</span>
            )}
          </div>
        </>
      )}
    </button>
  )
}
