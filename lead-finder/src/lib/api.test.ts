import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiUnavailableError, auditLeads, fetchPitch, searchLeads } from './api'
import type { PitchRequest, SearchRequest } from './types'

const req: SearchRequest = { location: 'Austin', category: 'cafes', radiusKm: 5, limit: 10 }
const pitchReq: PitchRequest = {
  lead: { name: 'Acme Cafe', category: 'Cafe' }, gaps: ['no_website'], services: ['website'],
  sender: { name: '', business: '', email: '', phone: '', address: '', website: '' },
}
const res = (body: unknown, status = 200, type = 'application/json') =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': type } })

afterEach(() => vi.unstubAllGlobals())

describe('access key', () => {
  afterEach(() => window.localStorage.clear())
  it('sends x-access-key only when one is stored', async () => {
    const f = vi.fn(async () => res({ leads: [], source: 'overpass' }))
    vi.stubGlobal('fetch', f)
    await searchLeads(req)
    expect((f.mock.calls[0] as unknown as [string, RequestInit])[1].headers).not.toHaveProperty('x-access-key')
    window.localStorage.setItem('leadfinder:accessKey', 'k1')
    await searchLeads(req)
    expect((f.mock.calls[1] as unknown as [string, RequestInit])[1].headers).toMatchObject({ 'x-access-key': 'k1' })
  })
  it('turns a 401 into a message that points at Your details', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res({ error: 'Access key required' }, 401)))
    await expect(searchLeads(req)).rejects.toThrow(/Access key required.*Your details/)
  })
  it('falls back to the template pitch on a 401', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res({ error: 'Access key required' }, 401)))
    expect((await fetchPitch(pitchReq)).source).toBe('template')
  })
})

describe('api client', () => {
  it('returns parsed JSON on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res({ leads: [], source: 'overpass' })))
    expect((await searchLeads(req)).source).toBe('overpass')
  })

  it('throws ApiUnavailableError for a rejected fetch, 404/405 without JSON, and HTML bodies', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('x') }))
    await expect(searchLeads(req)).rejects.toBeInstanceOf(ApiUnavailableError)
    vi.stubGlobal('fetch', vi.fn(async () => res('nf', 404, 'text/plain')))
    await expect(searchLeads(req)).rejects.toBeInstanceOf(ApiUnavailableError)
    vi.stubGlobal('fetch', vi.fn(async () => res({ error: 'x' }, 405)))
    await expect(searchLeads(req)).rejects.toBeInstanceOf(ApiUnavailableError)
    vi.stubGlobal('fetch', vi.fn(async () => res('<html>', 200, 'text/html')))
    await expect(searchLeads(req)).rejects.toBeInstanceOf(ApiUnavailableError)
  })

  it('throws the server error message for JSON errors, including a JSON 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res({ error: 'Unknown category' }, 400)))
    await expect(searchLeads(req)).rejects.toThrow('Unknown category')
    vi.stubGlobal('fetch', vi.fn(async () => res({ error: 'Not here' }, 404)))
    const err = await searchLeads(req).catch((e) => e)
    expect(err).not.toBeInstanceOf(ApiUnavailableError)
    expect(err.message).toBe('Not here')
    vi.stubGlobal('fetch', vi.fn(async () => res({}, 500)))
    await expect(searchLeads(req)).rejects.toThrow('Something went wrong')
  })

  it('rethrows abort rejections as-is', async () => {
    const ctrl = new AbortController()
    const abortErr = new DOMException('aborted', 'AbortError')
    vi.stubGlobal('fetch', vi.fn(async () => { ctrl.abort(); throw abortErr }))
    await expect(searchLeads(req, ctrl.signal)).rejects.toBe(abortErr)
  })

  it('auditLeads returns [] on errors but rethrows abort', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res({ error: 'boom' }, 500)))
    expect(await auditLeads([{ id: 'a', website: 'x.com' }])).toEqual([])
    const ctrl = new AbortController()
    vi.stubGlobal('fetch', vi.fn(async () => { ctrl.abort(); throw new DOMException('a', 'AbortError') }))
    await expect(auditLeads([{ id: 'a', website: 'x.com' }], ctrl.signal)).rejects.toBeTruthy()
  })

  it('fetchPitch falls back to a template on failure and never throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('x') }))
    const p = await fetchPitch(pitchReq)
    expect(p.source).toBe('template')
    expect(p.email.subject).toBe('Quick idea for Acme Cafe')
  })
})
