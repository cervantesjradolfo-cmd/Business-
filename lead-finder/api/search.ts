// POST /api/search: geocode a location and find businesses nearby (OpenStreetMap).
import { parseSearchRequest } from '../src/lib/validate'
import { checkAccess, json } from '../server/http'
import { searchBusinesses } from '../server/osm'

export async function POST(request: Request): Promise<Response> {
  const denied = checkAccess(request)
  if (denied) return denied
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Bad request' }, 400)
  }
  const parsed = parseSearchRequest(body)
  if (!parsed.ok) return json({ error: parsed.error }, 400)
  try {
    const result = await searchBusinesses(parsed.value)
    if ('error' in result) return json({ error: result.error }, result.status)
    return json(result)
  } catch (err) {
    console.error('search error', err)
    return json({ error: 'Search failed. Please try again.' }, 500)
  }
}

export async function GET(): Promise<Response> {
  return json({ error: 'Use POST' }, 405)
}
