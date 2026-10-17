// Website audit: fetches a homepage safely (no private addresses, bounded time and size).
import { contactPageLinks, extractEmails } from '../src/lib/emails.js'
import { detectSiteGaps } from '../src/lib/gaps.js'
import { normalizeWebsite } from '../src/lib/url.js'
import type { AuditResult } from '../src/lib/types.js'
import { contactEmail } from './http.js'
import { Blocked, safeGet } from './safeRequest.js'

const MAX_BYTES = 1.5 * 1024 * 1024
const MAX_REDIRECTS = 5
const BUDGET_MS = 8000

export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker))
  return results
}

async function readBody(res: Response): Promise<string> {
  if (!res.body) return ''
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      total += value.length
    }
  } finally {
    reader.cancel().catch(() => {})
  }
  const buf = new Uint8Array(Math.min(total, MAX_BYTES))
  let off = 0
  for (const c of chunks) {
    const slice = c.subarray(0, Math.max(0, buf.length - off))
    buf.set(slice, off)
    off += slice.length
  }
  return new TextDecoder('utf-8').decode(buf)
}

const isTimeout = (e: unknown) => e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')

const auditHeaders = (): Record<string, string> => {
  const email = contactEmail()
  return {
    'User-Agent': `Mozilla/5.0 (compatible; LeadFinderAudit/1.0${email ? `; +mailto:${email}` : ''})`,
    Accept: 'text/html,application/xhtml+xml',
  }
}

// One extra page (a contact page), following a few redirects. '' when it can't be read.
async function fetchPage(start: string, signal: AbortSignal): Promise<string> {
  let url = new URL(start)
  for (let hop = 0; hop <= 3; hop++) {
    const res = await safeGet(url, { signal, headers: auditHeaders() })
    const loc = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && loc) {
      res.body?.cancel().catch(() => {})
      url = new URL(loc, url)
      continue
    }
    if (res.status < 200 || res.status >= 300 || !/html|xml/i.test(res.headers.get('content-type') ?? 'html')) {
      res.body?.cancel().catch(() => {})
      return ''
    }
    return readBody(res)
  }
  return ''
}

// Email addresses on the homepage, or else on up to two contact/about pages (within the audit's time budget).
async function findEmails(html: string, finalUrl: string, signal: AbortSignal): Promise<string[]> {
  const onHome = extractEmails(html, finalUrl)
  if (onHome.length) return onHome
  for (const link of contactPageLinks(html, finalUrl)) {
    if (signal.aborted) break
    try {
      const found = extractEmails(await fetchPage(link, signal), finalUrl)
      if (found.length) return found
    } catch {
      // try the next page
    }
  }
  return []
}

export async function auditWebsite(id: string, website: string, now: Date = new Date()): Promise<AuditResult> {
  const checkedAt = now.toISOString()
  const candidates = normalizeWebsite(website)
  if (!candidates) {
    return { id, status: 'skipped', gaps: [], note: "Website value isn't a web address", checkedAt }
  }
  const started = Date.now()
  const deadline = AbortSignal.timeout(BUDGET_MS)
  let lastReason = 'Could not connect'

  for (const candidate of candidates) {
    let url = new URL(candidate)
    try {
      for (let hop = 0; ; hop++) {
        if (hop > MAX_REDIRECTS) throw new Error('Too many redirects')
        // Redirects are followed by hand; every hop is checked and connects only to a checked address.
        const res = await safeGet(url, { signal: deadline, headers: auditHeaders() })
        if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
          const loc = res.headers.get('location')!
          res.body?.cancel().catch(() => {})
          url = new URL(loc, url)
          continue
        }
        const status = res.status
        if (status >= 200 && status < 300) {
          const type = res.headers.get('content-type') ?? ''
          const html = !type || /html|xml/i.test(type) ? await readBody(res) : ''
          if (html === '') res.body?.cancel().catch(() => {})
          const elapsedMs = Date.now() - started
          const finalUrl = url.toString()
          const { gaps, detail } = detectSiteGaps(html, { finalUrl, elapsedMs, now })
          const emails = html ? await findEmails(html, finalUrl, deadline) : []
          return { id, status: 'ok', finalUrl, httpStatus: status, elapsedMs, gaps, detail, ...(emails.length ? { emails } : {}), checkedAt }
        }
        res.body?.cancel().catch(() => {})
        const cloudflare = !!res.headers.get('cf-ray') || /cloudflare/i.test(res.headers.get('server') ?? '')
        if (status === 401 || status === 403 || status === 429 || (status === 503 && cloudflare)) {
          return {
            id, status: 'limited', finalUrl: url.toString(), httpStatus: status, gaps: [],
            note: 'Site blocked our automated check; review it by hand', checkedAt,
          }
        }
        return { id, status: 'unreachable', finalUrl: url.toString(), httpStatus: status, gaps: [], note: `HTTP ${status}`, checkedAt }
      }
    } catch (err) {
      if (err instanceof Blocked) return { id, status: 'skipped', gaps: [], note: 'Address not allowed', checkedAt }
      if (isTimeout(err) || deadline.aborted) {
        lastReason = 'Timed out after 8 s'
        break
      }
      lastReason = err instanceof Error && err.message === 'Too many redirects' ? 'Too many redirects' : 'Could not connect'
    }
  }
  return { id, status: 'unreachable', gaps: [], note: lastReason, checkedAt }
}
