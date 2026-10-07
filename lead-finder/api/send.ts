// POST /api/send: send one email through the caller's own SMTP mailbox. The password arrives
// with each request and is never stored or logged.
import { parseSendRequest } from '../src/lib/validate.js'
import type { SendErrorCode, SendResult } from '../src/lib/types.js'
import { checkAccess, json } from '../server/http.js'
import { sendViaSmtp } from '../server/mailer.js'

const STATUS: Record<SendErrorCode, number> = {
  invalid: 400, host: 400, suppressed: 409, auth: 422, connection: 502, rejected: 502, timeout: 504, access: 401, unavailable: 502,
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
  const parsed = parseSendRequest(body)
  if (!parsed.ok) return json({ ok: false, code: 'invalid', error: parsed.error } satisfies SendResult, 400)
  const result = await sendViaSmtp(parsed.value)
  return json(result, result.ok ? 200 : STATUS[result.code])
}

export async function GET(): Promise<Response> {
  return json({ error: 'Use POST' }, 405)
}
