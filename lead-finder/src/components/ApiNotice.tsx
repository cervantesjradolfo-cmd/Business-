import { AlertTriangle } from 'lucide-react'

type Props = { kind: 'unavailable' | 'error'; message?: string; onDemo?: () => void }

export default function ApiNotice({ kind, message, onDemo }: Props) {
  return (
    <div role="alert" className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0">
        {kind === 'unavailable' ? (
          <>
            <p>
              Lead Finder's server isn't reachable from here (it needs <code className="rounded bg-red-100 px-1">npm run dev</code> or a
              Vercel deploy). You can explore the screens with demo data.
            </p>
            <button
              type="button"
              onClick={onDemo}
              className="mt-3 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Explore demo data
            </button>
          </>
        ) : (
          <p>{message}</p>
        )}
      </div>
    </div>
  )
}
