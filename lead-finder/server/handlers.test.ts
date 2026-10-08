// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const aiPitch = vi.fn()
vi.mock('./ai', () => ({ aiPitch: (...a: unknown[]) => aiPitch(...a) }))
const searchBusinesses = vi.fn()
vi.mock('./osm', () => ({ searchBusinesses: (...a: unknown[]) => searchBusinesses(...a) }))
const auditWebsite = vi.fn()
vi.mock('./audit', async (orig) => ({ ...(await orig<typeof import('./audit')>()), auditWebsite: (...a: unknown[]) => auditWebsite(...a) }))

const createTransport = vi.fn()
vi.mock('nodemailer', () => ({ createTransport: (...a: unknown[]) => createTransport(...a) }))

import { POST as pitchPost } from '../api/pitch'
import { POST as sendPost } from '../api/send'
import { POST as searchPost } from '../api/search'
import { POST as auditPost } from '../api/audit'

const saved = process.env.APP_ACCESS_KEY
beforeEach(() => {
  aiPitch.mockReset().mockResolvedValue(null)
  searchBusinesses.mockReset().mockResolvedValue({ error: 'x', status: 502 })
  createTransport.mockReset()
  auditWebsite.mockReset().mockResolvedValue({ id: 'a', status: 'ok', gaps: [], checkedAt: '' })
})
afterEach(() => {
  if (saved === undefined) delete process.env.APP_ACCESS_KEY
  else process.env.APP_ACCESS_KEY = saved
})

const post = (path: string, body: unknown, key?: string) =>
  new Request(`http://localhost/api/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { 'x-access-key': key } : {}) },
    body: JSON.stringify(body),
  })
const pitchBody = { lead: { name: 'Acme' }, gaps: ['no_website'], services: ['website'], sender: {} }
const searchBody = { location: 'Austin', category: 'cafes', radiusKm: 5, limit: 10 }
const sendBody = {
  smtp: { host: 'smtp.gmail.com', port: 465, secure: true, user: 'me@gmail.com', pass: 'pw' },
  from: { name: 'Me', address: 'me@gmail.com' }, to: 'a@acme.example.com', subject: 'Hi', text: 'Body', suppressed: [],
}
const auditBody = { leads: [{ id: 'a', website: 'example.com' }] }

describe('APP_ACCESS_KEY', () => {
  it('rejects every handler with 401 and never calls Claude, Nominatim or the audit', async () => {
    process.env.APP_ACCESS_KEY = 'k1'
    expect((await pitchPost(post('pitch', pitchBody))).status).toBe(401)
    expect((await pitchPost(post('pitch', pitchBody, 'bad'))).status).toBe(401)
    expect((await searchPost(post('search', searchBody))).status).toBe(401)
    expect((await auditPost(post('audit', auditBody))).status).toBe(401)
    expect(aiPitch).not.toHaveBeenCalled()
    expect(searchBusinesses).not.toHaveBeenCalled()
    expect(auditWebsite).not.toHaveBeenCalled()
  })
  it('rejects /api/send with 401 and never opens a mail transport', async () => {
    process.env.APP_ACCESS_KEY = 'k1'
    expect((await sendPost(post('send', sendBody))).status).toBe(401)
    expect((await sendPost(post('send', sendBody, 'bad'))).status).toBe(401)
    expect(createTransport).not.toHaveBeenCalled()
  })
  it('lets matching requests through', async () => {
    process.env.APP_ACCESS_KEY = 'k1'
    expect((await pitchPost(post('pitch', pitchBody, 'k1'))).status).toBe(200)
    expect(aiPitch).toHaveBeenCalledTimes(1)
    expect((await auditPost(post('audit', auditBody, 'k1'))).status).toBe(200)
    expect(searchBusinesses).not.toHaveBeenCalled()
    await searchPost(post('search', searchBody, 'k1'))
    expect(searchBusinesses).toHaveBeenCalledTimes(1)
  })
  it('is open when the variable is unset', async () => {
    delete process.env.APP_ACCESS_KEY
    expect((await pitchPost(post('pitch', pitchBody))).status).toBe(200)
  })
})
