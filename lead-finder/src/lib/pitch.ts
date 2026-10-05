// Outreach templates. Edit the wording here (the AI version lives in server/ai.ts).
import { PRICING } from '../data/pricing.js'
import { GAP_DEFS } from './gaps.js'
import type { Pitch, PitchRequest, Sender, ServiceId } from './types.js'

export const OPT_OUT_EMAIL = "If you'd rather not hear from me, just reply \"no thanks\" and I won't email again."
export const OPT_OUT_SMS = 'Reply STOP to opt out.'

const SMS_MAX = 320

export function emailSignature(sender: Sender): string {
  return [sender.name, sender.business, sender.phone, sender.email, sender.website, sender.address]
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n')
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const lowerLabel = (s: string) => (/^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1))

function plural(word: string): string {
  const w = word.toLowerCase()
  if (/(s|x|ch|sh)$/.test(w)) return w.endsWith('s') && !w.endsWith('ss') ? w : `${w}es`
  if (/[^aeiou]y$/.test(w)) return `${w.slice(0, -1)}ies`
  return `${w}s`
}

function topPhrases(req: PitchRequest): string[] {
  return [...new Set(req.gaps)]
    .map((id) => GAP_DEFS[id])
    .filter(Boolean)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((d) => d.phrase)
}

function serviceLabels(services: ServiceId[], hasGaps: boolean): string[] {
  const list = hasGaps ? services.filter((s) => PRICING[s]).slice(0, 3) : (['review_collection', 'ai_chat'] as ServiceId[])
  return list.map((s) => lowerLabel(PRICING[s].label))
}

export function buildTemplatePitch(req: PitchRequest): Pitch {
  const name = req.lead.name.trim()
  const senderName = req.sender.name.trim() || '[Your name]'
  const senderBusiness = req.sender.business.trim() || '[Your business]'
  const phrases = topPhrases(req)
  const labels = serviceLabels(req.services, phrases.length > 0)
  const place = req.lead.city?.trim() || 'your area'
  const sig = emailSignature({
    ...req.sender,
    name: senderName,
    business: senderBusiness,
  })

  const lines: string[] = [`Hi ${name} team,`, '']
  if (phrases.length) {
    lines.push(`I was looking at ${plural(req.lead.category || 'business')} in ${place} and noticed a few things about ${name}'s online presence:`)
    lines.push('')
    for (const p of phrases) lines.push(`- ${cap(p)}`)
    lines.push('')
    lines.push(`I help local businesses fix exactly this with ${joinList(labels)}.`)
  } else {
    lines.push(`I was looking at ${plural(req.lead.category || 'business')} in ${place} and ${name}'s online presence looks solid.`)
    lines.push('')
    lines.push(`I help local businesses win more customers with ${joinList(labels)}.`)
  }
  lines.push('Would you be open to a quick 10-minute call this week?', '', sig, '', OPT_OUT_EMAIL)

  const smsWith = (n: string, ps: string[]) => {
    const middle = ps.length
      ? `I noticed ${ps.join(' and ')}. I help local businesses fix that fast.`
      : 'I help local businesses win more customers online.'
    return `Hi ${n}, this is ${senderName} with ${senderBusiness}. ${middle} Open to a quick chat? ${OPT_OUT_SMS}`
  }
  let sms = smsWith(name, phrases.slice(0, 2))
  if (sms.length > SMS_MAX) sms = smsWith(name, phrases.slice(0, 1))
  if (sms.length > SMS_MAX) sms = smsWith(name.length > 40 ? `${name.slice(0, 40)}…` : name, phrases.slice(0, 1))

  const noticed = phrases.length ? ` and noticed ${joinList(phrases)}` : ''
  const fix = phrases.length ? `fix that with ${joinList(labels)}` : `win more customers with ${joinList(labels)}`
  const phoneOpener = `Hi, is this ${name}? This is ${senderName} from ${senderBusiness}. I'll be quick: I was looking at ${name} online${noticed}. I help businesses like yours ${fix}. Do you have two minutes?`

  return { email: { subject: `Quick idea for ${name}`, body: lines.join('\n') }, sms, phoneOpener, source: 'template' }
}

export function finalizeAiPitch(
  ai: { subject: string; emailBody: string; sms: string; phoneOpener: string },
  req: PitchRequest,
): Pitch | null {
  const subject = ai.subject?.trim()
  const body = ai.emailBody?.trim()
  const sms = ai.sms?.trim()
  const opener = ai.phoneOpener?.trim()
  if (!subject || !body || !sms || !opener) return null
  const name = req.lead.name.trim().toLowerCase()
  if (![body, sms, opener].every((t) => t.toLowerCase().includes(name))) return null
  const sender = {
    ...req.sender,
    name: req.sender.name.trim() || '[Your name]',
    business: req.sender.business.trim() || '[Your business]',
  }
  return {
    email: { subject, body: `${body}\n\n${emailSignature(sender)}\n\n${OPT_OUT_EMAIL}` },
    sms: `${sms} ${OPT_OUT_SMS}`,
    phoneOpener: opener,
    source: 'ai',
  }
}
