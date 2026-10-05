// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkAccess, fetchWithTimeout, userAgent } from './http'

const saved = process.env.APP_ACCESS_KEY
afterEach(() => {
  if (saved === undefined) delete process.env.APP_ACCESS_KEY
  else process.env.APP_ACCESS_KEY = saved
})

const req = (key?: string) => new Request('http://localhost/api/pitch', { method: 'POST', headers: key === undefined ? {} : { 'x-access-key': key } })

describe('checkAccess', () => {
  it('lets everything through when APP_ACCESS_KEY is unset', () => {
    delete process.env.APP_ACCESS_KEY
    expect(checkAccess(req())).toBeNull()
    expect(checkAccess(req('anything'))).toBeNull()
  })
  it('returns 401 for a missing, wrong or different-length key', async () => {
    process.env.APP_ACCESS_KEY = 'secret-key'
    for (const k of [undefined, '', 'wrong-key!', 'secret', 'secret-key-and-more']) {
      const res = checkAccess(req(k))
      expect(res?.status, String(k)).toBe(401)
      expect(await res!.json()).toEqual({ error: 'Access key required' })
    }
  })
  it('accepts the matching key', () => {
    process.env.APP_ACCESS_KEY = 'secret-key'
    expect(checkAccess(req('secret-key'))).toBeNull()
  })
})

describe('userAgent', () => {
  const email = process.env.LEADS_CONTACT_EMAIL
  afterEach(() => {
    if (email === undefined) delete process.env.LEADS_CONTACT_EMAIL
    else process.env.LEADS_CONTACT_EMAIL = email
  })
  it('has no placeholder e-mail by default', () => {
    delete process.env.LEADS_CONTACT_EMAIL
    expect(userAgent()).toBe('LeadFinder/1.0')
  })
  it('includes the configured e-mail', () => {
    process.env.LEADS_CONTACT_EMAIL = 'me@mybiz.test'
    expect(userAgent()).toContain('contact: me@mybiz.test')
  })
})

describe('fetchWithTimeout', () => {
  afterEach(() => { vi.unstubAllGlobals() })
  it('rejects when the caller signal is already aborted', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init?: RequestInit) => {
      init?.signal?.throwIfAborted()
      return new Response('ok')
    }))
    const ctrl = new AbortController()
    ctrl.abort()
    await expect(fetchWithTimeout('https://x.example/', { timeoutMs: 1000, signal: ctrl.signal })).rejects.toThrow()
  })
})
