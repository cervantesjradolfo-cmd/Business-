import { Loader2 } from 'lucide-react'

type Props = { message: string; onRetry?: () => void; retrying: boolean; disabled: boolean }

export default function SearchNotice({ message, onRetry, retrying, disabled }: Props) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      <p className="min-w-0">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {retrying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Trying full search…
            </>
          ) : (
            'Try full search again'
          )}
        </button>
      )}
    </div>
  )
}
