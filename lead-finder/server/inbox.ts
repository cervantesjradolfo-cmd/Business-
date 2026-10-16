// Reads the outreach mailbox over IMAP (port 993, TLS) and returns the messages that answer outreach emails.
// Like the mailer, it connects only to a mail server address it checked itself, and errors are mapped to
// fixed messages: nothing from the request (or the password) reaches a response or log.
import { ImapFlow, type FetchMessageObject } from 'imapflow'
import { simpleParser } from 'mailparser'
import { stripQuoted } from '../src/lib/replies.js'
import type { InboxErrorCode, InboxMessage, InboxRequest, InboxResult } from '../src/lib/types.js'
import { resolveSmtpHost, type MailerDeps } from './mailer.js'

export type InboxDeps = {
  lookup?: MailerDeps['lookup'] // DNS; resolveSmtpHost's default when unset
  createClient: (options: ConstructorParameters<typeof ImapFlow>[0]) => Pick<ImapFlow, 'connect' | 'getMailboxLock' | 'search' | 'fetch' | 'logout' | 'close'>
}

const defaultDeps: InboxDeps = {
  createClient: (options) => new ImapFlow(options),
}

const CHECK_TIMEOUT_MS = 45_000 // the whole check stays under Vercel's 60 s
const MAX_SCANNED = 400 // newest messages in the date range whose headers are read
const MAX_RETURNED = 40 // newest matching messages whose text is read
const MAX_SOURCE_BYTES = 256 * 1024
const MAX_TEXT = 4000

const fail = (code: InboxErrorCode, error: string): InboxResult => ({ ok: false, code, error })

function mapError(err: unknown): InboxResult {
  const e = (err ?? {}) as { code?: unknown; authenticationFailed?: unknown; responseText?: unknown }
  const code = typeof e.code === 'string' ? e.code : ''
  if (e.authenticationFailed === true || code === 'AUTHENTICATIONFAILED') {
    return fail('auth', 'The mailbox refused the username or app password when checking replies. Check them under Mailbox.')
  }
  if (code === 'ETIMEDOUT' || code === 'CONNECT_TIMEOUT' || code === 'GREETING_TIMEOUT' || code === 'CHECK_TIMEOUT') {
    return fail('timeout', "The incoming mail server didn't answer in time.")
  }
  return fail('connection', "Couldn't connect to the incoming mail server. Check the IMAP host under Mailbox (IMAP must be turned on for the mailbox).")
}

const lower = (s: string | undefined) => (s ?? '').trim().toLowerCase()
const ids = (v: string) => v.match(/<[^<>\s]{1,250}>/g) ?? []

// Header values from a raw header block (unfolded), lower-cased names.
function parseHeaders(raw: Buffer | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw) return out
  const text = raw.toString('utf8').replace(/\r?\n[ \t]+/g, ' ')
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i > 0) out[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim()
  }
  return out
}

// Out-of-office and other automatic replies (RFC 3834 and the common vendor headers).
export function isAutomatic(h: Record<string, string>, subject: string): boolean {
  const auto = lower(h['auto-submitted'])
  if (auto && auto !== 'no') return true
  if (h['x-autoreply'] || h['x-autorespond'] || h['x-autoreply-from'] || h['x-mail-autoreply']) return true
  if (/^(auto_reply|auto-reply|bulk|junk|list)$/.test(lower(h.precedence))) return true
  return /^(automatic reply|auto.?reply|out of (the )?office|autoreply)\b/i.test(subject.trim())
}

export async function checkInbox(req: InboxRequest, deps: InboxDeps = defaultDeps): Promise<InboxResult> {
  const resolved = await resolveSmtpHost(req.imap.host, deps.lookup ? { lookup: deps.lookup } : undefined)
  if (!resolved.ok) return fail('host', resolved.error)
  const servername = req.imap.host.trim().replace(/^\[|\]$/g, '')
  const addresses = new Set(req.addresses)
  const ours = new Set(req.messageIds)

  const client = deps.createClient({
    host: resolved.address,
    port: 993,
    secure: true,
    servername,
    auth: { user: req.imap.user, pass: req.imap.pass },
    tls: { servername, minVersion: 'TLSv1.2' },
    logger: false,
    disableAutoIdle: true,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  })
  // A connection error after a failed connect() would otherwise be an unhandled 'error' event.
  ;(client as unknown as { on?: (ev: string, fn: () => void) => void }).on?.('error', () => {})

  let timer: ReturnType<typeof setTimeout> | undefined
  const work = (async (): Promise<InboxResult> => {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')
    try {
      const found = await client.search({ since: new Date(req.since) }, { uid: true })
      const uids = (Array.isArray(found) ? found : []).sort((a, b) => a - b).slice(-MAX_SCANNED)
      if (uids.length === 0) return { ok: true, messages: [] }

      // Pass 1: envelopes and a few headers, to find the messages that answer us.
      const matches: { msg: FetchMessageObject; refs: string[]; auto: boolean }[] = []
      for await (const msg of client.fetch(uids, {
        uid: true, envelope: true, internalDate: true,
        headers: ['references', 'in-reply-to', 'auto-submitted', 'precedence', 'x-autoreply', 'x-autorespond', 'x-autoreply-from', 'x-mail-autoreply'],
      }, { uid: true })) {
        const from = lower(msg.envelope?.from?.[0]?.address)
        const h = parseHeaders(msg.headers)
        const refs = [...new Set([...ids(h['in-reply-to'] ?? msg.envelope?.inReplyTo ?? ''), ...ids(h.references ?? '')])].filter((id) => ours.has(id))
        if (!addresses.has(from) && refs.length === 0) continue
        matches.push({ msg, refs, auto: isAutomatic(h, msg.envelope?.subject ?? '') })
      }
      const picked = matches.slice(-MAX_RETURNED)
      if (picked.length === 0) return { ok: true, messages: [] }

      // Pass 2: the text of the matching messages, without what they quote.
      const texts = new Map<number, string>()
      for await (const msg of client.fetch(picked.map((p) => p.msg.uid), { uid: true, source: { maxLength: MAX_SOURCE_BYTES } }, { uid: true })) {
        if (!msg.source) continue
        try {
          const parsed = await simpleParser(msg.source, { skipImageLinks: true, skipTextToHtml: true, skipTextLinks: true })
          texts.set(msg.uid, stripQuoted(parsed.text ?? '').slice(0, MAX_TEXT))
        } catch {
          texts.set(msg.uid, '')
        }
      }

      const messages: InboxMessage[] = picked.map(({ msg, refs, auto }) => {
        const env = msg.envelope ?? {}
        const messageId = typeof env.messageId === 'string' && /^<[^<>\s]{1,250}>$/.test(env.messageId) ? env.messageId : undefined
        const dateRaw = env.date ?? msg.internalDate
        const date = dateRaw && !Number.isNaN(new Date(dateRaw).getTime()) ? new Date(dateRaw).toISOString() : new Date().toISOString()
        const name = (env.from?.[0]?.name ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 200)
        return {
          id: messageId ?? `uid:${servername}:${msg.uid}:${date}`,
          from: lower(env.from?.[0]?.address),
          ...(name ? { fromName: name } : {}),
          subject: (env.subject ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 300),
          date,
          ...(messageId ? { messageId } : {}),
          refs,
          text: texts.get(msg.uid) ?? '',
          auto,
        }
      })
      return { ok: true, messages }
    } finally {
      lock.release()
    }
  })()
  work.catch(() => {}) // a late failure after the timeout must not be unhandled
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject({ code: 'CHECK_TIMEOUT' }), CHECK_TIMEOUT_MS)
    })
    const result = await Promise.race([work, timeout])
    await client.logout().catch(() => {})
    return result
  } catch (err) {
    return mapError(err)
  } finally {
    clearTimeout(timer)
    try {
      client.close()
    } catch {
      // already closed
    }
  }
}
