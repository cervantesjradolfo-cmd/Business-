import { CloudCog, Loader2 } from 'lucide-react'
import type { BackgroundView } from '../lib/useBackground'

type Props = {
  view: BackgroundView
  canTurnOn: boolean // the mailbox is set up
  onTurnOn: () => void
  onTurnOff: () => void
  onRunNow: () => void
}

const btn = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '')

// Run while the app is closed: on/off, the last scheduled run, and Run now.
export default function BackgroundPanel({ view, canTurnOn, onTurnOn, onTurnOff, onRunNow }: Props) {
  return (
    <section aria-label="Run while closed" className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold"><CloudCog className="h-4 w-4" aria-hidden />Run while the app is closed</h3>
      {!view.available ? (
        <p className="text-sm text-slate-500">
          Not set up on the server yet. It needs Upstash Redis, BACKGROUND_SECRET and CRON_SECRET in Vercel, and a scheduler that calls the app every few minutes (see the README).
          Until then, keep this tab open with auto-send on.
        </p>
      ) : !view.enabled ? (
        <>
          <p className="text-sm text-slate-600">
            The server checks replies and sends due emails on a schedule, with the same sending hours, warm-up, daily limit and compliance check.
            Your mailbox password is stored encrypted on your server for this.
          </p>
          <button type="button" className={btn} disabled={!canTurnOn || view.busy} onClick={onTurnOn}>
            {view.busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Turn on
          </button>
          {!canTurnOn && <p className="text-xs text-slate-500">Set up your mailbox below first.</p>}
        </>
      ) : (
        <>
          <p role="status" className="text-sm text-green-700">
            On. Sending and reply checks happen on the server, so this tab doesn't need to stay open.
          </p>
          <p className="text-xs text-slate-500">
            {view.lastRunAt ? `Last run ${when(view.lastRunAt)}: ${view.lastRunNote ?? ''}.` : 'No scheduled run yet.'}
            {view.syncedAt ? ` In step with the server since ${when(view.syncedAt)}.` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} disabled={view.busy} onClick={onRunNow}>
              {view.busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Run now
            </button>
            <button type="button" className={btn} disabled={view.busy} onClick={onTurnOff}>Turn off</button>
          </div>
          {view.note && <p role="status" className="text-sm text-slate-600">Run now: {view.note}.</p>}
        </>
      )}
      {view.error && <p role="alert" className="text-sm text-red-700">{view.error}</p>}
    </section>
  )
}
