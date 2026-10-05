import type { Filters, ScoredLead } from './types'

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
