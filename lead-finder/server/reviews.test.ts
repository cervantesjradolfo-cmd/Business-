// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { lookupReviews } from './reviews'
import { POST } from '../api/reviews'

let calls: { url: string; init: RequestInit }[]
const NOW = new Date('2026-10-17T12:00:00Z')
beforeEach(() => { calls = []; delete process.env.GOOGLE_PLACES_API_KEY; delete process.env.APP_ACCESS_KEY })
afterEach(() => { vi.unstubAllGlobals(); delete process.env.GOOGLE_PLACES_API_KEY })
const stub = (status: number, body: unknown) => vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
  calls.push({ url: String(url), init })
  return new Response(JSON.stringify(body), { status })
}))

describe('Google reviews', () => {
  it('needs the API key', async () => {
    stub(200, {})
    expect(await lookupReviews({ name: 'Corner Cafe' })).toMatchObject({ reviews: null, error: expect.stringMatching(/GOOGLE_PLACES_API_KEY/) })
    expect(calls).toEqual([])
  })
  it('asks Places Text Search for the business near its position and returns rating, count and link', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'gkey'
    stub(200, { places: [{ rating: 3.84, userRatingCount: 41, googleMapsUri: 'https://maps.google.com/?cid=1' }] })
    expect(await lookupReviews({ name: 'Corner Cafe', address: '1 Main St, Austin', lat: 30.2, lon: -97.7 }, NOW))
      .toEqual({ reviews: { rating: 3.8, count: 41, mapsUrl: 'https://maps.google.com/?cid=1', checkedAt: NOW.toISOString() } })
    expect(calls[0].url).toBe('https://places.googleapis.com/v1/places:searchText')
    expect(calls[0].init.headers).toMatchObject({ 'X-Goog-Api-Key': 'gkey', 'X-Goog-FieldMask': expect.stringContaining('places.userRatingCount') })
    const body = JSON.parse(calls[0].init.body as string)
    expect(body).toMatchObject({ textQuery: 'Corner Cafe, 1 Main St, Austin', maxResultCount: 1, locationBias: { circle: { center: { latitude: 30.2, longitude: -97.7 } } } })
  })
  it('says not found, and drops odd links', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'gkey'
    stub(200, {})
    expect((await lookupReviews({ name: 'X' }, NOW)).reviews).toEqual({ count: 0, checkedAt: NOW.toISOString() })
    stub(200, { places: [{ rating: 4.5, userRatingCount: 3, googleMapsUri: 'https://evil.example.com' }] })
    expect((await lookupReviews({ name: 'X' }, NOW)).reviews).toEqual({ rating: 4.5, count: 3, checkedAt: NOW.toISOString() })
  })
  it('POST /api/reviews explains a refused key without echoing it', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'gkey'
    stub(403, { error: { message: 'API key gkey not valid' } })
    const res = await POST(new Request('http://localhost/api/reviews', { method: 'POST', body: JSON.stringify({ name: 'Corner Cafe' }) }))
    expect(res.status).toBe(502)
    const text = await res.text()
    expect(text).toMatch(/refused/)
    expect(text).not.toContain('gkey')
    expect((await POST(new Request('http://localhost/api/reviews', { method: 'POST', body: '{}' }))).status).toBe(400)
  })
})
