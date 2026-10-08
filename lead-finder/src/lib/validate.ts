import { PRICING } from '../data/pricing.js'
import { getCategory } from '../data/categories.js'
import { GAP_DEFS } from './gaps.js'
import type { AuditRequest, FollowUpRequest, GapId, Offer, PitchRequest, ProjectsRequest, SearchRequest, SendRequest, Sender, ServiceId, CategoryId } from './types.js'

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function clampNum(v: unknown, min: number, max: number, def: number): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n)) return def
  return Math.min(max, Math.max(min, n))
}

export function parseSearchRequest(body: unknown): Parsed<SearchRequest> {
  if (!isObj(body)) return fail('Invalid request')
  const location = typeof body.location === 'string' ? body.location.trim().slice(0, 200) : ''
  if (!location) return fail('Enter a city, ZIP code or address')
  const category = typeof body.category === 'string' ? body.category : 'any'
  if (!getCategory(category)) return fail('Unknown category')
  return {
    ok: true,
    value: {
      location,
      category: category as CategoryId,
      radiusKm: clampNum(body.radiusKm, 1, 25, 5),
      limit: Math.round(clampNum(body.limit, 1, 200, 60)),
    },
  }
}

// Permit keywords go into a SoQL query, so only plain words are allowed.
export function cleanKeywords(v: unknown): string[] {
  const list = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : []
  const out: string[] = []
  for (const k of list) {
    if (typeof k !== 'string') continue
    const w = k.toUpperCase().replace(/[^A-Z0-9 /-]/g, ' ').replace(/\s+/g, ' ').trim()
    if (w.length >= 3 && w.length <= 40 && !out.includes(w)) out.push(w)
  }
  return out.slice(0, 20)
}

export function parseProjectsRequest(body: unknown): Parsed<ProjectsRequest> {
  if (!isObj(body)) return fail('Invalid request')
  const location = typeof body.location === 'string' ? body.location.trim().slice(0, 200) : ''
  if (!location) return fail('Enter a city, ZIP code or address')
  const keywords = cleanKeywords(body.keywords)
  if (keywords.length === 0) return fail('Add the kinds of work to look for in Profile details')
  return {
    ok: true,
    value: {
      location,
      keywords,
      radiusKm: clampNum(body.radiusKm, 1, 25, 5),
      days: Math.round(clampNum(body.days, 7, 180, 60)),
      limit: Math.round(clampNum(body.limit, 1, 200, 60)),
    },
  }
}

export function parseAuditRequest(body: unknown): Parsed<AuditRequest> {
  if (!isObj(body) || !Array.isArray(body.leads)) return fail('Invalid request')
  if (body.leads.length < 1) return fail('No leads to audit')
  if (body.leads.length > 10) return fail('Too many leads (max 10 per request)')
  const leads: AuditRequest['leads'] = []
  for (const item of body.leads) {
    if (!isObj(item) || typeof item.id !== 'string' || typeof item.website !== 'string') return fail('Invalid lead')
    if (item.website.length > 500 || item.id.length > 200) return fail('Website value too long')
    leads.push({ id: item.id, website: item.website })
  }
  return { ok: true, value: { leads } }
}

const optStr = (v: unknown, max = 200): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined
const reqStr = (v: unknown): string => (typeof v === 'string' ? v.trim().slice(0, 200) : '')

export function parsePitchRequest(body: unknown): Parsed<PitchRequest> {
  if (!isObj(body) || !isObj(body.lead)) return fail('Invalid request')
  const name = typeof body.lead.name === 'string' ? body.lead.name.trim() : ''
  if (!name) return fail('Business name is required')
  if (name.length > 200) return fail('Business name is too long')
  const gaps = (Array.isArray(body.gaps) ? body.gaps : []).filter(
    (g): g is GapId => typeof g === 'string' && Object.hasOwn(GAP_DEFS, g),
  )
  const services = (Array.isArray(body.services) ? body.services : []).filter(
    (s): s is ServiceId => typeof s === 'string' && Object.hasOwn(PRICING, s),
  )
  const s = isObj(body.sender) ? body.sender : {}
  const sender: Sender = {
    name: reqStr(s.name), business: reqStr(s.business), email: reqStr(s.email),
    phone: reqStr(s.phone), address: reqStr(s.address), website: reqStr(s.website),
  }
  let project: PitchRequest['project']
  if (isObj(body.project)) {
    project = {
      address: optStr(body.project.address) ?? '',
      description: optStr(body.project.description, 300) ?? '',
      issued: optStr(body.project.issued, 10) ?? '',
    }
  }
  let offer: Offer | undefined
  if (isObj(body.offer)) {
    const sellingPoints = optStr(body.offer.sellingPoints, 500)
    offer = { services: optStr(body.offer.services, 300) ?? '', ...(sellingPoints ? { sellingPoints } : {}) }
  }
  return {
    ok: true,
    value: {
      lead: {
        name,
        category: optStr(body.lead.category) ?? 'business',
        city: optStr(body.lead.city),
        website: optStr(body.lead.website),
      },
      gaps,
      services,
      sender,
      ...(offer ? { offer } : {}),
      ...(project ? { project } : {}),
    },
  }
}

const EMAIL_RE = /^[^\s@<>()",;:\\[\]]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/

export function isEmail(s: string): boolean {
  if (typeof s !== 'string') return false
  const t = s.trim()
  return t.length <= 254 && !/[\r\n]/.test(t) && EMAIL_RE.test(t)
}

const HOST_RE = /^[A-Za-z0-9.:_-]+$/
const hasNewline = (s: string) => /[\r\n]/.test(s)

// Error strings never contain submitted values (the request carries an SMTP password).
export function parseSendRequest(body: unknown): Parsed<SendRequest> {
  if (!isObj(body) || !isObj(body.smtp) || !isObj(body.from)) return fail('Invalid request')
  const { smtp, from } = body
  const host = typeof smtp.host === 'string' ? smtp.host.trim() : ''
  if (host.length < 1 || host.length > 253 || !HOST_RE.test(host.replace(/^\[|\]$/g, ''))) return fail('Enter a valid mail server host')
  const port = smtp.port
  if (port !== 465 && port !== 587 && port !== 2525) return fail('Port must be 465, 587 or 2525')
  if (typeof smtp.secure !== 'boolean' || smtp.secure !== (port === 465)) return fail('Port 465 uses SSL; 587 and 2525 use STARTTLS')
  const user = typeof smtp.user === 'string' ? smtp.user : ''
  if (user.length < 1 || user.length > 254) return fail('Enter the mailbox username')
  const pass = typeof smtp.pass === 'string' ? smtp.pass : ''
  if (pass.length < 1 || pass.length > 200) return fail('Enter the mailbox app password')
  const fromAddress = typeof from.address === 'string' ? from.address.trim() : ''
  if (!isEmail(fromAddress)) return fail('Enter a valid from address')
  const fromName = typeof from.name === 'string' ? from.name.trim() : ''
  if (fromName.length > 100 || hasNewline(fromName)) return fail('From name is invalid')
  const to = typeof body.to === 'string' ? body.to.trim() : ''
  if (!isEmail(to)) return fail('Enter a valid recipient address')
  const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
  if (subject.length < 1 || subject.length > 200 || hasNewline(subject)) return fail('Subject must be 1 to 200 characters on one line')
  const text = typeof body.text === 'string' ? body.text : ''
  if (text.trim().length < 1 || text.length > 20000) return fail('Message must be 1 to 20000 characters')
  let inReplyTo: string | undefined
  if (body.inReplyTo !== undefined && body.inReplyTo !== null && body.inReplyTo !== '') {
    if (typeof body.inReplyTo !== 'string' || !/^<[^<>\s]{1,250}>$/.test(body.inReplyTo)) return fail('Invalid reply reference')
    inReplyTo = body.inReplyTo
  }
  const rawSup = Array.isArray(body.suppressed) ? body.suppressed : []
  if (rawSup.length > 5000) return fail('Suppression list too long')
  const suppressed = rawSup.filter((v): v is string => typeof v === 'string').map((v) => v.trim().toLowerCase())
  return {
    ok: true,
    value: {
      smtp: { host, port, secure: smtp.secure, user, pass },
      from: { name: fromName, address: fromAddress },
      to,
      subject,
      text,
      ...(inReplyTo ? { inReplyTo } : {}),
      suppressed,
    },
  }
}

export function parseFollowUpRequest(body: unknown): Parsed<FollowUpRequest> {
  if (!isObj(body) || !isObj(body.lead)) return fail('Invalid request')
  const name = optStr(body.lead.name)
  if (!name) return fail('Business name is required')
  const step = body.step === 1 || body.step === 2 ? body.step : 0
  if (!step) return fail('Invalid follow-up step')
  const previousBody = typeof body.previousBody === 'string' ? body.previousBody.trim().slice(0, 5000) : ''
  if (!previousBody) return fail('The earlier email is required')
  const s = isObj(body.sender) ? body.sender : {}
  const offer = isObj(body.offer) ? body.offer : undefined
  const project = isObj(body.project) ? body.project : undefined
  const points = offer ? optStr(offer.sellingPoints, 500) : undefined
  return {
    ok: true,
    value: {
      lead: { name, category: optStr(body.lead.category) ?? 'business', city: optStr(body.lead.city) },
      sender: { name: reqStr(s.name), business: reqStr(s.business) },
      step,
      previousSubject: optStr(body.previousSubject, 300) ?? '',
      previousBody,
      ...(offer ? { offer: { services: optStr(offer.services, 300) ?? '', ...(points ? { sellingPoints: points } : {}) } } : {}),
      ...(project ? { project: { address: optStr(project.address) ?? '', description: optStr(project.description, 300) ?? '', issued: optStr(project.issued, 10) ?? '' } } : {}),
    },
  }
}
