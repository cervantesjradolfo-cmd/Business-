// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const aiFollowUp = vi.fn()
vi.mock('./ai', () => ({ aiFollowUp: (...a: unknown[]) => aiFollowUp(...a) }))
import { GET, POST } from '../api/followup'

const savedKey = process.env.APP_ACCESS_KEY
beforeEach(() => { aiFollowUp.mockReset(); delete process.env.APP_ACCESS_KEY })
afterEach(() => { if (savedKey === undefined) delete process.env.APP_ACCESS_KEY; else process.env.APP_ACCESS_KEY = savedKey })

const req = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://x/api/followup', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) })
const good = { lead: { name: 'Summit' }, sender: { name: 'A', business: 'B' }, step: 1, previousSubject: 'S', previousBody: 'Hi' }

describe('POST /api/followup', () => {
  it('returns the AI body, or null when AI is not available', async () => {
    aiFollowUp.mockResolvedValueOnce('Following up.').mockResolvedValueOnce(null)
    expect(await (await POST(req(good))).json()).toEqual({ body: 'Following up.' })
    expect(aiFollowUp.mock.calls[0][0]).toMatchObject({ step: 1, previousBody: 'Hi', lead: { name: 'Summit' } })
    const res = await POST(req(good))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ body: null })
  })
  it('requires the access key when one is set, before doing anything', async () => {
    process.env.APP_ACCESS_KEY = 'secret'
    expect((await POST(req(good))).status).toBe(401)
    expect((await POST(req(good, { 'x-access-key': 'wrong' }))).status).toBe(401)
    expect(aiFollowUp).not.toHaveBeenCalled()
    aiFollowUp.mockResolvedValue('ok')
    expect((await POST(req(good, { 'x-access-key': 'secret' }))).status).toBe(200)
  })
  it('rejects bad JSON and invalid requests, and GET', async () => {
    expect((await POST(req('{nope'))).status).toBe(400)
    const bad = await POST(req({ ...good, step: 5 }))
    expect(bad.status).toBe(400)
    expect(await bad.json()).toEqual({ error: 'Invalid follow-up step' })
    expect((await GET()).status).toBe(405)
    expect(aiFollowUp).not.toHaveBeenCalled()
  })
})
