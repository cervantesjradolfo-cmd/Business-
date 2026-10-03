// @vitest-environment node
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const lookup = vi.fn()
vi.mock('node:dns/promises', () => ({ lookup: (...a: unknown[]) => lookup(...a) }))
const httpsRequest = vi.fn()
const httpRequest = vi.fn()
vi.mock('node:https', () => ({ default: { request: (...a: unknown[]) => httpsRequest(...a) }, request: (...a: unknown[]) => httpsRequest(...a) }))
vi.mock('node:http', () => ({ default: { request: (...a: unknown[]) => httpRequest(...a) }, request: (...a: unknown[]) => httpRequest(...a) }))

import { auditWebsite, mapWithConcurrency } from './audit'

type Reply = { status: number; headers?: Record<string, string>; body?: string } | Error
type Opts = { hostname: string; port?: string; path: string; protocol: string; servername?: string; lookup: (h: string, o: object, cb: (e: Error | null, a?: string, f?: number) => void) => void }

// A stand-in for node:http(s).request that, like a real socket, resolves the host through
// options.lookup at connect time and only then answers. `addresses` records what each "socket" got.
let addresses: string[]
let seen: string[]
function stubNet(route: (url: string) => Reply) {
  const impl = (opts: Opts, cb: (res: Readable) => void) => {
    const req = new EventEmitter() as EventEmitter & { end(): void; destroy(): void }
    req.destroy = () => {}
    req.end = () => {
      opts.lookup(opts.hostname, {}, (err, address) => {
        if (err) return void queueMicrotask(() => req.emit('error', err))
        addresses.push(address as string)
        const url = `${opts.protocol}//${opts.hostname}${opts.port ? ':' + opts.port : ''}${opts.path}`
        seen.push(url)
        const r = route(url)
        if (r instanceof Error) return void queueMicrotask(() => req.emit('error', r))
        const res = Readable.from(r.body ? [Buffer.from(r.body)] : []) as Readable & { statusCode: number; headers: Record<string, string> }
        res.statusCode = r.status
        res.headers = { ...(r.headers ?? {}) }
        queueMicrotask(() => cb(res))
      })
    }
    return req
  }
  httpsRequest.mockImplementation(impl)
  httpRequest.mockImplementation(impl)
}

const page = (body: string, status = 200, headers: Record<string, string> = {}): Reply => ({ status, body, headers: { 'content-type': 'text/html', ...headers } })
const redirect = (location: string, status = 302): Reply => ({ status, headers: { location } })

beforeEach(() => {
  lookup.mockReset()
  lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
  httpsRequest.mockReset()
  httpRequest.mockReset()
  addresses = []
  seen = []
})
afterEach(() => { vi.unstubAllGlobals() })

describe('auditWebsite', () => {
  it('skips when DNS resolves to a private address', async () => {
    lookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }])
    stubNet(() => page('x'))
    const r = await auditWebsite('a', 'https://evil.example.com')
    expect(r).toMatchObject({ status: 'skipped', note: 'Address not allowed' })
    expect(seen).toEqual([])
  })
  it('skips when any one of several resolved addresses is private', async () => {
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }, { address: '::ffff:127.0.0.1', family: 6 }])
    stubNet(() => page('x'))
    expect(await auditWebsite('a', 'https://mixed.example.com')).toMatchObject({ status: 'skipped', note: 'Address not allowed' })
    expect(seen).toEqual([])
  })
  it('DNS rebinding: a name that is public the first time and private the next is skipped', async () => {
    // The old design looked the name up twice (check, then fetch's own lookup). Now the connection's
    // own lookup is the check, so a changed answer can never reach the socket. Here the https
    // candidate resolves publicly (and fails to connect); the http candidate re-resolves privately.
    lookup
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockResolvedValue([{ address: '169.254.169.254', family: 4 }])
    stubNet((url) => (url.startsWith('https:') ? new Error('ECONNREFUSED') : page('<html></html>')))
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const r = await auditWebsite('a', 'rebind.example.com')
    expect(r).toMatchObject({ status: 'skipped', note: 'Address not allowed' })
    expect(fetchSpy).not.toHaveBeenCalled() // fetch would resolve DNS on its own
    expect(addresses).toEqual(['93.184.216.34'])
    expect(seen.every((u) => u.startsWith('https:'))).toBe(true)
  })
  it('connects to the address that was checked, with SNI set to the hostname', async () => {
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    stubNet(() => page('<html></html>'))
    await auditWebsite('a', 'https://example.com')
    expect(addresses).toEqual(['93.184.216.34'])
    expect(httpsRequest.mock.calls[0][0].servername).toBe('example.com')
  })
  it('re-checks DNS on every redirect hop (second hop resolves privately)', async () => {
    lookup.mockImplementation(async (host: string) =>
      host === 'internal.example.net' ? [{ address: '192.168.1.5', family: 4 }] : [{ address: '93.184.216.34', family: 4 }])
    stubNet((url) => (url.startsWith('https://example.com') ? redirect('https://internal.example.net/admin') : page('x')))
    const r = await auditWebsite('a', 'https://example.com')
    expect(r).toMatchObject({ status: 'skipped', note: 'Address not allowed' })
    expect(seen).toEqual(['https://example.com/'])
  })
  it('skips a redirect to a private host', async () => {
    stubNet(() => redirect('http://127.0.0.1/admin'))
    const r = await auditWebsite('a', 'https://example.com')
    expect(r).toMatchObject({ status: 'skipped', note: 'Address not allowed' })
  })
  it('skips redirects to IPv4-compatible and NAT64 IPv6 literals and non-http schemes', async () => {
    for (const loc of ['http://[::127.0.0.1]/', 'http://[64:ff9b::7f00:1]/', 'http://[2002:7f00:1::]/', 'http://[::1]/', 'ftp://example.com/x']) {
      stubNet(() => redirect(loc))
      expect(await auditWebsite('a', 'https://example.com'), loc).toMatchObject({ status: 'skipped', note: 'Address not allowed' })
    }
  })
  it('skips junk values', async () => {
    expect(await auditWebsite('a', 'not a url')).toMatchObject({ status: 'skipped', note: "Website value isn't a web address" })
  })
  it('follows a redirect and finds gaps on a 200 page', async () => {
    stubNet((url) => (url.endsWith('/home') ? page('<html><head><title>T</title></head><body>hello</body></html>') : redirect('/home', 301)))
    const r = await auditWebsite('a', 'https://example.com', new Date('2026-06-01'))
    expect(r.status).toBe('ok')
    expect(r.finalUrl).toBe('https://example.com/home')
    expect(r.gaps).toEqual(expect.arrayContaining(['no_mobile_viewport', 'no_online_booking', 'missing_seo_tags']))
    expect(seen[1]).toBe('https://example.com/home')
  })
  it('falls back to http and reports no_https', async () => {
    stubNet((url) => (url.startsWith('https:') ? new Error('tls') : page('<html></html>')))
    const r = await auditWebsite('a', 'example.com')
    expect(r.status).toBe('ok')
    expect(r.finalUrl).toBe('http://example.com/')
    expect(r.gaps).toContain('no_https')
  })
  it('gives unreachable on timeout', async () => {
    stubNet(() => new DOMException('timed out', 'TimeoutError') as unknown as Error)
    const r = await auditWebsite('a', 'https://example.com')
    expect(r).toMatchObject({ status: 'unreachable', note: 'Timed out after 8 s' })
  })
  it('gives unreachable when all candidates fail to connect', async () => {
    stubNet(() => new Error('ECONNREFUSED'))
    expect(await auditWebsite('a', 'example.com')).toMatchObject({ status: 'unreachable' })
  })
  it('gives limited on 403 and for Cloudflare 503', async () => {
    stubNet(() => page('no', 403))
    expect(await auditWebsite('a', 'https://example.com')).toMatchObject({ status: 'limited', httpStatus: 403, gaps: [] })
    stubNet(() => page('no', 503, { 'cf-ray': 'abc' }))
    expect((await auditWebsite('a', 'https://example.com')).status).toBe('limited')
  })
  it('gives unreachable with the HTTP status for other errors', async () => {
    stubNet(() => page('x', 500))
    expect(await auditWebsite('a', 'https://example.com')).toMatchObject({ status: 'unreachable', httpStatus: 500, note: 'HTTP 500' })
  })
  it('fails after too many redirects', async () => {
    stubNet(() => redirect('https://example.com/loop'))
    expect(await auditWebsite('a', 'https://example.com')).toMatchObject({ status: 'unreachable', note: 'Too many redirects' })
  })
  it('runs the gap check on an empty string for non-HTML pages', async () => {
    stubNet(() => ({ status: 200, body: '%PDF', headers: { 'content-type': 'application/pdf' } }))
    const r = await auditWebsite('a', 'https://example.com')
    expect(r.status).toBe('ok')
    expect(r.gaps).toContain('missing_seo_tags')
  })
})

describe('mapWithConcurrency', () => {
  it('never exceeds the limit and keeps order', async () => {
    let active = 0
    let peak = 0
    const out = await mapWithConcurrency([5, 1, 4, 2, 3, 6, 7], 3, async (n) => {
      active++
      peak = Math.max(peak, active)
      await new Promise((r) => setTimeout(r, n))
      active--
      return n * 2
    })
    expect(out).toEqual([10, 2, 8, 4, 6, 12, 14])
    expect(peak).toBeLessThanOrEqual(3)
    expect(peak).toBeGreaterThan(1)
  })
  it('handles an empty list', async () => {
    expect(await mapWithConcurrency([], 4, async (x) => x)).toEqual([])
  })
})
