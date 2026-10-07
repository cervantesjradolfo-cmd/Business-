// @vitest-environment node
// End to end through POST /api/send with DNS and nodemailer mocked.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const lookup = vi.fn()
vi.mock('node:dns/promises', () => ({ lookup: (...a: unknown[]) => lookup(...a) }))
const createTransport = vi.fn()
vi.mock('nodemailer', () => ({ createTransport: (...a: unknown[]) => createTransport(...a) }))

import { POST, GET } from '../api/send'

const PASS = 'hunter2-secret-pw'
const body = (over: Record<string, unknown> = {}, smtp: Record<string, unknown> = {}) => ({
  smtp: { host: 'smtp.gmail.com', port: 465, secure: true, user: 'me@gmail.com', pass: PASS, ...smtp },
  from: { name: 'Sam', address: 'me@gmail.com' },
  to: 'owner@acme.example.com', subject: 'Hello', text: 'Body', suppressed: [], ...over,
})
const post = (b: unknown, key?: string) =>
  new Request('http://localhost/api/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { 'x-access-key': key } : {}) },
    body: typeof b === 'string' ? b : JSON.stringify(b),
  })

let sendMail: ReturnType<typeof vi.fn>
let close: ReturnType<typeof vi.fn>
let errSpy: ReturnType<typeof vi.spyOn>
let logSpy: ReturnType<typeof vi.spyOn>
let warnSpy: ReturnType<typeof vi.spyOn>
const savedKey = process.env.APP_ACCESS_KEY

beforeEach(() => {
  delete process.env.APP_ACCESS_KEY
  lookup.mockReset().mockResolvedValue([{ address: '142.250.1.1', family: 4 }])
  sendMail = vi.fn(async () => ({ messageId: '<abc@gmail.com>' }))
  close = vi.fn()
  createTransport.mockReset().mockImplementation(() => ({ sendMail, close }))
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  if (savedKey === undefined) delete process.env.APP_ACCESS_KEY
  else process.env.APP_ACCESS_KEY = savedKey
})

const consoleText = () => JSON.stringify([errSpy.mock.calls, logSpy.mock.calls, warnSpy.mock.calls])

describe('POST /api/send', () => {
  it('sends and returns the message id', async () => {
    const res = await POST(post(body()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, messageId: '<abc@gmail.com>' })
    expect(sendMail).toHaveBeenCalledTimes(1)
  })

  it('enforces the access key when set, and accepts the right one', async () => {
    process.env.APP_ACCESS_KEY = 'k1'
    expect((await POST(post(body()))).status).toBe(401)
    expect((await POST(post(body(), 'wrong'))).status).toBe(401)
    expect(createTransport).not.toHaveBeenCalled()
    expect(lookup).not.toHaveBeenCalled()
    expect((await POST(post(body(), 'k1'))).status).toBe(200)
  })

  it('rejects GET with 405 and malformed JSON with 400', async () => {
    expect((await GET()).status).toBe(405)
    expect((await POST(post('{not json'))).status).toBe(400)
    expect(createTransport).not.toHaveBeenCalled()
  })

  it.each([22, 25, 80, 443, 993, 3306, 6379, 0, -1, 587.5])('refuses port %s with invalid and never connects', async (port) => {
    const res = await POST(post(body({}, { port, secure: false })))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ ok: false, code: 'invalid' })
    expect(createTransport).not.toHaveBeenCalled()
  })

  it.each([465, 587, 2525])('accepts port %s with the matching secure flag', async (port) => {
    const res = await POST(post(body({}, { port, secure: port === 465 })))
    expect(res.status).toBe(200)
  })

  it.each([[465, false], [587, true], [2525, true]])('refuses port %s with secure=%s', async (port, secure) => {
    const res = await POST(post(body({}, { port, secure })))
    expect(res.status).toBe(400)
    expect(createTransport).not.toHaveBeenCalled()
  })

  it.each([
    '127.0.0.1', '127.1.2.3', '10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '0.0.0.0',
    '[::1]', '::1', 'fe80::1', 'fc00::1', '::ffff:127.0.0.1', 'localhost', 'LOCALHOST', 'metadata.google.internal', 'router',
  ])('refuses host %s with code host', async (host) => {
    const res = await POST(post(body({}, { host })))
    expect([400]).toContain(res.status)
    const j = await res.json()
    expect(j).toMatchObject({ ok: false })
    expect(['host', 'invalid']).toContain(j.code)
    expect(createTransport).not.toHaveBeenCalled()
  })

  it('refuses a name that resolves to a private address, including when only one answer is private', async () => {
    lookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }, { address: '10.1.2.3', family: 4 }])
    const res = await POST(post(body({}, { host: 'rebind.example.com' })))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ ok: false, code: 'host' })
    expect(createTransport).not.toHaveBeenCalled()
    lookup.mockResolvedValue([{ address: '::1', family: 6 }])
    expect((await POST(post(body({}, { host: 'v6.example.com' })))).status).toBe(400)
    lookup.mockResolvedValue([{ address: '169.254.169.254', family: 4 }])
    expect((await POST(post(body({}, { host: 'meta.example.com' })))).status).toBe(400)
    expect(createTransport).not.toHaveBeenCalled()
  })

  it('treats a DNS failure as host and an unresolvable name never reaches the transport', async () => {
    lookup.mockRejectedValue(new Error('ENOTFOUND'))
    const res = await POST(post(body()))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'host' })
    expect(createTransport).not.toHaveBeenCalled()
  })

  it('connects to the resolved address with the original host as TLS servername', async () => {
    await POST(post(body()))
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: '142.250.1.1', tls: expect.objectContaining({ servername: 'smtp.gmail.com' }),
    }))
    expect(lookup).toHaveBeenCalledTimes(1)
  })

  it('refuses a suppressed address with 409 regardless of case and whitespace, before any DNS or transport', async () => {
    const res = await POST(post(body({ to: ' Owner@Acme.Example.com ', suppressed: ['OWNER@acme.example.com '] })))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ ok: false, code: 'suppressed' })
    expect(lookup).not.toHaveBeenCalled()
    expect(createTransport).not.toHaveBeenCalled()
  })

  it('adds List-Unsubscribe and plain text only, and threads follow-ups', async () => {
    await POST(post(body({ inReplyTo: '<first@gmail.com>' })))
    const msg = sendMail.mock.calls[0][0] as Record<string, unknown>
    expect(msg.headers).toEqual({ 'List-Unsubscribe': '<mailto:me@gmail.com?subject=unsubscribe>' })
    expect(msg.inReplyTo).toBe('<first@gmail.com>')
    expect(msg.references).toBe('<first@gmail.com>')
    expect(msg).not.toHaveProperty('html')
  })

  it('refuses header injection in subject and from name', async () => {
    expect((await POST(post(body({ subject: 'Hi\r\nBcc: x@evil.example.com' })))).status).toBe(400)
    expect((await POST(post(body({ from: { name: 'Sam\nBcc: x@evil.example.com', address: 'me@gmail.com' } })))).status).toBe(400)
    expect(createTransport).not.toHaveBeenCalled()
  })

  it.each([
    [{ code: 'EAUTH', response: `535 bad ${PASS}`, message: `Invalid login ${PASS}` }, 422, 'auth'],
    [{ code: 'ETIMEDOUT', message: PASS }, 504, 'timeout'],
    [{ code: 'ECONNECTION', message: PASS }, 502, 'connection'],
    [{ code: 'ESOCKET', message: `tls ${PASS}` }, 502, 'connection'],
    [{ code: 'EENVELOPE', message: PASS }, 502, 'rejected'],
    [{ responseCode: 554, response: `554 ${PASS}` }, 502, 'rejected'],
    [new Error(`boom ${PASS}`), 502, 'connection'],
    ['plain string ' + PASS, 502, 'connection'],
    [null, 502, 'connection'],
  ])('maps %j to %s/%s and never leaks the password to the body or console', async (err, status, code) => {
    sendMail.mockRejectedValue(err)
    const res = await POST(post(body()))
    const text = await res.text()
    expect(res.status).toBe(status)
    expect(JSON.parse(text)).toMatchObject({ ok: false, code })
    expect(text).not.toContain(PASS)
    expect(text).not.toContain('hunter2')
    expect(consoleText()).not.toContain('hunter2')
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('never leaks the password when the transport factory itself throws or validation fails', async () => {
    createTransport.mockImplementation(() => { throw new Error(`cannot build ${PASS}`) })
    const res = await POST(post(body()))
    const text = await res.text()
    expect(text).not.toContain('hunter2')
    expect(consoleText()).not.toContain('hunter2')
    const bad = await POST(post(body({ to: 'not-an-email' })))
    expect(await bad.text()).not.toContain('hunter2')
  })

  it('does not echo submitted values in validation errors', async () => {
    const res = await POST(post(body({ subject: 'x'.repeat(300) }, { user: '', pass: PASS })))
    const text = await res.text()
    expect(res.status).toBe(400)
    expect(text).not.toContain(PASS)
  })
})
