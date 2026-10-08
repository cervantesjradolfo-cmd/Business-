import { PRICING } from '../data/pricing'
import { kmToMiles } from './format'
import type { LeadStatus, SavedLead, ScoredLead } from './types'

function cell(v: string | number | undefined): string {
  let s = v === undefined ? '' : String(v)
  if (/^[=@\t\r]/.test(s) || /^[+-][^\d\s]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

export function toCsv(rows: (string | number | undefined)[][]): string {
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n')
}

const miles = (km: number) => Math.round(kmToMiles(km) * 100) / 100

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  replied: 'Replied',
  won: 'Won',
  lost: 'Lost',
}

const HEADER = [
  'Name', 'Category', 'Score', 'Gaps', 'Recommended services', 'Deal min USD', 'Deal max USD', 'Phone', 'Email',
  'Website', 'Address', 'Opening hours', 'Distance mi', 'Latitude', 'Longitude', 'OpenStreetMap', 'Status', 'Notes',
]

// Client profiles don't sell websites, so their export leaves out score, gaps and deal value.
const CLIENT_HEADER = [
  'Name', 'Category', 'Phone', 'Email', 'Website', 'Address', 'Opening hours', 'Distance mi', 'Latitude', 'Longitude',
  'OpenStreetMap', 'Project', 'Permit', 'Permit issued', 'Reported cost USD', 'Status', 'Notes',
]

export function leadsToCsv(leads: ScoredLead[], saved: Record<string, SavedLead>, client = false): string {
  const rows: (string | number | undefined)[][] = [client ? CLIENT_HEADER : HEADER]
  for (const l of leads) {
    const s = saved[l.id]
    if (client) {
      rows.push([
        l.name, l.category, l.phone, l.email, l.website, l.address, l.openingHours,
        miles(l.distanceKm), l.lat, l.lon, l.osmUrl, l.project?.description, l.project?.permit, l.project?.issued, l.project?.cost,
        STATUS_LABELS[s?.status ?? 'new'], s?.notes ?? '',
      ])
      continue
    }
    rows.push([
      l.name, l.category, l.score,
      l.gaps.map((g) => g.label).join('; '),
      l.services.map((x) => PRICING[x].label).join('; '),
      l.dealValue.min, l.dealValue.max,
      l.phone, l.email, l.website, l.address, l.openingHours,
      miles(l.distanceKm), l.lat, l.lon, l.osmUrl,
      STATUS_LABELS[s?.status ?? 'new'],
      s?.notes ?? '',
    ])
  }
  return toCsv(rows)
}

export function csvFilename(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `leads-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.csv`
}
