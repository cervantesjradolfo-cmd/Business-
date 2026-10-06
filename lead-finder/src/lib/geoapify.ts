// Geoapify Places API (OpenStreetMap data behind an API key, so it is not throttled like the free
// public Overpass servers). Answers are turned into Overpass-style elements so parseOverpass can read them.
import { getCategory } from '../data/categories.js'
import { matchesAnySelector } from './overpass.js'
import type { SearchRequest } from './types.js'

export const GEOAPIFY_URL = 'https://api.geoapify.com/v2/places'
const MAX_LIMIT = 500 // Geoapify's per-request maximum
const KIND_KEYS = ['shop', 'amenity', 'craft', 'office', 'healthcare', 'leisure']

export function buildGeoapifyUrl(lat: number, lon: number, req: SearchRequest, apiKey: string): string {
  const def = getCategory(req.category) ?? getCategory('any')!
  const params = new URLSearchParams({
    categories: def.geoapify.join(','),
    filter: `circle:${lon},${lat},${Math.round(req.radiusKm * 1000)}`,
    bias: `proximity:${lon},${lat}`,
    // Extra rows leave room for the selector filter, duplicates and chains, as with Overpass.
    limit: String(Math.min(req.limit * 3, MAX_LIMIT)),
    lang: 'en',
    apiKey,
  })
  return `${GEOAPIFY_URL}?${params}`
}

type Tags = Record<string, string>
type Feature = { properties?: Record<string, unknown> }
const OSM_TYPES: Record<string, 'node' | 'way' | 'relation'> = { n: 'node', w: 'way', r: 'relation', node: 'node', way: 'way', relation: 'relation' }
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : undefined)

// GeoJSON features -> { elements } in Overpass shape. Uses the OSM tags Geoapify passes through in
// datasource.raw, filling gaps from its own fields, and keeps only places the category's selectors match.
export function geoapifyToOverpass(json: unknown, req: SearchRequest): { elements: unknown[] } | null {
  const features = (json as { features?: unknown })?.features
  if (!Array.isArray(features)) return null
  const def = getCategory(req.category) ?? getCategory('any')!
  const elements: unknown[] = []
  for (const f of features as Feature[]) {
    const p = f?.properties
    if (!p || typeof p !== 'object') continue
    const raw = ((p.datasource as { raw?: unknown })?.raw ?? {}) as Record<string, unknown>
    const type = OSM_TYPES[String(raw.osm_type ?? '')]
    const id = Number(raw.osm_id)
    const lat = Number(p.lat)
    const lon = Number(p.lon)
    if (!type || !Number.isSafeInteger(id) || id <= 0 || !Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const tags: Tags = {}
    for (const [k, v] of Object.entries(raw)) {
      const s = str(v)
      if (s !== undefined && !k.startsWith('osm_')) tags[k] = s
    }
    const contact = (p.contact ?? {}) as Record<string, unknown>
    const fill: [string, unknown][] = [
      ['name', p.name],
      ['website', p.website],
      ['phone', contact.phone],
      ['email', contact.email],
      ['opening_hours', p.opening_hours],
      ['addr:housenumber', p.housenumber],
      ['addr:street', p.street],
      ['addr:city', p.city],
      ['addr:state', p.state_code ?? p.state],
      ['addr:postcode', p.postcode],
    ]
    for (const [k, v] of fill) {
      const s = str(v)
      if (s !== undefined && !tags[k]) tags[k] = s
    }
    // Without any kind tag there is nothing to match; trust the Geoapify category then.
    if (KIND_KEYS.some((k) => tags[k]) && !matchesAnySelector(def.selectors, tags)) continue
    elements.push({ type, id, lat, lon, tags })
  }
  return { elements }
}
