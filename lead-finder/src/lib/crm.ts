// Turns saved leads into CRM records and sends them in batches. Pure helpers plus one sender.
import { syncCrm } from './api'
import { outreachEmailFor } from './outreach'
import type { CrmLead, CrmResult, SavedLead } from './types'

const BATCH = 25

export function crmLeadFor(s: SavedLead): CrmLead {
  const l = s.lead
  const email = outreachEmailFor(s)
  return {
    name: l.name,
    status: s.status,
    ...(email ? { email } : {}),
    ...(l.phone ? { phone: l.phone } : {}),
    ...(l.website ? { website: l.website } : {}),
    ...(l.address ? { address: l.address } : {}),
    ...(l.city ? { city: l.city } : {}),
    category: l.category,
  }
}

type Totals = { sent: number; skipped: number; error?: string }
export type CrmReport = { hubspot?: Totals; ghl?: Totals }

const add = (a: Totals | undefined, b: Totals | undefined): Totals | undefined =>
  !b ? a : { sent: (a?.sent ?? 0) + b.sent, skipped: (a?.skipped ?? 0) + b.skipped, ...(a?.error || b.error ? { error: a?.error || b.error } : {}) }

// Sends all the leads, 25 at a time, and stops at the first error.
export async function sendToCrm(leads: SavedLead[]): Promise<CrmReport> {
  let report: CrmReport = {}
  for (let i = 0; i < leads.length; i += BATCH) {
    const r: CrmResult = await syncCrm(leads.slice(i, i + BATCH).map(crmLeadFor))
    report = { hubspot: add(report.hubspot, r.hubspot), ghl: add(report.ghl, r.ghl) }
    if (r.hubspot?.error || r.ghl?.error) break
  }
  return report
}

export function crmReportText(r: CrmReport): string {
  const part = (name: string, t?: Totals) =>
    !t ? '' : t.error ? `${name}: ${t.error}` : `${name}: ${t.sent} sent${t.skipped ? `, ${t.skipped} skipped (${name === 'HubSpot' ? 'no email' : 'no email or phone'})` : ''}`
  return [part('HubSpot', r.hubspot), part('GoHighLevel', r.ghl)].filter(Boolean).join('. ') || 'Nothing was sent.'
}
