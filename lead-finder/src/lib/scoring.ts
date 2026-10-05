import { PRICING } from '../data/pricing'
import { GAP_DEFS, listingGaps } from './gaps'
import type { AuditResult, Gap, GapId, Lead, ScoredLead, ServiceId } from './types'

export function recommendServices(gaps: GapId[]): ServiceId[] {
  const sorted = [...gaps].filter((g) => GAP_DEFS[g]).sort((a, b) => GAP_DEFS[b].weight - GAP_DEFS[a].weight)
  const out: ServiceId[] = []
  for (const g of sorted) for (const s of GAP_DEFS[g].services) if (!out.includes(s)) out.push(s)
  return out.includes('website') ? out.filter((s) => s !== 'mobile_redesign') : out
}

export function dealValue(services: ServiceId[]): { min: number; max: number } {
  let min = 0
  let max = 0
  for (const s of services) {
    min += PRICING[s].min
    max += PRICING[s].max
  }
  return { min, max }
}

export function scoreTier(score: number): 'hot' | 'warm' | 'cool' {
  return score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'cool'
}

export function scoreLead(lead: Lead, audit?: AuditResult, pending = false): ScoredLead {
  const ids: GapId[] = listingGaps(lead)
  if (audit?.status === 'ok') ids.push(...audit.gaps)
  if (audit?.status === 'unreachable') ids.push('site_unreachable')
  const gaps: Gap[] = ids
    .map((id) => {
      const def = GAP_DEFS[id]
      const detail = id === 'site_unreachable' ? audit?.note : audit?.detail?.[id as keyof NonNullable<AuditResult['detail']>]
      return { id, label: def.label, weight: def.weight, ...(detail ? { detail } : {}) }
    })
    .sort((a, b) => b.weight - a.weight)
  const score = Math.min(100, gaps.reduce((n, g) => n + g.weight, 0))
  const services = recommendServices(ids)
  return {
    ...lead,
    audit,
    auditState: !lead.website?.trim() ? 'none' : pending ? 'pending' : 'done',
    gaps,
    score,
    services,
    dealValue: dealValue(services),
  }
}
