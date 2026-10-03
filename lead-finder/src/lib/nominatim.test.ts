import { describe, expect, it } from 'vitest'
import { buildGeocodeUrl, buildNominatimSearchUrl, parseGeocode, parseNominatimSearch } from './nominatim'

describe('urls', () => {
  it('builds the geocode url', () => {
    const u = new URL(buildGeocodeUrl('Austin, TX', 'me@x.com'))
    expect(u.origin).toBe('https://nominatim.openstreetmap.org')
    expect(u.searchParams.get('q')).toBe('Austin, TX')
    expect(u.searchParams.get('format')).toBe('jsonv2')
    expect(u.searchParams.get('limit')).toBe('1')
    expect(u.searchParams.get('email')).toBe('me@x.com')
    expect(new URL(buildGeocodeUrl('x')).searchParams.has('email')).toBe(false)
  })
  it('builds the search url', () => {
    const u = new URL(buildNominatimSearchUrl('dentist', 'Austin'))
    expect(u.searchParams.get('q')).toBe('dentist near Austin')
    expect(u.searchParams.get('extratags')).toBe('1')
    expect(u.searchParams.get('addressdetails')).toBe('1')
    expect(u.searchParams.get('format')).toBe('jsonv2')
  })
})

describe('parseGeocode', () => {
  it('parses the first hit', () => {
    expect(parseGeocode([{ lat: '1.5', lon: '2.5', display_name: 'Here' }])).toEqual({ lat: 1.5, lon: 2.5, displayName: 'Here' })
  })
  it('returns null for empty or bad data', () => {
    expect(parseGeocode([])).toBeNull()
    expect(parseGeocode({})).toBeNull()
    expect(parseGeocode([{ lat: 'x', lon: 'y' }])).toBeNull()
  })
})

describe('parseNominatimSearch', () => {
  const center = { lat: 30, lon: -97 }
  const item = (o: object) => ({ osm_type: 'node', osm_id: 1, lat: '30.001', lon: '-97.001', category: 'amenity', type: 'dentist', name: 'A', ...o })
  it('keeps matching items with extratags and address', () => {
    const [l] = parseNominatimSearch(
      [item({ extratags: { 'contact:website': 'a.com', phone: '1', opening_hours: 'Mo' }, address: { house_number: '5', road: 'Elm', town: 'Town', state: 'TX', postcode: '7' } })],
      center, 5,
    )
    expect(l.website).toBe('a.com')
    expect(l.phone).toBe('1')
    expect(l.address).toBe('5 Elm, Town TX 7')
    expect(l.categoryId).toBe('dentists')
  })
  it('drops place/highway items and far items', () => {
    const out = parseNominatimSearch(
      [item({ category: 'place' }), item({ osm_id: 2, category: 'highway' }), item({ osm_id: 3, lat: '31', lon: '-97' }), item({ osm_id: 4 })],
      center, 5,
    )
    expect(out.map((l) => l.osmId)).toEqual([4])
  })
  it('falls back to display_name and skips nameless', () => {
    const out = parseNominatimSearch([item({ name: '', display_name: 'Cafe Foo, Main St, Town' }), item({ osm_id: 9, name: '', display_name: '' })], center, 5)
    expect(out).toHaveLength(1)
    expect(out[0].name).toBe('Cafe Foo')
  })
})

describe('parseNominatimSearch extra tags', () => {
  const center = { lat: 30.27, lon: -97.74 }
  it('carries brand tags from extratags', () => {
    const [l] = parseNominatimSearch([{ osm_type: 'node', osm_id: 1, lat: '30.27', lon: '-97.74', category: 'amenity', type: 'cafe', name: 'Starbucks', extratags: { brand: 'Starbucks', 'brand:wikidata': 'Q37158', operator: 'SB' } }], center, 5)
    expect(l).toMatchObject({ brand: 'Starbucks', brandWikidata: 'Q37158', operator: 'SB' })
  })
  it('detects barbers from the name or hairdresser tag', () => {
    const items = [
      { osm_type: 'node', osm_id: 1, lat: '30.27', lon: '-97.74', category: 'shop', type: 'hairdresser', name: 'Cuts', extratags: { hairdresser: 'barber' } },
      { osm_type: 'node', osm_id: 2, lat: '30.27', lon: '-97.74', category: 'shop', type: 'hairdresser', name: 'Joe Barber Shop' },
      { osm_type: 'node', osm_id: 3, lat: '30.27', lon: '-97.74', category: 'shop', type: 'hairdresser', name: 'Salon X' },
    ]
    expect(parseNominatimSearch(items, center, 5).map((l) => l.categoryId)).toEqual(['barbers', 'barbers', 'salons'])
  })
})
