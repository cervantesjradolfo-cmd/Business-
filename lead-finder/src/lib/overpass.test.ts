import { describe, expect, it } from 'vitest'
import { CATEGORIES } from '../data/categories'
import { OVERPASS_MIRRORS, buildOverpassQuery, detectCategory, formatAddress, parseOverpass } from './overpass'

const center = { lat: 30.27, lon: -97.74 }

describe('buildOverpassQuery', () => {
  it('includes each selector with name and around', () => {
    const q = buildOverpassQuery(30.27, -97.74, 5, 'salons', 60)
    expect(q).toContain('nwr["shop"="beauty"]["name"](around:5000,30.27,-97.74);')
    expect(q).toContain('nwr["shop"="hairdresser"]["hairdresser"!="barber"]["name"](around:5000,30.27,-97.74);')
    expect(q.startsWith('[out:json][timeout:25];(')).toBe(true)
    expect(q).toContain('out center tags 180;')
  })
  it('caps the element count at 600', () => {
    expect(buildOverpassQuery(1, 2, 1, 'cafes', 200)).toContain('out center tags 600;')
  })
  it('any includes every category selector except the slow drywall name matches', () => {
    const q = buildOverpassQuery(1, 2, 1, 'any', 10)
    for (const c of CATEGORIES) for (const s of c.selectors) {
      if (s.includes('["name"~"drywall')) expect(q).not.toContain(`nwr${s}["name"]`)
      else expect(q).toContain(`nwr${s}["name"]`)
    }
  })
  it('lists three mirrors in order', () => {
    expect(OVERPASS_MIRRORS[0]).toContain('overpass-api.de')
    expect(OVERPASS_MIRRORS).toHaveLength(3)
  })
})

describe('parseOverpass', () => {
  const json = {
    elements: [
      { type: 'node', id: 1, lat: 30.28, lon: -97.74, tags: { name: 'Smile Dental', amenity: 'dentist', phone: '+1 555-0100', website: 'smile.example.com', 'addr:housenumber': '12', 'addr:street': 'Main St', 'addr:city': 'Austin', 'addr:state': 'TX', 'addr:postcode': '78701' } },
      { type: 'way', id: 2, center: { lat: 30.27, lon: -97.75 }, tags: { name: 'Beans', amenity: 'cafe', 'contact:phone': '555-1', 'contact:website': 'https://beans.example.com', 'contact:email': 'a@b.com', opening_hours: 'Mo-Su 07:00-17:00' } },
      { type: 'node', id: 3, lat: 30.27, lon: -97.74, tags: { amenity: 'cafe' } },
      { type: 'way', id: 4, tags: { name: 'No coords', amenity: 'cafe' } },
      { type: 'node', id: 5, lat: 30.27, lon: -97.74, tags: { name: 'Bakery One', shop: 'bakery' } },
    ],
  }
  const leads = parseOverpass(json, center)
  it('skips nameless and coordinate-less elements', () => {
    expect(leads.map((l) => l.id)).toEqual(['osm:node/1', 'osm:way/2', 'osm:node/5'])
  })
  it('handles nodes and ways with centre', () => {
    expect(leads[0].lat).toBe(30.28)
    expect(leads[1].lat).toBe(30.27)
    expect(leads[1].osmUrl).toBe('https://www.openstreetmap.org/way/2')
    expect(leads[0].distanceKm).toBeGreaterThan(1)
  })
  it('uses contact:* fallbacks', () => {
    expect(leads[1].phone).toBe('555-1')
    expect(leads[1].website).toBe('https://beans.example.com')
    expect(leads[1].email).toBe('a@b.com')
    expect(leads[1].openingHours).toBe('Mo-Su 07:00-17:00')
  })
  it('builds the address and detects categories', () => {
    expect(leads[0].address).toBe('12 Main St, Austin TX 78701')
    expect(leads[0].city).toBe('Austin')
    expect(leads[0].category).toBe('Dentist')
    expect(leads[0].categoryId).toBe('dentists')
    expect(leads[2].categoryId).toBe('other')
    expect(leads[2].category).toBe('Bakery')
  })
  it('returns [] for junk', () => {
    expect(parseOverpass(null, center)).toEqual([])
  })
})

describe('formatAddress / detectCategory', () => {
  it('removes stray commas and spaces', () => {
    expect(formatAddress({ 'addr:street': 'Oak Ave', 'addr:postcode': '123' })).toEqual({ address: 'Oak Ave, 123', city: undefined })
    expect(formatAddress({})).toEqual({ address: '', city: undefined })
  })
  it('matches negative and case-insensitive selectors', () => {
    expect(detectCategory({ shop: 'hairdresser', hairdresser: 'barber' }).id).toBe('barbers')
    expect(detectCategory({ shop: 'hairdresser', name: 'Joe BARBER Shop' }).id).toBe('barbers')
    expect(detectCategory({ shop: 'hairdresser' }).id).toBe('salons')
    expect(detectCategory({ craft: 'plumber' }).id).toBe('trades')
    expect(detectCategory({}).label).toBe('Business')
  })
  it('detects drywall and ceiling firms by tag or by name', () => {
    expect(detectCategory({ craft: 'plasterer' })).toEqual({ id: 'drywall', label: 'Drywall & ceiling contractor' })
    expect(detectCategory({ craft: 'insulation' }).id).toBe('drywall')
    expect(detectCategory({ office: 'company', name: 'Rocky Mountain DryWall' }).id).toBe('drywall')
    expect(detectCategory({ office: 'company', name: 'SRB Acoustics' }).id).toBe('drywall')
    expect(detectCategory({ craft: 'carpenter', name: 'Metal Framing Pros' }).id).toBe('drywall')
    expect(detectCategory({ craft: 'carpenter', name: 'Oak Cabinets' }).id).toBe('trades')
    expect(detectCategory({ shop: 'frame', name: 'Art & Framing' }).id).not.toBe('drywall')
  })
  it('builds a drywall query with the tag and name selectors', () => {
    const q = buildOverpassQuery(39.74, -104.99, 5, 'drywall', 50)
    expect(q).toContain('nwr["craft"~"^(drywall|drywall_contractor|plasterer|ceiling|insulation|framing|dry_lining)$"]["name"](around:5000,39.74,-104.99);')
    expect(q).toContain('nwr["office"~"."]["name"~"drywall|acoustic|ceiling|framing",i]["name"](around:5000,39.74,-104.99);')
    const any = buildOverpassQuery(39.74, -104.99, 5, 'any', 50)
    expect(any).toContain('plasterer|ceiling')
    expect(any).not.toContain('acoustic')
  })
})

describe('brand tags', () => {
  it('carries brand, brand:wikidata and operator into the lead', () => {
    const [l] = parseOverpass({ elements: [{ type: 'node', id: 9, lat: 30.27, lon: -97.74, tags: { name: 'Starbucks', amenity: 'cafe', brand: 'Starbucks', 'brand:wikidata': 'Q37158', operator: 'Starbucks Corp' } }] }, center)
    expect(l).toMatchObject({ brand: 'Starbucks', brandWikidata: 'Q37158', operator: 'Starbucks Corp' })
  })
  it('leaves them out when the tags are absent', () => {
    const [l] = parseOverpass({ elements: [{ type: 'node', id: 9, lat: 30.27, lon: -97.74, tags: { name: 'Indie', amenity: 'cafe' } }] }, center)
    expect(l.brand).toBeUndefined()
    expect(l.brandWikidata).toBeUndefined()
    expect(l.operator).toBeUndefined()
  })
})
