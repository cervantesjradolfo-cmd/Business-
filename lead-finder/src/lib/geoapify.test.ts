import { describe, expect, it } from 'vitest'
import { CATEGORIES, getCategory } from '../data/categories'
import { buildGeoapifyUrl, geoapifyPerCategoryLimit, geoapifyToOverpass } from './geoapify'
import { parseOverpass } from './overpass'
import type { SearchRequest } from './types'

const req = (p: Partial<SearchRequest> = {}): SearchRequest => ({ location: 'Austin', category: 'restaurants', radiusKm: 5, limit: 10, ...p })
const feature = (raw: Record<string, unknown>, props: Record<string, unknown> = {}) => ({
  type: 'Feature',
  properties: { lat: 30.271, lon: -97.741, datasource: { sourcename: 'openstreetmap', raw }, ...props },
})

describe('buildGeoapifyUrl', () => {
  it('asks for one category in a circle around the centre, lon first', () => {
    const u = new URL(buildGeoapifyUrl(30.27, -97.74, 2.5, 'catering.cafe', 40, 'KEY'))
    expect(u.origin + u.pathname).toBe('https://api.geoapify.com/v2/places')
    expect(u.searchParams.get('categories')).toBe('catering.cafe')
    expect(u.searchParams.get('filter')).toBe('circle:-97.74,30.27,2500')
    expect(u.searchParams.get('bias')).toBe('proximity:-97.74,30.27')
    expect(u.searchParams.get('limit')).toBe('40')
    expect(u.searchParams.get('apiKey')).toBe('KEY')
  })
})

describe('geoapifyPerCategoryLimit', () => {
  it('splits limit x 3 across the categories, between 20 and 500', () => {
    expect(geoapifyPerCategoryLimit(req({ limit: 60 }), 2)).toBe(90)
    expect(geoapifyPerCategoryLimit(req({ limit: 60 }), 30)).toBe(20)
    expect(geoapifyPerCategoryLimit(req({ limit: 200 }), 1)).toBe(500)
  })
})

describe('category lists', () => {
  it('gives every category Geoapify categories, each listed once in "any"', () => {
    for (const c of CATEGORIES) expect(c.geoapify.length).toBeGreaterThan(0)
    const any = getCategory('any')!.geoapify
    expect(new Set(any).size).toBe(any.length)
    expect(any).toEqual(expect.arrayContaining(['healthcare.dentist', 'office.lawyer', 'sport.fitness']))
  })
})

describe('geoapifyToOverpass', () => {
  it('turns features with OSM tags into elements parseOverpass reads', () => {
    const json = { type: 'FeatureCollection', features: [
      feature({ osm_type: 'n', osm_id: 42, name: 'Taco Spot', amenity: 'fast_food', website: 'https://taco.example', phone: '+1 512 555 0100' }),
    ] }
    const out = geoapifyToOverpass(json, 'restaurants')!
    expect(out.elements).toEqual([{ type: 'node', id: 42, lat: 30.271, lon: -97.741, tags: { name: 'Taco Spot', amenity: 'fast_food', website: 'https://taco.example', phone: '+1 512 555 0100' } }])
    const [lead] = parseOverpass(out, { lat: 30.27, lon: -97.74 })
    expect(lead).toMatchObject({ id: 'osm:node/42', name: 'Taco Spot', categoryId: 'restaurants', website: 'https://taco.example', phone: '+1 512 555 0100' })
  })
  it('fills missing tags from Geoapify fields without overwriting OSM ones', () => {
    const out = geoapifyToOverpass({ features: [feature(
      { osm_type: 'w', osm_id: 7, amenity: 'restaurant', name: 'OSM Name' },
      { name: 'Geo Name', website: 'https://w.example', contact: { phone: '555' }, housenumber: '12', street: 'Main St', city: 'Austin', state_code: 'TX', postcode: '78701' },
    )] }, 'restaurants')!
    expect(out.elements[0]).toMatchObject({ type: 'way', id: 7, tags: { name: 'OSM Name', website: 'https://w.example', phone: '555', 'addr:housenumber': '12', 'addr:street': 'Main St', 'addr:city': 'Austin', 'addr:state': 'TX', 'addr:postcode': '78701' } })
  })
  it('drops places the category selectors do not match, keeps ones with no kind tag', () => {
    const out = geoapifyToOverpass({ features: [
      feature({ osm_type: 'n', osm_id: 1, name: 'Spa', shop: 'massage' }),
      feature({ osm_type: 'n', osm_id: 2, name: 'Salon', shop: 'hairdresser' }),
      feature({ osm_type: 'n', osm_id: 3, name: 'Untagged' }),
    ] }, 'salons')!
    expect(out.elements.map((e) => (e as { id: number }).id)).toEqual([2, 3])
  })
  it('skips features without an OSM id or coordinates, and rejects a non-GeoJSON answer', () => {
    const out = geoapifyToOverpass({ features: [
      feature({ name: 'No id', amenity: 'restaurant' }),
      feature({ osm_type: 'x', osm_id: 5, amenity: 'restaurant' }),
      feature({ osm_type: 'n', osm_id: 6, amenity: 'restaurant' }, { lat: 'nope' }),
      null,
    ] }, 'restaurants')!
    expect(out.elements).toEqual([])
    expect(geoapifyToOverpass({ error: 'Unauthorized' }, 'restaurants')).toBeNull()
  })
})
