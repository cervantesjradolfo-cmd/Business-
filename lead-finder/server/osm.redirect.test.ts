// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearOverpassCache, overpassSearch } from './osm'

const okJson = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } })
const elements = { elements: [{ type: 'node', id: 1, lat: 30.271, lon: -97.741, tags: { name: 'Beans', amenity: 'cafe' } }] }

const savedUrls = process.env.OVERPASS_URLS
beforeEach(() => { clearOverpassCache(); delete process.env.OVERPASS_URLS })
afterEach(() => {
  vi.unstubAllGlobals()
  if (savedUrls === undefined) delete process.env.OVERPASS_URLS
  else process.env.OVERPASS_URLS = savedUrls
})

// Mimics undici: with redirect 'error' a 3xx makes fetch reject with a TypeError; otherwise it would follow.
function redirectingFetch(redirecting: (url: string) => boolean) {
  const inits: Record<string, RequestInit | undefined> = {}
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    inits[url] = init
    if (redirecting(String(url))) {
      if (init?.redirect === 'error') throw new TypeError('fetch failed', { cause: new Error('unexpected redirect') })
      return okJson(elements) // would have followed the redirect to something internal
    }
    return okJson(elements)
  })
  vi.stubGlobal('fetch', fn)
  return { fn, inits }
}

describe('Overpass redirect guard', () => {
  it('sends redirect: "error" on every mirror request', async () => {
    const { fn } = redirectingFetch(() => false)
    await overpassSearch('q')
    expect(fn.mock.calls.length).toBeGreaterThan(0)
    for (const [, init] of fn.mock.calls) expect((init as RequestInit).redirect).toBe('error')
  })

  it('a redirecting mirror is rejected and the others still win the race', async () => {
    const { inits } = redirectingFetch((u) => u.includes('overpass-api.de'))
    const r = await overpassSearch('q')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.mirror).not.toContain('overpass-api.de')
    expect(inits['https://overpass-api.de/api/interpreter']?.redirect).toBe('error')
  })

  it('shows network_error per mirror in diagnostics when every mirror redirects, without throwing', async () => {
    redirectingFetch(() => true)
    const r = await overpassSearch('secret')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.diagnostics).toHaveLength(4)
      for (const d of r.diagnostics) expect(d.outcome).toBe('network_error')
      expect(r.diagnostics.map((d) => d.host)).toEqual([
        'overpass-api.de',
        'maps.mail.ru',
        'overpass.kumi.systems',
        'overpass.private.coffee',
      ])
    }
  })

  it('a redirect to an internal address is never followed or cached as success', async () => {
    redirectingFetch(() => true)
    await overpassSearch('q')
    const { fn } = redirectingFetch(() => true)
    const again = await overpassSearch('q')
    expect(again.ok).toBe(false)
    expect(fn).toHaveBeenCalled() // failures are not cached
  })
})
