// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NOMINATIM_FORBIDDEN, clearOverpassCache, geocode, searchBusinesses } from './osm'

const okJson = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } })
const geo = [{ lat: '30.27', lon: '-97.74', display_name: 'Austin, TX' }]
const row = (id: number, name: string, type: string, extra: Record<string, unknown> = {}) =>
  ({ osm_type: 'node', osm_id: id, lat: '30.271', lon: '-97.741', category: 'amenity', type, name, ...extra })

let calls: string[]
let n = 0
const loc = () => `Order Town ${++n}`
const sleep = async () => {}
beforeEach(() => { calls = []; clearOverpassCache(); delete process.env.LEADS_CONTACT_EMAIL })
afterEach(() => { vi.unstubAllGlobals() })

// Overpass mirrors fail; Nominatim answers by term (the q= parameter is "<term> in <location>" or similar).
function stub(byTerm: Record<string, () => Response>, geocodeRes: () => Response = () => okJson(geo)) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(String(url))
    const u = new URL(String(url))
    if (!u.hostname.includes('nominatim')) return new Response('busy', { status: 503 })
    if (!u.searchParams.has('extratags')) return geocodeRes()
    const q = (u.searchParams.get('q') ?? '').toLowerCase()
    const hit = Object.keys(byTerm).filter((t) => q.includes(t)).sort((a, b) => b.length - a.length)[0]
    return hit ? byTerm[hit]() : okJson([])
  }))
}
const searchCalls = () => calls.filter((c) => c.includes('extratags'))
const termOf = (c: string) => (new URL(c).searchParams.get('q') ?? '').toLowerCase()

describe('multiple Nominatim terms', () => {
  it('tries terms in the listed order and merges results (medical: clinic then doctors)', async () => {
    stub({ clinic: () => okJson([row(1, 'Clinic One', 'clinic')]), doctors: () => okJson([row(2, 'Doc Two', 'doctors')]) })
    const r = await searchBusinesses({ location: loc(), category: 'medical', radiusKm: 5, limit: 10 }, { sleep })
    expect('leads' in r && r.leads.map((l) => l.name).sort()).toEqual(['Clinic One', 'Doc Two'])
    expect(searchCalls().map(termOf).map((q) => (q.includes('clinic') ? 'clinic' : 'doctors'))).toEqual(['clinic', 'doctors'])
  })
  it('stops asking once the limit is reached', async () => {
    stub({ clinic: () => okJson([row(1, 'A', 'clinic'), row(2, 'B', 'clinic')]), doctors: () => okJson([row(3, 'C', 'doctors')]) })
    const r = await searchBusinesses({ location: loc(), category: 'medical', radiusKm: 5, limit: 2 }, { sleep })
    expect('leads' in r && r.leads).toHaveLength(2)
    expect(searchCalls()).toHaveLength(1)
  })
  it('keeps going to later terms when earlier ones return nothing', async () => {
    stub({ 'dry cleaning': () => okJson([]), laundry: () => okJson([row(5, 'Wash Co', 'laundry')]) })
    const r = await searchBusinesses({ location: loc(), category: 'cleaning', radiusKm: 5, limit: 10 }, { sleep })
    expect('leads' in r && r.leads.map((l) => l.name)).toEqual(['Wash Co'])
    expect(searchCalls()).toHaveLength(2)
  })
  it('a failing first term does not hide results from the second', async () => {
    stub({ clinic: () => new Response('x', { status: 500 }), doctors: () => okJson([row(2, 'Doc Two', 'doctors')]) })
    const r = await searchBusinesses({ location: loc(), category: 'medical', radiusKm: 5, limit: 10 }, { sleep })
    expect('leads' in r && r.leads.map((l) => l.name)).toEqual(['Doc Two'])
  })
  it('a failing later term does not discard results from the first', async () => {
    stub({ clinic: () => okJson([row(1, 'Clinic One', 'clinic')]), doctors: () => new Response('x', { status: 500 }) })
    const r = await searchBusinesses({ location: loc(), category: 'medical', radiusKm: 5, limit: 10 }, { sleep })
    expect('leads' in r && r.leads.map((l) => l.name)).toEqual(['Clinic One'])
  })
  it('502 busy when every term fails', async () => {
    stub({ clinic: () => new Response('x', { status: 500 }), doctors: () => new Response('x', { status: 500 }) })
    const r = await searchBusinesses({ location: loc(), category: 'medical', radiusKm: 5, limit: 10 }, { sleep })
    expect(r).toMatchObject({ status: 502, error: 'Map data servers are busy. Please try again in a minute.' })
  })
  it('does not duplicate a business returned by two terms', async () => {
    stub({ clinic: () => okJson([row(1, 'Same Place', 'clinic')]), doctors: () => okJson([row(1, 'Same Place', 'clinic')]) })
    const r = await searchBusinesses({ location: loc(), category: 'medical', radiusKm: 5, limit: 10 }, { sleep })
    expect('leads' in r && r.leads).toHaveLength(1)
  })
  it('sleeps (throttles) before every Nominatim request, including each extra term', async () => {
    stub({ clinic: () => okJson([]), doctors: () => okJson([]) })
    const s = vi.fn(async () => {})
    await searchBusinesses({ location: loc(), category: 'medical', radiusKm: 5, limit: 10 }, { sleep: s })
    expect(calls.filter((c) => c.includes('nominatim')).length).toBe(3)
    // throttle is time based: calls are made back-to-back here so at least 2 waits are expected
    expect(s.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
  it('barbers keep only barbers; salons drop barbers', async () => {
    const data = [
      row(1, 'Fade Shop', 'hairdresser', { category: 'shop', extratags: { hairdresser: 'barber' } }),
      row(2, 'Joes Barber Shop', 'hairdresser', { category: 'shop' }),
      row(3, 'Curl Studio', 'hairdresser', { category: 'shop' }),
    ]
    stub({ hairdresser: () => okJson(data) })
    const b = await searchBusinesses({ location: loc(), category: 'barbers', radiusKm: 5, limit: 10 }, { sleep })
    expect('leads' in b && b.leads.map((l) => l.name).sort()).toEqual(['Fade Shop', 'Joes Barber Shop'])
    const s = await searchBusinesses({ location: loc(), category: 'salons', radiusKm: 5, limit: 10 }, { sleep })
    expect('leads' in s && s.leads.map((l) => l.name)).toEqual(['Curl Studio'])
  })
  it('law and party_rentals (no phrase) give 502 and make no Nominatim search request', async () => {
    stub({})
    for (const category of ['law', 'party_rentals'] as const) {
      const r = await searchBusinesses({ location: loc(), category, radiusKm: 5, limit: 10 }, { sleep })
      expect(r).toMatchObject({ status: 502, error: 'Map data servers are busy. Please try again in a minute.' })
    }
    expect(searchCalls()).toEqual([])
  })
})

describe('403 handling', () => {
  it('searchBusinesses returns the specific OSM refusal message (502)', async () => {
    stub({}, () => new Response('blocked', { status: 403 }))
    const r = await searchBusinesses({ location: loc(), category: 'cafes', radiusKm: 5, limit: 10 }, { sleep })
    expect(r).toEqual({ error: NOMINATIM_FORBIDDEN, status: 502 })
    expect(NOMINATIM_FORBIDDEN).toContain('LEADS_CONTACT_EMAIL')
    expect(NOMINATIM_FORBIDDEN).toContain('README')
  })
  it('geocode throws on 403 and does not cache it', async () => {
    const l = loc()
    stub({}, () => new Response('blocked', { status: 403 }))
    await expect(geocode(l, { sleep })).rejects.toThrow(/refused/)
    stub({})
    expect(await geocode(l, { sleep })).toMatchObject({ lat: 30.27 })
  })
  it('other geocode failures (429, 500) keep the vague message', async () => {
    for (const status of [429, 500]) {
      stub({}, () => new Response('x', { status }))
      const r = await searchBusinesses({ location: loc(), category: 'cafes', radiusKm: 5, limit: 10 }, { sleep })
      expect(r).toEqual({ error: 'Location lookup failed. Please try again.', status: 502 })
    }
  })
  it('the request carries no placeholder e-mail when LEADS_CONTACT_EMAIL is unset', async () => {
    stub({})
    await searchBusinesses({ location: loc(), category: 'cafes', radiusKm: 5, limit: 10 }, { sleep })
    expect(calls.every((c) => !c.includes('example.com') && !c.includes('email='))).toBe(true)
  })
})
