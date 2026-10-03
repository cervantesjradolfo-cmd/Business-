// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const lookup = vi.fn()
// When set, the mocked DNS lookup rejects with this message (done outside vi.fn, whose bookkeeping
// reports a natively rejected promise as an unhandled error).
let dnsError = ''
vi.mock('node:dns/promises', () => ({
  lookup: (...a: unknown[]) => (dnsError ? Promise.reject(new Error(dnsError)) : lookup(...a)),
}))

import { Blocked, safeGet, safeLookup } from './safeRequest'

// Errors are summarised (not passed around as Error objects) to keep the assertions simple.
const run = (host: string, opts: { all?: boolean } = {}) =>
  new Promise<{ err: { message: string; blocked: boolean } | null; address?: unknown; family?: number }>((resolve) =>
    safeLookup(host, opts, (err, address, family) =>
      resolve({ err: err ? { message: err.message, blocked: err instanceof Blocked } : null, address, family })))

beforeEach(() => lookup.mockReset())

describe('safeLookup', () => {
  it('hands back the checked address (single and all forms)', async () => {
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    expect(await run('example.com')).toEqual({ err: null, address: '93.184.216.34', family: 4 })
    expect((await run('example.com', { all: true })).address).toEqual([{ address: '93.184.216.34', family: 4 }])
  })
  it('rejects with Blocked when any address is private', async () => {
    for (const bad of ['127.0.0.1', '169.254.169.254', '::7f00:1', '64:ff9b::7f00:1', '198.18.0.1', '224.0.0.1']) {
      lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }, { address: bad, family: bad.includes(':') ? 6 : 4 }])
      expect((await run('x.example.com')).err?.blocked, bad).toBe(true)
    }
  })
  it('rejects an empty answer and passes DNS errors through', async () => {
    lookup.mockResolvedValue([])
    expect((await run('x.example.com')).err?.blocked).toBe(true)
    dnsError = 'ENOTFOUND'
    const r = await run('x.example.com')
    dnsError = ''
    expect(r.err).toEqual({ message: 'ENOTFOUND', blocked: false })
  })
})

describe('safeGet with the real http modules', () => {
  const signal = () => new AbortController().signal
  it('refuses a name that resolves privately without connecting (Blocked reaches the caller)', async () => {
    lookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }])
    await expect(safeGet(new URL('https://rebind.example.com/'), { headers: {}, signal: signal() })).rejects.toBeInstanceOf(Blocked)
    await expect(safeGet(new URL('http://rebind.example.com/'), { headers: {}, signal: signal() })).rejects.toBeInstanceOf(Blocked)
  })
  it('refuses private literals and other schemes before any lookup', () => {
    for (const u of ['http://127.0.0.1/', 'http://[::7f00:1]/', 'http://[::127.0.0.1]/', 'http://localhost/', 'file:///etc/passwd'])
      expect(() => safeGet(new URL(u), { headers: {}, signal: signal() }), u).toThrow(Blocked)
    expect(lookup).not.toHaveBeenCalled()
  })
})
