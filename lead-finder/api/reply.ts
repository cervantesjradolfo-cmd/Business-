// POST /api/reply: sorts a reply to an outreach email and drafts the answer with AI. Answers { draft: null }
// when ANTHROPIC_API_KEY isn't set or the AI fails, so the app lets you write the answer yourself.
import { parseReplyRequest } from '../src/lib/validate.js'
import { checkAccess, json } from '../server/http.js'
import { aiReply } from '../server/ai.js'

export async function POST(request: Request): Promise<Response> {
  const denied = checkAccess(request)
  if (denied) return denied
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Bad request' }, 400)
  }
  const parsed = parseReplyRequest(body)
  if (!parsed.ok) return json({ error: parsed.error }, 400)
  return json({ draft: await aiReply(parsed.value) })
}

export async function GET(): Promise<Response> {
  return json({ error: 'Use POST' }, 405)
}
