// OpenStreetMap network code: Nominatim (geocoding + fallback search) and Overpass.
import { getCategory } from '../src/data/categories.js'
import { dedupeLeads, finalizeLeads } from '../src/lib/leads.js'
import { buildGeoapifyUrl, geoapifyPerCategoryLimit, geoapifyToOverpass } from '../src/lib/geoapify.js'
import { buildGeocodeUrl, buildNominatimSearchUrl, parseGeocode, parseNominatimSearch } from '../src/lib/nominatim.js'
import { buildOverpassQuery, parseOverpass, parseOverpassUrls, parseRetryAfter } from '../src/lib/overpass.js'
import type { Lead, OverpassDiagnostic, SearchRequest, SearchResponse } from '../src/lib/types.js'
import { contactEmail, fetchWithTimeout, userAgent } from './http.js'

type Deps = { sleep?: (ms: number) => Promise<void>; now?: () => number }
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

export const SEARCH_BUDGET_MS = 50_000 // searchBusinesses returns by start + 50 s (10 s margin under maxDuration 60)
export const FALLBACK_RESERVE_MS = 14_000 // time kept back for the Nominatim fallback
export const MIRROR_TIMEOUT_MS = 25_000 // per mirror attempt
export const GEOAPIFY_TIMEOUT_MS = 25_000 // for all of a search's Geoapify requests together ("any" makes ~30)
const RETRY_AFTER_CAP_MS = 3_000
const RETRY_DEFAULT_MS = 1_000 // when 429/504 has no usable Retry-After
const MIN_ATTEMPT_MS = 5_000 // do not start (or retry) an attempt with less time than this left
const OVERPASS_CACHE_TTL_MS = 10 * 60_000
const overpassCache = new Map<string, { json: unknown; mirror: string; expiresAt: number }>()

export function clearOverpassCache(): void {
  overpassCache.clear()
}

export const OVERPASS_FALLBACK_NOTICE =
  'The full map search was unavailable (the map servers did not answer in time), so these results come from a simpler search and may be incomplete.'

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

export async function overpassSearch(
  query: string,
  opts?: { deadline?: number; deps?: Deps },
): Promise<{ ok: true; json: unknown; mirror: string } | { ok: false; diagnostics: OverpassDiagnostic[] }> {
  const deps = opts?.deps
  const now = deps?.now ?? Date.now
  const sleep = deps?.sleep ?? realSleep
  const deadline = opts?.deadline ?? now() + MIRROR_TIMEOUT_MS

  const cached = overpassCache.get(query)
  if (cached) {
    if (now() < cached.expiresAt) return { ok: true, json: cached.json, mirror: cached.mirror }
    overpassCache.delete(query)
  }

  const mirrors = parseOverpassUrls(process.env.OVERPASS_URLS)
  const shared = new AbortController()

  type Once =
    | { kind: 'good'; json: unknown }
    | { kind: 'retry'; status: number; retryAfter: string | null }
    | { kind: 'fail'; outcome: Exclude<OverpassDiagnostic['outcome'], 'ok'>; status?: number }

  async function once(mirror: string): Promise<Once> {
    const timeoutMs = Math.min(MIRROR_TIMEOUT_MS, deadline - now())
    if (timeoutMs < MIN_ATTEMPT_MS) return { kind: 'fail', outcome: 'timeout' }
    try {
      const res = await fetchWithTimeout(mirror, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        timeoutMs,
        redirect: 'error',
        signal: shared.signal,
      })
      if (res.status === 429 || res.status === 504) {
        return { kind: 'retry', status: res.status, retryAfter: res.headers.get('retry-after') }
      }
      if (res.status !== 200) return { kind: 'fail', outcome: 'http_error', status: res.status }
      let body: { elements?: unknown; remark?: unknown } | null
      try {
        body = (await res.json()) as typeof body
      } catch (err) {
        if (err instanceof Error && err.name === 'TimeoutError') return { kind: 'fail', outcome: 'timeout' }
        if (shared.signal.aborted) return { kind: 'fail', outcome: 'network_error' }
        return { kind: 'fail', outcome: 'bad_response' }
      }
      if (!body || typeof body !== 'object' || !Array.isArray(body.elements)) return { kind: 'fail', outcome: 'bad_response' }
      if (body.elements.length === 0 && body.remark) return { kind: 'fail', outcome: 'bad_response' }
      return { kind: 'good', json: body }
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      return { kind: 'fail', outcome: name === 'TimeoutError' ? 'timeout' : 'network_error' }
    }
  }

  async function attempt(mirror: string): Promise<{ json?: unknown; diag: Omit<OverpassDiagnostic, 'host'> }> {
    let r: Once = await once(mirror)
    let retried = false
    if (r.kind === 'retry') {
      const wait = Math.min(parseRetryAfter(r.retryAfter, now()) ?? RETRY_DEFAULT_MS, RETRY_AFTER_CAP_MS)
      if (now() + wait + MIN_ATTEMPT_MS <= deadline) {
        retried = true
        await sleep(wait)
        const second: Once = shared.signal.aborted ? { kind: 'fail', outcome: 'network_error' } : await once(mirror)
        r = second.kind === 'retry' ? { kind: 'fail', outcome: 'http_error', status: second.status } : second
      } else {
        r = { kind: 'fail', outcome: 'http_error', status: r.status }
      }
    }
    if (r.kind === 'good') return { json: r.json, diag: { outcome: 'ok', ...(retried ? { retried: true as const } : {}) } }
    return {
      diag: {
        outcome: r.outcome,
        ...(r.status !== undefined ? { status: r.status } : {}),
        ...(retried ? { retried: true as const } : {}),
      },
    }
  }

  return new Promise((resolve) => {
    const diagnostics: OverpassDiagnostic[] = mirrors.map((m) => ({ host: new URL(m).host, outcome: 'network_error' }))
    let left = mirrors.length
    let won = false
    mirrors.forEach((mirror, i) => {
      attempt(mirror)
        .catch((): { json?: unknown; diag: Omit<OverpassDiagnostic, 'host'> } => ({ diag: { outcome: 'network_error' } }))
        .then(({ json, diag }) => {
          if (won) return
          diagnostics[i] = { host: diagnostics[i].host, ...diag }
          if (diag.outcome === 'ok') {
            won = true
            if (overpassCache.size >= CACHE_MAX) overpassCache.delete(overpassCache.keys().next().value as string)
            overpassCache.set(query, { json, mirror, expiresAt: now() + OVERPASS_CACHE_TTL_MS })
            shared.abort()
            resolve({ ok: true, json, mirror })
            return
          }
          if (--left === 0) resolve({ ok: false, diagnostics })
        })
    })
    if (mirrors.length === 0) resolve({ ok: false, diagnostics })
  })
}

// Geoapify Places, when GEOAPIFY_API_KEY is set: one request per Geoapify category (a combined list
// only returns one category's places), at most GEOAPIFY_CONCURRENCY at a time to stay under the free
// plan's 5 requests a second, merged and cached for 10 minutes. Returns null (and the search carries on
// with Overpass and Nominatim) when there is no key or every request failed. URLs carry the key, so
// they are never logged.
export const GEOAPIFY_CONCURRENCY = 4
const geoapifyCache = new Map<string, { leads: Lead[]; expiresAt: number }>()

export function clearGeoapifyCache(): void {
  geoapifyCache.clear()
}

export async function geoapifySearch(
  center: { lat: number; lon: number },
  req: SearchRequest,
  deps?: Deps,
): Promise<Lead[] | null> {
  const key = (process.env.GEOAPIFY_API_KEY ?? '').trim()
  if (!key) return null
  const now = deps?.now ?? Date.now
  const def = getCategory(req.category)
  if (!def || def.geoapify.length === 0) return null
  const cacheKey = JSON.stringify([center.lat, center.lon, req.radiusKm, req.category, req.limit])
  const cached = geoapifyCache.get(cacheKey)
  if (cached && now() < cached.expiresAt) return cached.leads

  const perLimit = geoapifyPerCategoryLimit(req, def.geoapify.length)
  const deadline = now() + GEOAPIFY_TIMEOUT_MS
  const queue = [...def.geoapify]
  const elements = new Map<string, unknown>()
  let okCount = 0
  const failures: string[] = []

  async function one(category: string): Promise<void> {
    const left = deadline - now()
    if (left < 1000) {
      failures.push('timeout')
      return
    }
    try {
      const res = await fetchWithTimeout(buildGeoapifyUrl(center.lat, center.lon, req.radiusKm, category, perLimit, key), {
        headers: { Accept: 'application/json' },
        timeoutMs: left,
        redirect: 'error',
      })
      if (!res.ok) {
        failures.push(String(res.status))
        return
      }
      const json = geoapifyToOverpass(await res.json(), req.category)
      if (!json) {
        failures.push('bad_response')
        return
      }
      okCount++
      for (const el of json.elements as { type: string; id: number }[]) elements.set(`${el.type}/${el.id}`, el)
    } catch (err) {
      failures.push(err instanceof Error && err.name === 'TimeoutError' ? 'timeout' : 'network_error')
    }
  }
  async function worker(): Promise<void> {
    for (let c = queue.shift(); c !== undefined; c = queue.shift()) await one(c)
  }
  await Promise.all(Array.from({ length: Math.min(GEOAPIFY_CONCURRENCY, queue.length) }, worker))

  if (failures.length > 0) console.warn('geoapify failures', JSON.stringify(failures))
  if (okCount === 0) return null
  const leads = finalizeLeads(parseOverpass({ elements: [...elements.values()] }, center), req.limit)
  // Cache only complete answers, so a partial one is retried next time.
  if (failures.length === 0) {
    if (geoapifyCache.size >= CACHE_MAX) geoapifyCache.delete(geoapifyCache.keys().next().value as string)
    geoapifyCache.set(cacheKey, { leads, expiresAt: now() + OVERPASS_CACHE_TTL_MS })
  }
  return leads
}

export async function nominatimSearch(term: string, location: string, deps?: Deps, timeoutMs = 10000): Promise<unknown> {
  await throttle(deps)
  const res = await fetchWithTimeout(buildNominatimSearchUrl(term, location, emailParam()), {
    headers: headers(),
    timeoutMs,
  })
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`)
  return res.json()
}

export async function searchBusinesses(
  req: SearchRequest,
  deps?: Deps,
): Promise<SearchResponse | { error: string; status: number }> {
  const now = deps?.now ?? Date.now
  const deadline = now() + SEARCH_BUDGET_MS
  let center: Center | null
  try {
    center = await geocode(req.location, deps)
  } catch (err) {
    console.error('geocode error', err)
    if (err instanceof ForbiddenError) return { error: NOMINATIM_FORBIDDEN, status: 502 }
    return { error: 'Location lookup failed. Please try again.', status: 502 }
  }
  if (!center) return { error: "Couldn't find that location. Try a city name or ZIP code.", status: 404 }

  const geo = await geoapifySearch(center, req, deps)
  if (geo) return { center, leads: geo, source: 'geoapify' }

  let diagnostics: OverpassDiagnostic[] = []
  if (!req.skipOverpass) {
    const op = await overpassSearch(buildOverpassQuery(center.lat, center.lon, req.radiusKm, req.category, req.limit), {
      deadline: deadline - FALLBACK_RESERVE_MS,
      deps,
    })
    if (op.ok) {
      return { center, leads: finalizeLeads(parseOverpass(op.json, center), req.limit), source: 'overpass' }
    }
    diagnostics = op.diagnostics
    console.warn('overpass unavailable', JSON.stringify(diagnostics))
  }

  const def = getCategory(req.category)
  const terms = def?.nominatimTerms ?? []
  try {
    if (terms.length === 0) throw new Error(`No Nominatim phrase for category ${req.category}`)
    let found: Lead[] = []
    let lastErr: unknown
    let anyOk = false
    let attempted = false
    for (const term of terms) {
      const remaining = deadline - now()
      if (remaining < 3000) break
      attempted = true
      try {
        const raw = await nominatimSearch(term, req.location, deps, Math.min(10000, remaining - 1500))
        anyOk = true
        found = dedupeLeads([...found, ...parseNominatimSearch(raw, center, req.radiusKm)])
      } catch (err) {
        lastErr = err
      }
      if (found.length >= req.limit) break
    }
    if (!attempted) throw new Error('No time left for the Nominatim fallback')
    if (!anyOk) throw lastErr
    // "hairdresser" returns both salons and barbers: split them by name/tag.
    if (req.category === 'barbers') found = found.filter((l) => l.categoryId === 'barbers')
    if (req.category === 'salons') found = found.filter((l) => l.categoryId !== 'barbers')
    return {
      center,
      leads: finalizeLeads(found, req.limit),
      source: 'nominatim',
      notice: OVERPASS_FALLBACK_NOTICE,
      diagnostics,
    }
  } catch (err) {
    console.error('nominatim fallback error', err)
    return { error: 'Map data servers are busy. Please try again in a minute.', status: 502 }
  }
}
