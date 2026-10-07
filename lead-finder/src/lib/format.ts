import type { Lead, ScoredLead } from './types'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export const formatUsd = (n: number): string => usd.format(n)

// Distances are kept in km (OpenStreetMap and the APIs use metres) and shown in miles.
export const KM_PER_MILE = 1.609344
export const kmToMiles = (km: number): number => km / KM_PER_MILE
export const formatMiles = (km: number): string => `${kmToMiles(km).toFixed(1)} mi`

// 44919084 -> "$44.9M", 650000 -> "$650K", 8456 -> "$8,456"
export function formatCost(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`
  if (n >= 1e5) return `$${Math.round(n / 1e3)}K`
  return formatUsd(n)
}

// "2026-10-06" -> "Oct 6, 2026"
export function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export function formatRange(r: { min: number; max: number }): string {
  return `${formatUsd(r.min)}–${formatUsd(r.max)}`
}

// Strip the scoring fields so only the plain Lead snapshot is stored.
export function toLead(s: ScoredLead): Lead {
  const { audit: _a, auditState: _s, gaps: _g, score: _c, services: _v, dealValue: _d, ...lead } = s
  void [_a, _s, _g, _c, _v, _d]
  return lead
}
