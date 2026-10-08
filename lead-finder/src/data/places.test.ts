import { describe, expect, it } from 'vitest'
import { LARGEST_US_CITIES, MAX_PLACES, STATE_CITIES, parsePlaces, stateCities } from './places'

describe('parsePlaces', () => {
  it('splits on new lines and semicolons, trims, and drops blanks and repeats (ignoring case)', () => {
    expect(parsePlaces(' Austin, TX \n\n denver,  CO;austin, tx\n60614 ;')).toEqual(['Austin, TX', 'denver, CO', '60614'])
    expect(parsePlaces('   ')).toEqual([])
  })
  it('caps the list and each place', () => {
    const many = Array.from({ length: 150 }, (_, i) => `Town ${i}`).join('\n')
    expect(parsePlaces(many)).toHaveLength(MAX_PLACES)
    expect(parsePlaces('x'.repeat(300))[0]).toHaveLength(200)
  })
})

describe('place lists', () => {
  it('has 50 distinct largest cities and every state plus DC', () => {
    expect(new Set(LARGEST_US_CITIES).size).toBe(50)
    expect(LARGEST_US_CITIES.every((c) => /^.+, [A-Z]{2}$/.test(c))).toBe(true)
    expect(new Set(STATE_CITIES.map((s) => s.code)).size).toBe(51)
    expect(STATE_CITIES.every((s) => s.cities.length > 0)).toBe(true)
  })
  it('formats a state list as "City, ST"', () => {
    expect(stateCities('TX')).toEqual(['Houston, TX', 'San Antonio, TX', 'Dallas, TX', 'Austin, TX', 'Fort Worth, TX'])
    expect(stateCities('ZZ')).toEqual([])
  })
})
