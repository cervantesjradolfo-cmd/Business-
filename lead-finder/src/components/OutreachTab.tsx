import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  buildStepEmail, canEnroll, dueAt, dueSteps, enrollAll, enrollmentLabel, formatDue, mailboxReady, mailtoHref, recordSent,
  senderReady, sentTodayCount, setPending, suppress, unenroll, unknownVariables, OUTREACH_VARIABLES,
} from '../lib/outreach'
import type { RunStatus } from '../lib/useOutreachRunner'
import type { Campaign, Enrollment, Mailbox, OutreachState, Pitch, SavedLead, Sender, SendResult } from '../lib/types'
import MailboxSettings from './MailboxSettings'

type Props = {
  state: OutreachState
  update: (fn: (p: OutreachState) => OutreachState) => void
  saved: Record<string, SavedLead>
  mailbox: Mailbox
  onMailbox: (m: Mailbox) => void
  sender: Sender
  now: Date
  pitchFor: (s: SavedLead) => Pitch
  markContacted: (s: SavedLead) => void
  status: RunStatus
  onRun: () => void
  onStop: () => void
  onAuto: (on: boolean) => void
  onTest: () => Promise<SendResult>
  onOpenLead: (id: string) => void
  onOpenSettings: () => void
}

const btn = 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
const primary = 'rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50'
const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand'
const caption = 'mb-1 block text-xs font-medium text-slate-600'
const section = 'space-y-3 rounded-xl border border-slate-200 bg-white p-4'

const when = (iso: string) => formatDue(new Date(iso))

// Seconds left until `at` (ms), ticking once a second.
function useCountdown(at?: number): number {
  const [t, setT] = useState(() => Date.now())
  useEffect(() => {
    if (!at) return
    const id = setInterval(() => setT(Date.now()), 1000)
    return () => clearInterval(id)
  }, [at])
  return at ? Math.max(0, Math.ceil((at - t) / 1000)) : 0
}

function SequenceEditor({ campaign, onSave }: { campaign: Campaign; onSave: (c: Campaign) => void }) {
  const [draft, setDraft] = useState<Campaign>(campaign)
  const [saved, setSaved] = useState(false)
  const edit = (c: Campaign) => {
    setDraft(c)
    setSaved(false)
  }
  const setStep = (i: number, patch: Partial<Campaign['followUps'][number]>) =>
    edit({ followUps: draft.followUps.map((f, j) => (j === i ? { ...f, ...patch } : f)) })
  const unknown = [...new Set(draft.followUps.flatMap((f) => unknownVariables(f.body)))]
  const error = unknown.length > 0
    ? `Unknown variable${unknown.length > 1 ? 's' : ''}: ${unknown.map((u) => `{{${u}}}`).join(', ')}`
    : draft.followUps.some((f) => !f.body.trim())
      ? 'Follow-ups need some text.'
      : draft.followUps.some((f) => !Number.isInteger(f.delayDays) || f.delayDays < 1 || f.delayDays > 60)
        ? 'Wait between 1 and 60 days.'
        : ''
  return (
    <section aria-label="Sequence" className={section}>
      <h3 className="text-sm font-semibold">Sequence</h3>
      <div className="rounded-lg bg-slate-50 p-3 text-sm">
        <p className="font-medium">Step 1</p>
        <p className="text-slate-600">The lead's pitch email from the Pitch panel</p>
      </div>
      {draft.followUps.map((f, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-slate-200 p-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="text-sm font-medium">Follow-up {i + 1}</p>
            <button type="button" onClick={() => edit({ followUps: draft.followUps.filter((_, j) => j !== i) })} className="text-sm font-medium text-red-700 hover:underline">Remove</button>
          </div>
          <label className="block">
            <span className={caption}>Days after the previous email (1 to 60)</span>
            <input
              type="number" min={1} max={60} value={Number.isNaN(f.delayDays) ? '' : f.delayDays}
              onChange={(e) => setStep(i, { delayDays: e.target.value === '' ? NaN : Math.round(Number(e.target.value)) })}
              className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand"
            />
          </label>
          <label className="block">
            <span className={caption}>Message</span>
            <textarea value={f.body} rows={5} maxLength={5000} onChange={(e) => setStep(i, { body: e.target.value })} className={input} />
          </label>
        </div>
      ))}
      {draft.followUps.length < 2 && (
        <button type="button" className={btn} onClick={() => edit({ followUps: [...draft.followUps, { delayDays: 7, body: 'Hi {{business}} team,\n\n' }] })}>Add follow-up</button>
      )}
      <p className="text-xs text-slate-500">
        Variables: {OUTREACH_VARIABLES.map((v) => `{{${v}}}`).join(' ')}. Your signature and the opt-out line are added automatically.
        Follow-ups are sent as replies to the first email.
      </p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex items-center gap-2">
        <button type="button" disabled={!!error} className={primary} onClick={() => { onSave({ followUps: draft.followUps.map((f) => ({ ...f, body: f.body.trim() })) }); setSaved(true) }}>Save sequence</button>
        {saved && <span role="status" className="text-xs text-green-700">Saved</span>}
      </div>
    </section>
  )
}

export default function OutreachTab(p: Props) {
  const { state, saved, mailbox, sender, now, status } = p
  const [report, setReport] = useState('')
  const smtp = mailboxReady(mailbox)
  const ready = senderReady(sender)
  const due = dueSteps(state, saved, now)
  const dueIds = new Set(due.map((e) => e.leadId))
  // Rows that wait on you: a send with an unknown result is not "due" (never retried automatically).
  const unknown = Object.values(state.enrollments).filter((e) => e.state === 'active' && e.pendingSend)
  const rows = [...due, ...unknown.filter((e) => !dueIds.has(e.leadId))]
  const countdown = useCountdown(status.nextAt)
  const enrolled = Object.values(state.enrollments).sort((a, b) => a.enrolledAt.localeCompare(b.enrolledAt))
  const sentToday = sentTodayCount(state, now)

  function markSent(e: Enrollment) {
    const s = saved[e.leadId]
    if (!s) return
    const built = buildStepEmail({ enrollment: e, saved: s, pitch: p.pitchFor(s), campaign: state.campaign, sender })
    const at = new Date()
    p.update((cur) => recordSent(setPending(cur, e.leadId, undefined), e.leadId, { step: e.nextStep, sentAt: at.toISOString(), subject: built.ok ? built.subject : p.pitchFor(s).email.subject, via: 'manual' }, at))
    if (s.status === 'new') p.markContacted(s)
  }

  function renderRow(e: Enrollment) {
    const s = saved[e.leadId]
    const at = dueAt(e, state.campaign)
    const built = s ? buildStepEmail({ enrollment: e, saved: s, pitch: p.pitchFor(s), campaign: state.campaign, sender }) : undefined
    const total = state.campaign.followUps.length + 1
    return (
      <li key={e.leadId} className="space-y-1 rounded-lg border border-slate-200 p-3 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <button type="button" onClick={() => p.onOpenLead(e.leadId)} className="text-left font-semibold text-brand hover:underline">{s?.lead.name ?? e.leadId}</button>
          <span className="text-slate-500">Step {e.nextStep + 1} of {total}{at ? `, due ${formatDue(at)}` : ''}</span>
        </div>
        <p className="break-all text-slate-600">{e.email}</p>
        {e.lastError && <p className="text-red-700">{e.lastError}</p>}
        {built && !built.ok && <p className="text-red-700">{built.error}</p>}
        {e.pendingSend ? (
          <div className="space-y-1">
            <p className="text-amber-800">Send result unknown, check your Sent folder</p>
            <div className="flex gap-2">
              <button type="button" className={btn} onClick={() => markSent(e)}>Mark as sent</button>
              <button type="button" className={btn} onClick={() => p.update((cur) => setPending(cur, e.leadId, undefined))}>Retry</button>
            </div>
          </div>
        ) : !smtp && (
          <div className="flex flex-wrap gap-2">
            {built?.ok && ready ? (
              <a className={btn} href={mailtoHref(e.email, built.subject, built.body)}>Open in email app</a>
            ) : (
              <button type="button" className={btn} disabled>Open in email app</button>
            )}
            <button type="button" className={btn} disabled={!built?.ok || !ready} onClick={() => markSent(e)}>Mark as sent</button>
          </div>
        )}
      </li>
    )
  }

  return (
    <div className="space-y-4">
      {!ready && (
        <p role="status" className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          Add your name, business and postal address before sending.
          <button type="button" onClick={p.onOpenSettings} className="font-semibold underline">Open details</button>
        </p>
      )}
      {!smtp && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          No mailbox set up: use Open in email app, then Mark as sent
        </p>
      )}

      <section aria-label="Due now" className={section}>
        <h3 className="text-sm font-semibold">Due now ({due.length})</h3>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing is due. Add saved leads to outreach from their detail panel.</p>
        ) : (
          <ul className="space-y-2">{rows.map(renderRow)}</ul>
        )}
        {smtp && (
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={primary} disabled={status.running || !ready || due.length === 0} onClick={p.onRun}>Send due emails</button>
              {status.running && <button type="button" className={btn} onClick={p.onStop}>Stop</button>}
              <label className="ml-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={status.auto} disabled={!ready} onChange={(e) => p.onAuto(e.target.checked)} className="h-4 w-4 accent-brand" />
                Auto-send while this tab is open
              </label>
            </div>
            {status.running && (
              <p role="status" className="text-sm text-slate-600">
                Sent {status.sent} of {status.total}{status.nextAt ? `, next in ${countdown}s` : ''}
              </p>
            )}
            {!status.running && status.sent > 0 && <p role="status" className="text-sm text-slate-600">Sent {status.sent} of {status.total}</p>}
            {status.message && <p role="alert" className="text-sm text-red-700">{status.message}</p>}
            <p className="text-xs text-slate-500">{sentToday} of {mailbox.dailyCap} sent today</p>
          </div>
        )}
      </section>

      <section aria-label="In outreach" className={section}>
        <h3 className="text-sm font-semibold">In outreach ({enrolled.length})</h3>
        {enrolled.length === 0 ? (
          <p className="text-sm text-slate-500">No leads in outreach yet.</p>
        ) : (
          <ul className="space-y-2">
            {enrolled.map((e) => (
              <li key={e.leadId} className="space-y-1 rounded-lg border border-slate-200 p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <button type="button" onClick={() => p.onOpenLead(e.leadId)} className="text-left font-semibold text-brand hover:underline">{saved[e.leadId]?.lead.name ?? e.leadId}</button>
                  <span className="text-slate-500">{enrollmentLabel(e, state.campaign)}</span>
                </div>
                <p className="break-all text-slate-600">{e.email}</p>
                {e.history.length > 0 && (
                  <ul className="text-xs text-slate-500">
                    {e.history.map((h) => <li key={h.step}>Step {h.step + 1}, {when(h.sentAt)}, {h.via === 'smtp' ? 'sent by Lead Finder' : 'sent manually'}</li>)}
                  </ul>
                )}
                <div className="flex gap-2 pt-1">
                  {e.state !== 'stopped' && <button type="button" className={btn} onClick={() => p.update((cur) => suppress(cur, e.email))}>Unsubscribed</button>}
                  <button type="button" className={btn} onClick={() => p.update((cur) => unenroll(cur, e.leadId))}>Remove from outreach</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button" className={btn}
            onClick={() => {
              const r = enrollAll(state, saved, new Date())
              p.update(() => r.state)
              setReport(`Added ${r.added}, skipped ${r.skipped}`)
            }}
          >
            Add all saved leads with an email
          </button>
          {report && <span role="status" className="text-sm text-slate-600">{report}</span>}
        </div>
        {Object.values(saved).some((s) => !canEnroll(s, state).ok) && <p className="text-xs text-slate-500">Leads already in outreach, unsubscribed or marked replied, won or lost are skipped.</p>}
      </section>

      <SequenceEditor campaign={state.campaign} onSave={(campaign) => p.update((cur) => ({ ...cur, campaign }))} />

      <MailboxSettings mailbox={mailbox} sender={sender} onSave={p.onMailbox} onTest={p.onTest} />

      <section aria-label="Unsubscribed addresses" className={section}>
        <h3 className="text-sm font-semibold">Unsubscribed addresses ({state.suppressed.length})</h3>
        {state.suppressed.length === 0 ? (
          <p className="text-sm text-slate-500">No one has unsubscribed.</p>
        ) : (
          <ul className="space-y-0.5 text-sm text-slate-600">{state.suppressed.map((a) => <li key={a} className="break-all">{a}</li>)}</ul>
        )}
      </section>
    </div>
  )
}
