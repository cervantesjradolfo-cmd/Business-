import { PRICING } from '../data/pricing.js'
import { getCategory } from '../data/categories.js'
import { GAP_DEFS } from './gaps.js'
import type { AuditRequest, GapId, Offer, PitchRequest, ProjectsRequest, SearchRequest, Sender, ServiceId, CategoryId } from './types.js'

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
