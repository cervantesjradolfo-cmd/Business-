import { useState } from 'react'
import { Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { formatDue, mailtoHref } from '../lib/outreach'
import { INTENT_LABELS, REPLY_BODY_MAX, replyEmail } from '../lib/replies'
import type { ReplyCheck } from '../lib/useReplies'
import type { Reply, ReplyIntent, SavedLead, Sender } from '../lib/types'

type Props = {
  pending: Reply[] // waiting on you, newest first
  handled: Reply[] // recent handled ones, newest first
  saved: Record<string, SavedLead>
  sender: Sender
  canCheck: boolean // the mailbox has an IMAP server
  canSend: boolean // the mailbox can send
  checkedAt?: string
  check: ReplyCheck
  onCheck: () => void
  onDraft: (id: string) => Promise<boolean>
  onSend: (id: string, body: string) => Promise<{ ok: boolean; error?: string }>
  onSaveDraft: (id: string, body: string) => void
  onHandled: (id: string, how: 'manual' | 'dismissed') => void
  onOpenLead: (id: string) => void
}

const btn = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
const primary = 'rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50'
const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand'

const INTENT_STYLES: Record<ReplyIntent, string> = {
  interested: 'bg-green-50 text-green-800 ring-green-200',
  question: 'bg-blue-50 text-blue-800 ring-blue-200',
  not_now: 'bg-amber-50 text-amber-800 ring-amber-200',
  not_interested: 'bg-slate-100 text-slate-700 ring-slate-200',
  unsubscribe: 'bg-red-50 text-red-800 ring-red-200',
  auto_reply: 'bg-slate-100 text-slate-600 ring-slate-200',
  other: 'bg-slate-100 text-slate-700 ring-slate-200',
}
const HOW_LABELS = { sent: 'Answered', manual: 'Answered outside Lead Finder', dismissed: 'No answer needed', auto: 'Handled automatically' } as const

function IntentBadge({ intent }: { intent?: ReplyIntent }) {
  if (!intent) return null
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${INTENT_STYLES[intent]}`}>{INTENT_LABELS[intent]}</span>
}

function ReplyCard({ r, p }: { r: Reply; p: Props }) {
  const [body, setBody] = useState(r.draft?.body ?? '')
  const [synced, setSynced] = useState(r.draft?.body)
  const [busy, setBusy] = useState<'' | 'ai' | 'send'>('')
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  // A new AI draft replaces the text box, unless you have typed your own.
  if (r.draft?.body !== synced) {
    setSynced(r.draft?.body)
    if (r.draft && (body === (synced ?? '') || !body.trim())) setBody(r.draft.body)
  }
  const lead = p.saved[r.leadId]?.lead
  const drafting = busy === 'ai' || (p.check.drafting > 0 && !r.draft && !r.intent)
  const email = replyEmail(r, body, p.sender)

  async function ai() {
    setBusy('ai')
    setNote('')
    try {
      if (!(await p.onDraft(r.id))) setNote("AI writing isn't set up on this site (it needs ANTHROPIC_API_KEY on Vercel). Write your answer below.")
    } finally {
      setBusy('')
    }
  }

  async function send() {
    setBusy('send')
    setError('')
    try {
      const res = await p.onSend(r.id, body)
      if (!res.ok) setError(res.error ?? 'Sending failed.')
    } finally {
      setBusy('')
    }
  }

  return (
    <li className="space-y-2 rounded-lg border border-slate-200 p-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <button type="button" onClick={() => p.onOpenLead(r.leadId)} className="text-left font-semibold text-brand hover:underline">{lead?.name ?? r.from}</button>
        <span className="flex items-center gap-2 text-slate-500"><IntentBadge intent={r.intent} />{formatDue(new Date(r.date))}</span>
      </div>
      <p className="break-all text-slate-600">{r.fromName ? `${r.fromName} <${r.from}>` : r.from}</p>
      {r.summary && <p className="text-slate-700"><span className="font-medium">What they want: </span>{r.summary}</p>}
      <div>
        <p className="text-xs font-medium text-slate-600">Their reply</p>
        <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-slate-50 p-2 font-sans text-sm text-slate-800">{r.text || '(no text)'}</pre>
      </div>
      <label className="block">
        <span className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-600">
          Your answer
          {r.draft && <span className="rounded-full bg-white px-2 py-0.5 text-xs font-normal text-slate-600 ring-1 ring-slate-200">{r.draft.source === 'ai' ? 'Written by AI' : 'Edited'}</span>}
        </span>
        <textarea
          value={body} rows={7} maxLength={REPLY_BODY_MAX} disabled={busy === 'send'}
          placeholder={drafting ? 'AI is writing a draft…' : 'Write your answer'}
          onChange={(e) => setBody(e.target.value)}
          onBlur={() => body.trim() && body !== r.draft?.body && p.onSaveDraft(r.id, body)}
          className={input}
        />
      </label>
      <p className="text-xs text-slate-500">Read it before sending. Your signature and opt-out line are added, and their message is quoted below your answer.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {note && <p role="status" className="text-xs text-amber-800">{note}</p>}
      <div className="flex flex-wrap gap-2">
        {p.canSend && <button type="button" className={primary} disabled={!!busy || !body.trim()} onClick={send}>{busy === 'send' ? 'Sending…' : 'Send answer'}</button>}
        <button type="button" className={btn} disabled={!!busy} onClick={ai}>
          {drafting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
          {r.draft?.source === 'ai' ? 'Rewrite with AI' : 'Write with AI'}
        </button>
        {body.trim() ? <a className={btn} href={mailtoHref(r.from, email.subject, email.body)}>Open in email app</a> : <button type="button" className={btn} disabled>Open in email app</button>}
        <button type="button" className={btn} disabled={!!busy} onClick={() => p.onHandled(r.id, 'manual')}>Mark as answered</button>
        <button type="button" className={btn} disabled={!!busy} onClick={() => p.onHandled(r.id, 'dismissed')}>No answer needed</button>
      </div>
    </li>
  )
}

export default function RepliesPanel(p: Props) {
  const [showHandled, setShowHandled] = useState(false)
  return (
    <section aria-label="Replies" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Replies ({p.pending.length})</h3>
        <button type="button" className={btn} disabled={!p.canCheck || p.check.checking} onClick={p.onCheck}>
          {p.check.checking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          {p.check.checking ? 'Checking…' : 'Check for replies'}
        </button>
      </div>
      {!p.canCheck && <p className="text-sm text-slate-500">Add your mailbox below, including the incoming mail server (IMAP), to find replies automatically. Until then, set a lead to Replied yourself.</p>}
      {p.canCheck && (
        <p className="text-xs text-slate-500">
          {p.checkedAt ? `Last checked ${new Date(p.checkedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}. ` : ''}
          A reply stops that lead's follow-ups and marks it Replied. Unsubscribe requests and "no thanks" replies are added to Unsubscribed automatically.
          With auto-send on, replies are checked every 5 minutes.
        </p>
      )}
      {p.check.message && <p role="status" className="text-sm text-slate-600">{p.check.message}</p>}
      {p.check.error && <p role="alert" className="text-sm text-red-700">{p.check.error}</p>}
      {p.pending.length === 0 ? (
        p.canCheck && <p className="text-sm text-slate-500">No replies waiting for you.</p>
      ) : (
        <ul className="space-y-2">{p.pending.map((r) => <ReplyCard key={r.id} r={r} p={p} />)}</ul>
      )}
      {p.handled.length > 0 && (
        <div>
          <button type="button" aria-expanded={showHandled} onClick={() => setShowHandled(!showHandled)} className="text-sm font-medium text-brand hover:underline">
            {showHandled ? 'Hide handled replies' : `Show handled replies (${p.handled.length})`}
          </button>
          {showHandled && (
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {p.handled.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => p.onOpenLead(r.leadId)} className="font-medium text-brand hover:underline">{p.saved[r.leadId]?.lead.name ?? r.from}</button>
                  <IntentBadge intent={r.intent} />
                  <span>{formatDue(new Date(r.date))}, {r.handled ? HOW_LABELS[r.handled.how] : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
