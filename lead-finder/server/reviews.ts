// Google rating and review count for one business, from the Places API (Text Search, New).
// Needs GOOGLE_PLACES_API_KEY; each lookup is billed by Google, so the app only calls it when you ask.
import type { Reviews, ReviewsRequest } from '../src/lib/types.js'
import { fetchWithTimeout } from './http.js'

export const placesKey = () => (process.env.GOOGLE_PLACES_API_KEY ?? '').trim()

export async function lookupReviews(req: ReviewsRequest, now: Date = new Date()): Promise<{ reviews: Reviews | null; error?: string }> {
  const key = placesKey()
  if (!key) return { reviews: null, error: 'Google reviews aren\'t set up (GOOGLE_PLACES_API_KEY).' }
  const textQuery = [req.name, req.address || req.city].filter(Boolean).join(', ')
  try {
    const res = await fetchWithTimeout('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.googleMapsUri',
      },
      body: JSON.stringify({
        textQuery,
        maxResultCount: 1,
        ...(req.lat !== undefined && req.lon !== undefined && (req.lat !== 0 || req.lon !== 0)
          ? { locationBias: { circle: { center: { latitude: req.lat, longitude: req.lon }, radius: 1000 } } }
          : {}),
      }),
      redirect: 'manual',
      timeoutMs: 10_000,
    })
    if (res.status === 400 || res.status === 403) return { reviews: null, error: 'Google refused the request. Check the API key and that the Places API (New) is enabled.' }
    if (!res.ok) return { reviews: null, error: `Google answered with an error (HTTP ${res.status}).` }
    const data = (await res.json()) as { places?: { rating?: unknown; userRatingCount?: unknown; googleMapsUri?: unknown }[] }
    const place = data.places?.[0]
    if (!place) return { reviews: { count: 0, checkedAt: now.toISOString() } }
    const rating = typeof place.rating === 'number' && place.rating >= 0 && place.rating <= 5 ? Math.round(place.rating * 10) / 10 : undefined
    const count = typeof place.userRatingCount === 'number' && place.userRatingCount >= 0 ? Math.round(place.userRatingCount) : 0
    const mapsUrl = typeof place.googleMapsUri === 'string' && /^https:\/\/(maps\.google\.com|www\.google\.com\/maps|maps\.app\.goo\.gl)/.test(place.googleMapsUri) ? place.googleMapsUri : undefined
    return { reviews: { ...(rating !== undefined ? { rating } : {}), count, ...(mapsUrl ? { mapsUrl } : {}), checkedAt: now.toISOString() } }
  } catch {
    return { reviews: null, error: "Couldn't reach Google." }
  }
}
