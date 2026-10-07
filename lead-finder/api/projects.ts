// POST /api/projects: recent building permits matching a client's work (Chicago only for now).
import { parseProjectsRequest } from '../src/lib/validate.js'
import { checkAccess, json } from '../server/http.js'
import { searchProjects } from '../server/permits.js'

export async function POST(request: Request): Promise<Response> {
  const denied = checkAccess(request)
  if (denied) return denied
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Bad request' }, 400)
  }
  const parsed = parseProjectsRequest(body)
  if (!parsed.ok) return json({ error: parsed.error }, 400)
  try {
    const result = await searchProjects(parsed.value)
    if ('error' in result) return json({ error: result.error }, result.status)
    return json(result)
  } catch (err) {
    console.error('projects error', err)
    return json({ error: 'Search failed. Please try again.' }, 500)
  }
}

export async function GET(): Promise<Response> {
  return json({ error: 'Use POST' }, 405)
}
