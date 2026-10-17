// Background mode keeps two copies of a profile's outreach: the browser's and the server's (which sends
// and checks replies while the app is closed). mergeOutreach combines them so neither side loses work:
// the server owns what it did (emails sent, replies found), you own what you decided (sequence wording,
// drafts, who is in outreach, unsubscribes), and a stop on either side always wins.
import type { BackgroundLead, Enrollment, LeadStatus, OutreachState, Reply, SavedLead, StatusEvent } from './types.js'

const later = (a?: string, b?: string) => (!a ? b : !b ? a : a > b ? a : b)
const earlier = (a?: string, b?: string) => (!a ? b : !b ? a : a < b ? a : b)

function mergeEnrollment(server: Enrollment, client: Enrollment): Enrollment {
  // Whoever got further along the sequence knows what was sent.
  const base = client.history.length > server.history.length ? client : server
  const other = base === server ? client : server
  const stopped = [base, other].find((e) => e.state === 'stopped')
  const finished = [base, other].find((e) => e.state === 'finished')
  const merged: Enrollment = { ...base }
  if (stopped) {
    merged.state = 'stopped'
    if (stopped.stopReason) merged.stopReason = stopped.stopReason
  } else if (finished) merged.state = 'finished'
  // Drafts are your edits: the browser's copy wins.
  if (client.drafts) merged.drafts = client.drafts
  else delete merged.drafts
  return merged
}

function mergeReply(server: Reply, client: Reply): Reply {
  const merged: Reply = { ...server, ...client }
  merged.intent = server.intent ?? client.intent
  merged.summary = server.summary ?? client.summary
  const draft = client.draft?.source === 'edited' ? client.draft : (server.draft ?? client.draft)
  if (draft) merged.draft = draft
  else delete merged.draft
  const handled = client.handled ?? server.handled
  if (handled) merged.handled = handled
  else delete merged.handled
  return merged
}

export function mergeOutreach(server: OutreachState, client: OutreachState): OutreachState {
  const removed: Record<string, string> = { ...server.removed }
  for (const [id, at] of Object.entries(client.removed ?? {})) removed[id] = later(removed[id], at)!

  const enrollments: Record<string, Enrollment> = {}
  for (const id of new Set([...Object.keys(server.enrollments), ...Object.keys(client.enrollments)])) {
    const s = server.enrollments[id]
    const c = client.enrollments[id]
    const e = s && c ? mergeEnrollment(s, c) : (s ?? c)!
    // Taken out of outreach after it was added: stays out.
    if (removed[id] && removed[id] >= e.enrolledAt) continue
    enrollments[id] = e
  }
  for (const id of Object.keys(removed)) if (enrollments[id]) delete removed[id]

  const replies: Record<string, Reply> = {}
  for (const id of new Set([...Object.keys(server.replies), ...Object.keys(client.replies)])) {
    const s = server.replies[id]
    const c = client.replies[id]
    replies[id] = s && c ? mergeReply(s, c) : (s ?? c)!
  }

  const sameDay = server.sentToday.day === client.sentToday.day
  const sentToday = sameDay
    ? { day: server.sentToday.day, count: Math.max(server.sentToday.count, client.sentToday.count) }
    : server.sentToday.day > client.sentToday.day ? server.sentToday : client.sentToday

  const mailboxStartedAt = earlier(server.mailboxStartedAt, client.mailboxStartedAt)
  const inboxCheckedAt = later(server.inboxCheckedAt, client.inboxCheckedAt)
  return {
    campaign: client.campaign,
    enrollments,
    suppressed: [...new Set([...server.suppressed, ...client.suppressed])],
    sentToday,
    replies,
    ...(inboxCheckedAt ? { inboxCheckedAt } : {}),
    ...(mailboxStartedAt ? { mailboxStartedAt } : {}),
    ...(Object.keys(removed).length ? { removed } : {}),
  }
}

// Lead statuses: yours, unless the server changed one after you last did (it sent an email, or they replied).
export function mergeLeads(client: Record<string, BackgroundLead>, events: StatusEvent[]): Record<string, BackgroundLead> {
  const out: Record<string, BackgroundLead> = {}
  for (const [id, c] of Object.entries(client)) {
    const ev = events.filter((e) => e.leadId === id && e.at > c.updatedAt).sort((a, b) => b.at.localeCompare(a.at))[0]
    out[id] = ev ? { ...c, status: ev.status, updatedAt: ev.at } : c
  }
  return out
}

// The server's status changes that the browser hasn't seen yet and that are newer than your own edit.
export function statusChangesFor(saved: Record<string, SavedLead>, events: StatusEvent[], seenUntil: string): { leadId: string; status: LeadStatus }[] {
  const latest = new Map<string, StatusEvent>()
  for (const e of events) {
    if (e.at <= seenUntil) continue
    const s = saved[e.leadId]
    if (!s || s.updatedAt >= e.at || s.status === e.status) continue
    const prev = latest.get(e.leadId)
    if (!prev || e.at > prev.at) latest.set(e.leadId, e)
  }
  return [...latest.values()].map((e) => ({ leadId: e.leadId, status: e.status }))
}
