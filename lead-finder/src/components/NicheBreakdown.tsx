import clsx from 'clsx'
import { getCategory } from '../data/categories'
import type { ScoredLead } from '../lib/types'

// One chip per niche in the results, busiest first, with how many have no website at all.
// Picking a chip narrows the list to that niche; "All niches" shows everything again.
type Props = { leads: ScoredLead[]; value?: string; onChange: (niche: string | undefined) => void }

type Row = { id: string; label: string; count: number; noSite: number }

function nicheRows(leads: ScoredLead[]): Row[] {
  const rows = new Map<string, Row>()
  for (const l of leads) {
    const row = rows.get(l.categoryId) ?? { id: l.categoryId, label: getCategory(l.categoryId)?.label ?? 'Other', count: 0, noSite: 0 }
    row.count++
    if (l.gaps.some((g) => g.id === 'no_website')) row.noSite++
    rows.set(l.categoryId, row)
  }
  return [...rows.values()].sort((a, b) => b.count - a.count || b.noSite - a.noSite || a.label.localeCompare(b.label))
}

export default function NicheBreakdown({ leads, value, onChange }: Props) {
  const rows = nicheRows(leads)
  // A single-niche search has nothing to break down (unless a picked niche has emptied out).
  if (rows.length < 2 && !value) return null
  const chip = (active: boolean) =>
    clsx('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm', active ? 'border-brand bg-indigo-50 text-brand' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
  return (
    <div role="group" aria-label="Niches" className="flex flex-wrap gap-2">
      <button type="button" aria-pressed={!value} onClick={() => onChange(undefined)} className={chip(!value)}>
        All niches <span className="tabular-nums font-semibold">{leads.length}</span>
      </button>
      {rows.map((r) => (
        <button key={r.id} type="button" aria-pressed={value === r.id} onClick={() => onChange(value === r.id ? undefined : r.id)} className={chip(value === r.id)}>
          {r.label} <span className="tabular-nums font-semibold">{r.count}</span>
          {r.noSite > 0 && <span className="text-xs text-rose-600">{r.noSite} no site</span>}
        </button>
      ))}
    </div>
  )
}
