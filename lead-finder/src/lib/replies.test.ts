import { describe, expect, it } from 'vitest'
import { DEFAULT_CAMPAIGN, EMPTY_MAILBOX, loadMailbox, loadOutreach } from './outreach'
import {
  applyReplyDraft, handledReplies, inboxRequestFor, leadForMessage, mergeReplies, optOutIntent, pendingReplies, replyEmail, stripQuoted,
} from './replies'
import type { Enrollment, InboxMessage, OutreachState, Sender } from './types'

const T0 = new Date('2026-10-01T15:00:00Z')
const NOW = new Date('2026-10-10T15:00:00Z')
const sender: Sender = { name: 'Sam', business: 'Acme Web', email: 'sam@acme.example.com', phone: '', address: '1 Main St, Austin TX', website: '' }

const enrolled = (leadId: string, email: string, sent: boolean, over: Partial<Enrollment> = {}): Enrollment => ({
  leadId, email, enrolledAt: T0.toISOString(), nextStep: sent ? 1 : 0, state: 'active',
  history: sent ? [{ step: 0, sentAt: T0.toISOString(), subject: 'A website for Corner Cafe', via: 'smtp', messageId: `<${leadId}@acme>` }] : [],
  ...over,
})
const state = (...es: Enrollment[]): OutreachState => ({
  campaign: DEFAULT_CAMPAIGN, enrollments: Object.fromEntries(es.map((e) => [e.leadId, e])), suppressed: [], sentToday: { day: '', count: 0 }, replies: {},
})
const msg = (over: Partial<InboxMessage> = {}): InboxMessage => ({
  id: '<r1@corner>', from: 'owner@corner.example.com', subject: 'Re: A website for Corner Cafe', date: '2026-10-09T12:00:00.000Z',
  messageId: '<r1@corner>', refs: [], text: 'Sounds good, how much would it cost?', auto: false, ...over,
})

describe('stripQuoted', () => {
  it('keeps only the new part of a Gmail reply', () => {
    expect(stripQuoted('Yes please, call me Tuesday.\n\nOn Mon, Oct 6, 2026 at 9:00 AM Sam <sam@acme.example.com> wrote:\n> Hi Corner Cafe team,\n> ...')).toBe('Yes please, call me Tuesday.')
  })
  it('handles "wrote:" on its own line, Outlook headers and original-message markers', () => {
    expect(stripQuoted('Sure.\nOn Mon, Oct 6, 2026 at 9:00 AM Sam <sam@acme.example.com>\nwrote:\n> old')).toBe('Sure.')
    expect(stripQuoted('Call me.\r\n\r\nFrom: Sam <sam@acme.example.com>\r\nSent: Monday\r\nTo: x\r\nSubject: hi')).toBe('Call me.')
    expect(stripQuoted('Ok\n-----Original Message-----\nold')).toBe('Ok')
  })
  it('drops leading quotes but keeps text written between them', () => {
    expect(stripQuoted('> quoted first\nmy answer\n> more quote')).toBe('my answer')
  })
})

describe('optOutIntent', () => {
  it.each([
    ['Please unsubscribe me', 'unsubscribe'], ['Remove me from your list', 'unsubscribe'], ['stop emailing me', 'unsubscribe'],
    ["Don't contact us again", 'unsubscribe'], ['no thanks', 'not_interested'], ['No, thank you.', 'not_interested'], ['We are not interested', 'not_interested'],
  ])('%s -> %s', (text, intent) => expect(optOutIntent(text)).toBe(intent))
  it('leaves normal replies alone', () => {
    expect(optOutIntent('How much for a website?')).toBeUndefined()
    expect(optOutIntent('Thanks, call me Tuesday')).toBeUndefined()
  })
})

describe('inboxRequestFor', () => {
  it('asks for everyone emailed since a day before the first send, with the sent message ids', () => {
    const s = state(enrolled('a', 'owner@corner.example.com', true), enrolled('b', 'b@x.example.com', false))
    const req = inboxRequestFor(s, { ...EMPTY_MAILBOX, imapHost: 'imap.gmail.com', user: 'u', pass: 'p' }, NOW)!
    expect(req.addresses).toEqual(['owner@corner.example.com'])
    expect(req.messageIds).toEqual(['<a@acme>'])
    expect(req.since).toBe('2026-09-30T15:00:00.000Z')
    expect(req.imap).toEqual({ host: 'imap.gmail.com', user: 'u', pass: 'p' })
  })
  it('is null when nothing was sent, and never looks back more than 45 days', () => {
    expect(inboxRequestFor(state(enrolled('b', 'b@x.example.com', false)), EMPTY_MAILBOX, NOW)).toBeNull()
    const req = inboxRequestFor(state(enrolled('a', 'a@x.example.com', true)), EMPTY_MAILBOX, new Date('2027-01-01T00:00:00Z'))!
    expect(req.since).toBe('2026-11-17T00:00:00.000Z')
  })
})

describe('mergeReplies', () => {
  it('adds a reply from an emailed address and stops that sequence', () => {
    const r = mergeReplies(state(enrolled('a', 'owner@corner.example.com', true)), [msg()], NOW)
    expect(r.added).toHaveLength(1)
    expect(r.replied).toEqual(['a'])
    expect(r.state.replies['<r1@corner>']).toMatchObject({ leadId: 'a', receivedAt: NOW.toISOString() })
    expect(r.state.replies['<r1@corner>'].handled).toBeUndefined()
    expect(r.state.enrollments.a).toMatchObject({ state: 'stopped', stopReason: 'replied' })
    expect(pendingReplies(r.state)).toHaveLength(1)
  })
  it('matches by message reference when they answer from another address', () => {
    const s = state(enrolled('a', 'owner@corner.example.com', true), enrolled('b', 'b@x.example.com', true))
    expect(leadForMessage(s, msg({ from: 'boss@gmail.example.com', refs: ['<b@acme>'] }))).toBe('b')
    expect(leadForMessage(s, msg({ from: 'stranger@x.example.com' }))).toBeUndefined()
  })
  it('ignores strangers, leads never emailed, and messages it already has', () => {
    const s = state(enrolled('a', 'owner@corner.example.com', false))
    expect(mergeReplies(s, [msg()], NOW).added).toHaveLength(0)
    const once = mergeReplies(state(enrolled('a', 'owner@corner.example.com', true)), [msg()], NOW).state
    const again = mergeReplies(once, [msg()], NOW)
    expect(again.added).toHaveLength(0)
    expect(again.state).toBe(once)
  })
  it('keeps auto-replies without stopping the sequence', () => {
    const r = mergeReplies(state(enrolled('a', 'owner@corner.example.com', true)), [msg({ auto: true, text: 'I am out of the office' })], NOW)
    expect(r.autoReplies).toBe(1)
    expect(r.replied).toEqual([])
    expect(r.state.enrollments.a.state).toBe('active')
    expect(r.state.replies['<r1@corner>']).toMatchObject({ intent: 'auto_reply', handled: { how: 'auto' } })
  })
  it('unsubscribes "no thanks" and unsubscribe replies right away', () => {
    const r = mergeReplies(state(enrolled('a', 'owner@corner.example.com', true)), [msg({ text: 'No thanks' })], NOW)
    expect(r.unsubscribed).toBe(1)
    expect(r.state.suppressed).toEqual(['owner@corner.example.com'])
    expect(r.state.enrollments.a).toMatchObject({ state: 'stopped', stopReason: 'unsubscribed' })
    expect(r.state.replies['<r1@corner>']).toMatchObject({ intent: 'not_interested', handled: { how: 'auto' } })
    expect(pendingReplies(r.state)).toHaveLength(0)
    expect(handledReplies(r.state)).toHaveLength(1)
  })
})

describe('applyReplyDraft', () => {
  const base = () => mergeReplies(state(enrolled('a', 'owner@corner.example.com', true)), [msg()], NOW).state
  it('stores the intent, summary and draft', () => {
    const s = applyReplyDraft(base(), '<r1@corner>', { intent: 'question', summary: 'Asks the price', body: 'Hi! Usually $1,500 to $5,000.' }, NOW)
    expect(s.replies['<r1@corner>']).toMatchObject({ intent: 'question', summary: 'Asks the price', draft: { body: 'Hi! Usually $1,500 to $5,000.', source: 'ai' } })
  })
  it('never replaces text you edited', () => {
    const edited = { ...base() }
    edited.replies = { '<r1@corner>': { ...edited.replies['<r1@corner>'], draft: { body: 'Mine', source: 'edited' } } }
    const s = applyReplyDraft(edited, '<r1@corner>', { intent: 'question', summary: '', body: 'AI' }, NOW)
    expect(s.replies['<r1@corner>'].draft).toEqual({ body: 'Mine', source: 'edited' })
  })
  it('honours an opt-out the AI spotted', () => {
    const s = applyReplyDraft(base(), '<r1@corner>', { intent: 'unsubscribe', summary: 'Wants no more email', body: '' }, NOW)
    expect(s.suppressed).toContain('owner@corner.example.com')
    expect(s.replies['<r1@corner>'].handled?.how).toBe('auto')
  })
})

describe('replyEmail', () => {
  it('answers in the same thread with the signature and their message quoted', () => {
    const r = mergeReplies(state(enrolled('a', 'owner@corner.example.com', true)), [msg({ fromName: 'Pat' })], NOW).state.replies['<r1@corner>']
    const e = replyEmail(r, 'Hi Pat,\n\nAbout $1,500.', sender)
    expect(e.subject).toBe('Re: A website for Corner Cafe')
    expect(e.inReplyTo).toBe('<r1@corner>')
    expect(e.body.startsWith('Hi Pat,\n\nAbout $1,500.\n\nSam')).toBe(true)
    expect(e.body).toContain('no thanks')
    expect(e.body).toContain('Pat <owner@corner.example.com> wrote:\n> Sounds good, how much would it cost?')
    expect(replyEmail({ ...r, subject: 'Hello' }, 'x', sender).subject).toBe('Re: Hello')
  })
})

describe('loading', () => {
  it('round-trips replies and drops broken ones', () => {
    const s = mergeReplies(state(enrolled('a', 'owner@corner.example.com', true)), [msg()], NOW).state
    window.localStorage.setItem('k', JSON.stringify({ ...s, inboxCheckedAt: NOW.toISOString(), replies: { ...s.replies, bad: { id: 'bad' }, worse: 5 } }))
    const loaded = loadOutreach('k')
    expect(Object.keys(loaded.replies)).toEqual(['<r1@corner>'])
    expect(loaded.replies['<r1@corner>']).toEqual(s.replies['<r1@corner>'])
    expect(loaded.inboxCheckedAt).toBe(NOW.toISOString())
    window.localStorage.setItem('k', '{}')
    expect(loadOutreach('k').replies).toEqual({})
  })
  it("gives mailboxes saved before reply checks their provider's IMAP server", () => {
    window.localStorage.setItem('m', JSON.stringify({ host: 'smtp.gmail.com', port: 465 }))
    expect(loadMailbox('m').imapHost).toBe('imap.gmail.com')
    window.localStorage.setItem('m', JSON.stringify({ host: 'smtp.gmail.com', port: 465, imapHost: '' }))
    expect(loadMailbox('m').imapHost).toBe('')
    window.localStorage.setItem('m', JSON.stringify({ host: 'mail.mine.example.com', port: 587 }))
    expect(loadMailbox('m').imapHost).toBe('')
  })
})

describe('applyReplyDraft force', () => {
  it('replaces your edits when you ask for a rewrite', () => {
    const s = mergeReplies(state(enrolled('a', 'owner@corner.example.com', true)), [msg()], NOW).state
    s.replies['<r1@corner>'] = { ...s.replies['<r1@corner>'], draft: { body: 'Mine', source: 'edited' } }
    const next = applyReplyDraft(s, '<r1@corner>', { intent: 'question', summary: '', body: 'AI' }, NOW, true)
    expect(next.replies['<r1@corner>'].draft).toEqual({ body: 'AI', source: 'ai' })
  })
})
