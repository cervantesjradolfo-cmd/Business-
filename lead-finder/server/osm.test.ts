// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NOMINATIM_FORBIDDEN, OVERPASS_FALLBACK_NOTICE, clearOverpassCache, geocode, overpassSearch, searchBusinesses } from './osm'
import { GEOAPIFY_URL } from '../src/lib/geoapify'

const okJson = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } })
const geo = [{ lat: '30.27', lon: '-97.74', display_name: 'Austin, TX' }]
const elements = { elements: [{ type: 'node', id: 1, lat: 30.271, lon: -97.741, tags: { name: 'Beans', amenity: 'cafe' } }] }

let calls: string[]
beforeEach(() => { calls = []; clearOverpassCache() })
afterEach(() => { vi.unstubAllGlobals() })

function stub(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(String(url))
    return handler(String(url), init)
  }))
}

describe('overpassSearch', () => {
  const never = (init?: RequestInit) =>
    new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
  const okResult = (r: Awaited<ReturnType<typeof overpassSearch>>) => (r.ok ? r.mirror : 'FAILED')
  const savedUrls = process.env.OVERPASS_URLS
  afterEach(() => {
    if (savedUrls === undefined) delete process.env.OVERPASS_URLS
    else process.env.OVERPASS_URLS = savedUrls
  })

  it('returns the first good answer and aborts the slower mirrors', async () => {
    const signals: AbortSignal[] = []
    stub((url, init) => {
      if (url.includes('overpass-api.de')) {
        signals.push(init!.signal as AbortSignal)
        return never(init) as Promise<Response>
      }
      return okJson(elements)
    })
    const r = await overpassSearch('q')
    expect(okResult(r)).toContain('maps.mail.ru')
    expect(calls).toHaveLength(4)
    expect(signals[0].aborted).toBe(true)
  })
  it('ignores a remark with no elements and accepts a remark with elements', async () => {
    stub((url) => (url.includes('overpass-api.de') ? okJson({ remark: 'runtime error', elements: [] }) : okJson({ remark: 'partial', ...elements })))
    expect(okResult(await overpassSearch('q'))).toContain('maps.mail.ru')
  })
  it('accepts a valid empty result', async () => {
    stub(() => okJson({ elements: [] }))
    expect((await overpassSearch('q')).ok).toBe(true)
  })
  it('reports one diagnostic per mirror, in order, when all fail', async () => {
    stub((url) => {
      if (url.includes('overpass-api.de')) throw new DOMException('t', 'TimeoutError')
      if (url.includes('maps.mail.ru')) throw new Error('down')
      if (url.includes('kumi')) return new Response('x', { status: 503 })
      return new Response('<html>', { status: 200 })
    })
    const r = await overpassSearch('secret query')
    expect(r).toEqual({
      ok: false,
      diagnostics: [
        { host: 'overpass-api.de', outcome: 'timeout' },
        { host: 'maps.mail.ru', outcome: 'network_error' },
        { host: 'overpass.kumi.systems', outcome: 'http_error', status: 503 },
        { host: 'overpass.private.coffee', outcome: 'bad_response' },
      ],
    })
    expect(JSON.stringify(r)).not.toContain('secret')
  })
  it('retries a 429 once after the Retry-After wait', async () => {
    process.env.OVERPASS_URLS = 'https://a.example/api'
    let n = 0
    stub(() => (++n === 1 ? new Response('busy', { status: 429, headers: { 'retry-after': '2' } }) : okJson(elements)))
    const sleep = vi.fn(async (_ms: number) => {})
    const r = await overpassSearch('q', { deps: { sleep } })
    expect(r.ok).toBe(true)
    expect(sleep).toHaveBeenCalledWith(2000)
    expect(calls).toHaveLength(2)
  })
  it('caps the wait at 3 s, defaults to 1 s, and records a second 429', async () => {
    process.env.OVERPASS_URLS = 'https://a.example/api'
    stub(() => new Response('busy', { status: 504, headers: { 'retry-after': '120' } }))
    const sleep = vi.fn(async (_ms: number) => {})
    const r = await overpassSearch('q', { deps: { sleep } })
    expect(sleep).toHaveBeenCalledWith(3000)
    expect(r).toEqual({ ok: false, diagnostics: [{ host: 'a.example', outcome: 'http_error', status: 504, retried: true }] })
    stub(() => new Response('busy', { status: 429 }))
    await overpassSearch('q2', { deps: { sleep } })
    expect(sleep).toHaveBeenLastCalledWith(1000)
  })
  it('does not retry 503, or when there is no time left', async () => {
    process.env.OVERPASS_URLS = 'https://a.example/api'
    stub(() => new Response('x', { status: 503 }))
    const sleep = vi.fn(async (_ms: number) => {})
    await overpassSearch('q', { deps: { sleep } })
    expect(calls).toHaveLength(1)
    stub(() => new Response('x', { status: 429 }))
    const r = await overpassSearch('q2', { deadline: Date.now() + 5500, deps: { sleep } })
    expect(sleep).not.toHaveBeenCalled()
    expect(r).toEqual({ ok: false, diagnostics: [{ host: 'a.example', outcome: 'http_error', status: 429 }] })
  })
  it('makes no retry request when another mirror wins during the wait', async () => {
    process.env.OVERPASS_URLS = 'https://a.example/api,https://b.example/api'
    stub((url) => (url.includes('a.example') ? new Response('busy', { status: 429 }) : okJson(elements)))
    let release!: () => void
    const sleep = () => new Promise<void>((r) => { release = r })
    const r = await overpassSearch('q', { deps: { sleep } })
    expect(okResult(r)).toContain('b.example')
    release()
    await new Promise((r) => setTimeout(r, 0))
    expect(calls).toHaveLength(2)
  })
  it('caches successes for 10 minutes, but not failures', async () => {
    let t = 1_000_000
    const deps = { now: () => t }
    stub(() => okJson(elements))
    await overpassSearch('same', { deps })
    await overpassSearch('same', { deps })
    expect(calls).toHaveLength(4)
    t += 10 * 60_000 + 1
    await overpassSearch('same', { deps })
    expect(calls).toHaveLength(8)
    calls = []
    stub(() => new Response('x', { status: 500 }))
    await overpassSearch('bad', { deps })
    await overpassSearch('bad', { deps })
    expect(calls).toHaveLength(8)
  })
  it('uses OVERPASS_URLS when set', async () => {
    process.env.OVERPASS_URLS = 'https://mine.example/api'
    stub(() => okJson(elements))
    const r = await overpassSearch('q')
    expect(okResult(r)).toBe('https://mine.example/api')
    expect(calls).toEqual(['https://mine.example/api'])
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
    expect('leads' in r && r.notice).toBe(OVERPASS_FALLBACK_NOTICE)
    expect('leads' in r && r.diagnostics?.map((d) => d.host)).toEqual([
      'overpass-api.de', 'maps.mail.ru', 'overpass.kumi.systems', 'overpass.private.coffee',
    ])
    expect('leads' in r && r.leads[0].name).toBe('Fallback Cafe')
    // geocode + search are two Nominatim requests; the second must wait
    expect(sleep).toHaveBeenCalled()
    expect(sleep.mock.calls.at(-1)![0]).toBeGreaterThan(0)
  })
  it('skips Overpass entirely when skipOverpass is set', async () => {
    stub((url) => {
      if (url.includes('extratags')) {
        return okJson([{ osm_type: 'node', osm_id: 8, lat: '30.271', lon: '-97.741', category: 'amenity', type: 'cafe', name: 'Quick Cafe' }])
      }
      if (url.includes('nominatim')) return okJson(geo)
      throw new Error('Overpass must not be called')
    })
    const r = await searchBusinesses({ location: 'Skip City', category: 'cafes', radiusKm: 5, limit: 10, skipOverpass: true }, { sleep: async () => {} })
    expect('leads' in r && r.source).toBe('nominatim')
    expect('leads' in r && r.leads[0].name).toBe('Quick Cafe')
    expect('leads' in r && r.diagnostics).toEqual([])
    expect(calls.every((u) => u.includes('nominatim'))).toBe(true)
  })
  it('stops starting fallback terms when the time budget is used up', async () => {
    stub((url) => (url.includes('nominatim') ? okJson(geo) : new Response('no', { status: 500 })))
    let t = 0
    const now = () => t
    const sleep = vi.fn(async () => { t += 60_000 })
    const r = await searchBusinesses({ location: 'Budget Town', category: 'cafes', radiusKm: 5, limit: 10 }, { sleep, now })
    expect(r).toMatchObject({ status: 502 })
    expect(calls.some((c) => c.includes('extratags'))).toBe(false)
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

describe('Geoapify', () => {
  const saved = process.env.GEOAPIFY_API_KEY
  afterEach(() => {
    if (saved === undefined) delete process.env.GEOAPIFY_API_KEY
    else process.env.GEOAPIFY_API_KEY = saved
  })
  const geoFeature = { features: [{ properties: { lat: 30.271, lon: -97.741, datasource: { raw: { osm_type: 'n', osm_id: 9, name: 'Geo Cafe', amenity: 'cafe' } } } }] }

  it('uses Geoapify first when a key is set, without touching Overpass', async () => {
    process.env.GEOAPIFY_API_KEY = ' test-key '
    stub((url) => (url.startsWith(GEOAPIFY_URL) ? okJson(geoFeature) : url.includes('nominatim') ? okJson(geo) : Promise.reject(new Error('Overpass must not be called'))))
    const r = await searchBusinesses({ location: 'Geo City', category: 'cafes', radiusKm: 5, limit: 10 }, { sleep: async () => {} })
    expect('leads' in r && r.source).toBe('geoapify')
    expect('leads' in r && r.leads.map((l) => l.name)).toEqual(['Geo Cafe'])
    const geoCall = calls.find((u) => u.startsWith(GEOAPIFY_URL))!
    expect(new URL(geoCall).searchParams.get('apiKey')).toBe('test-key')
  })

  it('falls back to Overpass when Geoapify fails, and never logs the key', async () => {
    process.env.GEOAPIFY_API_KEY = 'secret-key'
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    stub((url) => (url.startsWith(GEOAPIFY_URL) ? new Response('{"error":"Unauthorized"}', { status: 401 }) : url.includes('nominatim') ? okJson(geo) : okJson(elements)))
    const r = await searchBusinesses({ location: 'Geo Fail City', category: 'cafes', radiusKm: 5, limit: 10 }, { sleep: async () => {} })
    expect('leads' in r && r.source).toBe('overpass')
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret-key')
    warn.mockRestore()
  })

  it('is skipped entirely without a key', async () => {
    delete process.env.GEOAPIFY_API_KEY
    stub((url) => (url.includes('nominatim') ? okJson(geo) : okJson(elements)))
    await searchBusinesses({ location: 'No Key City', category: 'cafes', radiusKm: 5, limit: 10 }, { sleep: async () => {} })
    expect(calls.some((u) => u.startsWith(GEOAPIFY_URL))).toBe(false)
  })
})
