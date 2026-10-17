// POST /api/reviews: a business's Google rating and review count (needs GOOGLE_PLACES_API_KEY).
import { parseReviewsRequest } from '../src/lib/validate.js'
import { checkAccess, json } from '../server/http.js'
import { lookupReviews } from '../server/reviews.js'

export async function POST(request: Request): Promise<Response> {
  const denied = checkAccess(request)
  if (denied) return denied
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Bad request' }, 400)
  }
  const parsed = parseReviewsRequest(body)
  if (!parsed.ok) return json({ error: parsed.error }, 400)
  const r = await lookupReviews(parsed.value)
  return r.reviews ? json({ reviews: r.reviews }) : json({ error: r.error }, 502)
}

export async function GET(): Promise<Response> {
  return json({ error: 'Use POST' }, 405)
}
