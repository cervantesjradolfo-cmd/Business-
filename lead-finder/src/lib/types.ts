// Shared types for Lead Finder (used by the browser app and the server handlers).

export type CategoryId =
  | 'any' | 'restaurants' | 'cafes' | 'salons' | 'barbers' | 'auto_repair' | 'dentists'
  | 'fitness' | 'trades' | 'cleaning' | 'party_rentals' | 'retail' | 'real_estate'
  | 'law' | 'medical'
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
export type SearchRequest = {
  location: string
  category: CategoryId
  radiusKm: number
  limit: number
  skipOverpass?: boolean // go straight to the Nominatim search; the browser asks Overpass itself
}
export type OverpassDiagnostic = {
  host: string // URL host only, e.g. 'overpass-api.de' (never the full URL or query)
  outcome: 'ok' | 'timeout' | 'http_error' | 'network_error' | 'bad_response'
  status?: number // set only for 'http_error'
  retried?: true // set when the mirror was retried after 429/504
}
export type SearchResponse = {
  center: { lat: number; lon: number; displayName: string }
  leads: Lead[]
  source: 'overpass' | 'nominatim'
  notice?: string
  diagnostics?: OverpassDiagnostic[] // only on source 'nominatim' (Overpass failed)
}
export type AuditRequest = { leads: { id: string; website: string }[] } // 1..10 items
export type AuditResponse = { results: AuditResult[] }
export type PitchRequest = {
  lead: Pick<Lead, 'name' | 'category' | 'city' | 'website'>
  gaps: GapId[]
  services: ServiceId[]
  sender: Sender
}
export type PitchResponse = Pitch
