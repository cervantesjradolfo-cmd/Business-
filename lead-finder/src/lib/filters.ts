import { HOT_HEAT } from './heat'
import type { Filters, Lead, ScoredLead } from './types'

// How many ways there are to reach a business: phone, email (listed or found on their website), website.
export const contactCount = (l: Pick<Lead, 'phone' | 'email' | 'website'> & Partial<Pick<ScoredLead, 'audit'>>): number =>
  [l.phone, l.email || l.audit?.emails?.[0], l.website].filter((v) => !!v?.trim()).length

// For client profiles: projects newest and biggest first, then businesses easiest to reach, then nearest.
export function sortByContact(leads: ScoredLead[]): ScoredLead[] {
  const issued = (l: ScoredLead) => l.project?.issued ?? ''
  return [...leads].sort(
    (a, b) =>
      issued(b).localeCompare(issued(a)) ||
      (b.project?.cost ?? 0) - (a.project?.cost ?? 0) ||
      contactCount(b) - contactCount(a) ||
      a.distanceKm - b.distanceKm ||
      a.name.localeCompare(b.name),
  )
}

// Hottest first, keeping the given order among leads with the same heat.
export function sortByHeat(leads: ScoredLead[]): ScoredLead[] {
  return leads.map((l, i) => ({ l, i })).sort((a, b) => b.l.heat - a.l.heat || a.i - b.i).map((x) => x.l)
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
      (!f.hasPhone || !!l.phone?.trim()) &&
      (!f.hotOnly || l.heat >= HOT_HEAT) &&
      (!f.niche || l.categoryId === f.niche),
  )
}
