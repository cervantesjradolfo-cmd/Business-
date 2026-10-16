// POST /api/inbox: replies to outreach emails, read from the caller's own mailbox over IMAP. The password
// arrives with each request and is never stored or logged.
import { parseInboxRequest } from '../src/lib/validate.js'
import type { InboxErrorCode, InboxResult } from '../src/lib/types.js'
import { checkAccess, json } from '../server/http.js'
import { checkInbox } from '../server/inbox.js'

const STATUS: Record<InboxErrorCode, number> = {
  invalid: 400, host: 400, auth: 422, connection: 502, timeout: 504, access: 401, unavailable: 502,
}

export async function POST(request: Request): Promise<Response> {
  const denied = checkAccess(request)
  if (denied) return denied
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Bad request' }, 400)
  }
  const parsed = parseInboxRequest(body)
  if (!parsed.ok) return json({ ok: false, code: 'invalid', error: parsed.error } satisfies InboxResult, 400)
  const result = await checkInbox(parsed.value)
  return json(result, result.ok ? 200 : STATUS[result.code])
}

export async function GET(): Promise<Response> {
  return json({ error: 'Use POST' }, 405)
}
