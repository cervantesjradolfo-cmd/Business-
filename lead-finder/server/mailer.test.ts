// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { resolveSmtpHost, sendViaSmtp, type MailerDeps } from './mailer'
import type { SendRequest } from '../src/lib/types'

const req: SendRequest = {
  smtp: { host: 'smtp.gmail.com', port: 465, secure: true, user: 'me@gmail.com', pass: 'hunter2-secret' },
  from: { name: 'Sam', address: 'me@gmail.com' },
  to: 'Owner@Acme.example.com', subject: 'Hello', text: 'Body', suppressed: [],
}
const publicLookup = async () => [{ address: '142.250.1.1', family: 4 }]

function deps(sendMail: (m: unknown) => Promise<unknown>, lookup: MailerDeps['lookup'] = publicLookup) {
  const close = vi.fn()
  const createTransport = vi.fn(() => ({ sendMail, close })) as unknown as MailerDeps['createTransport']
  return { d: { lookup, createTransport } as MailerDeps, close, createTransport }
}

describe('resolveSmtpHost', () => {
  it('uses a public address and rejects private, blocked and unresolvable hosts', async () => {
    expect(await resolveSmtpHost('smtp.gmail.com', { lookup: publicLookup })).toEqual({ ok: true, address: '142.250.1.1' })
    expect(await resolveSmtpHost('1.2.3.4')).toEqual({ ok: true, address: '1.2.3.4' })
    for (const h of ['127.0.0.1', '10.0.0.5', '[::1]', '169.254.169.254', 'localhost', 'intranet']) {
      expect(await resolveSmtpHost(h, { lookup: publicLookup })).toEqual({ ok: false, error: "That mail server address isn't allowed" })
    }
    const rebind = async () => [{ address: '8.8.8.8', family: 4 }, { address: '192.168.1.1', family: 4 }]
    expect((await resolveSmtpHost('evil.example.com', { lookup: rebind })).ok).toBe(false)
    expect(await resolveSmtpHost('nope.example.com', { lookup: async () => { throw new Error('ENOTFOUND') } })).toEqual({ ok: false, error: "Couldn't find that mail server" })
    expect(await resolveSmtpHost('empty.example.com', { lookup: async () => [] })).toEqual({ ok: false, error: "Couldn't find that mail server" })
  })
})

describe('sendViaSmtp', () => {
  it('connects to the checked address, keeps the host for TLS, and sends plain text', async () => {
    const sendMail = vi.fn(async (_m: unknown) => ({ messageId: '<id@gmail.com>' }))
    const { d, close, createTransport } = deps(sendMail)
    const r = await sendViaSmtp({ ...req, inReplyTo: '<first@gmail.com>' }, d)
    expect(r).toEqual({ ok: true, messageId: '<id@gmail.com>' })
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: '142.250.1.1', port: 465, secure: true, requireTLS: false,
      auth: { user: 'me@gmail.com', pass: 'hunter2-secret' },
      tls: { servername: 'smtp.gmail.com', minVersion: 'TLSv1.2' }, logger: false, debug: false,
    }))
    const msg = sendMail.mock.calls[0][0] as Record<string, unknown>
    expect(msg).toMatchObject({
      from: { name: 'Sam', address: 'me@gmail.com' }, to: 'Owner@Acme.example.com', subject: 'Hello', text: 'Body',
      inReplyTo: '<first@gmail.com>', references: '<first@gmail.com>',
      headers: { 'List-Unsubscribe': '<mailto:me@gmail.com?subject=unsubscribe>' },
    })
    expect(msg).not.toHaveProperty('html')
    expect(close).toHaveBeenCalledTimes(1)
  })
  it('requires STARTTLS on non-SSL ports', async () => {
    const { d, createTransport } = deps(async () => ({ messageId: 'x' }))
    await sendViaSmtp({ ...req, smtp: { ...req.smtp, port: 587, secure: false } }, d)
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ secure: false, requireTLS: true }))
  })
  it('refuses suppressed addresses before touching the network', async () => {
    const lookup = vi.fn(publicLookup)
    const { d, createTransport } = deps(async () => ({ messageId: 'x' }), lookup)
    const r = await sendViaSmtp({ ...req, suppressed: ['owner@acme.example.com'] }, d)
    expect(r).toMatchObject({ ok: false, code: 'suppressed' })
    expect(lookup).not.toHaveBeenCalled()
    expect(createTransport).not.toHaveBeenCalled()
  })
  it('refuses private hosts', async () => {
    const { d, createTransport } = deps(async () => ({ messageId: 'x' }))
    const r = await sendViaSmtp({ ...req, smtp: { ...req.smtp, host: '10.0.0.1' } }, d)
    expect(r).toMatchObject({ ok: false, code: 'host' })
    expect(createTransport).not.toHaveBeenCalled()
  })
  it.each([
    [{ code: 'EAUTH', message: 'Invalid login hunter2-secret' }, 'auth'],
    [{ code: 'ETIMEDOUT' }, 'timeout'],
    [{ code: 'ECONNECTION' }, 'connection'],
    [{ code: 'ESOCKET' }, 'connection'],
    [{ code: 'EENVELOPE' }, 'rejected'],
    [{ code: 'EMESSAGE', responseCode: 554 }, 'rejected'],
    [{ responseCode: 550 }, 'rejected'],
    [new Error('weird hunter2-secret'), 'connection'],
  ])('maps %j to %s without leaking the password', async (err, code) => {
    const { d, close } = deps(async () => { throw err })
    const r = await sendViaSmtp(req, d)
    expect(r).toMatchObject({ ok: false, code })
    expect(JSON.stringify(r)).not.toContain('hunter2')
    expect(close).toHaveBeenCalledTimes(1)
  })
  it('includes only the numeric response code for rejections', async () => {
    const { d } = deps(async () => { throw { responseCode: 550, response: '550 no hunter2-secret' } })
    const r = await sendViaSmtp(req, d)
    expect(r).toEqual({ ok: false, code: 'rejected', error: 'The mail server refused the message (code 550).' })
  })
  it('times out a send that never finishes', async () => {
    vi.useFakeTimers()
    try {
      const { d, close } = deps(() => new Promise(() => {}))
      const p = sendViaSmtp(req, d)
      await vi.advanceTimersByTimeAsync(41_000)
      expect(await p).toMatchObject({ ok: false, code: 'timeout' })
      expect(close).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
  it('gives up on a DNS lookup that never resolves with a mapped host error', async () => {
    vi.useFakeTimers()
    try {
      const { d, createTransport } = deps(async () => ({ messageId: 'x' }), () => new Promise(() => {}))
      const p = sendViaSmtp(req, d)
      await vi.advanceTimersByTimeAsync(5_100)
      expect(await p).toEqual({ ok: false, code: 'host', error: "Couldn't find that mail server" })
      expect(createTransport).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
