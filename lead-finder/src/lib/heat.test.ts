import { describe, expect, it } from 'vitest'
import { applyFilters, sortByHeat } from './filters'
import { detectSignals, heatFor, parseStartDate } from './heat'
import { parseOverpass } from './overpass'
import { scoreLead } from './scoring'
import type { Lead } from './types'

const NOW = new Date('2026-10-17T12:00:00Z')
const base: Lead = { id: 'a', osmType: 'node', osmId: 1, osmUrl: '', name: 'A', category: 'Cafe', categoryId: 'cafes', address: '', lat: 0, lon: 0, distanceKm: 1, website: 'a.example.com' }
const heat = (l: Partial<Lead> = {}, audit?: Parameters<typeof scoreLead>[1]) => {
  const s = scoreLead({ ...base, ...l }, audit)
  return heatFor(s, NOW)
}
const ok = (signals: ('hiring' | 'new_opening' | 'placeholder_site')[] = []) => ({ id: 'a', status: 'ok' as const, gaps: [], signals, checkedAt: '' })

describe('detectSignals', () => {
  it('spots hiring, a new opening and a placeholder page in the visible text', () => {
    expect(detectSignals('<h2>We&#39;re growing!</h2><p>Now hiring line cooks.</p>')).toEqual(['hiring'])
    expect(detectSignals('<div class="banner">Grand Opening this Saturday</div>')).toEqual(['new_opening'])
    expect(detectSignals('<html><body><h1>Website coming soon</h1></body></html>')).toEqual(['placeholder_site'])
    expect(detectSignals('<script>var t="now hiring"</script><p>Fresh coffee daily</p>')).toEqual([])
  })
})

describe('heatFor', () => {
  it('is 1 with no signals', () => {
    expect(heat({}, ok())).toEqual({ heat: 1, reasons: [] })
    expect(heat({ website: undefined }).heat).toBe(1) // missing a website is a fit, not a moment
  })
  it('adds points for website signals, a recent opening and a broken site, strongest first, up to 5', () => {
    const h = heat({ startDate: '2026-08' }, ok(['hiring', 'new_opening']))
    expect(h.heat).toBe(5)
    expect(h.reasons.map((r) => r.label)).toEqual(['Hiring (says so on their website)', 'Newly opened or opening soon (website)', 'Opened recently (map listing: 2026-08)'])
    expect(heat({}, { id: 'a', status: 'unreachable', gaps: [], checkedAt: '' }).reasons[0].label).toBe('Website is down or broken right now')
    expect(heat({ startDate: '2019' }, ok()).heat).toBe(1)
  })
  it('rates fresh permits higher than older ones, and big jobs higher', () => {
    const project = (issued: string, cost?: number) => ({ permit: 'p', city: 'Chicago', issued, description: '', address: '', ...(cost ? { cost } : {}) })
    expect(heat({ project: project('2026-10-10', 500_000) }).heat).toBe(5)
    expect(heat({ project: project('2026-09-20') }).heat).toBe(3)
    expect(heat({ project: project('2026-06-01') }).heat).toBe(1)
  })
  it('counts weak Google reviews', () => {
    expect(heat({ reviews: { rating: 3.6, count: 40, checkedAt: '' } }, ok()).reasons).toEqual([{ label: 'Google rating 3.6 from 40 reviews', points: 2 }])
    expect(heat({ reviews: { rating: 4.8, count: 6, checkedAt: '' } }, ok()).reasons).toEqual([{ label: 'Only 6 Google reviews', points: 1 }])
    expect(heat({ reviews: { rating: 4.8, count: 300, checkedAt: '' } }, ok()).heat).toBe(1)
  })
})

describe('start dates from the map', () => {
  it('keeps OSM start_date / opening_date when it is a date', () => {
    expect(parseStartDate('2026-03-14')).toBe('2026-03-14')
    expect(parseStartDate('early 2020')).toBeUndefined()
    const [lead] = parseOverpass({ elements: [{ type: 'node', id: 1, lat: 1, lon: 1, tags: { name: 'New Cafe', amenity: 'cafe', opening_date: '2026-09' } }] }, { lat: 1, lon: 1 })
    expect(lead.startDate).toBe('2026-09')
  })
})

describe('heat filters', () => {
  const cool = scoreLead({ ...base, id: 'cool', name: 'Cool' }, ok())
  const hot = scoreLead({ ...base, id: 'hot', name: 'Hot', distanceKm: 9 }, ok(['hiring', 'new_opening']))
  const f = { minScore: 0, noWebsiteOnly: false, hasPhone: false, showChains: true }
  it('keeps only heat 4+ when asked, and sorts hottest first', () => {
    expect(applyFilters([cool, hot], { ...f, hotOnly: true }).map((l) => l.id)).toEqual(['hot'])
    expect(sortByHeat([cool, hot]).map((l) => l.id)).toEqual(['hot', 'cool'])
  })
})
