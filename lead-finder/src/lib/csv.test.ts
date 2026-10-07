import { describe, expect, it } from 'vitest'
import { csvFilename, leadsToCsv, toCsv } from './csv'
import { scoreLead } from './scoring'
import type { Lead, SavedLead } from './types'

describe('toCsv', () => {
  it('quotes, escapes and uses CRLF with a BOM', () => {
    const out = toCsv([['a"b', 'x\ny'], [1, undefined]])
    expect(out).toBe('﻿"a""b","x\ny"\r\n"1",""')
  })
  it('guards formulas but keeps phone numbers', () => {
    const out = toCsv([['=SUM(A1)', '@x', '+cmd', '-cmd', '+1 555-0100', '-5', '\tx']])
    expect(out).toContain('"\'=SUM(A1)"')
    expect(out).toContain('"\'@x"')
    expect(out).toContain('"\'+cmd"')
    expect(out).toContain('"\'-cmd"')
    expect(out).toContain('"+1 555-0100"')
    expect(out).toContain('"-5"')
    expect(out).toContain('"\'\tx"')
  })
})

describe('leadsToCsv', () => {
  const lead: Lead = { id: 'a', osmType: 'node', osmId: 1, osmUrl: 'u', name: 'Foo', category: 'Cafe', categoryId: 'cafes', address: '1 St', lat: 1, lon: 2, distanceKm: 0.5 }
  it('writes a header, status and notes', () => {
    const s = scoreLead(lead)
    const saved: Record<string, SavedLead> = { a: { lead, status: 'won', notes: 'hi', savedAt: '', updatedAt: '' } }
    const lines = leadsToCsv([s], saved).split('\r\n')
    expect(lines[0]).toContain('"Name","Category","Score"')
    expect(lines[1]).toContain('"Foo"')
    expect(lines[1]).toContain('"Won","hi"')
    expect(leadsToCsv([s], {})).toContain('"New",""')
  })
  it('leaves score, gaps and deal value out for a client profile', () => {
    const s = scoreLead({ ...lead, phone: '+1 555-0100' })
    const lines = leadsToCsv([s], { a: { lead, status: 'contacted', notes: 'call back', savedAt: '', updatedAt: '' } }, true).split('\r\n')
    expect(lines[0]).toBe('\ufeff"Name","Category","Phone","Email","Website","Address","Opening hours","Distance km","Latitude","Longitude","OpenStreetMap","Project","Permit","Permit issued","Reported cost USD","Status","Notes"')
    expect(lines[1]).toBe('"Foo","Cafe","+1 555-0100","","","1 St","","0.5","1","2","u","","","","","Contacted","call back"')
    const job = scoreLead({ ...lead, project: { permit: 'B1', city: 'Chicago', issued: '2026-10-06', description: 'Interior alterations', address: '225 W Randolph St', cost: 44919084 } })
    expect(leadsToCsv([job], {}, true).split('\r\n')[1]).toContain('"Interior alterations","B1","2026-10-06","44919084","New"')
  })
  it('names the file by date', () => {
    expect(csvFilename(new Date(2026, 0, 5))).toBe('leads-2026-01-05.csv')
  })
})
