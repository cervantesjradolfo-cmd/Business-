// OpenStreetMap network code: Nominatim (geocoding + fallback search) and Overpass.
import { getCategory } from '../src/data/categories.js'
import { dedupeLeads, finalizeLeads } from '../src/lib/leads.js'
import { buildGeocodeUrl, buildNominatimNameUrl, buildNominatimSearchUrl, parseGeocode, parseNominatimSearch } from '../src/lib/nominatim.js'
import { OVERPASS_MIRRORS, buildOverpassQuery, parseOverpass } from '../src/lib/overpass.js'
import type { Lead, SearchRequest, SearchResponse } from '../src/lib/types.js'
import { contactEmail, fetchWithTimeout, userAgent } from './http.js'

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

const MIRROR_TIMEOUT_MS = 25_000 // a busy mirror can take 20 s to answer
const OVERPASS_BUDGET_MS = 30_000 // all mirrors together, leaving time for the fallback search within Vercel's 60 s
const STAGGER_MS = 4_000 // ask the next mirror if the current one hasn't answered by then

async function askMirror(mirror: string, query: string, signal: AbortSignal): Promise<unknown | null> {
  try {
    const res = await fetch(mirror, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.any([signal, AbortSignal.timeout(MIRROR_TIMEOUT_MS)]),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { elements?: unknown[]; remark?: string } | null
    if (!body || typeof body !== 'object') return null
    const count = Array.isArray(body.elements) ? body.elements.length : 0
    if (body.remark && count === 0) return null
    return body
  } catch {
    return null
  }
}

// Asks the mirrors in order, without waiting for a slow one: the next mirror is asked as soon as the
// current one fails, or after a few seconds without an answer. The first good answer wins and the
// other requests are cancelled.
export async function overpassSearch(
  query: string, staggerMs = STAGGER_MS, budgetMs = OVERPASS_BUDGET_MS,
): Promise<{ json: unknown; mirror: string } | null> {
  const cancel = new AbortController()
  return new Promise((resolve) => {
    const deadline = setTimeout(() => finish(null), budgetMs)
    let next = 0
    let running = 0
    let done = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = (result: { json: unknown; mirror: string } | null) => {
      if (done) return
      done = true
      clearTimeout(timer)
      clearTimeout(deadline)
      cancel.abort()
      resolve(result)
    }
    const launch = () => {
      clearTimeout(timer)
      if (done || next >= OVERPASS_MIRRORS.length) return
      const mirror = OVERPASS_MIRRORS[next++]
      running++
      timer = setTimeout(launch, staggerMs)
      void askMirror(mirror, query, cancel.signal).then((json) => {
        running--
        if (json) return finish({ json, mirror })
        if (next < OVERPASS_MIRRORS.length) launch()
        else if (running === 0) finish(null)
      })
    }
    launch()
  })
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

// Name search for categories with nameSearchTerms. Returns null when every request failed.
async function searchByName(req: SearchRequest, center: Center, deps?: Deps): Promise<Lead[] | null> {
  const terms = getCategory(req.category)?.nameSearchTerms ?? []
  let found: Lead[] = []
  let anyOk = false
  for (const term of terms) {
    try {
      await throttle(deps)
      const res = await fetchWithTimeout(buildNominatimNameUrl(term, center, req.radiusKm, emailParam()), { headers: headers(), timeoutMs: 10000 })
      if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`)
      found = [...found, ...parseNominatimSearch(await res.json(), center, req.radiusKm).filter((l) => l.categoryId === req.category)]
      anyOk = true
    } catch (err) {
      console.error('name search error', err)
    }
  }
  return anyOk ? found : null
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

  const def = getCategory(req.category)
  const [found, byName] = await Promise.all([
    overpassSearch(buildOverpassQuery(center.lat, center.lon, req.radiusKm, req.category, req.limit)),
    def?.nameSearchTerms ? searchByName(req, center, deps) : Promise.resolve(null),
  ])
  if (found) {
    return { center, leads: finalizeLeads([...parseOverpass(found.json, center), ...(byName ?? [])], req.limit, req.category === 'any'), source: 'overpass' }
  }
  if (byName) {
    return {
      center,
      leads: finalizeLeads(byName, req.limit, req.category === 'any'),
      source: 'nominatim',
      notice: 'Map servers were busy, so results came from a name search and may be incomplete.',
    }
  }

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
      if (req.category !== 'any' && found.length >= req.limit) break
    }
    if (!anyOk) throw lastErr
    // "hairdresser" returns both salons and barbers: split them by name/tag.
    if (req.category === 'barbers') found = found.filter((l) => l.categoryId === 'barbers')
    if (req.category === 'salons') found = found.filter((l) => l.categoryId !== 'barbers')
    return {
      center,
      leads: finalizeLeads(found, req.limit, req.category === 'any'),
      source: 'nominatim',
      notice: 'Map servers were busy, so results came from a simpler search and may be incomplete.',
    }
  } catch (err) {
    console.error('nominatim fallback error', err)
    return { error: 'Map data servers are busy. Please try again in a minute.', status: 502 }
  }
}
