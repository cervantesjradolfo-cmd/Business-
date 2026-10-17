import { describe, expect, it } from 'vitest'
import { DEFAULT_CAMPAIGN, recordSent, unenroll } from './outreach'
import { mergeLeads, mergeOutreach, statusChangesFor } from './sync'
import type { Enrollment, OutreachState, Reply, SavedLead } from './types'

const T = '2026-10-16T15:00:00.000Z'
const e = (leadId: string, over: Partial<Enrollment> = {}): Enrollment => ({ leadId, email: `${leadId}@x.example.com`, enrolledAt: T, nextStep: 0, state: 'active', history: [], ...over })
const st = (over: Partial<OutreachState> = {}): OutreachState => ({ campaign: DEFAULT_CAMPAIGN, enrollments: {}, suppressed: [], sentToday: { day: '2026-10-16', count: 0 }, replies: {}, ...over })
const reply = (over: Partial<Reply> = {}): Reply => ({ id: 'r1', leadId: 'a', from: 'a@x.example.com', subject: 'Re', date: T, refs: [], text: 'hi', auto: false, receivedAt: T, ...over })

describe('mergeOutreach', () => {
  it("keeps the server's sends and your drafts and sequence", () => {
    const sentByServer = recordSent(st({ enrollments: { a: e('a') } }), 'a', { step: 0, sentAt: '2026-10-16T16:00:00.000Z', subject: 'Hi', via: 'smtp', messageId: '<m>' }, new Date('2026-10-16T16:00:00Z'))
    const client = st({
      campaign: { followUps: [{ delayDays: 5, body: 'Mine' }] },
      enrollments: { a: e('a', { drafts: { 1: { body: 'My follow-up', source: 'edited' } } }) },
    })
    const m = mergeOutreach(sentByServer, client)
    expect(m.enrollments.a).toMatchObject({ nextStep: 1, history: [{ messageId: '<m>' }], drafts: { 1: { body: 'My follow-up' } } })
    expect(m.campaign.followUps[0].body).toBe('Mine')
    expect(m.sentToday.count).toBe(1)
    expect(m.mailboxStartedAt).toBe('2026-10-16T16:00:00.000Z')
  })
  it('a stop on either side wins, and unsubscribes add up', () => {
    const m = mergeOutreach(
      st({ enrollments: { a: e('a', { state: 'stopped', stopReason: 'replied' }) }, suppressed: ['x@x.example.com'] }),
      st({ enrollments: { a: e('a') }, suppressed: ['y@x.example.com'] }),
    )
    expect(m.enrollments.a).toMatchObject({ state: 'stopped', stopReason: 'replied' })
    expect(m.suppressed.sort()).toEqual(['x@x.example.com', 'y@x.example.com'])
  })
  it('a lead you took out of outreach stays out, but adding it again later counts', () => {
    const client = unenroll(st({ enrollments: { a: e('a') } }), 'a', new Date('2026-10-17T00:00:00Z'))
    const m = mergeOutreach(st({ enrollments: { a: e('a') } }), client)
    expect(m.enrollments.a).toBeUndefined()
    const readded = mergeOutreach(m, st({ enrollments: { a: e('a', { enrolledAt: '2026-10-18T00:00:00.000Z' }) } }))
    expect(readded.enrollments.a).toBeTruthy()
    expect(readded.removed).toBeUndefined()
  })
  it("keeps the server's new replies and AI drafts, and your answers and edits", () => {
    const m = mergeOutreach(
      st({ replies: { r1: reply({ intent: 'question', draft: { body: 'AI', source: 'ai' } }), r2: reply({ id: 'r2' }) } }),
      st({ replies: { r1: reply({ handled: { at: T, how: 'sent' } }), r3: reply({ id: 'r3', draft: { body: 'Mine', source: 'edited' } }) } }),
    )
    expect(Object.keys(m.replies).sort()).toEqual(['r1', 'r2', 'r3'])
    expect(m.replies.r1).toMatchObject({ intent: 'question', draft: { body: 'AI' }, handled: { how: 'sent' } })
    expect(m.replies.r3.draft).toEqual({ body: 'Mine', source: 'edited' })
  })
})

describe('lead statuses', () => {
  it("uses the server's status when it changed after your edit", () => {
    const lead = { id: 'a', name: 'A', category: 'Cafe', status: 'new' as const, updatedAt: T, pitch: { email: { subject: 's', body: 'b' }, sms: '', phoneOpener: '', source: 'template' as const }, services: [] }
    const events = [{ leadId: 'a', status: 'contacted' as const, at: '2026-10-16T16:00:00.000Z' }]
    expect(mergeLeads({ a: lead }, events).a.status).toBe('contacted')
    expect(mergeLeads({ a: { ...lead, status: 'won', updatedAt: '2026-10-17T00:00:00.000Z' } }, events).a.status).toBe('won')
  })
  it('tells the browser which saved leads to update', () => {
    const saved = { a: { status: 'new', updatedAt: T } as SavedLead, b: { status: 'won', updatedAt: '2026-10-18T00:00:00.000Z' } as SavedLead }
    const events = [
      { leadId: 'a', status: 'contacted' as const, at: '2026-10-16T16:00:00.000Z' },
      { leadId: 'a', status: 'replied' as const, at: '2026-10-16T17:00:00.000Z' },
      { leadId: 'b', status: 'replied' as const, at: '2026-10-16T17:00:00.000Z' },
    ]
    expect(statusChangesFor(saved, events, '')).toEqual([{ leadId: 'a', status: 'replied' }])
    expect(statusChangesFor(saved, events, '2026-10-16T17:00:00.000Z')).toEqual([])
  })
})
