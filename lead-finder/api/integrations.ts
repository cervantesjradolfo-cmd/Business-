// Alerts, CRM sync and Google reviews, in one function (Vercel's Hobby plan allows 12 per deployment).
//   GET  /api/integrations               which are set up (yes/no only, never the secrets)
//   POST /api/integrations?op=notify      Slack and/or webhook alert when a lead replies or books
//   POST /api/integrations?op=crm         send leads to HubSpot and/or GoHighLevel
//   POST /api/integrations?op=reviews     a business's Google rating and review count
// Destinations and tokens come from environment variables, never from the request.
import { parseAlertRequest, parseCrmRequest, parseReviewsRequest } from '../src/lib/validate.js'
import { checkAccess, json } from '../server/http.js'
import { integrations, sendAlert, syncCrm } from '../server/integrations.js'
import { lookupReviews } from '../server/reviews.js'

export async function GET(request: Request): Promise<Response> {
  const denied = checkAccess(request)
  if (denied) return denied
  return json(integrations())
}

export async function POST(request: Request): Promise<Response> {
  const denied = checkAccess(request)
  if (denied) return denied
  const op = new URL(request.url).searchParams.get('op')
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Bad request' }, 400)
  }
  if (op === 'notify') {
    const parsed = parseAlertRequest(body)
    if (!parsed.ok) return json({ error: parsed.error }, 400)
    return json(await sendAlert(parsed.value))
  }
  if (op === 'crm') {
    const on = integrations()
    if (!on.hubspot && !on.ghl) return json({ error: 'No CRM is set up on the server. See README, "Alerts and CRM sync".' }, 400)
    const parsed = parseCrmRequest(body)
    if (!parsed.ok) return json({ error: parsed.error }, 400)
    return json(await syncCrm(parsed.value))
  }
  if (op === 'reviews') {
    const parsed = parseReviewsRequest(body)
    if (!parsed.ok) return json({ error: parsed.error }, 400)
    const r = await lookupReviews(parsed.value)
    return r.reviews ? json({ reviews: r.reviews }) : json({ error: r.error }, 502)
  }
  return json({ error: 'Unknown operation' }, 400)
}
