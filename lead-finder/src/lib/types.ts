// Shared types for Lead Finder (used by the browser app and the server handlers).

export type CategoryId =
  | 'any' | 'restaurants' | 'cafes' | 'salons' | 'barbers' | 'auto_repair' | 'dentists'
  | 'fitness' | 'drywall' | 'general_contractors' | 'trades' | 'cleaning' | 'party_rentals' | 'retail'
  | 'real_estate' | 'property_managers' | 'architects' | 'law' | 'medical'
export type ServiceId =
  | 'website' | 'online_booking' | 'ai_chat' | 'mobile_redesign' | 'seo_basics' | 'review_collection'
export type GapId =
  | 'no_website' | 'site_unreachable' | 'no_https' | 'no_mobile_viewport' | 'no_online_booking'
  | 'no_contact_form' | 'no_chat_widget' | 'no_social_links' | 'missing_seo_tags'
  | 'outdated_copyright' | 'slow_site' | 'no_click_to_call' | 'no_phone_listed' | 'no_hours_listed'
export type SiteGapId = Exclude<GapId, 'no_website' | 'site_unreachable' | 'no_phone_listed' | 'no_hours_listed'>
export type LeadStatus = 'new' | 'contacted' | 'replied' | 'won' | 'lost'

export type Lead = {
  id: string // `osm:${osmType}/${osmId}` or `demo:N`
  osmType: 'node' | 'way' | 'relation'
  osmId: number
  osmUrl: string
  name: string
  category: string
  categoryId: CategoryId | 'other'
  address: string // '' if unknown
  city?: string
  phone?: string
  email?: string
  website?: string // raw value from OSM
  openingHours?: string
  lat: number
  lon: number
  distanceKm: number // from search centre, 2 decimals
  brand?: string // OSM brand tag
  brandWikidata?: string // OSM brand:wikidata tag
  operator?: string // OSM operator tag
  isChain?: boolean // brand tagged, or the same name appears 3+ times in the results
  isDemo?: boolean
  project?: Project // set for leads from building permits: the lead is the job's general contractor
}

// An active job from a city building permit.
export type Project = {
  permit: string
  city: string
  issued: string // YYYY-MM-DD
  description: string
  address: string // job site, without the city
  workType?: string
  cost?: number // reported cost in USD
  architect?: string
}

export type AuditStatus = 'ok' | 'unreachable' | 'limited' | 'skipped'
export type AuditResult = {
  id: string
  status: AuditStatus
  finalUrl?: string
  httpStatus?: number
  elapsedMs?: number
  gaps: SiteGapId[] // only filled when status === 'ok'
  detail?: Partial<Record<SiteGapId, string>>
  note?: string
  checkedAt: string // ISO
}

export type Gap = { id: GapId; label: string; detail?: string; weight: number }
export type ScoredLead = Lead & {
  audit?: AuditResult
  auditState: 'pending' | 'done' | 'none' // 'none' = no website, nothing to audit
  gaps: Gap[] // sorted by weight desc
  score: number // 0..100 integer
  services: ServiceId[]
  dealValue: { min: number; max: number }
}

export type Sender = { name: string; business: string; email: string; phone: string; address: string; website: string }

// A client profile finds customers for one of your clients and pitches on their behalf.
// The agency profile (no ClientProfile) is the default: it finds businesses that need your services.
export type ClientProfile = {
  id: string
  label: string // shown in the profile switcher, e.g. "Asher Construction"
  offer: string // what the client does, e.g. "drywall, metal framing and acoustic ceilings"
  sellingPoints: string // optional, true facts only, e.g. "Licensed and insured"
  categories: CategoryId[] // the kinds of businesses that buy from the client
  projectKeywords: string[] // permit descriptions to look for, e.g. "DRYWALL"; empty = no project search
  sender: Sender // who signs the client's pitches
}
// Sent with a pitch request when it is written for a client profile.
export type Offer = { services: string; sellingPoints?: string }
export type Pitch = {
  email: { subject: string; body: string }
  sms: string
  phoneOpener: string
  source: 'ai' | 'template'
}
export type SavedLead = {
  lead: Lead
  audit?: AuditResult
  status: LeadStatus
  notes: string
  pitch?: Pitch
  outreachEmail?: string // address to cold-email, overrides the lead's listed email
  savedAt: string
  updatedAt: string
}
export type Filters = { minScore: number; noWebsiteOnly: boolean; hasPhone: boolean; showChains: boolean }

// API contracts (all JSON; errors are { error: string } with 4xx/5xx)
export type SearchRequest = { location: string; category: CategoryId; radiusKm: number; limit: number }
export type SearchResponse = {
  center: { lat: number; lon: number; displayName: string }
  leads: Lead[]
  source: 'overpass' | 'nominatim'
  notice?: string
}
export type AuditRequest = { leads: { id: string; website: string }[] } // 1..10 items
export type AuditResponse = { results: AuditResult[] }
export type PitchRequest = {
  lead: Pick<Lead, 'name' | 'category' | 'city' | 'website'>
  gaps: GapId[]
  services: ServiceId[]
  sender: Sender
  offer?: Offer
  project?: Pick<Project, 'address' | 'description' | 'issued'>
}
export type PitchResponse = Pitch
export type ProjectsRequest = { location: string; radiusKm: number; keywords: string[]; days: number; limit: number }
export type ProjectsResponse = { center: { lat: number; lon: number; displayName: string }; leads: Lead[]; notice?: string }

// ---- Outreach (cold email) ----
export type FollowUp = { delayDays: number; body: string } // delayDays 1..60, counted from the previous step's send time
export type Campaign = { followUps: FollowUp[] } // 0..2 items; step 1 is always the lead's pitch email

export type OutreachEntry = {
  step: number // 0 = pitch email, 1..2 = follow-ups
  sentAt: string // ISO
  subject: string
  via: 'smtp' | 'manual'
  messageId?: string // from SMTP, used for In-Reply-To on follow-ups
}
export type StopReason = 'replied' | 'won' | 'lost' | 'removed' | 'unsubscribed'
export type Enrollment = {
  leadId: string
  email: string // lower-cased, snapshot at enrollment
  enrolledAt: string // ISO; step 0 is due at this time
  nextStep: number // index of the next step to send
  state: 'active' | 'finished' | 'stopped'
  stopReason?: StopReason
  subject?: string // step-0 subject as actually sent; follow-ups use "Re: " + this
  history: OutreachEntry[]
  pendingSend?: { step: number; startedAt: string } // set right before an SMTP call, cleared after
  lastError?: string
  lastErrorAt?: string // ISO
  drafts?: Partial<Record<number, Draft>> // by step: replaces the pitch / follow-up template for that step
}
// A step's wording written by AI or edited by hand. The body never includes the signature or
// opt-out line; those are added fresh when the email is built.
export type Draft = {
  subject?: string // step 0 only; follow-ups always reply to the step-0 subject
  body: string
  source: 'ai' | 'edited'
}
export type FollowUpRequest = {
  lead: Pick<Lead, 'name' | 'category' | 'city'>
  sender: Pick<Sender, 'name' | 'business'>
  step: number // 1 or 2
  previousSubject: string
  previousBody: string // the step-1 email as sent or queued, without the footer
  offer?: Offer
  project?: Pick<Project, 'address' | 'description' | 'issued'>
}
export type FollowUpResponse = { body: string | null } // null = AI not available; use the template
export type OutreachState = {
  campaign: Campaign
  enrollments: Record<string, Enrollment> // by leadId
  suppressed: string[] // lower-cased addresses, unique
  sentToday: { day: string; count: number } // day = local YYYY-MM-DD; SMTP sends only
}
export type Mailbox = {
  host: string
  port: 465 | 587 | 2525
  secure: boolean
  user: string
  pass: string
  fromName: string
  fromAddress: string
  gapSeconds: number // 20..300, default 45
  dailyCap: number // 1..200, default 30
}
export type SendRequest = {
  smtp: { host: string; port: number; secure: boolean; user: string; pass: string }
  from: { name: string; address: string }
  to: string
  subject: string
  text: string
  inReplyTo?: string // "<...>" message id of step 0
  suppressed: string[]
}
export type SendErrorCode = 'invalid' | 'suppressed' | 'host' | 'auth' | 'connection' | 'timeout' | 'rejected' | 'access' | 'unavailable'
export type SendResult = { ok: true; messageId: string } | { ok: false; code: SendErrorCode; error: string }
