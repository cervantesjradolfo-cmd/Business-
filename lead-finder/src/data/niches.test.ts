import { describe, expect, it } from 'vitest'
import { CATEGORIES, DEFAULT_FAVORITES, NICHES } from './categories'
import { buildOverpassQuery, detectCategory } from '../lib/overpass'

describe('underserved niches', () => {
  it('are all categories, starred by default, and each builds an Overpass query', () => {
    expect(NICHES.map((c) => c.id)).toEqual(DEFAULT_FAVORITES)
    expect(DEFAULT_FAVORITES).toHaveLength(16)
    for (const n of NICHES) {
      expect(CATEGORIES.some((c) => c.id === n.id)).toBe(true)
      expect(n.selectors.length).toBeGreaterThan(0)
      expect(buildOverpassQuery(41.88, -87.63, 5, n.id, 60)).toMatch(/^\[out:json\].*nwr\[/)
    }
  })
  it('label businesses with the more specific niche', () => {
    const cat = (tags: Record<string, string>) => detectCategory(tags).id
    expect(cat({ shop: 'car_repair', name: "Mann's Towing Service" })).toBe('towing')
    expect(cat({ office: 'towing', name: 'Lincoln Towing' })).toBe('towing')
    expect(cat({ amenity: 'dojo', name: 'Enso Karate' })).toBe('martial_arts_dance')
    expect(cat({ leisure: 'dance', name: 'Dance Academy' })).toBe('martial_arts_dance')
    expect(cat({ amenity: 'restaurant', name: 'Jolly Inn Restaurant & Banquets' })).toBe('wedding_venues')
    expect(cat({ amenity: 'events_venue', name: 'Lago Hall' })).toBe('wedding_venues')
    expect(cat({ craft: 'carpenter', name: 'Midwest Fence Corporation' })).toBe('fencing')
    expect(cat({ craft: 'gardener', name: "Bluder's Tree Service" })).toBe('tree_service')
    expect(cat({ shop: 'doors', name: "Helson's Garage Door Store" })).toBe('garage_doors')
    expect(cat({ craft: 'paver', name: 'De Vega Concrete' })).toBe('concrete')
    expect(cat({ shop: 'locksmith', name: 'Omega Locksmith' })).toBe('locksmiths')
    expect(cat({ shop: 'funeral_directors', name: 'Malec & Sons' })).toBe('funeral_homes')
    expect(cat({ amenity: 'childcare', name: 'YMCA Child Care' })).toBe('daycare')
    expect(cat({ shop: 'storage_rental', name: 'Metro Self Storage' })).toBe('self_storage')
    expect(cat({ craft: 'junk_removal', name: 'Junk OnDemand' })).toBe('junk_removal')
    expect(cat({ craft: 'glaziery', name: 'City Glass' })).toBe('glass')
    expect(cat({ craft: 'photographer', name: 'WASIO Photography' })).toBe('photographers')
    expect(cat({ shop: 'party', name: 'EZ Tent Rental' })).toBe('party_rentals')
  })
  it('do not grab unrelated businesses by name', () => {
    expect(detectCategory({ amenity: 'fast_food', name: 'White Fence Farm' }).id).not.toBe('fencing')
    expect(detectCategory({ landuse: 'industrial', name: 'Ozinga - Concrete' }).id).toBe('other')
    expect(detectCategory({ amenity: 'ice_cream', name: 'Glass Slipper Ice Cream' }).id).not.toBe('glass')
  })
})
