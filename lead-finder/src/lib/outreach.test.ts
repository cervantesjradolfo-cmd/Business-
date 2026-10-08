import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_CAMPAIGN, buildStepEmail, canEnroll, dueAt, dueSteps, enroll, enrollAll, followUpSubject, loadMailbox, loadOutreach,
  localDay, mailboxReady, mailtoHref, outreachEmailFor, recordError, recordSent, renderTemplate, senderReady, sentTodayCount,
  setDraft, setPending, stripFooter, suppress, syncWithSaved, unenroll, unknownVariables, DRAFT_BODY_MAX,
} from './outreach'
import { emailFooter, OPT_OUT_EMAIL } from './pitch'
import type { Enrollment, OutreachState, Pitch, SavedLead, Sender } from './types'

const SENDER: Sender = { name: 'Sam', business: 'Acme Web', email: 'sam@acme.example.com', phone: '', address: '1 Main St, Austin TX', website: '' }
const lead = (id: string, extra: Partial<SavedLead['lead']> = {}, status: SavedLead['status'] = 'new', s: Partial<SavedLead> = {}): SavedLead => ({
  lead: { id, osmType: 'node', osmId: 1, osmUrl: '', name: `Biz ${id}`, category: 'Cafe', categoryId: 'cafes', address: '', lat: 0, lon: 0, distanceKm: 1, email: `${id}@biz.example.com`, ...extra },
  status, notes: '', savedAt: '', updatedAt: '', ...s,
})
const empty = (): OutreachState => ({ campaign: DEFAULT_CAMPAIGN, enrollments: {}, suppressed: [], sentToday: { day: '', count: 0 } })
const T0 = new Date('2026-10-01T09:00:00')
const DAY = 86_400_000
const pitch = (body = `Hi there${emailFooter(SENDER)}`): Pitch => ({ email: { subject: 'Quick idea', body }, sms: '', phoneOpener: '', source: 'ai' })
const entry = (step: number, at: Date, extra = {}) => ({ step, sentAt: at.toISOString(), subject: 'Quick idea', via: 'smtp' as const, ...extra })

beforeEach(() => { window.localStorage.clear() })
afterEach(() => { window.localStorage.clear() })

describe('templates', () => {
  it('fills known variables and leaves unknown ones', () => {
    const vars = { business: 'Cafe X', sender_name: 'Sam', sender_business: 'Acme', city: 'Austin' }
    expect(renderTemplate('Hi {{business}} / {{ city }} / {{nope}}', vars)).toBe('Hi Cafe X / Austin / {{nope}}')
    expect(unknownVariables('{{business}} {{ nope }} {{nope}} {{x}}')).toEqual(['nope', 'x'])
  })
  it('prefixes Re: once', () => {
    expect(followUpSubject('Quick idea')).toBe('Re: Quick idea')
    expect(followUpSubject('RE: Quick idea')).toBe('RE: Quick idea')
  })
  it('builds a mailto link with CRLF newlines', () => {
    expect(mailtoHref('a@b.com', 'Hi there', 'one\ntwo')).toBe('mailto:a@b.com?subject=Hi%20there&body=one%0D%0Atwo')
  })
})

describe('small helpers', () => {
  it('picks the first listed email unless one was typed', () => {
    expect(outreachEmailFor(lead('a', { email: ' one@x.com; two@x.com' }))).toBe('one@x.com')
    expect(outreachEmailFor(lead('a', { email: undefined }))).toBe('')
    expect(outreachEmailFor(lead('a', { email: 'one@x.com' }, 'new', { outreachEmail: 'typed@x.com' }))).toBe('typed@x.com')
    expect(outreachEmailFor(lead('a', { email: 'one@x.com' }, 'new', { outreachEmail: '' }))).toBe('')
  })
  it('knows when the sender and mailbox are ready', () => {
    expect(senderReady(SENDER)).toBe(true)
    expect(senderReady({ ...SENDER, address: ' ' })).toBe(false)
    const m = loadMailbox('k')
    expect(mailboxReady(m)).toBe(false)
    expect(mailboxReady({ ...m, host: 'smtp.gmail.com', user: 'u', pass: 'p', fromAddress: 'u@gmail.com' })).toBe(true)
    expect(mailboxReady({ ...m, host: 'smtp.gmail.com', user: 'u', pass: 'p', fromAddress: 'nope' })).toBe(false)
  })
  it('uses the local calendar day for the daily count', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    const s = { ...empty(), sentToday: { day: localDay(T0), count: 4 } }
    expect(sentTodayCount(s, T0)).toBe(4)
    expect(sentTodayCount(s, new Date(T0.getTime() + DAY))).toBe(0)
  })
})

describe('canEnroll and enroll', () => {
  it('gives the exact reasons', () => {
    const s = empty()
    expect(canEnroll(undefined, s)).toEqual({ ok: false, reason: 'Save the lead first' })
    expect(canEnroll(lead('a', { email: undefined }), s)).toEqual({ ok: false, reason: 'Add a valid email for outreach' })
    expect(canEnroll(lead('a', { email: 'bad' }), s)).toEqual({ ok: false, reason: 'Add a valid email for outreach' })
    expect(canEnroll(lead('a'), { ...s, suppressed: ['a@biz.example.com'] })).toEqual({ ok: false, reason: 'This address unsubscribed' })
    expect(canEnroll(lead('a', {}, 'replied'), s)).toEqual({ ok: false, reason: 'Lead is marked Replied' })
    expect(canEnroll(lead('a'), s)).toEqual({ ok: true, email: 'a@biz.example.com' })
    const enrolled = enroll(s, lead('a'), T0)
    expect(canEnroll(lead('a'), enrolled)).toEqual({ ok: false, reason: 'Already in outreach' })
    expect(canEnroll(lead('b', { email: 'A@biz.example.com' }), enrolled)).toEqual({ ok: false, reason: 'Another lead in outreach uses this address' })
  })
  it('allows a shared address once the other enrollment stopped', () => {
    const s = syncWithSaved(enroll(empty(), lead('a'), T0), { a: lead('a', {}, 'lost') })
    expect(canEnroll(lead('b', { email: 'a@biz.example.com' }), s).ok).toBe(true)
  })
  it('creates an active enrollment due at once', () => {
    const s = enroll(empty(), lead('a', { email: 'A@Biz.example.com' }), T0)
    expect(s.enrollments.a).toEqual({ leadId: 'a', email: 'a@biz.example.com', enrolledAt: T0.toISOString(), nextStep: 0, state: 'active', history: [] })
    expect(enroll(s, lead('a'), T0)).toBe(s)
  })
  it('enrolls many and counts skipped, ignoring leads without an email', () => {
    const saved = { a: lead('a'), b: lead('b'), c: lead('c', { email: undefined }), d: lead('d', {}, 'won') }
    const r = enrollAll(enroll(empty(), saved.a, T0), saved, T0)
    expect(r.added).toBe(1)
    expect(r.skipped).toBe(2)
    expect(Object.keys(r.state.enrollments).sort()).toEqual(['a', 'b'])
  })
  it('removes the row on unenroll', () => {
    expect(unenroll(enroll(empty(), lead('a'), T0), 'a').enrollments).toEqual({})
  })
})

describe('scheduling', () => {
  const saved = { a: lead('a'), b: lead('b'), c: lead('c', {}, 'lost') }
  it('step 0 is due at enrollment; follow-ups after the delay from the last send', () => {
    let s = enroll(empty(), saved.a, T0)
    expect(dueAt(s.enrollments.a, s.campaign)).toEqual(T0)
    s = recordSent(s, 'a', entry(0, new Date(T0.getTime() + 1000)), T0)
    expect(dueAt(s.enrollments.a, s.campaign)).toEqual(new Date(T0.getTime() + 1000 + 3 * DAY))
    s = recordSent(s, 'a', entry(1, new Date(T0.getTime() + 4 * DAY)), T0)
    expect(dueAt(s.enrollments.a, s.campaign)).toEqual(new Date(T0.getTime() + 11 * DAY))
    s = recordSent(s, 'a', entry(2, new Date(T0.getTime() + 11 * DAY)), T0)
    expect(s.enrollments.a.state).toBe('finished')
    expect(dueAt(s.enrollments.a, s.campaign)).toBeNull()
  })
  it('applies campaign delay edits to unsent steps', () => {
    let s = enroll(empty(), saved.a, T0)
    s = recordSent(s, 'a', entry(0, T0), T0)
    s = { ...s, campaign: { followUps: [{ delayDays: 10, body: 'x' }] } }
    expect(dueAt(s.enrollments.a, s.campaign)).toEqual(new Date(T0.getTime() + 10 * DAY))
  })
  it('lists due steps oldest first and skips pending, suppressed, answered and recently failed ones', () => {
    let s = enroll(enroll(empty(), saved.b, new Date(T0.getTime() + 1000)), saved.a, T0)
    expect(dueSteps(s, saved, new Date(T0.getTime() + 2000)).map((e) => e.leadId)).toEqual(['a', 'b'])
    expect(dueSteps(s, saved, new Date(T0.getTime() - 1))).toEqual([])
    s = setPending(s, 'a', { step: 0, startedAt: T0.toISOString() })
    expect(dueSteps(s, saved, T0).map((e) => e.leadId)).toEqual([])
    s = setPending(s, 'a', undefined)
    s = recordError(s, 'b', 'boom', new Date(T0.getTime() + 5000))
    const later = new Date(T0.getTime() + 60_000)
    expect(dueSteps(s, saved, later).map((e) => e.leadId)).toEqual(['a', 'b'])
    expect(dueSteps(s, saved, later, { skipRecentErrorsMs: 3_600_000 }).map((e) => e.leadId)).toEqual(['a'])
    expect(dueSteps(s, { ...saved, a: lead('a', {}, 'replied') }, later).map((e) => e.leadId)).toEqual(['b'])
    expect(dueSteps(s, { b: saved.b }, later).map((e) => e.leadId)).toEqual(['b'])
    expect(dueSteps({ ...s, suppressed: ['b@biz.example.com'] }, saved, later).map((e) => e.leadId)).toEqual(['a'])
  })
})

describe('syncWithSaved', () => {
  const saved = { a: lead('a'), b: lead('b') }
  it('stops removed, answered and unsubscribed leads and never revives them', () => {
    let s = enroll(enroll(empty(), saved.a, T0), saved.b, T0)
    expect(syncWithSaved(s, saved)).toBe(s)
    s = syncWithSaved(s, { a: lead('a', {}, 'won') })
    expect(s.enrollments.a).toMatchObject({ state: 'stopped', stopReason: 'won' })
    expect(s.enrollments.b).toMatchObject({ state: 'stopped', stopReason: 'removed' })
    expect(syncWithSaved(s, saved).enrollments.a.state).toBe('stopped')
  })
  it('finishes enrollments past the end of a shortened sequence, but never revives finished ones', () => {
    let s = recordSent(enroll(empty(), saved.a, T0), 'a', entry(0, T0), T0)
    s = { ...s, campaign: { followUps: [] } }
    expect(syncWithSaved(s, saved).enrollments.a.state).toBe('finished')
    const done = syncWithSaved(s, saved)
    expect(syncWithSaved({ ...done, campaign: DEFAULT_CAMPAIGN }, saved).enrollments.a.state).toBe('finished')
  })
})

describe('recordSent / recordError / suppress', () => {
  const a = lead('a')
  it('advances the step, clears errors and counts SMTP sends only', () => {
    let s = enroll(empty(), a, T0)
    s = recordError(setPending(s, 'a', { step: 0, startedAt: '' }), 'a', 'boom', T0)
    const smtp = recordSent(s, 'a', entry(0, T0, { messageId: '<m@x>' }), T0)
    expect(smtp.enrollments.a).toMatchObject({ nextStep: 1, subject: 'Quick idea', state: 'active' })
    expect(smtp.enrollments.a.pendingSend).toBeUndefined()
    expect(smtp.enrollments.a.lastError).toBeUndefined()
    expect(smtp.sentToday).toEqual({ day: localDay(T0), count: 1 })
    const manual = recordSent(s, 'a', { ...entry(0, T0), via: 'manual' }, T0)
    expect(manual.sentToday.count).toBe(0)
  })
  it('resets the daily count on a new day', () => {
    const s = { ...enroll(empty(), a, T0), sentToday: { day: '2020-01-01', count: 9 } }
    expect(recordSent(s, 'a', entry(0, T0), T0).sentToday).toEqual({ day: localDay(T0), count: 1 })
  })
  it('ignores a step that was already recorded', () => {
    const s = recordSent(enroll(empty(), a, T0), 'a', entry(0, T0), T0)
    expect(recordSent(s, 'a', entry(0, T0), T0)).toBe(s)
    expect(recordSent(s, 'zzz', entry(0, T0), T0)).toBe(s)
  })
  it('suppress lower-cases, dedupes and stops matching enrollments', () => {
    const s = suppress(suppress(enroll(empty(), a, T0), ' A@BIZ.example.com'), 'a@biz.example.com')
    expect(s.suppressed).toEqual(['a@biz.example.com'])
    expect(s.enrollments.a).toMatchObject({ state: 'stopped', stopReason: 'unsubscribed' })
  })
})

describe('buildStepEmail', () => {
  const a = lead('a', { city: 'Austin' })
  const base = (e: Enrollment, p = pitch()) => buildStepEmail({ enrollment: e, saved: a, pitch: p, campaign: DEFAULT_CAMPAIGN, sender: SENDER })
  const first = enroll(empty(), a, T0).enrollments.a
  it('sends the pitch as written when it ends with the current footer', () => {
    expect(base(first)).toEqual({ ok: true, subject: 'Quick idea', body: `Hi there${emailFooter(SENDER)}`, source: 'ai' })
    expect(base(first, { ...pitch(), source: 'template' })).toMatchObject({ ok: true, source: 'template' })
    expect(emailFooter(SENDER).endsWith(OPT_OUT_EMAIL)).toBe(true)
  })
  it('blocks a pitch written before the details changed or while details are missing', () => {
    expect(base(first, pitch('Hi\n\n[Your name]\n\nbye'))).toEqual({ ok: false, error: "This pitch was written before your details changed. Press Regenerate in the lead's Pitch panel." })
    expect(buildStepEmail({ enrollment: first, saved: a, pitch: pitch(), campaign: DEFAULT_CAMPAIGN, sender: { ...SENDER, address: '' } })).toEqual({
      ok: false, error: 'Add the name, business and postal address under Your/Profile details first.',
    })
  })
  it('builds follow-ups from the templates, as a reply to step 1', () => {
    const s = recordSent(enroll(empty(), a, T0), 'a', entry(0, T0, { messageId: '<m1@x>' }), T0)
    const r = base(s.enrollments.a)
    expect(r.ok && r.subject).toBe('Re: Quick idea')
    expect(r.ok && r.inReplyTo).toBe('<m1@x>')
    expect(r.ok && r.body.startsWith('Hi Biz a team,\n\nI wanted to follow up')).toBe(true)
    expect(r.ok && r.body.endsWith(emailFooter(SENDER))).toBe(true)
  })
  it('uses the step-1 subject as sent and falls back to "your area"', () => {
    const noCity = lead('a')
    let s = recordSent(enroll(empty(), noCity, T0), 'a', entry(0, T0, { subject: 'Sent subject' }), T0)
    s = { ...s, campaign: { followUps: [{ delayDays: 1, body: 'In {{city}} from {{sender_business}}' }] } }
    const r = buildStepEmail({ enrollment: s.enrollments.a, saved: noCity, pitch: pitch(), campaign: s.campaign, sender: SENDER })
    expect(r).toMatchObject({ ok: true, subject: 'Re: Sent subject' })
    expect(r.ok && r.body.startsWith('In your area from Acme Web')).toBe(true)
    expect(r.ok && r.inReplyTo).toBeUndefined()
  })
})

describe('loading', () => {
  it('returns defaults for a missing or corrupt key', () => {
    expect(loadOutreach('k')).toEqual(empty())
    window.localStorage.setItem('k', '{nope')
    expect(loadOutreach('k')).toEqual(empty())
    window.localStorage.setItem('k', '[1]')
    expect(loadOutreach('k')).toEqual(empty())
    expect(loadMailbox('m')).toMatchObject({ host: '', port: 465, secure: true, gapSeconds: 45, dailyCap: 30 })
  })
  it('repairs bad fields one by one', () => {
    window.localStorage.setItem('k', JSON.stringify({
      campaign: { followUps: [{ delayDays: 999.4, body: 'a' }, { delayDays: 'x', body: 'b' }, { delayDays: 2, body: 'c' }, { body: 5 }] },
      enrollments: {
        ok: { leadId: 'ok', email: 'OK@x.com', enrolledAt: T0.toISOString(), nextStep: 1, state: 'weird', stopReason: 'weird', history: [entry(0, T0), { step: 9 }, null] },
        bad1: { email: 'x' }, bad2: { leadId: 'b', email: 5 }, bad3: 'str',
      },
      suppressed: ['A@b.com', 'a@b.com', 'nope', 3],
      sentToday: { day: 5, count: -4 },
    }))
    const s = loadOutreach('k')
    expect(s.campaign.followUps).toEqual([{ delayDays: 60, body: 'a' }, { delayDays: 3, body: 'b' }])
    expect(Object.keys(s.enrollments)).toEqual(['ok'])
    expect(s.enrollments.ok).toMatchObject({ email: 'ok@x.com', state: 'active', nextStep: 1 })
    expect(s.enrollments.ok.stopReason).toBeUndefined()
    expect(s.enrollments.ok.history).toHaveLength(1)
    expect(s.suppressed).toEqual(['a@b.com'])
    expect(s.sentToday).toEqual({ day: '', count: 0 })
  })
  it('repairs the mailbox', () => {
    window.localStorage.setItem('m', JSON.stringify({ host: ' smtp.x.com ', port: 25, secure: false, user: 5, pass: 'p', gapSeconds: 1, dailyCap: 9999 }))
    expect(loadMailbox('m')).toMatchObject({ host: 'smtp.x.com', port: 465, secure: true, user: '', pass: 'p', gapSeconds: 20, dailyCap: 200 })
    window.localStorage.setItem('m', JSON.stringify({ port: 587, secure: true }))
    expect(loadMailbox('m')).toMatchObject({ port: 587, secure: false })
  })
})

describe('drafts (AI or edited wording per step)', () => {
  const a = lead('a', { city: 'Austin' })
  const build = (e: Enrollment, p = pitch()) => buildStepEmail({ enrollment: e, saved: a, pitch: p, campaign: DEFAULT_CAMPAIGN, sender: SENDER })
  const enrolled = () => enroll(empty(), a, T0)

  it('uses a step-1 draft with a fresh footer, even when the old pitch is stale', () => {
    const s = setDraft(enrolled(), 'a', 0, { subject: 'New idea', body: 'Hi Acme,\n\nShort note.', source: 'edited' })
    const stale = pitch('Hi\n\n[Your name]\n\nbye')
    expect(build(s.enrollments.a, stale)).toEqual({ ok: true, subject: 'New idea', body: `Hi Acme,\n\nShort note.${emailFooter(SENDER)}`, source: 'edited' })
    const noSubject = setDraft(enrolled(), 'a', 0, { body: 'Body', source: 'ai' })
    expect(build(noSubject.enrollments.a)).toMatchObject({ subject: 'Quick idea', source: 'ai' })
  })
  it('uses a follow-up draft as a reply to the step-1 subject, keeping In-Reply-To', () => {
    let s = recordSent(enrolled(), 'a', { step: 0, sentAt: T0.toISOString(), subject: 'Sent subject', via: 'smtp', messageId: '<m1@x>' }, T0)
    s = setDraft(s, 'a', 1, { subject: 'ignored', body: 'Just checking in.', source: 'ai' })
    expect(build(s.enrollments.a)).toEqual({
      ok: true, subject: 'Re: Sent subject', body: `Just checking in.${emailFooter(SENDER)}`, source: 'ai', inReplyTo: '<m1@x>',
    })
    expect(s.enrollments.a.drafts?.[1]).not.toHaveProperty('subject')
  })
  it('keeps subjects to one line, caps the body, and removes a draft', () => {
    const s = setDraft(enrolled(), 'a', 0, { subject: 'Hi\r\nBcc: x@evil.example', body: 'x'.repeat(DRAFT_BODY_MAX + 50), source: 'edited' })
    expect(s.enrollments.a.drafts?.[0]).toEqual({ subject: 'Hi Bcc: x@evil.example', body: 'x'.repeat(DRAFT_BODY_MAX), source: 'edited' })
    const cleared = setDraft(s, 'a', 0, undefined)
    expect(cleared.enrollments.a).not.toHaveProperty('drafts')
    expect(build(cleared.enrollments.a)).toMatchObject({ source: 'ai', subject: 'Quick idea' })
    expect(setDraft(s, 'nobody', 0, undefined)).toBe(s)
  })
  it('strips only an exact footer', () => {
    expect(stripFooter(`Hello${emailFooter(SENDER)}`, SENDER)).toBe('Hello')
    expect(stripFooter('Hello\n\nbye', SENDER)).toBe('Hello\n\nbye')
  })
  it('loads drafts defensively', () => {
    const key = 'leadfinder:outreach:test-drafts'
    const e = setDraft(enrolled(), 'a', 0, { subject: 'S', body: 'B', source: 'ai' }).enrollments.a
    window.localStorage.setItem(key, JSON.stringify({
      enrollments: { a: { ...e, drafts: { 0: { subject: 'S\nX', body: 'B', source: 'weird' }, 1: { body: 7 }, 9: { body: 'far' }, x: { body: 'nan' } } } },
    }))
    expect(loadOutreach(key).enrollments.a.drafts).toEqual({ 0: { subject: 'S X', body: 'B', source: 'edited' } })
    window.localStorage.setItem(key, JSON.stringify({ enrollments: { a: { ...e, drafts: 'nope' } } }))
    expect(loadOutreach(key).enrollments.a).not.toHaveProperty('drafts')
    window.localStorage.removeItem(key)
  })
})
