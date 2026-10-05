// @vitest-environment node
// Adversarial SSRF checks: redirects to private targets, IPv6 literal forms, rebinding on a later hop.
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const lookup = vi.fn()
vi.mock('node:dns/promises', () => ({ lookup: (...a: unknown[]) => lookup(...a) }))
const httpsRequest = vi.fn()
const httpRequest = vi.fn()
vi.mock('node:https', () => ({ default: { request: (...a: unknown[]) => httpsRequest(...a) }, request: (...a: unknown[]) => httpsRequest(...a) }))
vi.mock('node:http', () => ({ default: { request: (...a: unknown[]) => httpRequest(...a) }, request: (...a: unknown[]) => httpRequest(...a) }))

import { auditWebsite } from './audit'
import { safeLookup } from './safeRequest'

type Reply = { status: number; headers?: Record<string, string>; body?: string } | Error
type Opts = { hostname: string; port?: string; path: string; protocol: string; lookup: (h: string, o: object, cb: (e: Error | null, a?: string, f?: number) => void) => void }
let seen: string[]
let lookedUp: string[]
function stubNet(route: (url: string) => Reply) {
  const impl = (opts: Opts, cb: (res: Readable) => void) => {
    const req = new EventEmitter() as EventEmitter & { end(): void; destroy(): void }
    req.destroy = () => {}
    req.end = () => {
      opts.lookup(opts.hostname, {}, (err) => {
        if (err) return void queueMicrotask(() => req.emit('error', err))
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
const redirect = (location: string): Reply => ({ status: 302, headers: { location } })

beforeEach(() => {
  lookup.mockReset()
  lookedUp = []
  lookup.mockImplementation(async (h: string) => {
    lookedUp.push(h)
    if (h === 'internal.example.com') return [{ address: '10.1.2.3', family: 4 }]
    if (h === 'v6private.example.com') return [{ address: 'fd00::1', family: 6 }]
    if (h === 'mapped.example.com') return [{ address: '::ffff:169.254.169.254', family: 6 }]
    return [{ address: '93.184.216.34', family: 4 }]
  })
  httpsRequest.mockReset()
  httpRequest.mockReset()
  seen = []
})
afterEach(() => vi.unstubAllGlobals())

describe('redirect to a private target is skipped, and the private target is never requested', () => {
  const targets = [
    'http://127.0.0.1/',
    'http://127.0.0.1:9001/2018-06-01/runtime/invocation/next',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/',
    'http://[::127.0.0.1]/',
    'http://[::7f00:1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://[::ffff:7f00:1]/',
    'http://[::ffff:0:7f00:1]/',
    'http://[64:ff9b::7f00:1]/',
    'http://[2002:7f00:1::]/',
    'http://[fe80::1]/',
    'http://[fec0::1]/',
    'http://[fd00::1]/',
    'http://[::]/',
    'http://0.0.0.0/',
    'http://2130706433/',
    'http://0x7f.1/',
    'http://0177.0.0.1/',
    'http://127.1/',
    'http://localhost/',
    'http://foo.localhost/',
    'http://metadata.internal/',
    'http://10.0.0.1/',
    'http://192.168.1.1/',
    'http://172.16.0.1/',
    'http://100.64.0.1/',
    'http://198.18.0.1/',
    'http://224.0.0.1/',
    'http://255.255.255.255/',
    '//127.0.0.1/', // protocol-relative
    '/\\127.0.0.1/',
    'http://internal.example.com/', // name resolving to private on the hop
    'http://v6private.example.com/',
    'http://mapped.example.com/',
  ]
  for (const t of targets) {
    it(`blocks redirect to ${t}`, async () => {
      stubNet((url) => (url.includes('start.example.com') ? redirect(t) : { status: 200, body: '<html>SECRET</html>', headers: { 'content-type': 'text/html' } }))
      const r = await auditWebsite('a', 'https://start.example.com/')
      expect(r).toMatchObject({ status: 'skipped', note: 'Address not allowed' })
      expect(seen).toEqual(['https://start.example.com/'])
    })
  }

  it('blocks a private target on the 4th hop of a chain of public redirects', async () => {
    stubNet((url) => {
      const m = /hop(\d)\.example\.com/.exec(url)
      if (m && Number(m[1]) < 4) return redirect(`https://hop${Number(m[1]) + 1}.example.com/`)
      return redirect('http://169.254.169.254/')
    })
    const r = await auditWebsite('a', 'https://hop1.example.com/')
    expect(r.status).toBe('skipped')
    expect(seen.some((u) => u.includes('169.254'))).toBe(false)
  })

  it('rejects a redirect to a non-http scheme', async () => {
    stubNet(() => redirect('file:///etc/passwd'))
    const r = await auditWebsite('a', 'https://start.example.com/')
    expect(r.status).not.toBe('ok')
    expect(seen).toEqual(['https://start.example.com/'])
  })
})

describe('literal start URLs', () => {
  for (const u of ['http://[::127.0.0.1]/', 'http://[::7f00:1]/', 'https://[64:ff9b::7f00:1]/', 'http://127.0.0.1/', 'http://[::ffff:10.0.0.1]/']) {
    it(`skips ${u} without any DNS lookup or connection`, async () => {
      stubNet(() => ({ status: 200, body: 'x', headers: { 'content-type': 'text/html' } }))
      const r = await auditWebsite('a', u)
      expect(r.status).toBe('skipped')
      expect(seen).toEqual([])
      expect(lookedUp).toEqual([])
    })
  }
})

describe('safeLookup', () => {
  const run = (host: string, all = false) =>
    new Promise<{ err: Error | null; address?: unknown }>((res) => safeLookup(host, { all }, (err, address) => res({ err, address })))

  it('rejects when any answer is private, even in all mode', async () => {
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }, { address: '::ffff:7f00:1', family: 6 }])
    expect((await run('x.example.com', true)).err).toBeInstanceOf(Error)
    expect((await run('x.example.com', false)).err?.name).toBeDefined()
  })
  it('rejects an empty answer', async () => {
    lookup.mockResolvedValue([])
    expect((await run('x.example.com')).err).toBeInstanceOf(Error)
  })
  it('passes DNS errors through', async () => {
    lookup.mockRejectedValue(Object.assign(new Error('nx'), { code: 'ENOTFOUND' }))
    expect((await run('nx.example.com')).err).toMatchObject({ code: 'ENOTFOUND' })
  })
  it('returns the checked public address', async () => {
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    const r = await run('ok.example.com')
    expect(r.err).toBeNull()
    expect(r.address).toBe('93.184.216.34')
  })
})
