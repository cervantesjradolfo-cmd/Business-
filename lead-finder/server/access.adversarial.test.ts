// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const aiPitch = vi.fn()
vi.mock('./ai', () => ({ aiPitch: (...a: unknown[]) => aiPitch(...a) }))
const searchBusinesses = vi.fn()
vi.mock('./osm', () => ({ searchBusinesses: (...a: unknown[]) => searchBusinesses(...a) }))
const auditWebsite = vi.fn()
vi.mock('./audit', async (orig) => ({ ...(await orig<typeof import('./audit')>()), auditWebsite: (...a: unknown[]) => auditWebsite(...a) }))

import { POST as pitchPost } from '../api/pitch'
import { POST as searchPost } from '../api/search'
import { POST as auditPost } from '../api/audit'
import { checkAccess } from './http'

const saved = process.env.APP_ACCESS_KEY
beforeEach(() => {
  aiPitch.mockReset().mockResolvedValue(null)
  searchBusinesses.mockReset().mockResolvedValue({ error: 'x', status: 502 })
  auditWebsite.mockReset().mockResolvedValue({ id: 'a', status: 'ok', gaps: [], checkedAt: '' })
})
afterEach(() => {
  if (saved === undefined) delete process.env.APP_ACCESS_KEY
  else process.env.APP_ACCESS_KEY = saved
})

const req = (headers: Record<string, string>, body = '{}') =>
  new Request('http://localhost/api/x', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body })
const handlers = { pitch: pitchPost, search: searchPost, audit: auditPost }

describe('checkAccess', () => {
  it('is open when the key is not set at all', () => {
    delete process.env.APP_ACCESS_KEY
    expect(checkAccess(req({}))).toBeNull()
    expect(checkAccess(req({ 'x-access-key': 'anything' }))).toBeNull()
  })
  it('is open when the key is set to an empty string (treated as not set)', () => {
    process.env.APP_ACCESS_KEY = ''
    expect(checkAccess(req({}))).toBeNull()
  })
  it('401 with the documented JSON body for missing key', async () => {
    process.env.APP_ACCESS_KEY = 'sekret'
    const r = checkAccess(req({}))!
    expect(r.status).toBe(401)
    expect(await r.json()).toEqual({ error: 'Access key required' })
  })
  it('rejects wrong, empty, prefix, suffix-extended, case-changed keys', () => {
    process.env.APP_ACCESS_KEY = 'sekret'
    for (const k of ['wrong!', '', 'sekre', 'sekret1', 'SEKRET']) {
      let r: Response | null
      try { r = checkAccess(req({ 'x-access-key': k })) } catch { r = new Response(null, { status: 401 }) }
      expect(r?.status, JSON.stringify(k)).toBe(401)
    }
  })
  it('rejects a same-byte-length key that differs only in the last byte', () => {
    process.env.APP_ACCESS_KEY = 'abcdef'
    expect(checkAccess(req({ 'x-access-key': 'abcdeg' }))?.status).toBe(401)
  })
  it('does not accept the key through another header or the query string', () => {
    process.env.APP_ACCESS_KEY = 'sekret'
    expect(checkAccess(new Request('http://localhost/api/x?x-access-key=sekret', { method: 'POST', headers: { authorization: 'sekret', 'x-api-key': 'sekret' } }))?.status).toBe(401)
  })
  it('accepts the matching key, with a case-insensitive header name', () => {
    process.env.APP_ACCESS_KEY = 'sekret'
    expect(checkAccess(req({ 'X-Access-Key': 'sekret' }))).toBeNull()
  })
  it('handles non-ASCII keys', () => {
    process.env.APP_ACCESS_KEY = 'clé-ü'
    expect(checkAccess(new Request('http://l/', { headers: { 'x-access-key': 'cle-u' } }))?.status).toBe(401)
  })
})

describe('handlers check the key before parsing the body', () => {
  for (const [name, h] of Object.entries(handlers)) {
    it(`${name}: a malformed body without the key is 401, not 400`, async () => {
      process.env.APP_ACCESS_KEY = 'k'
      expect((await h(req({}, '{not json'))).status).toBe(401)
    })
    it(`${name}: with the right key a malformed body is a client error, not 401`, async () => {
      process.env.APP_ACCESS_KEY = 'k'
      const s = (await h(req({ 'x-access-key': 'k' }, '{not json'))).status
      expect(s).toBeGreaterThanOrEqual(400)
      expect(s).not.toBe(401)
    })
    it(`${name}: with no key configured a request without the header is not 401`, async () => {
      delete process.env.APP_ACCESS_KEY
      expect((await h(req({}, '{not json'))).status).not.toBe(401)
    })
  }
  it('nothing downstream runs for wrong keys', async () => {
    process.env.APP_ACCESS_KEY = 'k'
    const body = JSON.stringify({ location: 'Austin', category: 'cafes', radiusKm: 5, limit: 10, lead: { name: 'A' }, gaps: [], services: [], sender: {}, leads: [{ id: 'a', website: 'example.com' }] })
    for (const h of Object.values(handlers)) await h(req({ 'x-access-key': 'nope' }, body))
    expect(aiPitch).not.toHaveBeenCalled()
    expect(searchBusinesses).not.toHaveBeenCalled()
    expect(auditWebsite).not.toHaveBeenCalled()
  })
})
