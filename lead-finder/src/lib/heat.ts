// Heat: how good a moment it is to reach out, from 1 (no sign) to 5 (strong signs), with the reasons.
// The score says how much a business needs you; heat says whether something is happening right now.
// Pure helpers: the website signals are read during the audit, the rest comes from the lead.
import type { AuditSignal, ScoredLead } from './types.js'

export type HeatReason = { label: string; points: number }
export type Heat = { heat: number; reasons: HeatReason[] }

export const HOT_HEAT = 4 // "heat 4+" filters
const DAY_MS = 86_400_000

// Signals on a homepage. Hiring and a new opening mean a business that is growing and spending;
// a placeholder page means they know they need a website.
export function detectSignals(html: string): AuditSignal[] {
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').toLowerCase()
  const out: AuditSignal[] = []
  if (/\b(now hiring|we('| a)re hiring|join our team|career opportunities|apply (now|today) to join|help wanted|open positions)\b/.test(text)) out.push('hiring')
  if (/\b(grand opening|now open|newly opened|just opened|opening soon|coming soon to)\b/.test(text)) out.push('new_opening')
  if (text.trim().length < 2000 && /\b(under construction|website coming soon|site coming soon|launching soon|this domain (is|may be) for sale|parked free|future home of)\b/.test(text)) out.push('placeholder_site')
  return out
}

// OSM start_date / opening_date values like "2026", "2026-03" or "2026-03-14".
export function parseStartDate(v: string | undefined): string | undefined {
  const s = (v ?? '').trim()
  return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(s) ? s : undefined
}

const daysSince = (date: string, now: Date) => (now.getTime() - new Date(date.length === 4 ? `${date}-07-01` : date.length === 7 ? `${date}-15` : date).getTime()) / DAY_MS

export function heatFor(lead: Pick<ScoredLead, 'project' | 'audit' | 'gaps' | 'reviews' | 'startDate'>, now: Date = new Date()): Heat {
  const reasons: HeatReason[] = []
  const p = lead.project
  if (p?.issued) {
    const age = daysSince(p.issued, now)
    if (age <= 14) reasons.push({ label: `Permit issued ${Math.max(0, Math.round(age))} days ago`, points: 3 })
    else if (age <= 45) reasons.push({ label: `Permit issued ${Math.round(age)} days ago`, points: 2 })
    if ((p.cost ?? 0) >= 250_000) reasons.push({ label: 'Large job (reported cost $250k+)', points: 1 })
  }
  const signals = lead.audit?.signals ?? []
  if (signals.includes('hiring')) reasons.push({ label: 'Hiring (says so on their website)', points: 2 })
  if (signals.includes('new_opening')) reasons.push({ label: 'Newly opened or opening soon (website)', points: 2 })
  if (signals.includes('placeholder_site')) reasons.push({ label: 'Website is a "coming soon" or placeholder page', points: 2 })
  if (lead.startDate && daysSince(lead.startDate, now) <= 365 && daysSince(lead.startDate, now) >= -180) {
    reasons.push({ label: `Opened recently (map listing: ${lead.startDate})`, points: 2 })
  }
  if (lead.gaps.some((g) => g.id === 'site_unreachable')) reasons.push({ label: 'Website is down or broken right now', points: 2 })
  const r = lead.reviews
  if (r?.rating !== undefined && (r.count ?? 0) >= 5 && r.rating < 4) reasons.push({ label: `Google rating ${r.rating.toFixed(1)} from ${r.count} reviews`, points: 2 })
  else if (r?.count !== undefined && r.count < 15) reasons.push({ label: `Only ${r.count} Google reviews`, points: 1 })
  reasons.sort((a, b) => b.points - a.points)
  const points = reasons.reduce((n, x) => n + x.points, 0)
  return { heat: Math.max(1, Math.min(5, 1 + points)), reasons }
}

