import { Loader2 } from 'lucide-react'

export default function ProgressBar({ phase, done, total }: { phase: 'searching' | 'auditing'; done: number; total: number }) {
  const text = phase === 'searching' ? 'Finding businesses…' : `Checking websites ${done}/${total}…`
  const pct = phase === 'searching' || total === 0 ? 8 : Math.max(4, Math.round((done / total) * 100))
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm" role="status" aria-live="polite">
      <div className="mb-2 flex items-center gap-2 text-sm text-slate-700">
        <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden />
        {text}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
