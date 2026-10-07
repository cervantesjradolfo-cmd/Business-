import type { Filters as F } from '../lib/types'

// client: a client profile, where the score and website filters don't apply.
type Props = { filters: F; onChange: (f: F) => void; shown: number; total: number; chainCount?: number; client?: boolean }

export default function Filters({ filters, onChange, shown, total, chainCount = 0, client = false }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
      {!client && (
        <>
          <label className="flex items-center gap-2">
            <span className="text-slate-600">Min score</span>
            <input
              type="range" min={0} max={100} step={5} value={filters.minScore}
              onChange={(e) => onChange({ ...filters, minScore: Number(e.target.value) })}
              className="w-28 accent-brand"
            />
            <span className="w-7 tabular-nums font-medium">{filters.minScore}</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={filters.noWebsiteOnly} onChange={(e) => onChange({ ...filters, noWebsiteOnly: e.target.checked })} className="h-4 w-4 accent-brand" />
            No website only
          </label>
        </>
      )}
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={filters.hasPhone} onChange={(e) => onChange({ ...filters, hasPhone: e.target.checked })} className="h-4 w-4 accent-brand" />
        Has phone
      </label>
      {chainCount > 0 && (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={filters.showChains} onChange={(e) => onChange({ ...filters, showChains: e.target.checked })} className="h-4 w-4 accent-brand" />
          Show chains ({chainCount})
        </label>
      )}
      <span className="text-slate-500 sm:ml-auto">Showing {shown} of {total}</span>
    </div>
  )
}
