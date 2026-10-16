// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InboxRequest } from '../src/lib/types'
import { checkInbox, isAutomatic, type InboxDeps } from './inbox'

const lookup = vi.fn()
vi.mock('node:dns/promises', () => ({ lookup: (...a: unknown[]) => lookup(...a) }))
const fakeClient = vi.fn()
vi.mock('imapflow', () => ({ ImapFlow: class { constructor(o: unknown) { return fakeClient(o) } } }))

const { POST, GET } = await import('../api/inbox')

const PASS = 'imap-secret-pw'
const req = (over: Partial<InboxRequest> = {}): InboxRequest => ({
  imap: { host: 'imap.gmail.com', user: 'me@gmail.com', pass: PASS },
  since: '2026-10-01T00:00:00.000Z',
  addresses: ['owner@corner.example.com'],
  messageIds: ['<sent1@acme>'],
  ...over,
})

type Msg = { uid: number; from: string; subject: string; headers?: string; source: string; messageId?: string; inReplyTo?: string }
const raw = (from: string, subject: string, body: string, extra = '') =>
  `From: Pat <${from}>\r\nTo: me@gmail.com\r\nSubject: ${subject}\r\nMessage-ID: <x@y>\r\n${extra}Content-Type: text/plain; charset=utf-8\r\n\r\n${body}`

// A pretend IMAP server holding these messages.
function server(msgs: Msg[], opts: { connectError?: unknown } = {}) {
  const calls = { options: undefined as unknown, logout: 0, close: 0, released: 0 }
  const client = {
    on: vi.fn(),
    connect: vi.fn(async () => { if (opts.connectError) throw opts.connectError }),
    getMailboxLock: vi.fn(async () => ({ release: () => { calls.released++ } })),
    search: vi.fn(async () => msgs.map((m) => m.uid)),
    fetch: vi.fn((uids: number[], query: { source?: unknown }) => (async function* () {
      for (const m of msgs.filter((x) => uids.includes(x.uid))) {
        if (query.source) yield { uid: m.uid, seq: m.uid, source: Buffer.from(m.source) }
        else yield {
          uid: m.uid, seq: m.uid,
          envelope: { from: [{ name: 'Pat', address: m.from }], subject: m.subject, messageId: m.messageId, inReplyTo: m.inReplyTo, date: new Date('2026-10-09T12:00:00Z') },
          headers: Buffer.from(m.headers ?? ''),
        }
      }
    })()),
    logout: vi.fn(async () => { calls.logout++ }),
    close: vi.fn(() => { calls.close++ }),
  }
  const deps: InboxDeps = {
    lookup: async () => [{ address: '142.250.1.1', family: 4 }],
    createClient: (o) => { calls.options = o; return client as never },
  }
  return { deps, calls, client }
}

let errSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  delete process.env.APP_ACCESS_KEY
  lookup.mockReset().mockResolvedValue([{ address: '142.250.1.1', family: 4 }])
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('checkInbox', () => {
  it('returns replies from outreach addresses with the quoted text removed', async () => {
    const { deps, calls } = server([
      { uid: 1, from: 'owner@corner.example.com', subject: 'Re: A website', messageId: '<r1@corner>', source: raw('owner@corner.example.com', 'Re: A website', 'How much?\r\n\r\nOn Mon, Oct 6, 2026 Sam wrote:\r\n> Hi') },
      { uid: 2, from: 'newsletter@shop.example.com', subject: 'Sale', source: raw('newsletter@shop.example.com', 'Sale', 'Buy') },
    ])
    const res = await checkInbox(req(), deps)
    expect(res).toEqual({ ok: true, messages: [{
      id: '<r1@corner>', from: 'owner@corner.example.com', fromName: 'Pat', subject: 'Re: A website', date: '2026-10-09T12:00:00.000Z',
      messageId: '<r1@corner>', refs: [], text: 'How much?', auto: false,
    }] })
    // connects to the checked address over TLS, with SNI for the real host
    expect(calls.options).toMatchObject({ host: '142.250.1.1', port: 993, secure: true, servername: 'imap.gmail.com', logger: false })
    expect(calls.logout).toBe(1)
    expect(calls.close).toBe(1)
    expect(calls.released).toBe(1)
  })

  it('matches a reply from another address that references a sent email, and flags auto-replies', async () => {
    const { deps } = server([
      { uid: 3, from: 'boss@other.example.com', subject: 'Re: A website', messageId: '<r2@o>', headers: 'In-Reply-To: <sent1@acme>\r\nReferences: <zzz@q> <sent1@acme>\r\n', source: raw('boss@other.example.com', 'Re', 'Yes') },
      { uid: 4, from: 'owner@corner.example.com', subject: 'Out of office', messageId: '<r3@c>', headers: 'Auto-Submitted: auto-replied\r\n', source: raw('owner@corner.example.com', 'Out of office', 'Away') },
    ])
    const res = await checkInbox(req(), deps)
    if (!res.ok) throw new Error(res.error)
    expect(res.messages.map((m) => [m.from, m.refs, m.auto])).toEqual([
      ['boss@other.example.com', ['<sent1@acme>'], false],
      ['owner@corner.example.com', [], true],
    ])
  })

  it('refuses private mail server addresses without connecting', async () => {
    const { deps, calls } = server([])
    const res = await checkInbox(req({ imap: { host: 'imap.evil.example.com', user: 'u', pass: PASS } }), { ...deps, lookup: async () => [{ address: '10.0.0.5', family: 4 }] })
    expect(res).toMatchObject({ ok: false, code: 'host' })
    expect(calls.options).toBeUndefined()
  })

  it('maps a login failure to a fixed message that never contains the password', async () => {
    const { deps, calls } = server([], { connectError: Object.assign(new Error(`bad login for ${PASS}`), { authenticationFailed: true }) })
    const res = await checkInbox(req(), deps)
    expect(res).toMatchObject({ ok: false, code: 'auth' })
    expect(JSON.stringify(res)).not.toContain(PASS)
    expect(calls.close).toBe(1)
    expect(JSON.stringify(errSpy.mock.calls)).not.toContain(PASS)
  })

  it('maps other connection failures', async () => {
    const { deps } = server([], { connectError: { code: 'ECONNREFUSED' } })
    expect(await checkInbox(req(), deps)).toMatchObject({ ok: false, code: 'connection' })
    const { deps: d2 } = server([], { connectError: { code: 'CONNECT_TIMEOUT' } })
    expect(await checkInbox(req(), d2)).toMatchObject({ ok: false, code: 'timeout' })
  })
})

describe('isAutomatic', () => {
  it('spots automatic replies by header or subject', () => {
    expect(isAutomatic({ 'auto-submitted': 'auto-replied' }, 'Re: hi')).toBe(true)
    expect(isAutomatic({ 'auto-submitted': 'no' }, 'Re: hi')).toBe(false)
    expect(isAutomatic({ 'x-autoreply': 'yes' }, 'Re: hi')).toBe(true)
    expect(isAutomatic({ precedence: 'auto_reply' }, 'Re: hi')).toBe(true)
    expect(isAutomatic({}, 'Automatic reply: A website')).toBe(true)
    expect(isAutomatic({}, 'Out of Office: back Monday')).toBe(true)
    expect(isAutomatic({}, 'Re: A website')).toBe(false)
  })
})

describe('POST /api/inbox', () => {
  const post = (b: unknown, key?: string) => new Request('http://localhost/api/inbox', {
    method: 'POST', headers: { 'content-type': 'application/json', ...(key ? { 'x-access-key': key } : {}) }, body: typeof b === 'string' ? b : JSON.stringify(b),
  })

  it('enforces the access key and rejects bad requests before connecting', async () => {
    process.env.APP_ACCESS_KEY = 'k1'
    expect((await POST(post(req()))).status).toBe(401)
    delete process.env.APP_ACCESS_KEY
    expect((await GET()).status).toBe(405)
    expect((await POST(post('{nope'))).status).toBe(400)
    const bad = await POST(post({ ...req(), addresses: ['not an email'] }))
    expect(bad.status).toBe(400)
    expect(await bad.json()).toMatchObject({ ok: false, code: 'invalid' })
    const noPass = await POST(post({ ...req(), imap: { host: 'imap.gmail.com', user: 'u', pass: '' } }))
    expect(noPass.status).toBe(400)
    expect(fakeClient).not.toHaveBeenCalled()
  })

  it('checks the inbox end to end', async () => {
    const { client } = server([{ uid: 1, from: 'owner@corner.example.com', subject: 'Re: A website', messageId: '<r1@corner>', source: raw('owner@corner.example.com', 'Re: A website', 'Yes') }])
    fakeClient.mockReturnValue(client)
    const res = await POST(post(req()))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.messages[0]).toMatchObject({ from: 'owner@corner.example.com', text: 'Yes' })
  })

  it('answers 422 for a refused login, without the password', async () => {
    const { client } = server([], { connectError: { authenticationFailed: true } })
    fakeClient.mockReturnValue(client)
    const res = await POST(post(req()))
    expect(res.status).toBe(422)
    expect(await res.text()).not.toContain(PASS)
  })
})
