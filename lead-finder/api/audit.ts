// POST /api/audit: check up to 10 business websites for gaps (homepage only).
import { parseAuditRequest } from '../src/lib/validate.js'
import { checkAccess, json } from '../server/http.js'
import { auditWebsite, mapWithConcurrency } from '../server/audit.js'

export async function POST(request: Request): Promise<Response> {
  const denied = checkAccess(request)
  if (denied) return denied
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Bad request' }, 400)
  }
  const parsed = parseAuditRequest(body)
  if (!parsed.ok) return json({ error: parsed.error }, 400)
  try {
    const results = await mapWithConcurrency(parsed.value.leads, 4, (i) => auditWebsite(i.id, i.website))
    return json({ results })
  } catch (err) {
    console.error('audit error', err)
    return json({ error: 'Audit failed. Please try again.' }, 500)
  }
}

export async function GET(): Promise<Response> {
  return json({ error: 'Use POST' }, 405)
}
