// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PitchRequest } from '../src/lib/types'

const create = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({ default: class { beta = { messages: { create } } } }))
const { aiFollowUp, aiPitch } = await import('./ai')

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

describe('aiFollowUp', () => {
  const req = {
    lead: { name: 'Summit Construction', category: 'General contractor', city: 'Chicago' },
    sender: { name: 'Asher', business: 'Asher Construction' },
    step: 1,
    previousSubject: 'Drywall for 225 W Randolph St',
    previousBody: 'Hi Summit team, we do drywall...',
    offer: { services: 'drywall', sellingPoints: 'Licensed and insured.' },
    project: { address: '225 W Randolph St', description: 'Interior alterations', issued: '2026-10-06' },
  }
  const text = (t: string, stop = 'end_turn') => ({ stop_reason: stop, content: [{ type: 'text', text: t }] })

  it('asks for a short follow-up that refers to the earlier email and returns its body', async () => {
    create.mockResolvedValue(text(JSON.stringify({ emailBody: '  Hi Summit team, following up on drywall.  ' })))
    expect(await aiFollowUp(req)).toBe('Hi Summit team, following up on drywall.')
    const args = create.mock.calls[0][0]
    expect(args.model).toBe('claude-opus-5-5')
    expect(args.max_tokens).toBe(4096)
    expect(args.system[0].text).toContain('follow-up to a cold email')
    expect(args.output_config.format.schema.required).toEqual(['emailBody'])
    const msg = JSON.parse(args.messages[0].content)
    expect(msg).toMatchObject({ followUpNumber: 1, earlierEmail: { subject: req.previousSubject, body: req.previousBody }, project: req.project })
    expect(msg.sender).toEqual({ name: 'Asher', business: 'Asher Construction', services: 'drywall', sellingPoints: 'Licensed and insured.' })
  })
  it('returns null on a refusal, a cut-off reply, an empty body or an error', async () => {
    for (const r of [text('{}', 'refusal'), text('{"emailBody":"Hi', 'max_tokens'), text('{"emailBody":"  "}')]) {
      create.mockReset().mockResolvedValue(r)
      expect(await aiFollowUp(req)).toBeNull()
    }
    create.mockReset().mockRejectedValue(new Error('down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await aiFollowUp(req)).toBeNull()
  })
  it('returns null without an API key, without calling the API', async () => {
    delete process.env.ANTHROPIC_API_KEY
    expect(await aiFollowUp(req)).toBeNull()
    expect(create).not.toHaveBeenCalled()
  })
})
