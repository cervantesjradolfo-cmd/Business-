import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_CAMPAIGN, buildStepEmail, canEnroll, dueAt, dueSteps, enroll, enrollAll, recordError, recordSent, sentTodayCount,
  setPending, suppress, syncWithSaved, unenroll,
} from './outreach'
import { emailFooter } from './pitch'
import type { OutreachState, Pitch, SavedLead, Sender } from './types'

const SENDER: Sender = { name: 'Sam', business: 'Acme Web', email: 'sam@acme.example.com', phone: '', address: '1 Main St', website: '' }
const lead = (id: string, status: SavedLead['status'] = 'new', email = `${id}@biz.example.com`): SavedLead => ({
  lead: { id, osmType: 'node', osmId: 1, osmUrl: '', name: `Biz ${id}`, category: 'Cafe', categoryId: 'cafes', address: '', lat: 0, lon: 0, distanceKm: 1, email },
  status, notes: '', savedAt: '', updatedAt: '',
})
const empty = (): OutreachState => ({ campaign: DEFAULT_CAMPAIGN, enrollments: {}, suppressed: [], sentToday: { day: '', count: 0 } })
const T0 = new Date('2026-10-01T09:00:00')
const DAY = 86_400_000
const at = (ms: number) => new Date(T0.getTime() + ms)
const entry = (step: number, d: Date) => ({ step, sentAt: d.toISOString(), subject: 'S', via: 'smtp' as const, messageId: `<m${step}@x>` })

beforeEach(() => window.localStorage.clear())
afterEach(() => window.localStorage.clear())

describe('follow-up delays count from the previous send, not from enrollment', () => {
  it('a late step 1 pushes step 2 out from the actual send time', () => {
    const saved = { a: lead('a') }
    let s = enroll(empty(), saved.a, T0)
    s = recordSent(s, 'a', entry(0, at(10 * DAY)), at(10 * DAY)) // sent 10 days late
    expect(dueAt(s.enrollments.a, s.campaign)).toEqual(at(13 * DAY))
    expect(dueSteps(s, saved, at(12 * DAY)).length).toBe(0)
    expect(dueSteps(s, saved, at(13 * DAY)).map((e) => e.leadId)).toEqual(['a'])
    s = recordSent(s, 'a', entry(1, at(14 * DAY)), at(14 * DAY))
    expect(dueAt(s.enrollments.a, s.campaign)).toEqual(at(21 * DAY))
    expect(dueSteps(s, saved, at(20 * DAY)).length).toBe(0)
  })
  it('a manual send also anchors the delay', () => {
    let s = enroll(empty(), lead('a'), T0)
    s = recordSent(s, 'a', { ...entry(0, at(DAY)), via: 'manual' }, at(DAY))
    expect(dueAt(s.enrollments.a, s.campaign)).toEqual(at(4 * DAY))
  })
  it('does not count a manual send toward the daily SMTP cap', () => {
    let s = enroll(empty(), lead('a'), T0)
    s = recordSent(s, 'a', { ...entry(0, T0), via: 'manual' }, T0)
    expect(sentTodayCount(s, T0)).toBe(0)
  })
})

describe('daily cap accounting', () => {
  it('counts SMTP sends within a day and resets the next local day', () => {
    let s = empty()
    for (const id of ['a', 'b', 'c']) s = enroll(s, lead(id), T0)
    for (const id of ['a', 'b', 'c']) s = recordSent(s, id, entry(0, T0), T0)
    expect(sentTodayCount(s, T0)).toBe(3)
    expect(sentTodayCount(s, at(DAY))).toBe(0)
    s = recordSent(s, 'a', entry(1, at(3 * DAY)), at(3 * DAY))
    expect(s.sentToday.count).toBe(1)
  })
})

describe('stopping sequences', () => {
  const saved = { a: lead('a'), b: lead('b'), c: lead('c') }
  const started = () => {
    let s = empty()
    for (const id of ['a', 'b', 'c']) s = recordSent(enroll(s, saved[id as 'a'], T0), id, entry(0, T0), T0)
    return s
  }
  it.each(['replied', 'won', 'lost'] as const)('stops when the saved status becomes %s, and dueSteps excludes it even before sync', (status) => {
    const s = started()
    const now = at(4 * DAY)
    const after = { ...saved, a: lead('a', status) }
    expect(dueSteps(s, after, now).map((e) => e.leadId)).toEqual(['b', 'c'])
    const synced = syncWithSaved(s, after)
    expect(synced.enrollments.a).toMatchObject({ state: 'stopped', stopReason: status })
    expect(synced.enrollments.b.state).toBe('active')
    // changing the status back does not restart it
    expect(syncWithSaved(synced, saved).enrollments.a.state).toBe('stopped')
    expect(dueSteps(syncWithSaved(synced, saved), saved, now).map((e) => e.leadId)).toEqual(['b', 'c'])
  })
  it('stops when the lead is removed', () => {
    const { b, c } = saved
    const synced = syncWithSaved(started(), { b, c })
    expect(synced.enrollments.a).toMatchObject({ state: 'stopped', stopReason: 'removed' })
    expect(dueSteps(started(), { b, c }, at(4 * DAY)).map((e) => e.leadId)).toEqual(['b', 'c'])
  })
  it('contacted status does not stop a sequence', () => {
    const synced = syncWithSaved(started(), { ...saved, a: lead('a', 'contacted') })
    expect(synced.enrollments.a.state).toBe('active')
  })
  it('returns the same object when nothing changed', () => {
    const s = started()
    expect(syncWithSaved(s, saved)).toBe(s)
  })
  it('suppressing an address stops it and removes it from due', () => {
    const s = suppress(started(), 'A@Biz.example.com')
    expect(s.enrollments.a).toMatchObject({ state: 'stopped', stopReason: 'unsubscribed' })
    expect(dueSteps(s, saved, at(4 * DAY)).map((e) => e.leadId)).toEqual(['b', 'c'])
    expect(s.suppressed).toEqual(['a@biz.example.com'])
    expect(suppress(s, 'a@biz.example.com').suppressed).toEqual(['a@biz.example.com'])
  })
  it('a stopped enrollment is never due', () => {
    const s = syncWithSaved(started(), { b: saved.b, c: saved.c })
    expect(dueAt(s.enrollments.a, s.campaign)).toBeNull()
  })
})

describe('enrollment refusals', () => {
  it('suppression blocks enrollment case-insensitively, and enrollAll skips it', () => {
    const s = suppress(empty(), 'x@biz.example.com')
    const l = lead('x', 'new', 'X@Biz.Example.com')
    expect(canEnroll(l, s)).toEqual({ ok: false, reason: 'This address unsubscribed' })
    expect(enroll(s, l, T0)).toBe(s)
    const r = enrollAll(s, { x: l, y: lead('y') }, T0)
    expect(r).toMatchObject({ added: 1, skipped: 1 })
  })
  it('refuses a second enrollment for the same lead or the same address', () => {
    let s = enroll(empty(), lead('a', 'new', 'dup@biz.example.com'), T0)
    expect(canEnroll(lead('a'), s)).toEqual({ ok: false, reason: 'Already in outreach' })
    expect(canEnroll(lead('b', 'new', 'DUP@biz.example.com'), s)).toEqual({ ok: false, reason: 'Another lead in outreach uses this address' })
    const again = enroll(s, lead('b', 'new', 'dup@biz.example.com'), T0)
    expect(again).toBe(s)
    s = unenroll(s, 'a')
    expect(canEnroll(lead('b', 'new', 'dup@biz.example.com'), s).ok).toBe(true)
  })
  it('refuses replied/won/lost leads and unsaved leads', () => {
    expect(canEnroll(lead('a', 'won'), empty())).toEqual({ ok: false, reason: expect.stringMatching(/^Lead is marked/) })
    expect(canEnroll(undefined, empty())).toEqual({ ok: false, reason: 'Save the lead first' })
    expect(canEnroll(lead('a', 'new', 'nope'), empty())).toEqual({ ok: false, reason: 'Add a valid email for outreach' })
    expect(canEnroll(lead('a', 'new', 'a@b.c\nbcc@x.com'), empty()).ok).toBe(false)
  })
  it('enrollAll twice adds nothing the second time', () => {
    const saved = { a: lead('a'), b: lead('b') }
    const first = enrollAll(empty(), saved, T0)
    expect(first.added).toBe(2)
    expect(enrollAll(first.state, saved, T0)).toMatchObject({ added: 0, skipped: 2 })
  })
})

describe('step 1 with an AI pitch', () => {
  const l = lead('a')
  const e = enroll(empty(), l, T0).enrollments.a
  const ai = (body: string): Pitch => ({ email: { subject: 'AI subject', body }, sms: '', phoneOpener: '', source: 'ai' })
  const build = (p: Pitch, sender = SENDER) => buildStepEmail({ enrollment: e, saved: l, pitch: p, campaign: DEFAULT_CAMPAIGN, sender })
  it('is blocked when the signature predates a sender change, ok after regenerating', () => {
    const old = ai(`Hi${emailFooter(SENDER)}`)
    expect(build(old).ok).toBe(true)
    const changed = { ...SENDER, address: '99 New Rd' }
    const r = build(old, changed)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toMatch(/Regenerate/)
    expect(build(ai(`Hi${emailFooter(changed)}`), changed).ok).toBe(true)
  })
  it('is blocked when the pitch still has placeholders or no footer at all', () => {
    expect(build(ai('Hi, regards [Your name]')).ok).toBe(false)
    expect(build(ai('')).ok).toBe(false)
  })
})

describe('send result unknown is never auto-resent', () => {
  it('pendingSend excludes the step from dueSteps in both modes until cleared; errors do not clear it', () => {
    const saved = { a: lead('a') }
    let s = setPending(enroll(empty(), saved.a, T0), 'a', { step: 0, startedAt: T0.toISOString() })
    const later = at(30 * DAY)
    expect(dueSteps(s, saved, later)).toEqual([])
    expect(dueSteps(s, saved, later, { skipRecentErrorsMs: 3_600_000 })).toEqual([])
    s = recordError(s, 'a', 'x', later)
    expect(dueSteps(s, saved, at(40 * DAY))).toEqual([])
    expect(s.enrollments.a.pendingSend).toBeDefined()
    s = setPending(s, 'a', undefined)
    expect(dueSteps(s, saved, at(40 * DAY)).length).toBe(1)
  })
  it('recording a sent step clears pending, and recording the same step twice does not double count', () => {
    const saved = { a: lead('a') }
    let s = setPending(enroll(empty(), saved.a, T0), 'a', { step: 0, startedAt: T0.toISOString() })
    s = recordSent(s, 'a', entry(0, T0), T0)
    expect(s.enrollments.a.pendingSend).toBeUndefined()
    const twice = recordSent(s, 'a', entry(0, T0), T0)
    expect(twice.enrollments.a.history.length).toBe(1)
    expect(twice.sentToday.count).toBe(1)
  })
})
