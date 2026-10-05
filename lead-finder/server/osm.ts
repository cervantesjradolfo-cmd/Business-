// OpenStreetMap network code: Nominatim (geocoding + fallback search) and Overpass.
import { getCategory } from '../src/data/categories'
import { dedupeLeads, finalizeLeads } from '../src/lib/leads'
import { buildGeocodeUrl, buildNominatimSearchUrl, parseGeocode, parseNominatimSearch } from '../src/lib/nominatim'
import { OVERPASS_MIRRORS, buildOverpassQuery, parseOverpass } from '../src/lib/overpass'
import type { Lead, SearchRequest, SearchResponse } from '../src/lib/types'
import { contactEmail, fetchWithTimeout, userAgent } from './http'

type Deps = { sleep?: (ms: number) => Promise<void> }
type Center = { lat: number; lon: number; displayName: string }

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

let lastNominatimAt = 0
async function throttle(deps?: Deps) {
  const wait = Math.max(0, 1100 - (Date.now() - lastNominatimAt))
  if (wait > 0) await (deps?.sleep ?? realSleep)(wait)
  lastNominatimAt = Date.now()
}

const geocodeCache = new Map<string, Center | null>()
const CACHE_MAX = 200

const headers = () => ({ 'User-Agent': userAgent(), 'Accept-Language': 'en' })
const emailParam = () => contactEmail() || undefined

export const NOMINATIM_FORBIDDEN =
  'OpenStreetMap refused the request. Set LEADS_CONTACT_EMAIL to your own e-mail (see README).'

class ForbiddenError extends Error {}

export async function geocode(location: string, deps?: Deps): Promise<Center | null> {
  const key = location.trim().toLowerCase()
  const cached = geocodeCache.get(key)
  if (cached) return cached
  await throttle(deps)
  const res = await fetchWithTimeout(buildGeocodeUrl(location, emailParam()), { headers: headers(), timeoutMs: 10000 })
  if (res.status === 403) throw new ForbiddenError(NOMINATIM_FORBIDDEN)
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`)
  const found = parseGeocode(await res.json())
  if (found) {
    if (geocodeCache.size >= CACHE_MAX) geocodeCache.delete(geocodeCache.keys().next().value as string)
    geocodeCache.set(key, found)
  }
  return found
}

export async function overpassSearch(query: string): Promise<{ json: unknown; mirror: string } | null> {
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const res = await fetchWithTimeout(mirror, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        timeoutMs: 15000,
      })
      if (!res.ok) continue
      const body = (await res.json()) as { elements?: unknown[]; remark?: string } | null
      if (!body || typeof body !== 'object') continue
      const count = Array.isArray(body.elements) ? body.elements.length : 0
      if (body.remark && count === 0) continue
      return { json: body, mirror }
    } catch {
      // try the next mirror
    }
  }
  return null
}

export async function nominatimSearch(term: string, location: string, deps?: Deps): Promise<unknown> {
  await throttle(deps)
  const res = await fetchWithTimeout(buildNominatimSearchUrl(term, location, emailParam()), {
    headers: headers(),
    timeoutMs: 10000,
  })
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`)
  return res.json()
}

export async function searchBusinesses(
  req: SearchRequest,
  deps?: Deps,
): Promise<SearchResponse | { error: string; status: number }> {
  let center: Center | null
  try {
    center = await geocode(req.location, deps)
  } catch (err) {
    console.error('geocode error', err)
    if (err instanceof ForbiddenError) return { error: NOMINATIM_FORBIDDEN, status: 502 }
    return { error: 'Location lookup failed. Please try again.', status: 502 }
  }
  if (!center) return { error: "Couldn't find that location. Try a city name or ZIP code.", status: 404 }

  const found = await overpassSearch(buildOverpassQuery(center.lat, center.lon, req.radiusKm, req.category, req.limit))
  if (found) {
    return { center, leads: finalizeLeads(parseOverpass(found.json, center), req.limit), source: 'overpass' }
  }

  const def = getCategory(req.category)
  const terms = def?.nominatimTerms ?? []
  try {
    if (terms.length === 0) throw new Error(`No Nominatim phrase for category ${req.category}`)
    let found: Lead[] = []
    let lastErr: unknown
    let anyOk = false
    for (const term of terms) {
      try {
        const raw = await nominatimSearch(term, req.location, deps)
        anyOk = true
        found = dedupeLeads([...found, ...parseNominatimSearch(raw, center, req.radiusKm)])
      } catch (err) {
        lastErr = err
      }
      if (found.length >= req.limit) break
    }
    if (!anyOk) throw lastErr
    // "hairdresser" returns both salons and barbers: split them by name/tag.
    if (req.category === 'barbers') found = found.filter((l) => l.categoryId === 'barbers')
    if (req.category === 'salons') found = found.filter((l) => l.categoryId !== 'barbers')
    return {
      center,
      leads: finalizeLeads(found, req.limit),
      source: 'nominatim',
      notice: 'Map servers were busy, so results came from a simpler search and may be incomplete.',
    }
  } catch (err) {
    console.error('nominatim fallback error', err)
    return { error: 'Map data servers are busy. Please try again in a minute.', status: 502 }
  }
}
