// AI-written pitches (optional). Falls back to the template in src/lib/pitch.ts when there is
// no ANTHROPIC_API_KEY or anything goes wrong.
import Anthropic from '@anthropic-ai/sdk'
import { PRICING } from '../src/data/pricing'
import { GAP_DEFS } from '../src/lib/gaps'
import { finalizeAiPitch } from '../src/lib/pitch'
import type { Pitch, PitchRequest } from '../src/lib/types'

const SYSTEM_PROMPT = `You are a friendly local-business consultant writing cold outreach to a small business owner.
- Mention the business by name and its top 2-3 gaps, in plain words.
- Email body: under 120 words, with a greeting, but no signature and no opt-out line (the code adds them).
- SMS: under 250 characters, no opt-out text (the code adds it).
- Phone opener: 2-4 sentences.
- Never invent facts, statistics, reviews or prices.
- No emojis.
Reply with JSON only: subject, emailBody, sms, phoneOpener.`

const SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: 'string' },
    emailBody: { type: 'string' },
    sms: { type: 'string' },
    phoneOpener: { type: 'string' },
  },
  required: ['subject', 'emailBody', 'sms', 'phoneOpener'],
  additionalProperties: false,
} as const

let client: Anthropic | null = null

export async function aiPitch(req: PitchRequest): Promise<Pitch | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null
  try {
    client ??= new Anthropic()
    const gaps = [...req.gaps]
      .map((id) => GAP_DEFS[id])
      .filter(Boolean)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map((g) => ({ label: g.label, phrase: g.phrase }))
    const userMessage = JSON.stringify({
      business: req.lead.name,
      category: req.lead.category,
      city: req.lead.city,
      website: req.lead.website,
      gaps,
      services: req.services.map((s) => PRICING[s]?.label).filter(Boolean),
      sender: { name: req.sender.name, business: req.sender.business },
    })
    const msg = await client.beta.messages.create(
      {
        model: 'claude-opus-5-5',
        max_tokens: 1024,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userMessage }],
      },
      { timeout: 20000 },
    )
    if (msg.stop_reason === 'refusal') return null
    const block = msg.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') return null
    const parsed = JSON.parse(block.text) as Record<string, unknown>
    const str = (v: unknown) => (typeof v === 'string' ? v : '')
    return finalizeAiPitch(
      { subject: str(parsed.subject), emailBody: str(parsed.emailBody), sms: str(parsed.sms), phoneOpener: str(parsed.phoneOpener) },
      req,
    )
  } catch (err) {
    console.error('pitch error', err)
    return null
  }
}
