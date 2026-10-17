// The compliance gate: every outgoing email is checked here before it is sent. An email that fails
// is not sent, and the reasons are shown. The browser checks the full rules (it knows your details);
// the server repeats the rules it can check from the email alone (see checkOutgoing in /api/send).
import { OPT_OUT_EMAIL } from './pitch.js'
import type { Sender } from './types.js'

// first = a cold first email, followup = a sequence follow-up, reply = answering their reply, test = to yourself.
export type EmailKind = 'first' | 'followup' | 'reply' | 'test'
export type OutgoingEmail = { kind: EmailKind; to: string; subject: string; body: string }

// Phrases that pretend you have talked before. A cold first email must not imply prior contact.
const PRIOR_CONTACT = /\b(as (we )?(discussed|promised|agreed|requested)|per our (call|conversation|discussion|chat)|following up on our (call|conversation|chat|meeting)|thanks for (your time|taking my call|the call|speaking with me)|great (talking|speaking|chatting) (to|with) you|you (asked|requested) (me|us) to)\b/i
// Text that was meant to be replaced before sending.
const PLACEHOLDER = /\[(your|their|business|company|first|name|insert)[^\]]{0,30}\]|\{\{[^}]*\}\}|<(your|insert)[^>]{0,30}>/i

// Rules that need only the email itself (shared with the server).
export function emailProblems(e: OutgoingEmail): string[] {
  const out: string[] = []
  const subject = e.subject.trim()
  if (!subject) out.push('The subject is empty.')
  if (e.kind === 'first' && /^(re|fwd?|fw)\s*:/i.test(subject)) out.push('A first email can\'t start its subject with "Re:" or "Fwd:", because that pretends you have written before.')
  if (e.kind === 'first' && PRIOR_CONTACT.test(`${subject}\n${e.body}`)) out.push("A first email can't say or suggest you have already spoken with them.")
  if (PLACEHOLDER.test(`${subject}\n${e.body}`)) out.push('The email still has a placeholder such as [Your name] or {{business}} in it.')
  if (e.kind !== 'test' && !e.body.includes(OPT_OUT_EMAIL)) out.push('The opt-out line is missing.')
  return out
}

// The full check, with your details and the unsubscribed list.
export function complianceProblems(e: OutgoingEmail, sender: Sender, suppressed: string[]): string[] {
  const out: string[] = []
  if (!sender.name.trim() || !sender.business.trim()) out.push('Add your name and business under Your/Profile details.')
  if (!sender.address.trim()) out.push('Add a postal address under Your/Profile details (the law requires one in commercial email).')
  else if (e.kind !== 'test' && !e.body.includes(sender.address.trim())) out.push('Your postal address is missing from the email.')
  if (suppressed.includes(e.to.trim().toLowerCase())) out.push("This address unsubscribed, so it can't be emailed.")
  return [...out, ...emailProblems(e)]
}

export function complianceError(problems: string[]): string {
  return `Blocked by the compliance check: ${problems.join(' ')}`
}
