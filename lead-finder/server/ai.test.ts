// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PitchRequest } from '../src/lib/types'

const create = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({ default: class { beta = { messages: { create } } } }))
const { aiPitch } = await import('./ai')

const sender = { name: 'Asher', business: 'Asher Construction', email: '', phone: '', address: '9 Oak St', website: '' }
const base: PitchRequest = { lead: { name: 'Summit Construction', category: 'General contractor', city: 'Denver' }, gaps: ['no_website'], services: ['website'], sender }
const reply = {
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: JSON.stringify({ subject: 'Drywall crew', emailBody: 'Hi Summit Construction team, ...', sms: 'Hi Summit Construction, ...', phoneOpener: 'Hi, is this Summit Construction?' }) }],
}

beforeEach(() => { process.env.ANTHROPIC_API_KEY = 'test'; create.mockReset().mockResolvedValue(reply) })
afterEach(() => { delete process.env.ANTHROPIC_API_KEY })

describe('aiPitch', () => {
  it('writes as the client, with the client prompt and offer, for a client profile', async () => {
    const p = await aiPitch({ ...base, offer: { services: 'drywall and acoustic ceilings', sellingPoints: 'Licensed and insured.' } })
    const args = create.mock.calls[0][0]
    expect(args.system[0].text).toContain('Never invent licences')
    expect(JSON.parse(args.messages[0].content)).toEqual({
      recipient: { business: 'Summit Construction', category: 'General contractor', city: 'Denver' },
      sender: { name: 'Asher', business: 'Asher Construction', services: 'drywall and acoustic ceilings', sellingPoints: 'Licensed and insured.' },
    })
    expect(p).toMatchObject({ source: 'ai', email: { subject: 'Drywall crew' } })
    expect(p!.email.body).toContain('Asher Construction')
  })
  it('passes a permit project to the AI', async () => {
    const project = { address: '225 W Randolph St', issued: '2026-10-06', description: 'Interior alterations' }
    await aiPitch({ ...base, offer: { services: 'drywall' }, project })
    const args = create.mock.calls[0][0]
    expect(args.system[0].text).toContain('public building permit')
    expect(JSON.parse(args.messages[0].content).project).toEqual(project)
  })
  it('keeps the agency prompt and gaps without an offer', async () => {
    await aiPitch(base)
    const args = create.mock.calls[0][0]
    expect(args.system[0].text).toContain('local-business consultant')
    const msg = JSON.parse(args.messages[0].content)
    expect(msg.gaps[0].label).toBe('No website')
    expect(msg).not.toHaveProperty('recipient')
  })
  it('returns null without an API key', async () => {
    delete process.env.ANTHROPIC_API_KEY
    expect(await aiPitch(base)).toBeNull()
    expect(create).not.toHaveBeenCalled()
  })
})
