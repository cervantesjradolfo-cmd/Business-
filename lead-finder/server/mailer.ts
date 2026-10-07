// Sends one email over SMTP with nodemailer, to a mail server we checked first.
// Errors are mapped to fixed messages: nothing from the request (or the password) reaches a response or log.
import { lookup as dnsLookup } from 'node:dns/promises'
import net from 'node:net'
import { createTransport } from 'nodemailer'
import { isBlockedHostname, isPrivateIp } from '../src/lib/url.js'
import type { SendErrorCode, SendRequest, SendResult } from '../src/lib/types.js'

export type MailerDeps = {
  lookup: (host: string) => Promise<{ address: string; family: number }[]>
  createTransport: typeof createTransport
}

const defaultLookup: MailerDeps['lookup'] = (host) => dnsLookup(host, { all: true })
const NOT_ALLOWED = "That mail server address isn't allowed"
const NOT_FOUND = "Couldn't find that mail server"
const SEND_TIMEOUT_MS = 40_000
const LOOKUP_TIMEOUT_MS = 5_000 // DNS gets its own budget so lookup + send stays well under Vercel's 60 s

// Resolves the host once and rejects private addresses (same rule as safeLookup); the caller connects to the address.
export async function resolveSmtpHost(
  host: string, deps: Pick<MailerDeps, 'lookup'> = { lookup: defaultLookup },
): Promise<{ ok: true; address: string } | { ok: false; error: string }> {
  const h = host.trim().replace(/^\[|\]$/g, '')
  if (net.isIP(h)) return isPrivateIp(h) ? { ok: false, error: NOT_ALLOWED } : { ok: true, address: h }
  if (isBlockedHostname(h) || !h.includes('.')) return { ok: false, error: NOT_ALLOWED }
  let addrs: { address: string; family: number }[]
  let lookupTimer: ReturnType<typeof setTimeout> | undefined
  try {
    const lookingUp = deps.lookup(h)
    lookingUp.catch(() => {}) // a late failure after the timeout must not be unhandled
    const timeout = new Promise<never>((_, reject) => {
      lookupTimer = setTimeout(() => reject(new Error('lookup timeout')), LOOKUP_TIMEOUT_MS)
    })
    addrs = await Promise.race([lookingUp, timeout])
  } catch {
    return { ok: false, error: NOT_FOUND }
  } finally {
    clearTimeout(lookupTimer)
  }
  if (addrs.length === 0) return { ok: false, error: NOT_FOUND }
  if (addrs.some((a) => isPrivateIp(a.address))) return { ok: false, error: NOT_ALLOWED }
  return { ok: true, address: addrs[0].address }
}

const fail = (code: SendErrorCode, error: string): SendResult => ({ ok: false, code, error })

function mapError(err: unknown): SendResult {
  const e = (err ?? {}) as { code?: unknown; responseCode?: unknown }
  const code = typeof e.code === 'string' ? e.code : ''
  const responseCode = typeof e.responseCode === 'number' ? e.responseCode : 0
  if (code === 'EAUTH') {
    return fail('auth', 'The mailbox refused the username or app password. Check them under Mailbox (Gmail and Outlook need an app password).')
  }
  if (code === 'ETIMEDOUT' || code === 'ETIMEOUT') return fail('timeout', "The mail server didn't answer in time.")
  if (code === 'EENVELOPE' || code === 'EMESSAGE' || responseCode >= 500) {
    return fail('rejected', `The mail server refused the message${responseCode ? ` (code ${responseCode})` : ''}.`)
  }
  return fail('connection', "Couldn't connect to the mail server. Check the host and port.")
}

export async function sendViaSmtp(
  req: SendRequest, deps: MailerDeps = { lookup: defaultLookup, createTransport },
): Promise<SendResult> {
  if (req.suppressed.includes(req.to.trim().toLowerCase())) {
    return fail('suppressed', "This address unsubscribed, so it won't be emailed")
  }
  const resolved = await resolveSmtpHost(req.smtp.host, deps)
  if (!resolved.ok) return fail('host', resolved.error)

  const { smtp, from } = req
  let transport: ReturnType<typeof createTransport> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    transport = deps.createTransport({
      host: resolved.address,
      port: smtp.port,
      secure: smtp.secure,
      requireTLS: !smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
      tls: { servername: smtp.host.trim().replace(/^\[|\]$/g, ''), minVersion: 'TLSv1.2' },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      logger: false,
      debug: false,
    })
    const sending = transport.sendMail({
      from: { name: from.name, address: from.address },
      to: req.to,
      subject: req.subject,
      text: req.text,
      headers: { 'List-Unsubscribe': `<mailto:${from.address}?subject=unsubscribe>` },
      ...(req.inReplyTo ? { inReplyTo: req.inReplyTo, references: req.inReplyTo } : {}),
    })
    sending.catch(() => {}) // a late failure after the timeout must not be unhandled
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject({ code: 'ETIMEDOUT' }), SEND_TIMEOUT_MS)
    })
    const info = await Promise.race([sending, timeout])
    return { ok: true, messageId: String(info.messageId) }
  } catch (err) {
    return mapError(err)
  } finally {
    clearTimeout(timer)
    transport?.close()
  }
}
