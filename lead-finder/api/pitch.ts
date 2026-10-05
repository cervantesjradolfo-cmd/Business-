// POST /api/pitch: write a cold email, text and call opener. Uses Claude when
// ANTHROPIC_API_KEY is set, otherwise (or on any error) the template.
import { buildTemplatePitch } from '../src/lib/pitch.js'
import { parsePitchRequest } from '../src/lib/validate.js'
import { checkAccess, json } from '../server/http.js'
import { aiPitch } from '../server/ai.js'

export async function POST(request: Request): Promise<Response> {
  const denied = checkAccess(request)
  if (denied) return denied
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Bad request' }, 400)
  }
  const parsed = parsePitchRequest(body)
  if (!parsed.ok) return json({ error: parsed.error }, 400)
  const pitch = (await aiPitch(parsed.value)) ?? buildTemplatePitch(parsed.value)
  return json(pitch)
}

export async function GET(): Promise<Response> {
  return json({ error: 'Use POST' }, 405)
}
