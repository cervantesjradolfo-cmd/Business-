import type { Filters, Lead, ScoredLead } from './types'

// How many ways there are to reach a business: phone, email, website.
export const contactCount = (l: Pick<Lead, 'phone' | 'email' | 'website'>): number =>
  [l.phone, l.email, l.website].filter((v) => !!v?.trim()).length

// For client profiles: easiest to reach first, then nearest.
export function sortByContact(leads: ScoredLead[]): ScoredLead[] {
  return [...leads].sort(
    (a, b) => contactCount(b) - contactCount(a) || a.distanceKm - b.distanceKm || a.name.localeCompare(b.name),
  )
}

export function sortLeads(leads: ScoredLead[]): ScoredLead[] {
  return [...leads].sort(
    (a, b) => b.score - a.score || a.distanceKm - b.distanceKm || a.name.localeCompare(b.name),
  )
}

export function applyFilters(leads: ScoredLead[], f: Filters): ScoredLead[] {
  return leads.filter(
    (l) =>
      l.score >= f.minScore &&
      (f.showChains || !l.isChain) &&
      (!f.noWebsiteOnly || l.gaps.some((g) => g.id === 'no_website')) &&
      (!f.hasPhone || !!l.phone?.trim()),
  )
}
