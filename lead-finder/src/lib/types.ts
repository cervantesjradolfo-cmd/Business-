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
}
export type PitchResponse = Pitch
