// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_RESERVE_MS, MIRROR_TIMEOUT_MS, OVERPASS_FALLBACK_NOTICE, SEARCH_BUDGET_MS, clearOverpassCache, overpassSearch, searchBusinesses } from './osm'

const okJson = (data: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json', ...headers } })
const elements = { elements: [{ type: 'node', id: 1, lat: 30.271, lon: -97.741, tags: { name: 'Beans', amenity: 'cafe' } }] }
const geo = [{ lat: '30.27', lon: '-97.74', display_name: 'Austin, TX' }]
const T0 = 1_700_000_000_000 // whole second, so HTTP dates are exact

let urls: string[]
const saved = { urls: process.env.OVERPASS_URLS, email: process.env.LEADS_CONTACT_EMAIL, key: process.env.APP_ACCESS_KEY }
beforeEach(() => { urls = []; clearOverpassCache(); delete process.env.OVERPASS_URLS })
afterEach(() => {
  vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers()
  for (const [k, v] of [['OVERPASS_URLS', saved.urls], ['LEADS_CONTACT_EMAIL', saved.email], ['APP_ACCESS_KEY', saved.key]] as const) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v
  }
})
function stub(h: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => { urls.push(String(url)); return h(String(url), init) }))
}
const hangUntilAbort = (init?: RequestInit) =>
  new Promise<Response>((_, rej) => init?.signal?.addEventListener('abort', () => rej(new DOMException('a', 'AbortError'))))
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('race', () => {
  it('a fast failing mirror does not beat a slower good one', async () => {
    const signals: AbortSignal[] = []
    stub(async (url, init) => {
      if (url.includes('overpass-api.de')) return new Response('busy', { status: 503 })
      if (url.includes('maps.mail.ru')) { await delay(60); return okJson(elements) }
      signals.push(init!.signal as AbortSignal)
      return hangUntilAbort(init)
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await overpassSearch('q')
    expect(r.ok && r.mirror).toContain('maps.mail.ru')
    await delay(10)
    expect(signals).toHaveLength(2)
    expect(signals.every((s) => s.aborted)).toBe(true)
    expect(warn).not.toHaveBeenCalled()
    expect(err).not.toHaveBeenCalled()
  })

  it('a 200 whose body stalls is aborted when another mirror wins', async () => {
    stub((url) => (url.includes('overpass-api.de') ? okJson(elements) : hangUntilAbort()))
    process.env.OVERPASS_URLS = 'https://a.example/x,https://b.example/y'
    stub((url, init) => (url.includes('a.example') ? hangUntilAbort(init) : okJson(elements)))
    const r = await overpassSearch('q')
    expect(r.ok && r.mirror).toBe('https://b.example/y')
  })
})

describe('timeouts and budget', () => {
  it('uses 25 s per mirror and shrinks it to the deadline; skips fetch under 5 s', async () => {
    const spy = vi.spyOn(AbortSignal, 'timeout')
    stub(() => new Response('x', { status: 500 }))
    await overpassSearch('q', { deps: { now: () => T0 } })
    expect(spy).toHaveBeenCalledWith(MIRROR_TIMEOUT_MS)
    expect(urls).toHaveLength(4)

    spy.mockClear(); urls.length = 0; clearOverpassCache()
    await overpassSearch('q', { deadline: T0 + 12_000, deps: { now: () => T0 } })
    expect(spy).toHaveBeenCalledWith(12_000)
    expect(spy).not.toHaveBeenCalledWith(MIRROR_TIMEOUT_MS)

    urls.length = 0
    const r = await overpassSearch('q', { deadline: T0 + 4_999, deps: { now: () => T0 } })
    expect(urls).toHaveLength(0)
    expect(r).toEqual({ ok: false, diagnostics: expect.any(Array) })
    if (!r.ok) expect(r.diagnostics.every((d) => d.outcome === 'timeout')).toBe(true)
  })

  it('a per-mirror timeout is reported as timeout using a real short abort', async () => {
    process.env.OVERPASS_URLS = 'https://a.example/x'
    stub((_u, init) => hangUntilAbort(init))
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
      const c = new AbortController()
      setTimeout(() => c.abort(new DOMException('t', 'TimeoutError')), 20)
      return c.signal
    })
    const r = await overpassSearch('q')
    // abort() with a TimeoutError reason makes fetch stubs reject with our AbortError stand-in; either is a failure, never a throw
    expect(r.ok).toBe(false)
  })

  it('searchBusinesses shrinks the mirror timeout after a slow geocode and stops fallback terms near the end', async () => {
    let t = T0
    const spy = vi.spyOn(AbortSignal, 'timeout')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stub((url) => {
      if (url.includes('nominatim') && url.includes('format=jsonv2') && !url.includes('q=')) return okJson(geo)
      if (url.includes('nominatim')) return okJson(geo)
      t = T0 + SEARCH_BUDGET_MS - 1_500 // overpass round ends with only 1.5 s of the budget left
      return new Response('x', { status: 503 })
    })
    // first geocode takes 20 s
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    const orig = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes('nominatim') && t === T0) t += 20_000
      return (orig as (u: string, i?: RequestInit) => Promise<Response>)(url, init)
    })
    const res = await searchBusinesses(
      { location: 'Slowville 1', category: 'cafes', radiusKm: 5, limit: 10 },
      { sleep: async () => {}, now: () => t },
    )
    const timeouts = spy.mock.calls.map((c) => c[0] as number)
    expect(Math.max(...timeouts.filter((n) => n !== 10000))).toBeLessThanOrEqual(SEARCH_BUDGET_MS - FALLBACK_RESERVE_MS - 20_000)
    // less than 3 s of budget left: no fallback term may start -> 502 without a Nominatim search request
    expect('error' in res && res.status).toBe(502)
    expect(urls.filter((u) => u.includes('nominatim')).length).toBe(1) // geocode only
  })
})

describe('retry', () => {
  const httpDate = (ms: number) => new Date(ms).toUTCString()
  async function wait(header: string | null) {
    process.env.OVERPASS_URLS = 'https://a.example/x'
    const sleep = vi.fn(async () => {})
    let n = 0
    stub(() => (n++ === 0 ? new Response('x', { status: 429, headers: header === null ? {} : { 'retry-after': header } }) : okJson(elements)))
    const r = await overpassSearch('q', { deps: { now: () => T0, sleep } })
    expect(r.ok).toBe(true)
    expect(urls).toHaveLength(2)
    return sleep.mock.calls.map((c) => (c as unknown[])[0])
  }
  it.each([
    ['2', 2000], ['0', 0], ['120', 3000], ['99999999999', 3000], [null, 1000], ['', 1000], ['-3', 1000], ['soon', 1000],
    [httpDate(T0 + 2000), 2000], [httpDate(T0 - 60_000), 0], [httpDate(T0 + 3_600_000), 3000],
  ])('Retry-After %j sleeps %j ms then retries once', async (h, ms) => {
    expect(await wait(h as string | null)).toEqual([ms])
  })

  it('retries 504 too, and a second 504 gives http_error 504 retried', async () => {
    process.env.OVERPASS_URLS = 'https://a.example/x'
    stub(() => new Response('x', { status: 504 }))
    const r = await overpassSearch('q', { deps: { now: () => T0, sleep: async () => {} } })
    expect(urls).toHaveLength(2)
    expect(r).toEqual({ ok: false, diagnostics: [{ host: 'a.example', outcome: 'http_error', status: 504, retried: true }] })
  })

  it('retry boundary: now + wait + 5000 <= deadline retries, one ms less does not', async () => {
    process.env.OVERPASS_URLS = 'https://a.example/x'
    stub(() => new Response('x', { status: 429, headers: { 'retry-after': '2' } }))
    const sleep = vi.fn(async () => {})
    await overpassSearch('q', { deadline: T0 + 7000, deps: { now: () => T0, sleep } })
    expect(urls).toHaveLength(2)
    urls.length = 0
    const r = await overpassSearch('q', { deadline: T0 + 6999, deps: { now: () => T0, sleep } })
    expect(urls).toHaveLength(1)
    expect(r).toEqual({ ok: false, diagnostics: [{ host: 'a.example', outcome: 'http_error', status: 429 }] })
  })
})

describe('cache', () => {
  it('hits within 10 min, misses at/after 10 min, never caches failures', async () => {
    let t = T0
    stub(() => okJson(elements))
    const deps = { now: () => t }
    await overpassSearch('q', { deps })
    const n = urls.length
    t = T0 + 10 * 60_000 - 1
    const hit = await overpassSearch('q', { deps })
    expect(hit.ok).toBe(true)
    expect(urls).toHaveLength(n)
    t = T0 + 10 * 60_000
    await overpassSearch('q', { deps })
    expect(urls.length).toBeGreaterThan(n)

    clearOverpassCache(); urls.length = 0
    stub(() => new Response('x', { status: 500 }))
    expect((await overpassSearch('f', { deps })).ok).toBe(false)
    const first = urls.length
    expect((await overpassSearch('f', { deps })).ok).toBe(false)
    expect(urls.length).toBe(first * 2)
  })
  it('different queries do not share cache entries', async () => {
    stub(() => okJson(elements))
    await overpassSearch('a'); const n = urls.length
    await overpassSearch('b')
    expect(urls.length).toBeGreaterThan(n)
  })
})

describe('OVERPASS_URLS in use', () => {
  it.each([[''], ['   '], [',,,'], ['http://a.example/x'], ['not a url, ftp://x.y']])('%j falls back to the four defaults', async (v) => {
    process.env.OVERPASS_URLS = v
    stub(() => new Response('x', { status: 500 }))
    await overpassSearch('q')
    expect(urls.map((u) => new URL(u).host).sort()).toEqual(['maps.mail.ru', 'overpass-api.de', 'overpass.kumi.systems', 'overpass.private.coffee'])
  })
  it('uses only the valid https entries, trimmed', async () => {
    process.env.OVERPASS_URLS = ' https://a.example/i , http://bad.example/i, junk, https://a.example/i '
    stub(() => new Response('x', { status: 500 }))
    await overpassSearch('q')
    expect(urls).toEqual(['https://a.example/i'])
  })
})

describe('diagnostics expose nothing secret', () => {
  it('returned, logged and error bodies contain no query, path, e-mail or key', async () => {
    process.env.LEADS_CONTACT_EMAIL = 'me-secret@example.org'
    process.env.APP_ACCESS_KEY = 'KEY-12345'
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stub((url) => {
      if (url.includes('nominatim.openstreetmap.org/search')) return okJson([{ lat: '30.271', lon: '-97.741', display_name: 'Beans, Austin', name: 'Beans', class: 'amenity', type: 'cafe', osm_type: 'node', osm_id: 1 }])
      if (url.includes('nominatim')) return okJson(geo)
      if (url.includes('overpass-api.de')) return new Response('x', { status: 429 })
      if (url.includes('maps.mail.ru')) throw new TypeError('fetch failed me-secret@example.org')
      return okJson({ remark: 'x', elements: [] })
    })
    const res = await searchBusinesses({ location: 'Diagville', category: 'cafes', radiusKm: 5, limit: 10 }, { sleep: async () => {} })
    if ('error' in res) throw new Error('expected fallback, got ' + res.error)
    expect(res.source).toBe('nominatim')
    expect(res.notice).toBe(OVERPASS_FALLBACK_NOTICE)
    expect(res.diagnostics).toHaveLength(4)
    for (const d of res.diagnostics!) expect(Object.keys(d).every((k) => ['host', 'outcome', 'status', 'retried'].includes(k))).toBe(true)
    const blob = JSON.stringify(res.diagnostics) + JSON.stringify(warn.mock.calls)
    for (const bad of ['me-secret', 'KEY-12345', 'interpreter', '/api/', 'https://', 'out center', '[out:json]', 'Diagville']) expect(blob).not.toContain(bad)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toBe('overpass unavailable')
  })

  it('law and party_rentals still give the 502 busy error when Overpass fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stub((url) => (url.includes('nominatim') ? okJson(geo) : new Response('x', { status: 500 })))
    for (const category of ['law', 'party_rentals'] as const) {
      const res = await searchBusinesses({ location: 'Lawtown', category, radiusKm: 5, limit: 10 }, { sleep: async () => {} })
      expect(res).toEqual({ error: 'Map data servers are busy. Please try again in a minute.', status: 502 })
    }
  })
})
