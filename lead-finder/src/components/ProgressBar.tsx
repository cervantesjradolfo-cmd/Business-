import { Loader2 } from 'lucide-react'

// Set during a "Many places" search: which place is running.
export type PlaceProgress = { place: string; index: number; total: number }

type Props = { phase: 'searching' | 'auditing'; done: number; total: number; place?: PlaceProgress; onStop?: () => void }

export default function ProgressBar({ phase, done, total, place, onStop }: Props) {
  const step = phase === 'searching' ? 'Finding businesses…' : `Checking websites ${done}/${total}…`
  const text = place ? `${place.place} (${place.index} of ${place.total}): ${step.charAt(0).toLowerCase()}${step.slice(1)}` : step
  const within = phase === 'searching' || total === 0 ? 0 : done / total
  const pct = place
    ? Math.max(4, Math.round(((place.index - 1 + within) / place.total) * 100))
    : phase === 'searching' || total === 0 ? 8 : Math.max(4, Math.round(within * 100))
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm" role="status" aria-live="polite">
      <div className="mb-2 flex items-center gap-2 text-sm text-slate-700">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand" aria-hidden />
        <span className="min-w-0 flex-1 break-words">{text}</span>
        {onStop && (
          <button type="button" onClick={onStop} className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-medium hover:bg-slate-50">
            Stop
          </button>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
