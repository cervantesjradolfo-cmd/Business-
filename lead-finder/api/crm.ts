// POST /api/crm: sends leads to HubSpot (HUBSPOT_TOKEN) and/or GoHighLevel (GHL_TOKEN + GHL_LOCATION_ID).
import { parseCrmRequest } from '../src/lib/validate.js'
import { checkAccess, json } from '../server/http.js'
import { integrations, syncCrm } from '../server/integrations.js'

export async function POST(request: Request): Promise<Response> {
  const denied = checkAccess(request)
  if (denied) return denied
  const on = integrations()
  if (!on.hubspot && !on.ghl) return json({ error: 'No CRM is set up on the server. See README, "Alerts and CRM sync".' }, 400)
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Bad request' }, 400)
  }
  const parsed = parseCrmRequest(body)
  if (!parsed.ok) return json({ error: parsed.error }, 400)
  return json(await syncCrm(parsed.value))
}

export async function GET(): Promise<Response> {
  return json({ error: 'Use POST' }, 405)
}
