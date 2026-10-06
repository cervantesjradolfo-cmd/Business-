import { CATEGORIES, getCategory } from '../data/categories.js'
import { distanceKm, osmUrl } from './geo.js'
import type { CategoryId, Lead } from './types.js'
import { isBlockedHostname } from './url.js'

export const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
] as const

// Comma-separated list of https URLs -> mirror list (defaults when nothing valid is given).
export function parseOverpassUrls(raw: string | undefined): string[] {
  const out: string[] = []
  for (const part of (raw ?? '').split(',')) {
    const s = part.trim()
    if (!s) continue
    try {
      const u = new URL(s)
      if (u.protocol !== 'https:') continue
      if (u.username || u.password) continue
      if (isBlockedHostname(u.hostname)) continue
    } catch {
      continue
    }
    if (!out.includes(s)) out.push(s)
  }
  return out.length > 0 ? out.slice(0, 6) : [...OVERPASS_MIRRORS]
}

// Retry-After header (seconds or HTTP date) -> milliseconds, or null when missing/unreadable.
export function parseRetryAfter(header: string | null, now: number): number | null {
  const v = header?.trim()
  if (!v) return null
  if (/^\d+$/.test(v)) return Number(v) * 1000
  if (!/[a-z]/i.test(v)) return null
  const t = Date.parse(v)
  if (Number.isNaN(t)) return null
  return Math.max(0, t - now)
}

export function buildOverpassQuery(lat: number, lon: number, radiusKm: number, category: CategoryId, limit: number): string {
  const def = getCategory(category) ?? CATEGORIES[0]
  const around = `(around:${Math.round(radiusKm * 1000)},${lat},${lon})`
  const parts = def.selectors.map((sel) => `nwr${sel}["name"]${around};`).join('')
  const max = Math.min(limit * 3, 600)
  return `[out:json][timeout:25];(${parts});out center tags ${max};`
}

type Tags = Record<string, string>

// --- tiny matcher for the selector forms used in categories.ts ---
type Cond = { key: string; op: '=' | '!=' | '~'; value: string; ci: boolean }
function parseSelector(sel: string): Cond[] {
  const conds: Cond[] = []
  const re = /\["([^"]+)"(!=|=|~)"((?:[^"\\]|\\.)*)"(,i)?\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(sel))) conds.push({ key: m[1], op: m[2] as Cond['op'], value: m[3], ci: !!m[4] })
  return conds
}
function matchesSelector(sel: string, tags: Tags): boolean {
  return parseSelector(sel).every((c) => {
    const v = tags[c.key]
    if (c.op === '=') return v === c.value
    if (c.op === '!=') return v !== c.value
    return v !== undefined && new RegExp(c.value, c.ci ? 'i' : '').test(v)
  })
}

export function matchesAnySelector(selectors: string[], tags: Tags): boolean {
  return selectors.some((s) => matchesSelector(s, tags))
}

const GENERIC_KEYS = ['shop', 'amenity', 'craft', 'office', 'healthcare', 'leisure']

function humanise(v: string): string {
  const s = v.replace(/[_;]+/g, ' ').trim()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Business'
}

export function detectCategory(tags: Tags): { id: CategoryId | 'other'; label: string } {
  const matches = CATEGORIES.filter((def) => def.id !== 'any' && def.selectors.some((s) => matchesSelector(s, tags)))
  // A hairdresser named "... Barber ..." matches both; the more specific barbers category wins.
  const hit = matches.find((d) => d.id === 'barbers') ?? matches[0]
  if (hit) return { id: hit.id, label: hit.singular }
  for (const k of GENERIC_KEYS) {
    if (tags[k]) return { id: 'other', label: humanise(tags[k]) }
  }
  return { id: 'other', label: 'Business' }
}

export function formatAddress(tags: Tags): { address: string; city?: string } {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ')
  const city = tags['addr:city']
  const region = [tags['addr:state'], tags['addr:postcode']].filter(Boolean).join(' ')
  const tail = [city, region].filter(Boolean).join(' ')
  const address = [street, tail].filter((p) => p && p.trim()).join(', ').replace(/\s+/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '')
  return { address, city: city || undefined }
}

export function pickContact(tags: Tags): { phone?: string; email?: string; website?: string; openingHours?: string } {
  const first = (...keys: string[]) => {
    for (const k of keys) {
      const v = tags[k]?.trim()
      if (v) return v
    }
    return undefined
  }
  return {
    phone: first('phone', 'contact:phone'),
    email: first('email', 'contact:email'),
    website: first('website', 'contact:website', 'url'),
    openingHours: first('opening_hours'),
  }
}

export function pickBrand(tags: Tags): { brand?: string; brandWikidata?: string; operator?: string } {
  const out: { brand?: string; brandWikidata?: string; operator?: string } = {}
  const brand = tags.brand?.trim()
  const wikidata = tags['brand:wikidata']?.trim()
  const operator = tags.operator?.trim()
  if (brand) out.brand = brand
  if (wikidata) out.brandWikidata = wikidata
  if (operator) out.operator = operator
  return out
}

type Element = { type?: string; id?: number; lat?: number; lon?: number; center?: { lat?: number; lon?: number }; tags?: Tags }

export function parseOverpass(json: unknown, center: { lat: number; lon: number }): Lead[] {
  const elements = (json as { elements?: unknown })?.elements
  if (!Array.isArray(elements)) return []
  const leads: Lead[] = []
  for (const el of elements as Element[]) {
    if (!el || typeof el !== 'object') continue
    const type = el.type
    if ((type !== 'node' && type !== 'way' && type !== 'relation') || typeof el.id !== 'number') continue
    const tags = el.tags ?? {}
    const name = tags.name?.trim()
    if (!name) continue
    const lat = type === 'node' ? el.lat : (el.center?.lat ?? el.lat)
    const lon = type === 'node' ? el.lon : (el.center?.lon ?? el.lon)
    if (typeof lat !== 'number' || typeof lon !== 'number') continue
    const cat = detectCategory(tags)
    const { address, city } = formatAddress(tags)
    leads.push({
      id: `osm:${type}/${el.id}`,
      osmType: type,
      osmId: el.id,
      osmUrl: osmUrl(type, el.id),
      name,
      category: cat.label,
      categoryId: cat.id,
      address,
      city,
      ...pickContact(tags),
      ...pickBrand(tags),
      lat,
      lon,
      distanceKm: Math.round(distanceKm(center, { lat, lon }) * 100) / 100,
    })
  }
  return leads
}
