import { describe, expect, it } from 'vitest'
import { applyFilters, sortLeads } from './filters'
import { scoreLead } from './scoring'
import type { Lead } from './types'

const mk = (id: string, o: Partial<Lead> = {}) =>
  scoreLead({ id, osmType: 'node', osmId: 1, osmUrl: '', name: id, category: 'c', categoryId: 'cafes', address: '', lat: 0, lon: 0, distanceKm: 1, phone: '1', openingHours: 'x', ...o })

describe('applyFilters', () => {
  const a = mk('a')
  const b = mk('b', { website: 'b.com' })
  const c = mk('c', { phone: undefined })
  const f = { minScore: 0, noWebsiteOnly: false, hasPhone: false, showChains: true }
  it('min score', () => expect(applyFilters([a, b, c], { ...f, minScore: 50 }).map((l) => l.id)).toEqual(['a', 'c']))
  it('no website only', () => expect(applyFilters([a, b], { ...f, noWebsiteOnly: true }).map((l) => l.id)).toEqual(['a']))
  it('hides chains unless showChains is on', () => {
    const chain = mk('chain', { isChain: true })
    expect(applyFilters([a, chain], { ...f, showChains: false }).map((l) => l.id)).toEqual(['a'])
    expect(applyFilters([a, chain], f).map((l) => l.id)).toEqual(['a', 'chain'])
  })
  it('has phone', () => expect(applyFilters([a, c], { ...f, hasPhone: true }).map((l) => l.id)).toEqual(['a']))
})

describe('sortLeads', () => {
  it('sorts by score, then distance, then name', () => {
    const l1 = mk('b', { distanceKm: 2 })
    const l2 = mk('a', { distanceKm: 2 })
    const l3 = mk('c', { distanceKm: 1 })
    const l4 = mk('d', { website: 'd.com' })
    expect(sortLeads([l4, l1, l2, l3]).map((l) => l.id)).toEqual(['c', 'a', 'b', 'd'])
  })
})
