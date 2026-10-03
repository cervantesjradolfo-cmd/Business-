import { describe, expect, it } from 'vitest'
import { dedupeLeads, finalizeLeads, markChains } from './leads'
import type { Lead } from './types'

const mk = (id: string, o: Partial<Lead> = {}): Lead => ({
  id, osmType: 'node', osmId: 1, osmUrl: '', name: 'Cafe', category: 'Cafe', categoryId: 'cafes', address: '', lat: 30, lon: -97, distanceKm: 1, ...o,
})

describe('dedupeLeads', () => {
  it('merges the same id', () => {
    expect(dedupeLeads([mk('a'), mk('a', { phone: '1' })])).toHaveLength(1)
  })
  it('merges the same name within 50 m, keeping the fuller one', () => {
    const out = dedupeLeads([mk('a'), mk('b', { name: ' cafe ', lat: 30.0002, phone: '1', website: 'x.com' })])
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('b')
  })
  it('keeps same name farther away and different names nearby', () => {
    expect(dedupeLeads([mk('a'), mk('b', { lat: 30.01 })])).toHaveLength(2)
    expect(dedupeLeads([mk('a'), mk('b', { name: 'Other' })])).toHaveLength(2)
  })
})

describe('finalizeLeads', () => {
  it('sorts by distance and caps', () => {
    const out = finalizeLeads([mk('a', { name: 'A', distanceKm: 3 }), mk('b', { name: 'B', distanceKm: 1 }), mk('c', { name: 'C', distanceKm: 2 })], 2)
    expect(out.map((l) => l.id)).toEqual(['b', 'c'])
  })
})

describe('chain detection', () => {
  it('marks leads with a brand or brand:wikidata', () => {
    const out = markChains([mk('a', { name: 'Solo', brand: 'Starbucks' }), mk('b', { name: 'Other', brandWikidata: 'Q37158' }), mk('c', { name: 'Indie' })])
    expect(out.map((l) => !!l.isChain)).toEqual([true, true, false])
  })
  it('marks a normalised name that appears 3 or more times, but not 2', () => {
    const three = [mk('a', { name: 'Joe\'s Pizza', lat: 30 }), mk('b', { name: 'JOES  pizza', lat: 30.1 }), mk('c', { name: 'joe\'s pizza!', lat: 30.2 })]
    expect(markChains(three).every((l) => l.isChain)).toBe(true)
    expect(markChains(three.slice(0, 2)).some((l) => l.isChain)).toBe(false)
  })
  it('finalizeLeads applies it after dedupe (a duplicate pair is not a chain)', () => {
    const out = finalizeLeads([mk('a', { name: 'Twin' }), mk('b', { name: 'Twin', lat: 30.0001 }), mk('c', { name: 'Other', lat: 31 })], 10)
    expect(out.some((l) => l.isChain)).toBe(false)
    const chain = finalizeLeads([mk('a', { name: 'Chainy', lat: 30 }), mk('b', { name: 'Chainy', lat: 30.1 }), mk('c', { name: 'Chainy', lat: 30.2 })], 10)
    expect(chain.every((l) => l.isChain)).toBe(true)
  })
})
