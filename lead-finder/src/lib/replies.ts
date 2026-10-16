// Replies to outreach emails: matching inbox messages to leads, the reply email, and loading from storage.
// Pure helpers, no React.
import { emailFooter } from './pitch.js'
import { isEmail } from './validate.js'
import type { InboxMessage, InboxRequest, Mailbox, OutreachState, Reply, ReplyDraft, ReplyIntent, Sender } from './types.js'

export const INTENT_LABELS: Record<ReplyIntent, string> = {
  interested: 'Interested',
  question: 'Has a question',
  not_now: 'Not now',
  not_interested: 'Not interested',
  unsubscribe: 'Unsubscribe',
  auto_reply: 'Auto-reply',
  other: 'Other',
}
const INTENTS = Object.keys(INTENT_LABELS) as ReplyIntent[]

export const IMAP_HOSTS: Record<string, string> = {
  'smtp.gmail.com': 'imap.gmail.com',
  'smtp.office365.com': 'outlook.office365.com',
  'smtp.zoho.com': 'imap.zoho.com',
}

const DAY_MS = 86_400_000
const LOOKBACK_DAYS = 45 // never search further back than this
const MAX_REPLIES = 300 // oldest handled replies are dropped beyond this
export const REPLY_BODY_MAX = 5000

export function inboxReady(m: Mailbox): boolean {
  return !!m.imapHost.trim() && !!m.user.trim() && !!m.pass
}

// Opt-outs, honoured even when AI is off. Every email says to reply "no thanks" to stop, so a
// "no thanks" or "not interested" counts as an opt-out too.
export function optOutIntent(text: string): 'unsubscribe' | 'not_interested' | undefined {
  const t = text.slice(0, 600).toLowerCase()
  if (/\bunsubscribe\b|\bremove me\b|\btake me off\b|\bstop (e-?mailing|contacting|sending)\b|\bdo not (e-?mail|contact)\b|\bdon'?t (e-?mail|contact)\b/.test(t)) return 'unsubscribe'
  if (/\bno,? thanks?\b|\bno thank you\b|\bnot interested\b/.test(t)) return 'not_interested'
  return undefined
}

// Intents that mean "don't email me again": the address is unsubscribed and the reply needs no answer.
export const OPT_OUT_INTENTS: ReplyIntent[] = ['unsubscribe', 'not_interested']

// Keeps the new part of a reply: cuts at the first "On ... wrote:", "-----Original Message-----",
// an Outlook "From:" header block or a run of "> " quoted lines.
export function stripQuoted(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const t = line.trim()
    if (/^-{2,}\s*original message\s*-{2,}$/i.test(t)) break
    if (/^_{5,}$/.test(t)) break
    if (/^on\b.{0,200}\bwrote:$/i.test(t)) break
    // "On Mon, Oct 6, 2026 at 9:00 AM Sam <sam@x.com>" + "wrote:" on the next line
    if (/^on\b.{0,200}$/i.test(t) && /^wrote:$/i.test((lines[i + 1] ?? '').trim())) break
    if (/^from:\s.+/i.test(t) && lines.slice(i + 1, i + 5).some((l) => /^(sent|date|to|subject):\s/i.test(l.trim()))) break
    if (t.startsWith('>')) {
      if (out.some((l) => l.trim())) break
      continue
    }
    out.push(line)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

// What to ask the server for: replies from anyone we have emailed, since the first of those emails.
export function inboxRequestFor(state: OutreachState, mailbox: Mailbox, now: Date): InboxRequest | null {
  const addresses = new Set<string>()
  const messageIds = new Set<string>()
  let first = Infinity
  for (const e of Object.values(state.enrollments)) {
    if (e.history.length === 0) continue
    addresses.add(e.email)
    for (const h of e.history) {
      if (h.messageId) messageIds.add(h.messageId)
      first = Math.min(first, new Date(h.sentAt).getTime())
    }
  }
  if (addresses.size === 0) return null
  const since = Math.max(first - DAY_MS, now.getTime() - LOOKBACK_DAYS * DAY_MS)
  return {
    imap: { host: mailbox.imapHost.trim(), user: mailbox.user, pass: mailbox.pass },
    since: new Date(since).toISOString(),
    addresses: [...addresses].slice(0, 2000),
    messageIds: [...messageIds].slice(0, 5000),
  }
}

// Which lead a message answers: one whose sent email it references, else one we emailed at that address.
export function leadForMessage(state: OutreachState, m: InboxMessage): string | undefined {
  const sent = Object.values(state.enrollments).filter((e) => e.history.length > 0)
  const byRef = sent.find((e) => e.history.some((h) => h.messageId && m.refs.includes(h.messageId)))
  if (byRef) return byRef.leadId
  return sent.find((e) => e.email === m.from)?.leadId
}

export type MergeResult = { state: OutreachState; added: Reply[]; replied: string[]; unsubscribed: number; autoReplies: number }

// Adds new messages as replies. A real reply stops the lead's sequence (the caller marks the lead Replied);
// an unsubscribe request also adds the address to the unsubscribed list; auto-replies are kept but change nothing.
export function mergeReplies(state: OutreachState, messages: InboxMessage[], now: Date): MergeResult {
  const replies = { ...state.replies }
  let suppressed = state.suppressed
  const enrollments = { ...state.enrollments }
  const added: Reply[] = []
  const replied = new Set<string>()
  let unsubscribed = 0
  let autoReplies = 0
  for (const m of messages) {
    if (replies[m.id]) continue
    const leadId = leadForMessage(state, m)
    if (!leadId) continue
    const at = now.toISOString()
    const reply: Reply = { ...m, leadId, receivedAt: at }
    if (m.auto) {
      reply.intent = 'auto_reply'
      reply.handled = { at, how: 'auto' }
      autoReplies++
    } else {
      replied.add(leadId)
      const optOut = optOutIntent(m.text)
      if (optOut) {
        reply.intent = optOut
        reply.handled = { at, how: 'auto' }
        const addr = enrollments[leadId]?.email ?? m.from
        for (const a of new Set([addr, m.from])) {
          if (isEmail(a) && !suppressed.includes(a)) suppressed = [...suppressed, a]
        }
        unsubscribed++
      }
    }
    const e = enrollments[leadId]
    if (!m.auto && e?.state === 'active') {
      enrollments[leadId] = { ...e, state: 'stopped', stopReason: reply.intent && OPT_OUT_INTENTS.includes(reply.intent) ? 'unsubscribed' : 'replied' }
    }
    replies[m.id] = reply
    added.push(reply)
  }
  if (added.length === 0) return { state, added, replied: [], unsubscribed, autoReplies }
  return {
    state: pruneReplies({ ...state, replies, suppressed, enrollments }),
    added, replied: [...replied], unsubscribed, autoReplies,
  }
}

function pruneReplies(state: OutreachState): OutreachState {
  const all = Object.values(state.replies)
  if (all.length <= MAX_REPLIES) return state
  const drop = all.filter((r) => r.handled).sort((a, b) => a.date.localeCompare(b.date)).slice(0, all.length - MAX_REPLIES)
  const replies = { ...state.replies }
  for (const r of drop) delete replies[r.id]
  return { ...state, replies }
}

export function updateReply(state: OutreachState, id: string, patch: Partial<Pick<Reply, 'intent' | 'summary' | 'draft' | 'handled'>>): OutreachState {
  const r = state.replies[id]
  if (!r) return state
  const next: Reply = { ...r, ...patch }
  if (patch.draft) next.draft = { body: patch.draft.body.slice(0, REPLY_BODY_MAX), source: patch.draft.source }
  return { ...state, replies: { ...state.replies, [id]: next } }
}

// Applies an AI draft. It never replaces text you edited unless you asked for a rewrite (force).
// An opt-out the AI spotted is honoured right away.
export function applyReplyDraft(state: OutreachState, id: string, d: ReplyDraft, now: Date, force = false): OutreachState {
  const r = state.replies[id]
  if (!r) return state
  let next = updateReply(state, id, {
    intent: d.intent, summary: d.summary,
    ...(d.body.trim() && !OPT_OUT_INTENTS.includes(d.intent) && (force || r.draft?.source !== 'edited') ? { draft: { body: d.body.trim(), source: 'ai' as const } } : {}),
  })
  if (OPT_OUT_INTENTS.includes(d.intent)) {
    const addr = state.enrollments[r.leadId]?.email ?? r.from
    const suppressed = [...new Set([...next.suppressed, ...[addr, r.from].filter(isEmail)])]
    next = { ...next, suppressed }
  }
  if ((OPT_OUT_INTENTS.includes(d.intent) || d.intent === 'auto_reply') && !r.handled) {
    next = updateReply(next, id, { handled: { at: now.toISOString(), how: 'auto' } })
  }
  return next
}

export function pendingReplies(state: OutreachState): Reply[] {
  return Object.values(state.replies).filter((r) => !r.handled).sort((a, b) => b.date.localeCompare(a.date))
}

export function handledReplies(state: OutreachState, limit = 20): Reply[] {
  return Object.values(state.replies).filter((r) => r.handled).sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
}

export function replySubject(subject: string): string {
  const s = subject.replace(/[\r\n]+/g, ' ').trim() || 'Your message'
  return (/^re:/i.test(s) ? s : `Re: ${s}`).slice(0, 200)
}

// The email that answers a reply: the draft, the signature and opt-out line, then their message quoted.
export function replyEmail(r: Reply, body: string, sender: Sender): { subject: string; body: string; inReplyTo?: string } {
  const when = new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const who = r.fromName ? `${r.fromName} <${r.from}>` : r.from
  const quoted = r.text.trim() ? `\n\nOn ${when}, ${who} wrote:\n${r.text.trim().split('\n').map((l) => `> ${l}`).join('\n')}` : ''
  return {
    subject: replySubject(r.subject),
    body: (body.trim() + emailFooter(sender) + quoted).slice(0, 20000),
    ...(r.messageId && /^<[^<>\s]{1,250}>$/.test(r.messageId) ? { inReplyTo: r.messageId } : {}),
  }
}

// ---- loading from localStorage (defensive) ----

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const iso = (v: unknown) => (typeof v === 'string' && !Number.isNaN(new Date(v).getTime()) ? v : '')
const HOW = ['sent', 'manual', 'dismissed', 'auto'] as const

function loadReply(raw: unknown): Reply | null {
  if (!isObj(raw)) return null
  const id = str(raw.id, 300)
  const leadId = str(raw.leadId, 300)
  const date = iso(raw.date)
  if (!id || !leadId || !date) return null
  const intent = INTENTS.includes(raw.intent as ReplyIntent) ? (raw.intent as ReplyIntent) : undefined
  const d = isObj(raw.draft) && typeof raw.draft.body === 'string' ? raw.draft : undefined
  const h = isObj(raw.handled) && HOW.includes(raw.handled.how as (typeof HOW)[number]) && iso(raw.handled.at) ? raw.handled : undefined
  const messageId = str(raw.messageId, 300)
  const fromName = str(raw.fromName, 200)
  return {
    id, leadId, date,
    from: str(raw.from, 254).toLowerCase(),
    ...(fromName ? { fromName } : {}),
    subject: str(raw.subject, 300),
    ...(messageId ? { messageId } : {}),
    refs: Array.isArray(raw.refs) ? raw.refs.filter((x): x is string => typeof x === 'string').slice(0, 20) : [],
    text: str(raw.text, 20000),
    auto: raw.auto === true,
    receivedAt: iso(raw.receivedAt) || date,
    ...(intent ? { intent } : {}),
    ...(typeof raw.summary === 'string' ? { summary: raw.summary.slice(0, 300) } : {}),
    ...(d ? { draft: { body: (d.body as string).slice(0, REPLY_BODY_MAX), source: d.source === 'ai' ? 'ai' as const : 'edited' as const } } : {}),
    ...(h ? { handled: { at: h.at as string, how: h.how as NonNullable<Reply['handled']>['how'] } } : {}),
  }
}

export function loadReplies(raw: unknown): Record<string, Reply> {
  const out: Record<string, Reply> = {}
  if (!isObj(raw)) return out
  for (const v of Object.values(raw)) {
    const r = loadReply(v)
    if (r) out[r.id] = r
  }
  return out
}
