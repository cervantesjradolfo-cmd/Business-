import { distanceKm, osmUrl } from './geo'
import { detectCategory, pickBrand, pickContact } from './overpass'
import type { Lead } from './types'

export const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'

export function buildGeocodeUrl(location: string, email?: string): string {
  const p = new URLSearchParams({ q: location, format: 'jsonv2', limit: '1', addressdetails: '1' })
  if (email) p.set('email', email)
  return `${NOMINATIM_BASE}/search?${p.toString()}`
}

export function parseGeocode(json: unknown): { lat: number; lon: number; displayName: string } | null {
  if (!Array.isArray(json) || json.length === 0) return null
  const first = json[0] as { lat?: string; lon?: string; display_name?: string }
  const lat = Number(first?.lat)
  const lon = Number(first?.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return { lat, lon, displayName: first.display_name ?? '' }
}

export function buildNominatimSearchUrl(term: string, location: string, email?: string): string {
  const p = new URLSearchParams({
    q: `${term} near ${location}`,
    format: 'jsonv2',
    extratags: '1',
    addressdetails: '1',
    limit: '40',
  })
  if (email) p.set('email', email)
  return `${NOMINATIM_BASE}/search?${p.toString()}`
}

type Item = {
  osm_type?: string
  osm_id?: number
  lat?: string
  lon?: string
  category?: string
  class?: string
  type?: string
  name?: string
  display_name?: string
  extratags?: Record<string, string>
  address?: Record<string, string>
}

const DROP = new Set(['place', 'boundary', 'highway', 'landuse'])

export function parseNominatimSearch(json: unknown, center: { lat: number; lon: number }, radiusKm: number): Lead[] {
  if (!Array.isArray(json)) return []
  const leads: Lead[] = []
  for (const it of json as Item[]) {
    if (!it || typeof it !== 'object') continue
    const cls = it.category ?? it.class ?? ''
    if (DROP.has(cls)) continue
    const type = it.osm_type
    if ((type !== 'node' && type !== 'way' && type !== 'relation') || typeof it.osm_id !== 'number') continue
    const lat = Number(it.lat)
    const lon = Number(it.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const dist = distanceKm(center, { lat, lon })
    if (dist > radiusKm) continue
    const name = it.name?.trim() || it.display_name?.split(',')[0]?.trim()
    if (!name) continue
    const extra = it.extratags ?? {}
    const a = it.address ?? {}
    const city = a.city ?? a.town ?? a.village ?? a.hamlet
    const street = [a.house_number, a.road].filter(Boolean).join(' ')
    const tail = [city, [a.state, a.postcode].filter(Boolean).join(' ')].filter((p) => p && p.trim()).join(' ')
    const address = [street, tail].filter(Boolean).join(', ')
    const cat = detectCategory({ ...extra, name, [cls]: it.type ?? '' })
    leads.push({
      id: `osm:${type}/${it.osm_id}`,
      osmType: type,
      osmId: it.osm_id,
      osmUrl: osmUrl(type, it.osm_id),
      name,
      category: cat.label,
      categoryId: cat.id,
      address,
      city: city || undefined,
      ...pickContact(extra),
      ...pickBrand(extra),
      lat,
      lon,
      distanceKm: Math.round(dist * 100) / 100,
    })
  }
  return leads
}
