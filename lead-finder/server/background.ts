// Background mode: the server keeps a copy of a profile's outreach and, on a schedule, checks replies
// and sends due emails exactly as the open app would (same sequence, sending hours, warm-up, daily limit,
// gap between emails and compliance check). Each workspace is one profile ('agency' or a client id).
import { complianceError, complianceProblems } from '../src/lib/compliance.js'
import {
  buildStepEmail, dueSteps, mailboxReady, recordError, recordSent, sentTodayCount, setPending, stripFooter, suppress, syncWithSaved,
} from '../src/lib/outreach.js'
import { OPT_OUT_INTENTS, INTENT_LABELS, applyReplyDraft, inboxReady, inboxRequestFor, mergeReplies } from '../src/lib/replies.js'
import { effectiveDailyCap, inSendWindow } from '../src/lib/sendWindow.js'
import { mergeLeads, mergeOutreach } from '../src/lib/sync.js'
import type {
  AlertRequest, BackgroundLead, BackgroundMailbox, BackgroundStatus, CrmLead, InboxRequest, InboxResult, Mailbox, Offer, OutreachState,
  ReplyDraft, ReplyRequest, SavedLead, SendRequest, SendResult, Sender, StatusEvent, SyncRequest, SyncResponse,
} from '../src/lib/types.js'
import { aiReply } from './ai.js'
import { checkInbox } from './inbox.js'
import { integrations, sendAlert, syncCrm } from './integrations.js'
import { getJson, kv, kvConfigured, lock, setJson } from './kv.js'
import { sendViaSmtp } from './mailer.js'
import { decrypt, encrypt, secretConfigured } from './secret.js'

export type Workspace = {
  id: string
  updatedAt: string
  outreach: OutreachState
  leads: Record<string, BackgroundLead>
  sender: Sender
  offer?: Offer
  mailbox: BackgroundMailbox
  passEnc: string
  events: StatusEvent[]
  lastSentAt?: string
  lastRunAt?: string
  lastRunNote?: string
}

export type RunDeps = {
  now: () => Date
  sleep: (ms: number) => Promise<void>
  send: (req: SendRequest) => Promise<SendResult>
  inbox: (req: InboxRequest) => Promise<InboxResult>
  draft: (req: ReplyRequest) => Promise<ReplyDraft | null>
  alert: (a: AlertRequest) => Promise<unknown>
  crm: (leads: CrmLead[]) => Promise<unknown>
}

const realDeps: RunDeps = {
  now: () => new Date(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  send: (req) => sendViaSmtp(req),
  inbox: (req) => checkInbox(req),
  draft: (req) => aiReply(req),
  alert: (a) => (integrations().slack || integrations().webhook ? sendAlert(a) : Promise.resolve()),
  crm: (leads) => (integrations().hubspot || integrations().ghl ? syncCrm(leads) : Promise.resolve()),
}

export const WORKSPACES = 'lf:workspaces'
const wsKey = (id: string) => `lf:ws:${id}`
const lockKey = (id: string) => `lf:lock:${id}`
const MAX_EVENTS = 500
export const backgroundAvailable = () => kvConfigured() && secretConfigured()

export function validWorkspaceId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-z0-9-]{1,64}$/.test(id)
}

// A saved lead as the outreach helpers expect it, built from what the browser sent.
function savedFor(l: BackgroundLead): SavedLead {
  return {
    lead: { id: l.id, osmType: 'node', osmId: 0, osmUrl: '', name: l.name, category: l.category, categoryId: 'other', address: '', lat: 0, lon: 0, distanceKm: 0, ...(l.city ? { city: l.city } : {}) },
    status: l.status, notes: '', savedAt: l.updatedAt, updatedAt: l.updatedAt,
  }
}
const savedMap = (ws: Workspace) => Object.fromEntries(Object.values(ws.leads).map((l) => [l.id, savedFor(l)]))

function setStatus(ws: Workspace, leadId: string, status: BackgroundLead['status'], at: Date) {
  const l = ws.leads[leadId]
  if (!l) return
  ws.leads[leadId] = { ...l, status, updatedAt: at.toISOString() }
  ws.events = [...ws.events, { leadId, status, at: at.toISOString() }].slice(-MAX_EVENTS)
}

// ---- browser sync ----

export async function statusOf(id: string): Promise<BackgroundStatus> {
  if (!backgroundAvailable()) return { available: false, enabled: false }
  const ws = await getJson<Workspace>(wsKey(id))
  return { available: true, enabled: !!ws, ...(ws?.lastRunAt ? { lastRunAt: ws.lastRunAt } : {}), ...(ws?.lastRunNote ? { lastRunNote: ws.lastRunNote } : {}) }
}

// Turns background mode on (or keeps it on) with the browser's copy, merged with the server's.
export async function syncWorkspace(req: SyncRequest, now: Date = new Date()): Promise<SyncResponse | 'busy'> {
  const release = await lock(lockKey(req.workspace), 20_000)
  if (!release) return 'busy'
  try {
    const old = await getJson<Workspace>(wsKey(req.workspace))
    const { pass, ...mailbox } = req.mailbox
    const ws: Workspace = {
      id: req.workspace,
      updatedAt: now.toISOString(),
      outreach: old ? mergeOutreach(old.outreach, req.outreach) : req.outreach,
      leads: mergeLeads(req.leads, old?.events ?? []),
      sender: req.sender,
      ...(req.offer ? { offer: req.offer } : {}),
      mailbox,
      passEnc: encrypt(pass),
      events: old?.events ?? [],
      ...(old?.lastSentAt ? { lastSentAt: old.lastSentAt } : {}),
      ...(old?.lastRunAt ? { lastRunAt: old.lastRunAt } : {}),
      ...(old?.lastRunNote ? { lastRunNote: old.lastRunNote } : {}),
    }
    await setJson(wsKey(ws.id), ws)
    await kv('SADD', WORKSPACES, ws.id)
    return {
      available: true, enabled: true, outreach: ws.outreach, events: ws.events,
      ...(ws.lastRunAt ? { lastRunAt: ws.lastRunAt } : {}), ...(ws.lastRunNote ? { lastRunNote: ws.lastRunNote } : {}),
    }
  } finally {
    await release()
  }
}

// Turns it off: the server's copy (and the stored password) is deleted. Returns the last copy so the browser keeps its results.
export async function disableWorkspace(id: string): Promise<SyncResponse | 'busy'> {
  const release = await lock(lockKey(id), 20_000)
  if (!release) return 'busy'
  try {
    const ws = await getJson<Workspace>(wsKey(id))
    await kv('DEL', wsKey(id))
    await kv('SREM', WORKSPACES, id)
    return { available: true, enabled: false, ...(ws ? { outreach: ws.outreach } : {}), events: ws?.events ?? [] }
  } finally {
    await release()
  }
}

// ---- the scheduled run ----

function replyRequest(ws: Workspace, replyId: string): ReplyRequest | null {
  const r = ws.outreach.replies[replyId]
  const l = r && ws.leads[r.leadId]
  if (!r || !l || !r.text.trim()) return null
  const e = ws.outreach.enrollments[r.leadId]
  const last = e?.history[e.history.length - 1]
  const built = e && last ? buildStepEmail({ enrollment: { ...e, nextStep: last.step }, saved: savedFor(l), pitch: l.pitch, campaign: ws.outreach.campaign, sender: ws.sender }) : undefined
  return {
    lead: { name: l.name, category: l.category, ...(l.city ? { city: l.city } : {}) },
    sender: { name: ws.sender.name, business: ws.sender.business, ...(ws.sender.bookingUrl ? { bookingUrl: ws.sender.bookingUrl } : {}) },
    services: l.services,
    ...(ws.offer ? { offer: ws.offer } : {}),
    ourEmail: built?.ok
      ? { subject: last?.subject ?? built.subject, body: stripFooter(built.body, ws.sender) }
      : { subject: l.pitch.email.subject, body: stripFooter(l.pitch.email.body, ws.sender) },
    theirReply: r.text,
  }
}

async function checkReplies(ws: Workspace, mailbox: Mailbox, deps: RunDeps): Promise<string> {
  if (!inboxReady(mailbox)) return ''
  const req = inboxRequestFor(ws.outreach, mailbox, deps.now())
  if (!req) return ''
  const res = await deps.inbox(req)
  if (!res.ok) return `Reply check failed: ${res.error}`
  const at = deps.now()
  const m = mergeReplies(ws.outreach, res.messages, at)
  ws.outreach = { ...m.state, inboxCheckedAt: at.toISOString() }
  for (const id of m.replied) {
    const l = ws.leads[id]
    if (l && (l.status === 'new' || l.status === 'contacted')) setStatus(ws, id, 'replied', at)
  }
  for (const r of m.added) {
    if (r.handled) continue
    const req2 = replyRequest(ws, r.id)
    const d = req2 ? await deps.draft(req2).catch(() => null) : null
    if (d) ws.outreach = applyReplyDraft(ws.outreach, r.id, d, deps.now())
    const now = ws.outreach.replies[r.id]
    const l = ws.leads[r.leadId]
    if (!l || now.handled || (now.intent && OPT_OUT_INTENTS.includes(now.intent))) continue
    await deps.alert({
      event: 'reply', lead: { name: l.name, ...(l.city ? { city: l.city } : {}) }, from: now.from,
      ...(now.intent ? { intent: now.intent, intentLabel: INTENT_LABELS[now.intent] } : {}), ...(now.summary ? { summary: now.summary } : {}), text: now.text,
    }).catch(() => {})
    await deps.crm([{ name: l.name, email: now.from, status: 'replied', ...(l.city ? { city: l.city } : {}), category: l.category }]).catch(() => {})
  }
  const real = m.added.length - m.autoReplies
  return real ? `${real} new ${real === 1 ? 'reply' : 'replies'}` : ''
}

// Runs one workspace until its due emails are sent or the time is up. Returns what happened, in a few words.
export async function runWorkspace(id: string, deadline: number, deps: RunDeps = realDeps): Promise<string> {
  const release = await lock(lockKey(id), 120_000)
  if (!release) return 'busy'
  try {
    const ws = await getJson<Workspace>(wsKey(id))
    if (!ws) return 'not enabled'
    const save = () => setJson(wsKey(id), ws)
    const pass = decrypt(ws.passEnc)
    if (pass === null) {
      ws.lastRunAt = deps.now().toISOString()
      ws.lastRunNote = "The saved mailbox password can't be read (was BACKGROUND_SECRET changed?). Turn background mode off and on again."
      await save()
      return ws.lastRunNote
    }
    const mailbox: Mailbox = { ...ws.mailbox, pass }
    const notes: string[] = []
    const replies = await checkReplies(ws, mailbox, deps)
    if (replies) notes.push(replies)
    await save()

    let sent = 0
    const failed = new Set<string>()
    while (mailboxReady(mailbox)) {
      const now = deps.now()
      const saved = savedMap(ws)
      ws.outreach = syncWithSaved(ws.outreach, saved)
      const due = dueSteps(ws.outreach, saved, now, { skipRecentErrorsMs: 3_600_000 }).filter((e) => !failed.has(e.leadId))
      if (due.length === 0) break
      if (!inSendWindow(mailbox, now)) {
        notes.push('outside sending hours')
        break
      }
      if (sentTodayCount(ws.outreach, now) >= effectiveDailyCap(mailbox, ws.outreach.mailboxStartedAt, now)) {
        notes.push("today's limit reached")
        break
      }
      const nextAt = (ws.lastSentAt ? new Date(ws.lastSentAt).getTime() : 0) + mailbox.gapSeconds * 1000
      if (nextAt > now.getTime()) {
        // Wait for the gap between emails only if there's time left in this run.
        if (nextAt + 15_000 > deadline) break
        await deps.sleep(nextAt - now.getTime())
        continue
      }
      const e = due[0]
      const l = ws.leads[e.leadId]
      const step = e.nextStep
      const built = buildStepEmail({ enrollment: e, saved: saved[e.leadId], pitch: l.pitch, campaign: ws.outreach.campaign, sender: ws.sender })
      const kind = step === 0 ? 'first' : 'followup'
      const problems = built.ok ? complianceProblems({ kind, to: e.email, subject: built.subject, body: built.body }, ws.sender, ws.outreach.suppressed) : []
      if (!built.ok || problems.length) {
        ws.outreach = recordError(ws.outreach, e.leadId, built.ok ? complianceError(problems) : built.error, now)
        failed.add(e.leadId)
        continue
      }
      // Saved before sending: if this run dies mid-send, the email shows as "result unknown" and is never sent twice.
      ws.outreach = setPending(ws.outreach, e.leadId, { step, startedAt: now.toISOString() })
      await save()
      const res = await deps.send({
        smtp: { host: mailbox.host, port: mailbox.port, secure: mailbox.secure, user: mailbox.user, pass },
        from: { name: mailbox.fromName, address: mailbox.fromAddress },
        to: e.email, subject: built.subject, text: built.body,
        ...(built.inReplyTo ? { inReplyTo: built.inReplyTo } : {}),
        suppressed: ws.outreach.suppressed, kind,
      })
      const at = deps.now()
      ws.lastSentAt = at.toISOString()
      if (res.ok) {
        ws.outreach = recordSent(setPending(ws.outreach, e.leadId, undefined), e.leadId, { step, sentAt: at.toISOString(), subject: built.subject, via: 'smtp', messageId: res.messageId }, at)
        if (l.status === 'new') setStatus(ws, e.leadId, 'contacted', at)
        sent++
      } else {
        ws.outreach = recordError(setPending(ws.outreach, e.leadId, undefined), e.leadId, res.error, at)
        if (res.code === 'suppressed') ws.outreach = suppress(ws.outreach, e.email)
        failed.add(e.leadId)
        if (res.code === 'auth' || res.code === 'connection' || res.code === 'host') {
          notes.push(res.error)
          await save()
          break
        }
      }
      await save()
      if (deps.now().getTime() + 15_000 > deadline) break
    }
    if (sent) notes.unshift(`sent ${sent}`)
    ws.lastRunAt = deps.now().toISOString()
    ws.lastRunNote = notes.join(', ') || 'nothing due'
    await save()
    return ws.lastRunNote
  } finally {
    await release()
  }
}

export async function runAll(deadline: number, deps: RunDeps = realDeps): Promise<{ id: string; note: string }[]> {
  const ids = (await kv<string[]>('SMEMBERS', WORKSPACES)) ?? []
  const out: { id: string; note: string }[] = []
  for (const id of ids.filter(validWorkspaceId)) {
    if (deps.now().getTime() + 10_000 > deadline) break
    out.push({ id, note: await runWorkspace(id, deadline, deps).catch(() => 'failed') })
  }
  return out
}
