// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NOMINATIM_FORBIDDEN, geocode, overpassSearch, searchBusinesses } from './osm'

const okJson = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } })
const geo = [{ lat: '30.27', lon: '-97.74', display_name: 'Austin, TX' }]
const elements = { elements: [{ type: 'node', id: 1, lat: 30.271, lon: -97.741, tags: { name: 'Beans', amenity: 'cafe' } }] }

let calls: string[]
beforeEach(() => { calls = [] })
afterEach(() => { vi.unstubAllGlobals() })

function stub(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(String(url))
    return handler(String(url), init)
  }))
}

describe('overpassSearch', () => {
  it('uses mirror 2 when mirror 1 fails', async () => {
    stub((url) => {
      if (url.includes('overpass-api.de')) return new Response('busy', { status: 429 })
      return okJson(elements)
    })
    const r = await overpassSearch('q')
    expect(r?.mirror).toContain('kumi.systems')
    expect(calls).toHaveLength(2)
  })
  it('treats a remark with no elements as failure and a remark with elements as success', async () => {
    stub((url) => (url.includes('overpass-api.de') ? okJson({ remark: 'timeout', elements: [] }) : okJson({ remark: 'partial', ...elements })))
    expect((await overpassSearch('q'))?.mirror).toContain('kumi.systems')
  })
  it('returns null when all mirrors fail', async () => {
    stub(() => { throw new Error('down') })
    expect(await overpassSearch('q')).toBeNull()
    expect(calls).toHaveLength(3)
  })
})

describe('searchBusinesses', () => {
  it('returns overpass results', async () => {
    stub((url) => (url.includes('nominatim') ? okJson(geo) : okJson(elements)))
    const sleep = vi.fn(async () => {})
    const r = await searchBusinesses({ location: 'Austin', category: 'cafes', radiusKm: 5, limit: 10 }, { sleep })
    expect('leads' in r && r.source).toBe('overpass')
    expect('leads' in r && r.leads[0].name).toBe('Beans')
  })
  it('falls back to Nominatim with a notice and throttles between requests', async () => {
    stub((url) => {
      if (url.includes('overpass') || url.includes('maps.mail.ru')) return new Response('no', { status: 500 })
      if (url.includes('extratags')) {
        return okJson([{ osm_type: 'node', osm_id: 7, lat: '30.271', lon: '-97.741', category: 'amenity', type: 'cafe', name: 'Fallback Cafe' }])
      }
      return okJson(geo)
    })
    const sleep = vi.fn(async (_ms: number) => {})
    const r = await searchBusinesses({ location: 'Fallback City', category: 'cafes', radiusKm: 5, limit: 10 }, { sleep })
    expect('leads' in r && r.source).toBe('nominatim')
    expect('leads' in r && r.notice).toContain('Map servers were busy')
    expect('leads' in r && r.leads[0].name).toBe('Fallback Cafe')
    // geocode + search are two Nominatim requests; the second must wait
    expect(sleep).toHaveBeenCalled()
    expect(sleep.mock.calls.at(-1)![0]).toBeGreaterThan(0)
  })
  it('404 when the location is not found, 502 when geocoding fails', async () => {
    stub(() => okJson([]))
    const r = await searchBusinesses({ location: 'Nowhere Land', category: 'any', radiusKm: 5, limit: 10 }, { sleep: async () => {} })
    expect(r).toMatchObject({ status: 404 })
    stub(() => new Response('x', { status: 500 }))
    const r2 = await searchBusinesses({ location: 'Broken Town', category: 'any', radiusKm: 5, limit: 10 }, { sleep: async () => {} })
    expect(r2).toMatchObject({ status: 502 })
  })
  it('502 when everything fails', async () => {
    stub((url) => (url.includes('q=') && !url.includes('extratags') ? okJson(geo) : new Response('x', { status: 500 })))
    const r = await searchBusinesses({ location: 'Everything Fails', category: 'any', radiusKm: 5, limit: 10 }, { sleep: async () => {} })
    expect(r).toMatchObject({ status: 502, error: 'Map data servers are busy. Please try again in a minute.' })
  })
  it('caches geocodes', async () => {
    stub((url) => (url.includes('nominatim') ? okJson(geo) : okJson(elements)))
    const req = { location: 'Cache Town', category: 'cafes' as const, radiusKm: 5, limit: 10 }
    await searchBusinesses(req, { sleep: async () => {} })
    await searchBusinesses(req, { sleep: async () => {} })
    expect(calls.filter((c) => c.includes('nominatim'))).toHaveLength(1)
  })
})

describe('Nominatim 403 and User-Agent', () => {
  const saved = process.env.LEADS_CONTACT_EMAIL
  afterEach(() => {
    if (saved === undefined) delete process.env.LEADS_CONTACT_EMAIL
    else process.env.LEADS_CONTACT_EMAIL = saved
  })
  it('maps a Nominatim 403 to a specific message', async () => {
    stub(() => new Response('blocked', { status: 403 }))
    const r = await searchBusinesses({ location: 'Forbidden Town', category: 'any', radiusKm: 5, limit: 10 }, { sleep: async () => {} })
    expect(r).toMatchObject({ status: 502, error: 'OpenStreetMap refused the request. Set LEADS_CONTACT_EMAIL to your own e-mail (see README).' })
    expect(NOMINATIM_FORBIDDEN).toContain('LEADS_CONTACT_EMAIL')
    await expect(geocode('Forbidden Town 2', { sleep: async () => {} })).rejects.toThrow(/OpenStreetMap refused/)
  })
  it('keeps the vague message for other geocode failures', async () => {
    stub(() => new Response('x', { status: 500 }))
    const r = await searchBusinesses({ location: 'Error Town', category: 'any', radiusKm: 5, limit: 10 }, { sleep: async () => {} })
    expect(r).toMatchObject({ status: 502, error: 'Location lookup failed. Please try again.' })
  })
  it('sends no placeholder e-mail when LEADS_CONTACT_EMAIL is unset', async () => {
    delete process.env.LEADS_CONTACT_EMAIL
    let ua = ''
    let url = ''
    stub((u, init) => {
      url = u
      ua = ((init?.headers ?? {}) as Record<string, string>)['User-Agent']
      return okJson(geo)
    })
    await geocode('UA Town Unset', { sleep: async () => {} })
    expect(ua).toBe('LeadFinder/1.0')
    expect(ua).not.toContain('example.com')
    expect(new URL(url).searchParams.has('email')).toBe(false)
  })
  it('puts the configured e-mail in the User-Agent and the email param', async () => {
    process.env.LEADS_CONTACT_EMAIL = 'me@mybiz.test'
    let ua = ''
    let url = ''
    stub((u, init) => {
      url = u
      ua = ((init?.headers ?? {}) as Record<string, string>)['User-Agent']
      return okJson(geo)
    })
    await geocode('UA Town Set', { sleep: async () => {} })
    expect(ua).toContain('me@mybiz.test')
    expect(new URL(url).searchParams.get('email')).toBe('me@mybiz.test')
  })
})

describe('Nominatim fallback terms', () => {
  const overpassDown = (url: string) => url.includes('overpass') || url.includes('maps.mail.ru')
  const item = (id: number, name: string, type: string, extra: Record<string, string> = {}) => ({
    osm_type: 'node', osm_id: id, lat: '30.271', lon: '-97.741', category: 'shop', type, name, extratags: extra,
  })

  it('searches the category terms in order, one request each, merging results', async () => {
    const qs: string[] = []
    stub((url) => {
      if (overpassDown(url)) return new Response('no', { status: 500 })
      if (url.includes('extratags')) {
        const q = new URL(url).searchParams.get('q')!
        qs.push(q)
        return okJson(q.startsWith('dry cleaning') ? [item(1, 'Clean Co', 'dry_cleaning')] : [item(2, 'Wash Co', 'laundry')])
      }
      return okJson(geo)
    })
    const r = await searchBusinesses({ location: 'Terms Town', category: 'cleaning', radiusKm: 5, limit: 10 }, { sleep: async () => {} })
    expect(qs).toEqual(['dry cleaning near Terms Town', 'laundry near Terms Town'])
    expect('leads' in r && r.leads.map((l) => l.name).sort()).toEqual(['Clean Co', 'Wash Co'])
  })
  it('stops once the limit is reached', async () => {
    const qs: string[] = []
    stub((url) => {
      if (overpassDown(url)) return new Response('no', { status: 500 })
      if (url.includes('extratags')) {
        qs.push(new URL(url).searchParams.get('q')!)
        return okJson([item(1, 'Clean Co', 'dry_cleaning')])
      }
      return okJson(geo)
    })
    await searchBusinesses({ location: 'Limit Town', category: 'cleaning', radiusKm: 5, limit: 1 }, { sleep: async () => {} })
    expect(qs).toHaveLength(1)
  })
  it('uses hairdresser for barbers and keeps only barbers', async () => {
    const qs: string[] = []
    stub((url) => {
      if (overpassDown(url)) return new Response('no', { status: 500 })
      if (url.includes('extratags')) {
        qs.push(new URL(url).searchParams.get('q')!)
        return okJson([item(1, 'Sharp Cuts', 'hairdresser', { hairdresser: 'barber' }), item(2, 'Fancy Salon', 'hairdresser')])
      }
      return okJson(geo)
    })
    const r = await searchBusinesses({ location: 'Barber Town', category: 'barbers', radiusKm: 5, limit: 10 }, { sleep: async () => {} })
    expect(qs).toEqual(['hairdresser near Barber Town'])
    expect('leads' in r && r.leads.map((l) => l.name)).toEqual(['Sharp Cuts'])
    const s = await searchBusinesses({ location: 'Salon Town', category: 'salons', radiusKm: 5, limit: 10 }, { sleep: async () => {} })
    expect('leads' in s && s.leads.map((l) => l.name)).toEqual(['Fancy Salon'])
  })
  it('returns 502 for a category with no working phrase, without a search request', async () => {
    stub((url) => (overpassDown(url) ? new Response('no', { status: 500 }) : okJson(geo)))
    const r = await searchBusinesses({ location: 'Law Town', category: 'law', radiusKm: 5, limit: 10 }, { sleep: async () => {} })
    expect(r).toMatchObject({ status: 502 })
    expect(calls.some((c) => c.includes('extratags'))).toBe(false)
  })
  it('marks chains in the results', async () => {
    stub((url) => (url.includes('nominatim') ? okJson(geo) : okJson({ elements: [{ type: 'node', id: 1, lat: 30.271, lon: -97.741, tags: { name: 'Starbucks', amenity: 'cafe', brand: 'Starbucks' } }] })))
    const r = await searchBusinesses({ location: 'Chain Town', category: 'cafes', radiusKm: 5, limit: 10 }, { sleep: async () => {} })
    expect('leads' in r && r.leads[0].isChain).toBe(true)
  })
})

describe('drywall name search', () => {
  const nameRow = (id: number, name: string, category: string, type: string) =>
    ({ osm_type: 'node', osm_id: id, lat: '30.272', lon: '-97.742', category, type, name })
  const byTerm: Record<string, unknown[]> = {
    drywall: [nameRow(2, 'Rocky Mountain Drywall', 'office', 'company'), nameRow(1, 'Total Plastering', 'craft', 'plasterer')],
    insulation: [nameRow(3, 'Aurora Insulation Pros', 'craft', 'insulation')],
    acoustic: [nameRow(4, 'Acoustic Guitar Shop', 'shop', 'musical_instrument')],
  }
  const tagged = { elements: [{ type: 'node', id: 1, lat: 30.271, lon: -97.741, tags: { name: 'Total Plastering', craft: 'plasterer' } }] }
  let place = 0
  const req = () => ({ location: `Drywall Town ${++place}`, category: 'drywall' as const, radiusKm: 5, limit: 10 })
  function stubDrywall(overpass: () => Response) {
    stub((url) => {
      const u = new URL(url)
      if (!u.hostname.includes('nominatim')) return overpass()
      if (!u.searchParams.has('bounded')) return okJson(geo)
      return okJson(byTerm[u.searchParams.get('q') ?? ''] ?? [])
    })
  }

  it('adds name matches to the Overpass results, dedupes them and drops other businesses', async () => {
    stubDrywall(() => okJson(tagged))
    const r = await searchBusinesses(req(), { sleep: async () => {} })
    expect('leads' in r && r.source).toBe('overpass')
    expect('leads' in r && r.leads.map((l) => l.name).sort()).toEqual(['Aurora Insulation Pros', 'Rocky Mountain Drywall', 'Total Plastering'])
    const searched = calls.filter((c) => c.includes('bounded=1')).map((c) => new URL(c).searchParams.get('q'))
    expect(searched).toEqual(['drywall', 'acoustic', 'ceiling', 'insulation'])
    expect(calls.find((c) => c.includes('bounded=1'))).toContain('viewbox=')
  })
  it('still returns name matches, with a notice, when every Overpass mirror fails', async () => {
    stubDrywall(() => new Response('busy', { status: 503 }))
    const r = await searchBusinesses(req(), { sleep: async () => {} })
    expect(r).toMatchObject({ source: 'nominatim', notice: expect.stringContaining('name search') })
    expect('leads' in r && r.leads).toHaveLength(3)
  })
  it('says the servers are busy when Overpass and the name search both fail', async () => {
    stub((url) => (new URL(url).searchParams.has('bounded') || !url.includes('nominatim') ? new Response('busy', { status: 503 }) : okJson(geo)))
    const r = await searchBusinesses(req(), { sleep: async () => {} })
    expect(r).toMatchObject({ status: 502, error: 'Map data servers are busy. Please try again in a minute.' })
  })
  it('does not run a name search for categories without name terms', async () => {
    stub((url) => (url.includes('nominatim') ? okJson(geo) : okJson(elements)))
    await searchBusinesses({ location: 'No Name Town', category: 'cafes', radiusKm: 5, limit: 10 }, { sleep: async () => {} })
    expect(calls.some((c) => c.includes('bounded=1'))).toBe(false)
  })
})
