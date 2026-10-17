// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CAMPAIGN, EMPTY_MAILBOX, enroll } from '../src/lib/outreach'
import { emailFooter } from '../src/lib/pitch'
import type { BackgroundLead, Mailbox, OutreachState, ReplyRequest, SavedLead, SendRequest } from '../src/lib/types'
import { runAll, runWorkspace, statusOf, syncWorkspace, disableWorkspace, type RunDeps } from './background'
import { POST as backgroundPOST } from '../api/background'
import { GET as cronGET } from '../api/cron'

// An in-memory Upstash: answers the REST commands the app uses.
let store: Map<string, string>
let sets: Map<string, Set<string>>
function fakeUpstash() {
  store = new Map()
  sets = new Map()
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    const [cmd, ...a] = JSON.parse(init.body as string) as string[]
    let result: unknown = null
    if (cmd === 'GET') result = store.get(a[0]) ?? null
    else if (cmd === 'SET') {
      if (a.includes('NX') && store.has(a[0])) result = null
      else { store.set(a[0], a[1]); result = 'OK' }
    } else if (cmd === 'DEL') result = store.delete(a[0]) ? 1 : 0
    else if (cmd === 'SADD') { (sets.get(a[0]) ?? sets.set(a[0], new Set()).get(a[0])!).add(a[1]); result = 1 }
    else if (cmd === 'SREM') result = sets.get(a[0])?.delete(a[1]) ? 1 : 0
    else if (cmd === 'SMEMBERS') result = [...(sets.get(a[0]) ?? [])]
    else if (cmd === 'EVAL') { const [, , key, id] = a; result = store.get(key) === id ? (store.delete(key), 1) : 0 }
    return new Response(JSON.stringify({ result }), { status: 200 })
  }))
}

const ENV = { KV_REST_API_URL: 'https://kv.example.com', KV_REST_API_TOKEN: 't', BACKGROUND_SECRET: 'x'.repeat(32), CRON_SECRET: 'c'.repeat(20) }
const sender = { name: 'Sam', business: 'Acme Web', email: 'sam@acme.example.com', phone: '', address: '1 Main St, Austin TX', website: '' }
const PASS = 'app-password-secret'
const mailbox: Mailbox = { ...EMPTY_MAILBOX, host: 'smtp.gmail.com', imapHost: 'imap.gmail.com', user: 'sam@acme.example.com', pass: PASS, fromName: 'Sam', fromAddress: 'sam@acme.example.com', sendDays: [0, 1, 2, 3, 4, 5, 6], sendStart: 0, sendEnd: 24, timeZone: 'UTC', warmup: false, gapSeconds: 20 }
const pitch = { email: { subject: 'A faster site for Corner Cafe', body: `Hi Corner Cafe team,${emailFooter(sender)}` }, sms: '', phoneOpener: '', source: 'template' as const }
const T0 = new Date('2026-10-16T15:00:00Z')
const lead = (id: string, status: BackgroundLead['status'] = 'new'): BackgroundLead => ({ id, name: `Cafe ${id}`, category: 'Cafe', status, updatedAt: T0.toISOString(), pitch, services: ['website'] })
const saved = (id: string): SavedLead => ({ lead: { id, osmType: 'node', osmId: 1, osmUrl: '', name: `Cafe ${id}`, category: 'Cafe', categoryId: 'cafes', address: '', lat: 0, lon: 0, distanceKm: 0, email: `${id}@x.example.com` }, status: 'new', notes: '', savedAt: '', updatedAt: '' })
const empty = (): OutreachState => ({ campaign: DEFAULT_CAMPAIGN, enrollments: {}, suppressed: [], sentToday: { day: '', count: 0 }, replies: {} })

function deps(over: Partial<RunDeps> = {}) {
  let clock = T0.getTime()
  const sent: SendRequest[] = []
  const d: RunDeps & { sent: SendRequest[] } = {
    sent,
    now: () => new Date(clock),
    sleep: async (ms) => { clock += ms },
    send: async (req) => { sent.push(req); clock += 1000; return { ok: true, messageId: `<m${sent.length}@x>` } },
    inbox: async () => ({ ok: true, messages: [] }),
    draft: async () => null,
    alert: async () => {},
    crm: async () => {},
    ...over,
  }
  return d
}

beforeEach(() => { Object.assign(process.env, ENV); delete process.env.APP_ACCESS_KEY; fakeUpstash() })
afterEach(() => { for (const k of Object.keys(ENV)) delete process.env[k]; vi.unstubAllGlobals() })

async function enable(outreach: OutreachState, leads: Record<string, BackgroundLead>) {
  const r = await syncWorkspace({ workspace: 'agency', outreach, leads, sender, mailbox }, T0)
  if (r === 'busy') throw new Error('busy')
  return r
}

describe('background sync', () => {
  it('stores the workspace with the password encrypted, and reports it as on', async () => {
    expect(await statusOf('agency')).toEqual({ available: true, enabled: false })
    await enable(enroll(empty(), saved('a'), T0), { a: lead('a') })
    const raw = store.get('lf:ws:agency')!
    expect(raw).not.toContain(PASS)
    expect(JSON.parse(raw).passEnc).toMatch(/^v1\./)
    expect(sets.get('lf:workspaces')).toEqual(new Set(['agency']))
    expect(await statusOf('agency')).toMatchObject({ available: true, enabled: true })
  })
  it('merges with what the server did, and turning off deletes the copy', async () => {
    await enable(enroll(empty(), saved('a'), T0), { a: lead('a') })
    await runWorkspace('agency', T0.getTime() + 50_000, deps())
    // The browser still has the old copy (nothing sent); the merge keeps the server's send.
    const r = await enable(enroll(empty(), saved('a'), T0), { a: lead('a') })
    expect(r.outreach!.enrollments.a.history).toHaveLength(1)
    expect(r.events).toEqual([{ leadId: 'a', status: 'contacted', at: expect.any(String) }])
    const off = await disableWorkspace('agency')
    expect(off).toMatchObject({ enabled: false, outreach: { enrollments: { a: { nextStep: 1 } } } })
    expect(store.has('lf:ws:agency')).toBe(false)
    expect(sets.get('lf:workspaces')!.size).toBe(0)
  })
})

describe('the scheduled run', () => {
  it('sends due emails with the gap between them, records them and marks leads contacted', async () => {
    let s = enroll(empty(), saved('a'), T0)
    s = enroll(s, saved('b'), new Date(T0.getTime() + 1))
    await enable(s, { a: lead('a'), b: lead('b') })
    const d = deps()
    expect(await runWorkspace('agency', T0.getTime() + 50_000, d)).toBe('sent 2')
    expect(d.sent.map((x) => x.to)).toEqual(['a@x.example.com', 'b@x.example.com'])
    expect(d.sent[0]).toMatchObject({ subject: 'A faster site for Corner Cafe', kind: 'first', smtp: { pass: PASS } })
    const ws = JSON.parse(store.get('lf:ws:agency')!)
    expect(ws.outreach.enrollments.a).toMatchObject({ nextStep: 1, history: [{ step: 0, via: 'smtp', messageId: '<m1@x>' }] })
    expect(ws.leads.a.status).toBe('contacted')
    expect(ws.lastRunNote).toBe('sent 2')
    // A second run right after has nothing left to send.
    expect(await runWorkspace('agency', T0.getTime() + 50_000, deps())).toBe('nothing due')
  })
  it('keeps to the sending hours and the daily limit', async () => {
    const s = enroll(empty(), saved('a'), T0)
    await syncWorkspace({ workspace: 'agency', outreach: s, leads: { a: lead('a') }, sender, mailbox: { ...mailbox, sendDays: [] } }, T0)
    const d = deps()
    expect(await runWorkspace('agency', T0.getTime() + 50_000, d)).toBe('outside sending hours')
    expect(d.sent).toEqual([])
  })
  it('saves the email as being sent before sending, so a crash never sends it twice', async () => {
    await enable(enroll(empty(), saved('a'), T0), { a: lead('a') })
    const d = deps({ send: async () => { const ws = JSON.parse(store.get('lf:ws:agency')!); expect(ws.outreach.enrollments.a.pendingSend).toBeTruthy(); throw new Error('crash') } })
    await expect(runWorkspace('agency', T0.getTime() + 50_000, d)).rejects.toThrow('crash')
    const d2 = deps()
    await runWorkspace('agency', T0.getTime() + 50_000, d2)
    expect(d2.sent).toEqual([])
  })
  it('blocks an email that fails the compliance check', async () => {
    await syncWorkspace({ workspace: 'agency', outreach: enroll(empty(), saved('a'), T0), leads: { a: lead('a') }, sender: { ...sender, address: '' }, mailbox }, T0)
    const d = deps()
    await runWorkspace('agency', T0.getTime() + 50_000, d)
    expect(d.sent).toEqual([])
    expect(JSON.parse(store.get('lf:ws:agency')!).outreach.enrollments.a.lastError).toMatch(/Your\/Profile details/)
  })
  it('finds replies, stops the sequence, drafts an answer and alerts', async () => {
    await enable(enroll(empty(), saved('a'), T0), { a: lead('a') })
    await runWorkspace('agency', T0.getTime() + 50_000, deps())
    const alert = vi.fn(async () => {})
    const draft = vi.fn(async (_req: ReplyRequest) => ({ intent: 'question' as const, summary: 'Asks the price', body: 'About $1,500.' }))
    const d = deps({
      inbox: async () => ({ ok: true, messages: [{ id: '<r1@x>', from: 'a@x.example.com', subject: 'Re: A faster site', date: T0.toISOString(), messageId: '<r1@x>', refs: ['<m1@x>'], text: 'How much?', auto: false }] }),
      draft, alert,
    })
    expect(await runWorkspace('agency', T0.getTime() + 50_000, d)).toBe('1 new reply')
    const ws = JSON.parse(store.get('lf:ws:agency')!)
    expect(ws.leads.a.status).toBe('replied')
    expect(ws.outreach.enrollments.a).toMatchObject({ state: 'stopped', stopReason: 'replied' })
    expect(ws.outreach.replies['<r1@x>']).toMatchObject({ intent: 'question', draft: { body: 'About $1,500.', source: 'ai' } })
    expect(draft.mock.calls[0][0]).toMatchObject({ theirReply: 'How much?', ourEmail: { subject: 'A faster site for Corner Cafe' }, services: ['website'] })
    expect(alert).toHaveBeenCalledWith(expect.objectContaining({ event: 'reply', summary: 'Asks the price' }))
  })
  it('skips a workspace another run holds', async () => {
    await enable(enroll(empty(), saved('a'), T0), { a: lead('a') })
    store.set('lf:lock:agency', 'someone-else')
    expect(await runWorkspace('agency', T0.getTime() + 50_000, deps())).toBe('busy')
  })
  it('runs every workspace', async () => {
    await enable(enroll(empty(), saved('a'), T0), { a: lead('a') })
    expect(await runAll(T0.getTime() + 50_000, deps())).toEqual([{ id: 'agency', note: 'sent 1' }])
  })
})

describe('endpoints', () => {
  const post = (body: unknown, key?: string) => backgroundPOST(new Request('http://localhost/api/background', { method: 'POST', headers: key ? { 'x-access-key': key } : {}, body: JSON.stringify(body) }))
  it('/api/cron needs CRON_SECRET', async () => {
    expect((await cronGET(new Request('http://localhost/api/cron'))).status).toBe(401)
    expect((await cronGET(new Request('http://localhost/api/cron', { headers: { authorization: 'Bearer wrong' } }))).status).toBe(401)
    const ok = await cronGET(new Request('http://localhost/api/cron', { headers: { authorization: `Bearer ${'c'.repeat(20)}` } }))
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ ran: [] })
  })
  it('/api/background checks the access key, the profile id and the mailbox', async () => {
    process.env.APP_ACCESS_KEY = 'k'
    expect((await post({ action: 'status', workspace: 'agency' })).status).toBe(401)
    expect((await post({ action: 'status', workspace: '../etc' }, 'k')).status).toBe(400)
    expect(await (await post({ action: 'status', workspace: 'agency' }, 'k')).json()).toEqual({ available: true, enabled: false })
    const bad = await post({ action: 'sync', workspace: 'agency', mailbox: { host: 'smtp.gmail.com' }, outreach: {}, leads: {}, sender }, 'k')
    expect(bad.status).toBe(400)
    const ok = await post({ action: 'sync', workspace: 'agency', mailbox, outreach: enroll(empty(), saved('a'), T0), leads: { a: lead('a') }, sender }, 'k')
    expect(ok.status).toBe(200)
    expect(await ok.text()).not.toContain(PASS)
  })
  it('says when background mode is not set up', async () => {
    delete process.env.BACKGROUND_SECRET
    expect(await (await post({ action: 'status', workspace: 'agency' })).json()).toEqual({ available: false, enabled: false })
    expect((await post({ action: 'sync', workspace: 'agency' })).status).toBe(400)
  })
})
