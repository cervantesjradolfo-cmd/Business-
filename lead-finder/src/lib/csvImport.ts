// CSV import: reads a spreadsheet export, guesses which column is which, and turns rows into leads.
// Pure helpers, no React.
import { isEmail } from './validate'
import type { Lead } from './types'

export const IMPORT_FIELDS = ['name', 'email', 'website', 'phone', 'address', 'city', 'category', 'notes'] as const
export type ImportField = (typeof IMPORT_FIELDS)[number]
export type ColumnMap = Record<ImportField, number> // column index, -1 = not in the file

export const FIELD_LABELS: Record<ImportField, string> = {
  name: 'Business name', email: 'Email', website: 'Website', phone: 'Phone', address: 'Address', city: 'City', category: 'Category', notes: 'Notes',
}
export const MAX_IMPORT_ROWS = 2000

// RFC 4180 CSV with quoted fields; the delimiter (comma, semicolon or tab) is taken from the first line.
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const firstLine = src.slice(0, src.search(/\r?\n|$/))
  const counts = [',', ';', '\t'].map((d) => ({ d, n: firstLine.split(d).length }))
  const delim = counts.sort((a, b) => b.n - a.n)[0].d
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"' && field === '') quoted = true
    else if (c === delim) {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.map((r) => r.map((v) => v.trim())).filter((r) => r.some((v) => v !== ''))
}

const GUESSES: Record<ImportField, RegExp> = {
  name: /^(business|company|organi[sz]ation|account|name|business name|company name|lead|title)$/i,
  email: /e-?mail/i,
  website: /web|site|url|domain/i,
  phone: /phone|tel|mobile|cell/i,
  address: /address|street/i,
  city: /^(city|town|locality)$/i,
  category: /categor|industry|type|niche|vertical/i,
  notes: /note|comment/i,
}

// Matches header names to fields. A plain "name" column counts as the business name only when there is no company column.
export function guessColumns(header: string[]): ColumnMap {
  const map = Object.fromEntries(IMPORT_FIELDS.map((f) => [f, -1])) as ColumnMap
  const used = new Set<number>()
  const pick = (f: ImportField, test: (h: string) => boolean) => {
    const i = header.findIndex((h, j) => !used.has(j) && test(h.trim()))
    if (i >= 0) {
      map[f] = i
      used.add(i)
    }
  }
  pick('name', (h) => /company|business|organi[sz]ation|account/i.test(h) && !/e-?mail|web|phone|address|id$/i.test(h))
  if (map.name < 0) pick('name', (h) => GUESSES.name.test(h))
  for (const f of IMPORT_FIELDS) if (map[f] < 0) pick(f, (h) => GUESSES[f].test(h))
  return map
}

// Stable id, so importing the same list twice updates the same leads.
function importId(name: string, email: string, website: string): string {
  const key = `${name}|${email}|${website}`.toLowerCase()
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return `csv:${(h >>> 0).toString(36)}`
}

export type ImportedRow = { lead: Lead; notes: string }
export type ImportResult = { rows: ImportedRow[]; skipped: number }

// Rows to leads. A row without a business name is skipped. The first row is the header.
export function rowsToLeads(rows: string[][], map: ColumnMap): ImportResult {
  const out: ImportedRow[] = []
  const seen = new Set<string>()
  let skipped = 0
  for (const r of rows.slice(1, MAX_IMPORT_ROWS + 1)) {
    const get = (f: ImportField) => (map[f] >= 0 ? (r[map[f]] ?? '').trim() : '')
    const name = get('name').slice(0, 200)
    if (!name) {
      skipped++
      continue
    }
    const rawEmail = get('email').split(/[;,\s]/)[0].replace(/^mailto:/i, '')
    const email = isEmail(rawEmail) ? rawEmail.toLowerCase() : ''
    const website = get('website').slice(0, 300)
    const id = importId(name, email, website)
    if (seen.has(id)) continue
    seen.add(id)
    out.push({
      lead: {
        id, osmType: 'node', osmId: 0, osmUrl: '', imported: true,
        name, category: get('category').slice(0, 100) || 'Imported lead', categoryId: 'other',
        address: get('address').slice(0, 300), lat: 0, lon: 0, distanceKm: 0,
        ...(get('city') ? { city: get('city').slice(0, 100) } : {}),
        ...(get('phone') ? { phone: get('phone').slice(0, 50) } : {}),
        ...(email ? { email } : {}),
        ...(website ? { website } : {}),
      },
      notes: get('notes').slice(0, 2000),
    })
  }
  return { rows: out, skipped }
}
