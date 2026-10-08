// Outreach (cold email): follow-up templates, scheduling and enrollment rules. Pure helpers, no React.
// Edit the default follow-up wording here.
import { STATUS_LABELS } from './csv'
import { emailFooter } from './pitch'
import { readJson } from './storage'
import { isEmail } from './validate'
import type {
  Campaign, Draft, Enrollment, Mailbox, OutreachEntry, OutreachState, Pitch, SavedLead, Sender, StopReason,
} from './types'

export const OUTREACH_VARIABLES = ['business', 'sender_name', 'sender_business', 'city'] as const
type Vars = Record<(typeof OUTREACH_VARIABLES)[number], string>

const FOLLOW_UP_1 = 'Hi {{business}} team,\n\nI wanted to follow up on my note below in case it got buried. Would a quick call this week work?'
const FOLLOW_UP_2 = "Hi {{business}} team,\n\nI haven't heard back, so I'll assume the timing isn't right. If that changes, just reply to this email and I'll get back to you."

export const DEFAULT_CAMPAIGN: Campaign = {
  followUps: [
    { delayDays: 3, body: FOLLOW_UP_1 },
    { delayDays: 7, body: FOLLOW_UP_2 },
  ],
}

export const EMPTY_MAILBOX: Mailbox = {
  host: '', port: 465, secure: true, user: '', pass: '', fromName: '', fromAddress: '', gapSeconds: 45, dailyCap: 30,
}

export const MAILBOX_PRESETS: { id: 'gmail' | 'outlook' | 'zoho' | 'other'; label: string; host: string; port: 465 | 587 }[] = [
  { id: 'gmail', label: 'Gmail / Google Workspace', host: 'smtp.gmail.com', port: 465 },
  { id: 'outlook', label: 'Outlook / Microsoft 365', host: 'smtp.office365.com', port: 587 },
  { id: 'zoho', label: 'Zoho Mail', host: 'smtp.zoho.com', port: 465 },
  { id: 'other', label: 'Other SMTP', host: '', port: 587 },
]

const DAY_MS = 86_400_000
const MAX_FOLLOW_UPS = 2

// ---- templates ----

export function renderTemplate(tpl: string, vars: Vars): string {
  return tpl.replace(/\{\{\s*([A-Za-z_]+)\s*\}\}/g, (m, name: string) =>
    (OUTREACH_VARIABLES as readonly string[]).includes(name) ? vars[name as keyof Vars] : m,
  )
}

export function unknownVariables(tpl: string): string[] {
  const out: string[] = []
  for (const m of tpl.matchAll(/\{\{\s*([^{}]*?)\s*\}\}/g)) {
    if (!(OUTREACH_VARIABLES as readonly string[]).includes(m[1]) && !out.includes(m[1])) out.push(m[1])
  }
  return out
}

export function followUpSubject(subject: string): string {
  return /^re:/i.test(subject.trim()) ? subject.trim() : `Re: ${subject.trim()}`
}

export function outreachEmailFor(s: SavedLead): string {
  if (typeof s.outreachEmail === 'string') return s.outreachEmail.trim()
  return (s.lead.email ?? '').split(/[;,]/)[0].trim()
}

export function senderReady(sender: Sender): boolean {
  return !!sender.name.trim() && !!sender.business.trim() && !!sender.address.trim()
}

export function mailboxReady(m: Mailbox): boolean {
  return !!m.host.trim() && !!m.user.trim() && !!m.pass && isEmail(m.fromAddress)
}

// ---- step emails ----

export type StepSource = 'template' | 'ai' | 'edited'
export type BuiltEmail =
  | { ok: true; subject: string; body: string; inReplyTo?: string; source: StepSource }
  | { ok: false; error: string }

// The pitch body without its signature and opt-out line (what a step-0 draft starts from).
export function stripFooter(body: string, sender: Sender): string {
  const footer = emailFooter(sender)
  return (body.endsWith(footer) ? body.slice(0, -footer.length) : body).trimEnd()
}

export function buildStepEmail(a: {
  enrollment: Enrollment; saved: SavedLead; pitch: Pitch; campaign: Campaign; sender: Sender
}): BuiltEmail {
  const { enrollment, saved, pitch, campaign, sender } = a
  if (!senderReady(sender)) return { ok: false, error: 'Add the name, business and postal address under Your/Profile details first.' }
  const footer = emailFooter(sender)
  const draft = enrollment.drafts?.[enrollment.nextStep]
  if (enrollment.nextStep === 0) {
    if (draft) return { ok: true, subject: draft.subject?.trim() || pitch.email.subject, body: draft.body.trim() + footer, source: draft.source }
    if (!pitch.email.body.endsWith(footer)) {
      return { ok: false, error: "This pitch was written before your details changed. Press Regenerate in the lead's Pitch panel." }
    }
    return { ok: true, subject: pitch.email.subject, body: pitch.email.body, source: pitch.source === 'ai' ? 'ai' : 'template' }
  }
  const followUp = campaign.followUps[enrollment.nextStep - 1]
  if (!followUp) return { ok: false, error: 'That follow-up is no longer in the sequence.' }
  const inReplyTo0 = enrollment.history.find((h) => h.step === 0)?.messageId
  if (draft) {
    return {
      ok: true,
      subject: followUpSubject(enrollment.subject ?? pitch.email.subject),
      body: draft.body.trim() + footer,
      source: draft.source,
      ...(inReplyTo0 ? { inReplyTo: inReplyTo0 } : {}),
    }
  }
  const vars: Vars = {
    business: saved.lead.name,
    sender_name: sender.name.trim(),
    sender_business: sender.business.trim(),
    city: saved.lead.city ?? saved.lead.project?.city ?? 'your area',
  }
  return {
    ok: true,
    subject: followUpSubject(enrollment.subject ?? pitch.email.subject),
    body: renderTemplate(followUp.body.trim(), vars) + footer,
    source: 'template',
    ...(inReplyTo0 ? { inReplyTo: inReplyTo0 } : {}),
  }
}

export const DRAFT_SUBJECT_MAX = 200
export const DRAFT_BODY_MAX = 5000

// Saves (or with undefined, removes) the wording for one step of a lead's sequence.
export function setDraft(state: OutreachState, leadId: string, step: number, draft: Draft | undefined): OutreachState {
  const e = state.enrollments[leadId]
  if (!e) return state
  const drafts = { ...e.drafts }
  if (draft) {
    drafts[step] = {
      body: draft.body.slice(0, DRAFT_BODY_MAX),
      source: draft.source,
      // Subjects are single-line: a line break would be header injection.
      ...(step === 0 && draft.subject?.trim() ? { subject: draft.subject.replace(/[\r\n]+/g, ' ').trim().slice(0, DRAFT_SUBJECT_MAX) } : {}),
    }
  } else delete drafts[step]
  const updated: Enrollment = { ...e, drafts }
  if (Object.keys(drafts).length === 0) delete updated.drafts
  return { ...state, enrollments: { ...state.enrollments, [leadId]: updated } }
}

// ---- enrollment ----

export type EnrollCheck = { ok: true; email: string } | { ok: false; reason: string }

export function canEnroll(s: SavedLead | undefined, state: OutreachState): EnrollCheck {
  if (!s) return { ok: false, reason: 'Save the lead first' }
  const email = outreachEmailFor(s)
  if (!isEmail(email)) return { ok: false, reason: 'Add a valid email for outreach' }
  const lower = email.toLowerCase()
  if (state.suppressed.includes(lower)) return { ok: false, reason: 'This address unsubscribed' }
  if (state.enrollments[s.lead.id]) return { ok: false, reason: 'Already in outreach' }
  if (Object.values(state.enrollments).some((e) => e.state !== 'stopped' && e.email === lower)) {
    return { ok: false, reason: 'Another lead in outreach uses this address' }
  }
  if (s.status === 'replied' || s.status === 'won' || s.status === 'lost') {
    return { ok: false, reason: `Lead is marked ${STATUS_LABELS[s.status]}` }
  }
  return { ok: true, email: lower }
}

export function enroll(state: OutreachState, s: SavedLead, now: Date): OutreachState {
  const check = canEnroll(s, state)
  if (!check.ok) return state
  const e: Enrollment = { leadId: s.lead.id, email: check.email, enrolledAt: now.toISOString(), nextStep: 0, state: 'active', history: [] }
  return { ...state, enrollments: { ...state.enrollments, [e.leadId]: e } }
}

export function enrollAll(
  state: OutreachState, saved: Record<string, SavedLead>, now: Date,
): { state: OutreachState; added: number; skipped: number } {
  let next = state
  let added = 0
  let skipped = 0
  for (const s of Object.values(saved)) {
    // leads with no email at all are not "skipped": there was nothing to add
    if (!outreachEmailFor(s)) continue
    const after = enroll(next, s, now)
    if (after === next) skipped++
    else added++
    next = after
  }
  return { state: next, added, skipped }
}

export function unenroll(state: OutreachState, leadId: string): OutreachState {
  if (!state.enrollments[leadId]) return state
  const enrollments = { ...state.enrollments }
  delete enrollments[leadId]
  return { ...state, enrollments }
}

// ---- scheduling ----

export function dueAt(e: Enrollment, campaign: Campaign): Date | null {
  if (e.state !== 'active') return null
  if (e.nextStep === 0) return new Date(e.enrolledAt)
  const followUp = campaign.followUps[e.nextStep - 1]
  if (!followUp) return null
  const last = e.history[e.history.length - 1]
  const from = new Date(last ? last.sentAt : e.enrolledAt).getTime()
  return new Date(from + followUp.delayDays * DAY_MS)
}

export function dueSteps(
  state: OutreachState, saved: Record<string, SavedLead>, now: Date, opts?: { skipRecentErrorsMs?: number },
): Enrollment[] {
  const out: { e: Enrollment; at: number }[] = []
  for (const e of Object.values(state.enrollments)) {
    if (e.state !== 'active' || e.pendingSend) continue
    const s = saved[e.leadId]
    if (!s || (s.status !== 'new' && s.status !== 'contacted')) continue
    if (state.suppressed.includes(e.email)) continue
    const at = dueAt(e, state.campaign)
    if (!at || at.getTime() > now.getTime()) continue
    if (opts?.skipRecentErrorsMs !== undefined && e.lastErrorAt && now.getTime() - new Date(e.lastErrorAt).getTime() < opts.skipRecentErrorsMs) continue
    out.push({ e, at: at.getTime() })
  }
  out.sort((a, b) => a.at - b.at || a.e.enrolledAt.localeCompare(b.e.enrolledAt))
  return out.map((o) => o.e)
}

// Stops enrollments whose lead is gone, answered or unsubscribed; finishes ones past the end of the sequence.
export function syncWithSaved(state: OutreachState, saved: Record<string, SavedLead>): OutreachState {
  let changed = false
  const enrollments: Record<string, Enrollment> = {}
  for (const [id, e] of Object.entries(state.enrollments)) {
    let next = e
    if (e.state === 'active') {
      const s = saved[e.leadId]
      let reason: StopReason | undefined
      if (!s) reason = 'removed'
      else if (s.status === 'replied' || s.status === 'won' || s.status === 'lost') reason = s.status
      else if (state.suppressed.includes(e.email)) reason = 'unsubscribed'
      if (reason) next = { ...e, state: 'stopped', stopReason: reason }
      else if (e.nextStep > state.campaign.followUps.length) next = { ...e, state: 'finished' }
    }
    if (next !== e) changed = true
    enrollments[id] = next
  }
  return changed ? { ...state, enrollments } : state
}

// "Oct 10" in the user's time zone
export function formatDue(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// "Step 2 of 3 due Oct 10", "Finished", "Stopped: replied"
export function enrollmentLabel(e: Enrollment, campaign: Campaign): string {
  if (e.state === 'finished') return 'Finished'
  if (e.state === 'stopped') return `Stopped: ${e.stopReason ?? 'removed'}`
  const at = dueAt(e, campaign)
  return `Step ${e.nextStep + 1} of ${campaign.followUps.length + 1}${at ? ` due ${formatDue(at)}` : ''}`
}

// ---- recording ----

export function localDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function sentTodayCount(state: OutreachState, now: Date): number {
  return state.sentToday.day === localDay(now) ? state.sentToday.count : 0
}

export function recordSent(state: OutreachState, leadId: string, entry: OutreachEntry, now: Date): OutreachState {
  const e = state.enrollments[leadId]
  if (!e || entry.step !== e.nextStep) return state
  const nextStep = entry.step + 1
  const updated: Enrollment = {
    ...e,
    history: [...e.history, entry],
    ...(entry.step === 0 ? { subject: entry.subject } : {}),
    nextStep,
    state: e.state === 'active' && nextStep > state.campaign.followUps.length ? 'finished' : e.state,
  }
  delete updated.pendingSend
  delete updated.lastError
  delete updated.lastErrorAt
  const sentToday = entry.via === 'smtp' ? { day: localDay(now), count: sentTodayCount(state, now) + 1 } : state.sentToday
  return { ...state, enrollments: { ...state.enrollments, [leadId]: updated }, sentToday }
}

export function recordError(state: OutreachState, leadId: string, error: string, now: Date): OutreachState {
  const e = state.enrollments[leadId]
  if (!e) return state
  return { ...state, enrollments: { ...state.enrollments, [leadId]: { ...e, lastError: error, lastErrorAt: now.toISOString() } } }
}

export function setPending(state: OutreachState, leadId: string, pending: Enrollment['pendingSend'] | undefined): OutreachState {
  const e = state.enrollments[leadId]
  if (!e) return state
  const updated = { ...e }
  if (pending) updated.pendingSend = pending
  else delete updated.pendingSend
  return { ...state, enrollments: { ...state.enrollments, [leadId]: updated } }
}

export function suppress(state: OutreachState, email: string): OutreachState {
  const lower = email.trim().toLowerCase()
  if (!lower) return state
  const enrollments: Record<string, Enrollment> = {}
  for (const [id, e] of Object.entries(state.enrollments)) {
    enrollments[id] = e.email === lower && e.state !== 'stopped' ? { ...e, state: 'stopped', stopReason: 'unsubscribed' } : e
  }
  return { ...state, enrollments, suppressed: state.suppressed.includes(lower) ? state.suppressed : [...state.suppressed, lower] }
}

export function mailtoHref(to: string, subject: string, body: string): string {
  const crlf = body.replace(/\r?\n/g, '\r\n')
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(crlf)}`
}

// ---- loading from localStorage (defensive, like loadSaved) ----

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const clampInt = (v: unknown, min: number, max: number, def: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : def
const isoOrEmpty = (v: unknown): string => (typeof v === 'string' && !Number.isNaN(new Date(v).getTime()) ? v : '')
const STOP_REASONS: StopReason[] = ['replied', 'won', 'lost', 'removed', 'unsubscribed']

function loadCampaign(raw: unknown): Campaign {
  if (!isObj(raw) || !Array.isArray(raw.followUps)) return DEFAULT_CAMPAIGN
  const followUps = []
  for (const f of raw.followUps) {
    if (!isObj(f) || typeof f.body !== 'string') continue
    followUps.push({ delayDays: clampInt(f.delayDays, 1, 60, 3), body: f.body.slice(0, 5000) })
    if (followUps.length === MAX_FOLLOW_UPS) break
  }
  return { followUps }
}

function loadEntry(raw: unknown): OutreachEntry | null {
  if (!isObj(raw) || typeof raw.step !== 'number' || !Number.isInteger(raw.step) || raw.step < 0 || raw.step > MAX_FOLLOW_UPS) return null
  const sentAt = isoOrEmpty(raw.sentAt)
  if (!sentAt || typeof raw.subject !== 'string') return null
  return {
    step: raw.step, sentAt, subject: raw.subject, via: raw.via === 'manual' ? 'manual' : 'smtp',
    ...(typeof raw.messageId === 'string' && raw.messageId ? { messageId: raw.messageId } : {}),
  }
}

function loadDrafts(raw: unknown): Enrollment['drafts'] | undefined {
  if (!isObj(raw)) return undefined
  const out: NonNullable<Enrollment['drafts']> = {}
  for (const [k, v] of Object.entries(raw)) {
    const step = Number(k)
    if (!Number.isInteger(step) || step < 0 || step > MAX_FOLLOW_UPS || !isObj(v) || typeof v.body !== 'string') continue
    out[step] = {
      body: v.body.slice(0, DRAFT_BODY_MAX),
      source: v.source === 'ai' ? 'ai' : 'edited',
      ...(step === 0 && typeof v.subject === 'string' && v.subject.trim() ? { subject: v.subject.replace(/[\r\n]+/g, ' ').trim().slice(0, DRAFT_SUBJECT_MAX) } : {}),
    }
  }
  return Object.keys(out).length ? out : undefined
}

function loadEnrollment(raw: unknown): Enrollment | null {
  if (!isObj(raw) || typeof raw.leadId !== 'string' || !raw.leadId || typeof raw.email !== 'string') return null
  const history = (Array.isArray(raw.history) ? raw.history : []).map(loadEntry).filter((h): h is OutreachEntry => !!h)
  const state = raw.state === 'finished' || raw.state === 'stopped' ? raw.state : 'active'
  const pending = isObj(raw.pendingSend) && typeof raw.pendingSend.step === 'number' ? raw.pendingSend : undefined
  const drafts = loadDrafts(raw.drafts)
  return {
    leadId: raw.leadId,
    email: raw.email.trim().toLowerCase(),
    enrolledAt: isoOrEmpty(raw.enrolledAt) || new Date().toISOString(),
    nextStep: clampInt(raw.nextStep, 0, MAX_FOLLOW_UPS + 1, history.length),
    state,
    ...(STOP_REASONS.includes(raw.stopReason as StopReason) ? { stopReason: raw.stopReason as StopReason } : {}),
    ...(typeof raw.subject === 'string' ? { subject: raw.subject } : {}),
    history,
    ...(pending ? { pendingSend: { step: pending.step as number, startedAt: isoOrEmpty(pending.startedAt) || new Date().toISOString() } } : {}),
    ...(typeof raw.lastError === 'string' ? { lastError: raw.lastError } : {}),
    ...(isoOrEmpty(raw.lastErrorAt) ? { lastErrorAt: raw.lastErrorAt as string } : {}),
    ...(drafts ? { drafts } : {}),
  }
}

export function loadOutreach(key: string): OutreachState {
  const raw = readJson<unknown>(key, null)
  const r = isObj(raw) ? raw : {}
  const enrollments: Record<string, Enrollment> = {}
  if (isObj(r.enrollments)) {
    for (const v of Object.values(r.enrollments)) {
      const e = loadEnrollment(v)
      if (e) enrollments[e.leadId] = e
    }
  }
  const suppressed: string[] = []
  for (const v of Array.isArray(r.suppressed) ? r.suppressed : []) {
    const s = typeof v === 'string' ? v.trim().toLowerCase() : ''
    if (isEmail(s) && !suppressed.includes(s)) suppressed.push(s)
  }
  const st = isObj(r.sentToday) ? r.sentToday : {}
  return {
    campaign: loadCampaign(r.campaign),
    enrollments,
    suppressed,
    sentToday: { day: typeof st.day === 'string' ? st.day : '', count: clampInt(st.count, 0, 1_000_000, 0) },
  }
}

export function loadMailbox(key: string): Mailbox {
  const raw = readJson<unknown>(key, null)
  const r = isObj(raw) ? raw : {}
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  const known = r.port === 465 || r.port === 587 || r.port === 2525
  const port = known ? (r.port as 465 | 587 | 2525) : 465
  return {
    host: str(r.host).trim(),
    port,
    secure: port === 465,
    user: str(r.user),
    pass: str(r.pass),
    fromName: str(r.fromName),
    fromAddress: str(r.fromAddress).trim(),
    gapSeconds: clampInt(r.gapSeconds, 20, 300, EMPTY_MAILBOX.gapSeconds),
    dailyCap: clampInt(r.dailyCap, 1, 200, EMPTY_MAILBOX.dailyCap),
  }
}
