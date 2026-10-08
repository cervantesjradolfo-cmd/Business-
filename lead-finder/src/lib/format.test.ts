import { describe, expect, it } from 'vitest'
import { KM_PER_MILE, formatMiles, kmToMiles } from './format'

describe('miles', () => {
  it('converts km to miles for display', () => {
    expect(kmToMiles(KM_PER_MILE)).toBe(1)
    expect(formatMiles(1.3)).toBe('0.8 mi')
    expect(formatMiles(16.09344)).toBe('10.0 mi')
    expect(formatMiles(0)).toBe('0.0 mi')
  })
})
