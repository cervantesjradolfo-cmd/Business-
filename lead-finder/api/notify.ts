// POST /api/notify: a Slack and/or webhook alert when a lead replies or books a meeting.
// The destinations come from SLACK_WEBHOOK_URL and ALERT_WEBHOOK_URL, never from the request.
import { parseAlertRequest } from '../src/lib/validate.js'
import { checkAccess, json } from '../server/http.js'
import { sendAlert } from '../server/integrations.js'

export async function POST(request: Request): Promise<Response> {
  const denied = checkAccess(request)
  if (denied) return denied
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Bad request' }, 400)
  }
  const parsed = parseAlertRequest(body)
  if (!parsed.ok) return json({ error: parsed.error }, 400)
  return json(await sendAlert(parsed.value))
}

export async function GET(): Promise<Response> {
  return json({ error: 'Use POST' }, 405)
}
