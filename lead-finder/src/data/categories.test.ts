import { describe, expect, it } from 'vitest'
import { CATEGORIES, getCategory } from './categories'

// These terms were checked against live Nominatim (the OSM "special phrases" it understands).
// Change them only after re-checking, because free-text words like "gym" or "law office" return nothing.
describe('Nominatim fallback terms', () => {
  const terms = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.nominatimTerms]))
  it('pins the terms per category', () => {
    expect(terms).toEqual({
      any: ['restaurant', 'cafe', 'hairdresser', 'car repair', 'dentist'],
      restaurants: ['restaurant'],
      cafes: ['cafe'],
      salons: ['hairdresser'],
      barbers: ['hairdresser'],
      auto_repair: ['car repair'],
      dentists: ['dentist'],
      fitness: ['martial arts', 'sports centre'],
      drywall: [],
      trades: ['electrician', 'carpenter'],
      cleaning: ['dry cleaning', 'laundry'],
      party_rentals: [],
      retail: ['clothes shop', 'gift shop', 'shoe shop'],
      real_estate: ['estate agent'],
      law: [],
      medical: ['clinic', 'doctors'],
    })
  })
  it('never uses the terms that returned 0 results for the problem categories', () => {
    const bad = ['hair salon', 'barber', 'auto repair', 'gym', 'cleaning service', 'party rental', 'real estate agent', 'law office', 'medical clinic', 'business', 'contractor']
    for (const c of CATEGORIES) for (const t of c.nominatimTerms) expect(bad).not.toContain(t)
  })
  it('getCategory still finds a category', () => {
    expect(getCategory('salons')?.nominatimTerms).toEqual(['hairdresser'])
  })
})
