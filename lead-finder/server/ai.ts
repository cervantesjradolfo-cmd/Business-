// AI-written pitches (optional). Falls back to the template in src/lib/pitch.ts when there is
// no ANTHROPIC_API_KEY or anything goes wrong.
import Anthropic from '@anthropic-ai/sdk'
import { PRICING } from '../src/data/pricing.js'
import { GAP_DEFS } from '../src/lib/gaps.js'
import { finalizeAiPitch } from '../src/lib/pitch.js'
import type { FollowUpRequest, Pitch, PitchRequest } from '../src/lib/types.js'

const SYSTEM_PROMPT = `You are a friendly local-business consultant writing cold outreach to a small business owner.
- Mention the business by name and its top 2-3 gaps, in plain words.
- Email body: under 120 words, with a greeting, but no signature and no opt-out line (the code adds them).
- SMS: under 250 characters, no opt-out text (the code adds it).
- Phone opener: 2-4 sentences.
- Never invent facts, statistics, reviews or prices.
- No emojis.
Reply with JSON only: subject, emailBody, sms, phoneOpener.`

// For client profiles: the sender is a trade business introducing itself to a possible customer.
const CLIENT_PROMPT = `You write short, honest cold outreach from a local business to another business that could hire it (for example a general contractor, property manager or architect).
- Mention the recipient by name and the kind of business they are.
- Say what the sender does, using the services given, and offer to bid on or help with upcoming projects.
- If a project is given, it comes from a public building permit: mention its address and kind of work, and offer to bid that scope.
- Use only the selling points given. Never invent licences, years in business, past clients, reviews, statistics or prices.
- Email body: under 120 words, with a greeting, but no signature and no opt-out line (the code adds them).
- SMS: under 250 characters, no opt-out text (the code adds it).
- Phone opener: 2-4 sentences.
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

// One structured-output call. Returns the parsed JSON, or null on a refusal or a cut-off reply.
// Thinking is always on for this model and counts toward max_tokens, so leave room beyond the JSON.
async function askJson(system: string, userMessage: string, schema: { [key: string]: unknown }): Promise<Record<string, unknown> | null> {
  client ??= new Anthropic()
  const msg = await client.beta.messages.create(
    {
      model: 'claude-opus-5-5',
      max_tokens: 4096,
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    },
    { timeout: 20000 },
  )
  if (msg.stop_reason === 'refusal' || msg.stop_reason === 'max_tokens') return null
  const block = msg.content.find((b) => b.type === 'text')
  if (!block || block.type !== 'text') return null
  return JSON.parse(block.text) as Record<string, unknown>
}

export async function aiPitch(req: PitchRequest): Promise<Pitch | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null
  try {
    const gaps = [...req.gaps]
      .map((id) => GAP_DEFS[id])
      .filter(Boolean)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map((g) => ({ label: g.label, phrase: g.phrase }))
    const userMessage = req.offer
      ? JSON.stringify({
          recipient: { business: req.lead.name, category: req.lead.category, city: req.lead.city, website: req.lead.website },
          ...(req.project ? { project: req.project } : {}),
          sender: { name: req.sender.name, business: req.sender.business, services: req.offer.services, sellingPoints: req.offer.sellingPoints },
        })
      : JSON.stringify({
          business: req.lead.name,
          category: req.lead.category,
          city: req.lead.city,
          website: req.lead.website,
          gaps,
          services: req.services.map((s) => PRICING[s]?.label).filter(Boolean),
          sender: { name: req.sender.name, business: req.sender.business },
        })
    const parsed = await askJson(req.offer ? CLIENT_PROMPT : SYSTEM_PROMPT, userMessage, SCHEMA)
    if (!parsed) return null
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

const FOLLOW_UP_PROMPT = `You write a short follow-up to a cold email that got no reply. The earlier email is given.
- Write follow-up number N (1 = first nudge, 2 = last, polite close-out that leaves the door open).
- Greet the recipient by business name. Briefly remind them what the sender offered, in new words; do not paste the earlier email.
- Under 70 words. One clear, easy question or next step. No guilt, no pressure, no fake urgency.
- Use only facts from the input. Never invent results, clients, prices, deadlines or statistics.
- No subject line, no signature and no opt-out line (the code adds them). No emojis.
Reply with JSON only: emailBody.`

const FOLLOW_UP_SCHEMA = {
  type: 'object',
  properties: { emailBody: { type: 'string' } },
  required: ['emailBody'],
  additionalProperties: false,
} as const

// AI-written follow-up body (no footer), or null when AI is off or anything goes wrong.
export async function aiFollowUp(req: FollowUpRequest): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null
  try {
    const parsed = await askJson(FOLLOW_UP_PROMPT, JSON.stringify({
      followUpNumber: req.step,
      recipient: { business: req.lead.name, category: req.lead.category, city: req.lead.city },
      ...(req.project ? { project: req.project } : {}),
      sender: { name: req.sender.name, business: req.sender.business, ...(req.offer ? { services: req.offer.services, sellingPoints: req.offer.sellingPoints } : {}) },
      earlierEmail: { subject: req.previousSubject, body: req.previousBody },
    }), FOLLOW_UP_SCHEMA)
    const body = typeof parsed?.emailBody === 'string' ? parsed.emailBody.trim() : ''
    if (!body || body.length > 3000) return null
    return body
  } catch (err) {
    console.error('follow-up error', err)
    return null
  }
}
