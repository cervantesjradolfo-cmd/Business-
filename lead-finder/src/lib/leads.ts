import { distanceKm } from './geo'
import type { Lead } from './types'

function filled(l: Lead): number {
  return [l.address, l.city, l.phone, l.email, l.website, l.openingHours].filter(Boolean).length
}

// Same id, or the same name (lowercased, trimmed) within 50 m: keep the one with more filled fields.
export function dedupeLeads(leads: Lead[]): Lead[] {
  const kept: Lead[] = []
  for (const l of leads) {
    const name = l.name.trim().toLowerCase()
    const i = kept.findIndex(
      (k) => k.id === l.id || (k.name.trim().toLowerCase() === name && distanceKm(k, l) <= 0.05),
    )
    if (i === -1) kept.push(l)
    else if (filled(l) > filled(kept[i])) kept[i] = l
  }
  return kept
}

const normName = (n: string) => n.toLowerCase().replace(/['’]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

// A chain/franchise: tagged with a brand, or the same normalised name shows up 3+ times.
export function markChains(leads: Lead[]): Lead[] {
  const counts = new Map<string, number>()
  for (const l of leads) {
    const n = normName(l.name)
    counts.set(n, (counts.get(n) ?? 0) + 1)
  }
  return leads.map((l) => {
    const chain = !!l.brand?.trim() || !!l.brandWikidata?.trim() || (counts.get(normName(l.name)) ?? 0) >= 3
    return chain ? { ...l, isChain: true } : l
  })
}

export function finalizeLeads(leads: Lead[], limit: number): Lead[] {
  return markChains(dedupeLeads(leads))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
}
