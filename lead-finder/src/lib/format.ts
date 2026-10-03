import type { Lead, ScoredLead } from './types'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export const formatUsd = (n: number): string => usd.format(n)

export function formatRange(r: { min: number; max: number }): string {
  return `${formatUsd(r.min)}–${formatUsd(r.max)}`
}

// Strip the scoring fields so only the plain Lead snapshot is stored.
export function toLead(s: ScoredLead): Lead {
  const { audit: _a, auditState: _s, gaps: _g, score: _c, services: _v, dealValue: _d, ...lead } = s
  void [_a, _s, _g, _c, _v, _d]
  return lead
}
