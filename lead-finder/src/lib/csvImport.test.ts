import { describe, expect, it } from 'vitest'
import { guessColumns, parseCsv, rowsToLeads } from './csvImport'

describe('parseCsv', () => {
  it('reads quoted fields with commas, quotes and line breaks, CRLF and a BOM', () => {
    const text = '﻿Company,Notes\r\n"Acme, Inc.","said ""call me""\nlater"\r\nBeta Co,\r\n\r\n'
    expect(parseCsv(text)).toEqual([['Company', 'Notes'], ['Acme, Inc.', 'said "call me"\nlater'], ['Beta Co', '']])
  })
  it('detects semicolon and tab delimiters', () => {
    expect(parseCsv('Name;Email\nA;a@x.example.com')).toEqual([['Name', 'Email'], ['A', 'a@x.example.com']])
    expect(parseCsv('Name\tEmail\nA\ta@x.example.com')).toEqual([['Name', 'Email'], ['A', 'a@x.example.com']])
  })
})

describe('guessColumns', () => {
  it('maps common header names', () => {
    expect(guessColumns(['Company Name', 'Contact Name', 'Email Address', 'Website URL', 'Phone Number', 'Street Address', 'City', 'Industry', 'Notes']))
      .toEqual({ name: 0, email: 2, website: 3, phone: 4, address: 5, city: 6, category: 7, notes: 8 })
  })
  it('uses a plain Name column when there is no company column, and leaves missing fields out', () => {
    expect(guessColumns(['Name', 'E-mail'])).toMatchObject({ name: 0, email: 1, website: -1, phone: -1 })
  })
})

describe('rowsToLeads', () => {
  const rows = [
    ['Company', 'Email', 'Website', 'City'],
    ['Corner Cafe', 'Owner@Corner.example.com', 'cornercafe.example.com', 'Austin'],
    ['', 'nobody@x.example.com', '', ''],
    ['Bad Email Co', 'not-an-email', '', ''],
    ['Corner Cafe', 'owner@corner.example.com', 'cornercafe.example.com', 'Austin'],
  ]
  const map = guessColumns(rows[0])
  it('makes imported leads, skips rows without a name and repeated rows, and drops invalid emails', () => {
    const r = rowsToLeads(rows, map)
    expect(r.skipped).toBe(1)
    expect(r.rows.map((x) => x.lead.name)).toEqual(['Corner Cafe', 'Bad Email Co'])
    expect(r.rows[0].lead).toMatchObject({ imported: true, email: 'owner@corner.example.com', website: 'cornercafe.example.com', city: 'Austin', category: 'Imported lead', categoryId: 'other', osmUrl: '' })
    expect(r.rows[1].lead.email).toBeUndefined()
    expect(r.rows[0].lead.id).toMatch(/^csv:/)
  })
  it('gives the same id on a second import of the same file', () => {
    expect(rowsToLeads(rows, map).rows[0].lead.id).toBe(rowsToLeads(rows, map).rows[0].lead.id)
  })
})
