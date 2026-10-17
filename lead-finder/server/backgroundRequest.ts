// Checks a background sync request. Everything is cleaned the same way the browser cleans its own storage.
import { PRICING } from '../src/data/pricing.js'
import { mailboxReady, parseMailbox, parseOutreach } from '../src/lib/outreach.js'
import type { BackgroundLead, LeadStatus, Offer, Pitch, Sender, ServiceId, SyncRequest } from '../src/lib/types.js'
import type { Parsed } from '../src/lib/validate.js'
import { isEmail } from '../src/lib/validate.js'
import { validWorkspaceId } from './background.js'

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const STATUSES: LeadStatus[] = ['new', 'contacted', 'replied', 'booked', 'won', 'lost']
const HOST_RE = /^[A-Za-z0-9.:_-]+$/
const MAX_LEADS = 5000

function parsePitch(raw: unknown): Pitch | null {
  if (!isObj(raw) || !isObj(raw.email)) return null
  const subject = str(raw.email.subject, 300).replace(/[\r\n]+/g, ' ')
  const body = str(raw.email.body, 20000)
  if (!subject || !body) return null
  return { email: { subject, body }, sms: str(raw.sms, 1000), phoneOpener: str(raw.phoneOpener, 2000), source: raw.source === 'ai' ? 'ai' : 'template' }
}

function parseLead(id: string, raw: unknown): BackgroundLead | null {
  if (!isObj(raw)) return null
  const name = str(raw.name, 200).trim()
  const pitch = parsePitch(raw.pitch)
  const updatedAt = typeof raw.updatedAt === 'string' && !Number.isNaN(new Date(raw.updatedAt).getTime()) ? raw.updatedAt : ''
  if (!name || !pitch || !updatedAt || id.length > 300) return null
  const city = str(raw.city, 100).trim()
  return {
    id, name, ...(city ? { city } : {}),
    category: str(raw.category, 100) || 'business',
    status: STATUSES.find((s) => s === raw.status) ?? 'new',
    updatedAt, pitch,
    services: (Array.isArray(raw.services) ? raw.services : []).filter((s): s is ServiceId => typeof s === 'string' && Object.hasOwn(PRICING, s)),
  }
}

function parseSender(raw: unknown): Sender {
  const r = isObj(raw) ? raw : {}
  const booking = str(r.bookingUrl, 300).trim()
  return {
    name: str(r.name, 200), business: str(r.business, 200), email: str(r.email, 254), phone: str(r.phone, 50),
    address: str(r.address, 300), website: str(r.website, 300),
    ...(/^https?:\/\/[^\s<>"]{3,300}$/.test(booking) ? { bookingUrl: booking } : {}),
  }
}

// Error strings never contain submitted values (the request carries a mailbox password).
export function parseSyncRequest(body: unknown): Parsed<SyncRequest> {
  if (!isObj(body)) return { ok: false, error: 'Invalid request' }
  if (!validWorkspaceId(body.workspace)) return { ok: false, error: 'Invalid profile' }
  const mailbox = parseMailbox(body.mailbox)
  if (!mailboxReady(mailbox)) return { ok: false, error: 'Set up the mailbox (server, username, app password and from address) first.' }
  if (mailbox.host.length > 253 || !HOST_RE.test(mailbox.host) || (mailbox.imapHost && !HOST_RE.test(mailbox.imapHost))) return { ok: false, error: 'Enter a valid mail server host' }
  if (mailbox.pass.length > 200 || !isEmail(mailbox.fromAddress)) return { ok: false, error: 'Invalid mailbox' }
  const rawLeads = isObj(body.leads) ? Object.entries(body.leads) : []
  if (rawLeads.length > MAX_LEADS) return { ok: false, error: 'Too many leads' }
  const leads: Record<string, BackgroundLead> = {}
  for (const [id, v] of rawLeads) {
    const l = parseLead(id, v)
    if (l) leads[id] = l
  }
  const offer: Offer | undefined = isObj(body.offer)
    ? { services: str(body.offer.services, 300), ...(str(body.offer.sellingPoints, 500) ? { sellingPoints: str(body.offer.sellingPoints, 500) } : {}) }
    : undefined
  return {
    ok: true,
    value: { workspace: body.workspace, outreach: parseOutreach(body.outreach), leads, sender: parseSender(body.sender), ...(offer ? { offer } : {}), mailbox },
  }
}
