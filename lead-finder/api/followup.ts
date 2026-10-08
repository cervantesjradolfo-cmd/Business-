// POST /api/followup: an AI-written follow-up email body for Outreach. Answers { body: null }
// when ANTHROPIC_API_KEY isn't set or the AI fails, so the app keeps the template.
import { parseFollowUpRequest } from '../src/lib/validate.js'
import { checkAccess, json } from '../server/http.js'
import { aiFollowUp } from '../server/ai.js'

export async function POST(request: Request): Promise<Response> {
  const denied = checkAccess(request)
  if (denied) return denied
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Bad request' }, 400)
  }
  const parsed = parseFollowUpRequest(body)
  if (!parsed.ok) return json({ error: parsed.error }, 400)
  return json({ body: await aiFollowUp(parsed.value) })
}

export async function GET(): Promise<Response> {
  return json({ error: 'Use POST' }, 405)
}
