// Small helpers shared by the API handlers.
import { timingSafeEqual } from 'node:crypto'

// The owner's contact e-mail from LEADS_CONTACT_EMAIL ('' when unset: there is no placeholder default,
// because OpenStreetMap blocks placeholder addresses).
export function contactEmail(): string {
  return (process.env.LEADS_CONTACT_EMAIL ?? '').trim()
}

export function userAgent(): string {
  const email = contactEmail()
  return email ? `LeadFinder/1.0 (lead research tool; contact: ${email})` : 'LeadFinder/1.0'
}

// Optional access control: when APP_ACCESS_KEY is set, every API call needs a matching x-access-key header.
// Returns a 401 Response when the key is missing or wrong, otherwise null.
export function checkAccess(request: Request): Response | null {
  const key = process.env.APP_ACCESS_KEY
  if (!key) return null
  const given = request.headers.get('x-access-key') ?? ''
  const a = Buffer.from(given)
  const b = Buffer.from(key)
  if (a.length === b.length && timingSafeEqual(a, b)) return null
  return json({ error: 'Access key required' }, 401)
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

export async function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs: number }): Promise<Response> {
  const { timeoutMs, signal, ...rest } = init
  const timeout = AbortSignal.timeout(timeoutMs)
  return fetch(url, { ...rest, signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
}
