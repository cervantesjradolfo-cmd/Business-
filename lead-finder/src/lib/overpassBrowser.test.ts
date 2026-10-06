import { describe, expect, it, vi } from 'vitest'
import { browserOverpassSearch } from './overpassBrowser'
import type { SearchRequest } from './types'

const center = { lat: 30.27, lon: -97.74 }
const req: SearchRequest = { location: 'Austin', category: 'cafes', radiusKm: 5, limit: 10 }
const ok = (elements: unknown[]) => new Response(JSON.stringify({ elements }), { status: 200, headers: { 'content-type': 'application/json' } })
const cafe = (id: number, name: string) => ({ type: 'node', id, lat: 30.271, lon: -97.741, tags: { name, amenity: 'cafe' } })
const A = 'https://a.example/api/interpreter'
const B = 'https://b.example/api/interpreter'

describe('browserOverpassSearch', () => {
  it('returns parsed leads from the first mirror that answers', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, _init?: RequestInit) => (String(url) === A ? new Response('busy', { status: 500 }) : ok([cafe(1, 'Beans')])))
    const leads = await browserOverpassSearch(center, req, { mirrors: [A, B], fetchImpl: fetchImpl as typeof fetch })
    expect(leads.leads?.map((l) => l.name)).toEqual(['Beans'])
    const init = fetchImpl.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
    expect(String(init.body)).toMatch(/^data=/)
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/x-www-form-urlencoded')
  })

  it('retries a mirror that answered busy or dropped the connection', async () => {
    let n = 0
    const fetchImpl = vi.fn(async () => {
      n++
      if (n === 1) return new Response('busy', { status: 503 })
      if (n === 2) throw new TypeError('Failed to fetch')
      return ok([cafe(2, 'Third Time')])
    })
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    try {
      const p = browserOverpassSearch(center, req, { mirrors: [A], fetchImpl: fetchImpl as typeof fetch })
      await vi.advanceTimersByTimeAsync(5000)
      expect((await p).leads?.map((l) => l.name)).toEqual(['Third Time'])
    } finally {
      vi.useRealTimers()
    }
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('returns null when every mirror fails', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => (String(url) === A ? new Response('nope', { status: 400 }) : Promise.reject(new TypeError('Failed to fetch'))))
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    try {
      const p = browserOverpassSearch(center, req, { mirrors: [A, B], fetchImpl: fetchImpl as typeof fetch })
      await vi.advanceTimersByTimeAsync(5000)
      expect(await p).toEqual({ leads: null, report: 'a.example: error (400), b.example: blocked or unreachable' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('treats an empty answer with a remark (server-side timeout) as a failure', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ elements: [], remark: 'runtime error: timeout' }), { status: 200 }))
    expect(await browserOverpassSearch(center, req, { mirrors: [A], fetchImpl: fetchImpl as typeof fetch })).toEqual({ leads: null, report: 'a.example: bad answer' })
  })

  it('accepts a genuinely empty answer', async () => {
    const fetchImpl = vi.fn(async () => ok([]))
    expect(await browserOverpassSearch(center, req, { mirrors: [A], fetchImpl: fetchImpl as typeof fetch })).toEqual({ leads: [] })
  })

  it('gives up when the time budget is too short to start', async () => {
    const fetchImpl = vi.fn(async () => ok([cafe(3, 'Late')]))
    expect(await browserOverpassSearch(center, req, { mirrors: [A], fetchImpl: fetchImpl as typeof fetch, timeoutMs: 1000 })).toEqual({ leads: null, report: 'a.example: timed out' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('stops when the caller aborts', async () => {
    const ctrl = new AbortController()
    const fetchImpl = vi.fn((_u: unknown, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    }))
    const p = browserOverpassSearch(center, req, { mirrors: [A, B], fetchImpl: fetchImpl as unknown as typeof fetch, signal: ctrl.signal })
    ctrl.abort()
    expect((await p).leads).toBeNull()
  })
})
